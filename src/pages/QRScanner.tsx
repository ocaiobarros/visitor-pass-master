import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useVisitorByPassId, useUpdateVisitorStatus } from '@/hooks/useVisitors';
import { useCredentialByQrId } from '@/hooks/useEmployeeCredentials';
import { useScanFeedback } from '@/hooks/useScanFeedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { QrCode, AlertTriangle, Car, User, Building2, Clock, ArrowDownLeft, ArrowUpRight, Camera, Maximize, Ban } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Visitor, EmployeeCredential, AccessDirection } from '@/types/visitor';
import { supabase } from '@/integrations/supabase/client';
import CameraScannerModal from '@/components/CameraScannerModal';
import { logAuditAction } from '@/hooks/useAuditLogs';

// ============================================
// GLOBAL STATE: Anti-duplicação por janela de tempo
// ============================================
const scanTimestamps: Map<string, number> = new Map();
const ANTI_DUP_WINDOW_MS = 10000; // 10 segundos conforme especificação

// ============================================
// TIPOS
// ============================================
type ScanAction = 'in' | 'out' | 'blocked' | 'expired' | 'closed' | 'duplicate' | 'expired_unused' | 'waiting_second_qr' | 'session_completed' | 'session_denied';

type ScanResult = {
  type: 'visitor';
  data: Visitor;
  action: ScanAction;
  sessionInfo?: { waitingFor: string; expiresIn: number };
} | {
  type: 'employee';
  data: EmployeeCredential;
  action: ScanAction;
  sessionInfo?: { waitingFor: string; expiresIn: number };
} | null;

interface RecentLog {
  id: string;
  direction: AccessDirection;
  createdAt: Date;
}

// ============================================
// COMPONENTE: Item de Log Recente
// ============================================
const LogItem = ({ log }: { log: RecentLog }) => (
  <div className="flex items-center gap-3 py-2 px-3 bg-muted/50 rounded-lg text-sm">
    {log.direction === 'in' ? (
      <ArrowDownLeft className="w-4 h-4 text-success shrink-0" />
    ) : (
      <ArrowUpRight className="w-4 h-4 text-destructive shrink-0" />
    )}
    <span className="font-medium">
      {log.direction === 'in' ? 'Entrada' : 'Saída'}
    </span>
    <span className="text-muted-foreground ml-auto">
      {format(log.createdAt, "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
    </span>
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================
const QRScanner = () => {
  const [qrCode, setQrCode] = useState('');
  const [searchCode, setSearchCode] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const autoResetTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const processingRef = useRef(false); // Mutex local
  
  const { toast } = useToast();
  const { playSuccess, playError, playBlocked } = useScanFeedback();
  const updateVisitorStatus = useUpdateVisitorStatus();

  // Queries
  const { data: visitor, isLoading: loadingVisitor } = useVisitorByPassId(
    searchCode.startsWith('VP-') ? searchCode : ''
  );
  const { data: credential, isLoading: loadingCredential } = useCredentialByQrId(
    searchCode.startsWith('EC-') ? searchCode : ''
  );

  // Auto-focus
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, [scanResult, scanError]);

  // ============================================
  // FUNÇÕES AUXILIARES
  // ============================================
  
  const clearScan = useCallback(() => {
    if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current);
    setQrCode('');
    setSearchCode('');
    setScanResult(null);
    setScanError(null);
    setIsProcessing(false);
    setRecentLogs([]);
    processingRef.current = false;
    inputRef.current?.focus();
  }, []);

  const scheduleReset = useCallback((ms = 3000) => {
    if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current);
    autoResetTimerRef.current = setTimeout(clearScan, ms);
  }, [clearScan]);

  const fetchRecentLogs = async (subjectType: 'visitor' | 'employee', subjectId: string) => {
    const { data } = await supabase
      .from('access_logs')
      .select('id, direction, created_at')
      .eq('subject_type', subjectType)
      .eq('subject_id', subjectId)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (data) {
      setRecentLogs(data.map(r => ({
        id: r.id,
        direction: r.direction as AccessDirection,
        createdAt: new Date(r.created_at),
      })));
    }
  };

  // ============================================
  // TOGGLE DETERMINÍSTICO: Lógica Server-First
  // ============================================
  
  /**
   * Executa o toggle determinístico:
   * 1. Busca último log do subject
   * 2. Verifica janela anti-duplicação (10s)
   * 3. Calcula próxima direção
   * 4. Insere novo log
   */
  const executeToggle = async (
    subjectType: 'visitor' | 'employee',
    subjectId: string
  ): Promise<{ success: boolean; direction: AccessDirection; reason?: string }> => {
    
    // STEP 1: Buscar último log do subject
    const { data: lastLog, error: fetchError } = await supabase
      .from('access_logs')
      .select('id, direction, created_at')
      .eq('subject_type', subjectType)
      .eq('subject_id', subjectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('[TOGGLE] Erro ao buscar último log:', fetchError);
      return { success: false, direction: 'in', reason: fetchError.message };
    }

    // STEP 2: Anti-duplicação por janela de tempo (10 segundos)
    const now = Date.now();
    if (lastLog) {
      const lastTime = new Date(lastLog.created_at).getTime();
      const elapsed = now - lastTime;
      
      if (elapsed < ANTI_DUP_WINDOW_MS) {
        console.log(`[TOGGLE] Anti-dup: ${elapsed}ms < ${ANTI_DUP_WINDOW_MS}ms, rejeitando`);
        return { 
          success: false, 
          direction: lastLog.direction as AccessDirection, 
          reason: 'duplicate' 
        };
      }
    }

    // Verificação secundária com Map local (para bips muito rápidos)
    const lastLocalScan = scanTimestamps.get(subjectId);
    if (lastLocalScan && (now - lastLocalScan) < ANTI_DUP_WINDOW_MS) {
      console.log('[TOGGLE] Anti-dup local ativado');
      return { success: false, direction: 'in', reason: 'duplicate' };
    }

    // STEP 3: Determinar próxima direção
    // Se último foi 'in' → próximo DEVE ser 'out'
    // Se último foi 'out' ou não existe → próximo DEVE ser 'in'
    const nextDirection: AccessDirection = lastLog?.direction === 'in' ? 'out' : 'in';
    
    console.log(`[TOGGLE] Último: ${lastLog?.direction || 'nenhum'} → Próximo: ${nextDirection}`);

    // STEP 4: Inserir novo log
    const { data: user } = await supabase.auth.getUser();
    
    const { error: insertError } = await supabase
      .from('access_logs')
      .insert({
        subject_type: subjectType,
        subject_id: subjectId,
        direction: nextDirection,
        gate_id: 'GUARITA_01',
        operator_id: user.user?.id || null,
      });

    if (insertError) {
      console.error('[TOGGLE] Erro ao inserir log:', insertError);
      return { success: false, direction: nextDirection, reason: insertError.message };
    }

    // Registrar timestamp local para anti-dup
    scanTimestamps.set(subjectId, now);
    
    console.log(`[TOGGLE] Sucesso: ${nextDirection} registrado para ${subjectId}`);
    return { success: true, direction: nextDirection };
  };

  // ============================================
  // CONSULTA DIRETA AO BANCO (Bypass Cache)
  // Garante reflexo instantâneo de bloqueio
  // ============================================
  
  const fetchFreshVisitor = async (passId: string): Promise<Visitor | null> => {
    const { data, error } = await supabase
      .from('visitors')
      .select('*')
      .eq('pass_id', passId)
      .maybeSingle();
    
    if (error || !data) return null;
    
    return {
      id: data.id,
      passId: data.pass_id,
      fullName: data.full_name,
      document: data.document,
      companyId: data.company_id,
      companyName: null,
      phone: data.phone,
      photoUrl: data.photo_url,
      visitToType: data.visit_to_type,
      visitToName: data.visit_to_name,
      gateObs: data.gate_obs,
      companyReason: data.company_reason || '',
      accessType: data.access_type || 'pedestrian',
      vehiclePassId: data.vehicle_pass_id,
      vehiclePlate: data.vehicle_plate,
      vehicleBrand: data.vehicle_brand,
      vehicleModel: data.vehicle_model,
      vehicleColor: data.vehicle_color,
      validFrom: new Date(data.valid_from),
      validUntil: new Date(data.valid_until),
      status: data.status,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  };

  const fetchFreshCredential = async (credentialId: string): Promise<EmployeeCredential | null> => {
    const { data, error } = await supabase
      .from('employee_credentials')
      .select('*, departments(id, name)')
      .eq('credential_id', credentialId)
      .maybeSingle();
    
    if (error || !data) return null;
    
    return {
      id: data.id,
      credentialId: data.credential_id,
      type: data.type,
      fullName: data.full_name,
      document: data.document,
      departmentId: data.department_id,
      department: data.departments ? { id: data.departments.id, name: data.departments.name } : undefined,
      jobTitle: data.job_title,
      photoUrl: data.photo_url,
      vehicleMakeModel: data.vehicle_make_model,
      vehiclePlate: data.vehicle_plate,
      status: data.status,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  };

  // Para veículos: buscar dados do proprietário pelo documento
  const fetchOwnerByDocument = async (document: string): Promise<{ jobTitle?: string; department?: { id: string; name: string } } | null> => {
    const { data: credential } = await supabase
      .from('employee_credentials')
      .select('job_title, departments(id, name)')
      .eq('document', document)
      .eq('type', 'personal')
      .maybeSingle();
    
    if (credential) {
      return {
        jobTitle: credential.job_title || undefined,
        department: credential.departments ? { id: credential.departments.id, name: credential.departments.name } : undefined,
      };
    }
    return null;
  };

  // ============================================
  // SESSION HELPERS
  // ============================================

  const findPendingVisitorSession = async (visitorId: string) => {
    const { data } = await supabase
      .from('access_sessions')
      .select('*')
      .eq('visitor_id', visitorId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  };

  const findPendingVehicleSession = async (vehicleCredentialId: string) => {
    const { data } = await supabase
      .from('access_sessions')
      .select('*')
      .eq('vehicle_credential_id', vehicleCredentialId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  };

  const checkAuthorizedDriver = async (vehicleCredentialId: string, driverCredentialId: string | null, associateId: string | null): Promise<{ authorized: true; authorization_type: string; driver_type: string; driverName?: string } | { authorized: false; denial_reason: string }> => {
    // Use separate queries to avoid PostgREST FK ambiguity (PGRST201)
    let query = supabase
      .from('vehicle_authorized_drivers')
      .select('*')
      .eq('vehicle_credential_id', vehicleCredentialId)
      .eq('is_active', true);

    if (driverCredentialId) {
      query = query.eq('employee_credential_id', driverCredentialId);
    } else if (associateId) {
      query = query.eq('associate_id', associateId);
    } else {
      return { authorized: false, denial_reason: 'Condutor não identificado' };
    }

    const { data } = await query.maybeSingle();
    if (!data) return { authorized: false, denial_reason: 'Condutor não autorizado para este veículo' };

    // Fetch related data separately
    let driverName: string | undefined;

    if (data.driver_type === 'employee' && data.employee_credential_id) {
      const { data: emp } = await supabase
        .from('employee_credentials')
        .select('full_name, status')
        .eq('id', data.employee_credential_id)
        .maybeSingle();
      if (emp?.status === 'blocked') {
        return { authorized: false, denial_reason: `Colaborador ${emp.full_name} está bloqueado` };
      }
      driverName = emp?.full_name;
    }

    if (data.driver_type === 'associate' && data.associate_id) {
      const { data: assoc } = await supabase
        .from('associates')
        .select('full_name, status, employee_credential_id')
        .eq('id', data.associate_id)
        .maybeSingle();
      if (assoc?.status === 'suspended') {
        return { authorized: false, denial_reason: `Agregado ${assoc.full_name} está suspenso` };
      }
      if (assoc?.status === 'expired') {
        return { authorized: false, denial_reason: `Agregado ${assoc.full_name} está expirado` };
      }
      if (assoc?.status !== 'active') {
        return { authorized: false, denial_reason: `Agregado ${assoc.full_name} não está ativo` };
      }
      driverName = assoc?.full_name;
      // Check responsible employee
      if (assoc?.employee_credential_id) {
        const { data: empCred } = await supabase
          .from('employee_credentials')
          .select('status, full_name')
          .eq('id', assoc.employee_credential_id)
          .maybeSingle();
        if (empCred?.status === 'blocked') {
          return { authorized: false, denial_reason: `Responsável ${empCred.full_name} está bloqueado` };
        }
      }
    }

    // Check validity period
    if (data.valid_from && new Date(data.valid_from) > new Date()) {
      return { authorized: false, denial_reason: 'Autorização ainda não válida' };
    }
    if (data.valid_until && new Date(data.valid_until) < new Date()) {
      return { authorized: false, denial_reason: 'Autorização vencida' };
    }

    return {
      authorized: true,
      authorization_type: data.authorization_type,
      driver_type: data.driver_type,
      driverName,
    };
  };

  // ============================================
  // PROCESSAMENTO PRINCIPAL
  // ============================================
  
  useEffect(() => {
    if (!searchCode) return;
    if (processingRef.current) return;

    const process = async () => {
      if (processingRef.current) return;
      processingRef.current = true;
      setIsProcessing(true);

      try {
        const { data: user } = await supabase.auth.getUser();
        const operatorId = user.user?.id || null;

        // =============== VISITANTE PESSOAL (VP-) ===============
        if (searchCode.startsWith('VP-')) {
          const freshVisitor = await fetchFreshVisitor(searchCode);
          
          if (!freshVisitor) {
            playError();
            setScanError(`Passe ${searchCode} não encontrado`);
            scheduleReset(3000);
            return;
          }

          await fetchRecentLogs('visitor', freshVisitor.id);

          // Status checks
          if (freshVisitor.status === 'closed' || freshVisitor.status === 'expired_unused') {
            playBlocked();
            const action = freshVisitor.status === 'expired_unused' ? 'expired_unused' : 'closed';
            setScanResult({ type: 'visitor', data: freshVisitor, action });
            logAuditAction('ACCESS_SCAN', { subject_type: 'visitor', subject_id: freshVisitor.id, result: 'DENIED', reason: freshVisitor.status });
            scheduleReset(4000);
            return;
          }

          if (new Date() < new Date(freshVisitor.validFrom)) {
            playBlocked();
            setScanResult({ type: 'visitor', data: freshVisitor, action: 'blocked' });
            logAuditAction('ACCESS_SCAN', { subject_type: 'visitor', subject_id: freshVisitor.id, result: 'DENIED', reason: 'not_yet_valid' });
            toast({ title: '🚫 Passe ainda não válido', description: `Válido a partir de ${format(new Date(freshVisitor.validFrom), 'dd/MM/yyyy HH:mm')}`, variant: 'destructive' });
            scheduleReset(4000);
            return;
          }

          // Expiration check: only block if visitor is NOT currently inside
          if (new Date() > new Date(freshVisitor.validUntil) && freshVisitor.status !== 'inside') {
            playBlocked();
            setScanResult({ type: 'visitor', data: freshVisitor, action: 'expired' });
            logAuditAction('ACCESS_SCAN', { subject_type: 'visitor', subject_id: freshVisitor.id, result: 'DENIED', reason: 'expired' });
            scheduleReset(4000);
            return;
          }

          // === VISITANTE CONDUTOR: precisa dupla validação ===
          if (freshVisitor.accessType === 'driver' && freshVisitor.vehiclePassId) {
            // Check for existing session
            const existingSession = await findPendingVisitorSession(freshVisitor.id);

            if (existingSession && existingSession.first_scan === 'vehicle') {
              // VV was scanned first, now VP completes the session
              await supabase
                .from('access_sessions')
                .update({ status: 'completed', completed_at: new Date().toISOString() })
                .eq('id', existingSession.id);

              // Now do the toggle
              const result = await executeToggle('visitor', freshVisitor.id);
              if (!result.success) {
                if (result.reason === 'duplicate') {
                  playBlocked();
                  setScanResult({ type: 'visitor', data: freshVisitor, action: 'duplicate' });
                  scheduleReset(2000);
                } else {
                  playError();
                  setScanError(result.reason || 'Erro ao registrar');
                  scheduleReset(3000);
                }
                return;
              }

              const newStatus = result.direction === 'in' ? 'inside' : 'closed';
              await updateVisitorStatus.mutateAsync({ id: freshVisitor.id, status: newStatus as any });
              await fetchRecentLogs('visitor', freshVisitor.id);

              playSuccess();
              setScanResult({ type: 'visitor', data: { ...freshVisitor, status: newStatus as any }, action: result.direction });
              toast({ title: result.direction === 'in' ? '✓ Entrada registrada!' : '✓ Saída registrada!', description: `${freshVisitor.fullName} (dupla validação OK)` });
              scheduleReset(3000);
              return;
            }

            // No session or person was already first_scan — create new session with person as first
            if (!existingSession) {
              const expiresAt = new Date(Date.now() + 60_000).toISOString();
              await supabase.from('access_sessions').insert({
                session_type: 'visitor_driver',
                visitor_id: freshVisitor.id,
                first_scan: 'person',
                expires_at: expiresAt,
                operator_id: operatorId,
              });

              playSuccess();
              setScanResult({
                type: 'visitor',
                data: freshVisitor,
                action: 'waiting_second_qr',
                sessionInfo: { waitingFor: `Veículo (${freshVisitor.vehiclePassId})`, expiresIn: 60 },
              });
              toast({ title: '📷 Aguardando QR do veículo', description: 'Escaneie o QR do veículo em até 60 segundos.' });
              scheduleReset(60_000);
              return;
            }

            // Session exists with first_scan='person' — duplicate person scan
            playBlocked();
            setScanResult({
              type: 'visitor',
              data: freshVisitor,
              action: 'waiting_second_qr',
              sessionInfo: { waitingFor: `Veículo (${freshVisitor.vehiclePassId})`, expiresIn: Math.max(0, Math.round((new Date(existingSession.expires_at).getTime() - Date.now()) / 1000)) },
            });
            scheduleReset(5000);
            return;
          }

          // === VISITANTE PEDESTRE: fluxo normal ===
          const result = await executeToggle('visitor', freshVisitor.id);
          if (!result.success) {
            if (result.reason === 'duplicate') {
              playBlocked();
              setScanResult({ type: 'visitor', data: freshVisitor, action: 'duplicate' });
              toast({ title: '⏱️ Aguarde', description: 'Bip repetido. Aguarde 10 segundos.' });
              scheduleReset(2000);
            } else {
              playError();
              setScanError(result.reason || 'Erro ao registrar');
              scheduleReset(3000);
            }
            return;
          }

          const newStatus = result.direction === 'in' ? 'inside' : 'closed';
          await updateVisitorStatus.mutateAsync({ id: freshVisitor.id, status: newStatus as any });
          await fetchRecentLogs('visitor', freshVisitor.id);

          playSuccess();
          setScanResult({ type: 'visitor', data: { ...freshVisitor, status: newStatus as any }, action: result.direction });
          toast({
            title: result.direction === 'in' ? '✓ Entrada registrada!' : '✓ Saída registrada!',
            description: `${freshVisitor.fullName} ${result.direction === 'in' ? 'entrou' : 'saiu'}.`,
          });
          scheduleReset(3000);

        // =============== VEÍCULO VISITANTE (VV-) ===============
        } else if (searchCode.startsWith('VV-')) {
          const { data: vData, error: vError } = await supabase
            .from('visitors')
            .select('*')
            .eq('vehicle_pass_id', searchCode)
            .maybeSingle();

          if (vError || !vData) {
            playError();
            setScanError(`Veículo ${searchCode} não encontrado`);
            scheduleReset(3000);
            return;
          }

          const freshVisitor: Visitor = {
            id: vData.id, passId: vData.pass_id, fullName: vData.full_name, document: vData.document,
            companyId: vData.company_id, companyName: null, phone: vData.phone, photoUrl: vData.photo_url,
            visitToType: vData.visit_to_type, visitToName: vData.visit_to_name, gateObs: vData.gate_obs,
            companyReason: vData.company_reason || '', accessType: vData.access_type || 'pedestrian',
            vehiclePassId: vData.vehicle_pass_id, vehiclePlate: vData.vehicle_plate,
            vehicleBrand: vData.vehicle_brand, vehicleModel: vData.vehicle_model, vehicleColor: vData.vehicle_color,
            validFrom: new Date(vData.valid_from), validUntil: new Date(vData.valid_until),
            status: vData.status, createdBy: vData.created_by,
            createdAt: new Date(vData.created_at), updatedAt: new Date(vData.updated_at),
          };

          await fetchRecentLogs('visitor', freshVisitor.id);

          if (freshVisitor.status === 'closed' || freshVisitor.status === 'expired_unused') {
            playBlocked();
            setScanResult({ type: 'visitor', data: freshVisitor, action: freshVisitor.status === 'expired_unused' ? 'expired_unused' : 'closed' });
            scheduleReset(4000);
            return;
          }
          if (new Date() < new Date(freshVisitor.validFrom)) {
            playBlocked();
            setScanResult({ type: 'visitor', data: freshVisitor, action: 'blocked' });
            scheduleReset(4000);
            return;
          }
          if (new Date() > new Date(freshVisitor.validUntil) && freshVisitor.status !== 'inside') {
            playBlocked();
            setScanResult({ type: 'visitor', data: freshVisitor, action: 'expired' });
            scheduleReset(4000);
            return;
          }

          // Check for existing session
          const existingSession = await findPendingVisitorSession(freshVisitor.id);

          if (existingSession && existingSession.first_scan === 'person') {
            // VP was scanned first, now VV completes the session
            await supabase
              .from('access_sessions')
              .update({ status: 'completed', completed_at: new Date().toISOString() })
              .eq('id', existingSession.id);

            const result = await executeToggle('visitor', freshVisitor.id);
            if (!result.success) {
              if (result.reason === 'duplicate') {
                playBlocked();
                setScanResult({ type: 'visitor', data: freshVisitor, action: 'duplicate' });
                scheduleReset(2000);
              } else {
                playError();
                setScanError(result.reason || 'Erro ao registrar');
                scheduleReset(3000);
              }
              return;
            }

            const newStatus = result.direction === 'in' ? 'inside' : 'closed';
            await updateVisitorStatus.mutateAsync({ id: freshVisitor.id, status: newStatus as any });
            await fetchRecentLogs('visitor', freshVisitor.id);

            playSuccess();
            setScanResult({ type: 'visitor', data: { ...freshVisitor, status: newStatus as any }, action: result.direction });
            toast({ title: result.direction === 'in' ? '✓ Entrada registrada!' : '✓ Saída registrada!', description: `${freshVisitor.fullName} (dupla validação OK)` });
            scheduleReset(3000);
            return;
          }

          // Create new session with vehicle as first
          if (!existingSession) {
            const expiresAt = new Date(Date.now() + 60_000).toISOString();
            await supabase.from('access_sessions').insert({
              session_type: 'visitor_driver',
              visitor_id: freshVisitor.id,
              first_scan: 'vehicle',
              expires_at: expiresAt,
              operator_id: operatorId,
            });

            playSuccess();
            setScanResult({
              type: 'visitor',
              data: freshVisitor,
              action: 'waiting_second_qr',
              sessionInfo: { waitingFor: `Pessoal (${freshVisitor.passId})`, expiresIn: 60 },
            });
            toast({ title: '📷 Aguardando QR pessoal', description: 'Escaneie o QR pessoal em até 60 segundos.' });
            scheduleReset(60_000);
            return;
          }

          // Already waiting for person
          playBlocked();
          setScanResult({
            type: 'visitor',
            data: freshVisitor,
            action: 'waiting_second_qr',
            sessionInfo: { waitingFor: `Pessoal (${freshVisitor.passId})`, expiresIn: Math.max(0, Math.round((new Date(existingSession.expires_at).getTime() - Date.now()) / 1000)) },
          });
          scheduleReset(5000);
          return;

        // =============== CREDENCIAL (EC-) ===============
        } else if (searchCode.startsWith('EC-')) {
          let freshCredential = await fetchFreshCredential(searchCode);
          
          if (!freshCredential) {
            playError();
            setScanError(`Credencial ${searchCode} não encontrada`);
            scheduleReset(3000);
            return;
          }

          // For vehicles: check owner data
          if (freshCredential.type === 'vehicle' && freshCredential.document) {
            const ownerData = await fetchOwnerByDocument(freshCredential.document);
            if (ownerData) {
              freshCredential = {
                ...freshCredential,
                jobTitle: ownerData.jobTitle || freshCredential.jobTitle,
                department: ownerData.department || freshCredential.department,
              };
            }
          }

          await fetchRecentLogs('employee', freshCredential.id);

          if (freshCredential.status === 'blocked') {
            playBlocked();
            setScanResult({ type: 'employee', data: freshCredential, action: 'blocked' });
            logAuditAction('ACCESS_SCAN', {
              subject_type: 'employee', subject_id: freshCredential.id,
              credential_id: freshCredential.credentialId,
              result: 'DENIED', reason: 'blocked'
            });
            scheduleReset(4000);
            return;
          }

          // === VEHICLE CREDENTIAL: create session, wait for driver ===
          if (freshCredential.type === 'vehicle') {
            const expiresAt = new Date(Date.now() + 30_000).toISOString();
            try {
              await supabase.from('access_sessions').insert({
                session_type: 'employee_vehicle',
                vehicle_credential_id: freshCredential.id,
                first_scan: 'vehicle',
                expires_at: expiresAt,
                operator_id: operatorId,
              });
            } catch (e: any) {
              // Unique index may reject if session already pending
              const existingSession = await findPendingVehicleSession(freshCredential.id);
              if (existingSession) {
                playBlocked();
                setScanResult({
                  type: 'employee',
                  data: freshCredential,
                  action: 'waiting_second_qr',
                  sessionInfo: { waitingFor: 'QR pessoal do condutor', expiresIn: Math.max(0, Math.round((new Date(existingSession.expires_at).getTime() - Date.now()) / 1000)) },
                });
                scheduleReset(5000);
                return;
              }
            }

            playSuccess();
            setScanResult({
              type: 'employee',
              data: freshCredential,
              action: 'waiting_second_qr',
              sessionInfo: { waitingFor: 'QR pessoal do condutor autorizado', expiresIn: 30 },
            });
            toast({ title: '📷 Aguardando condutor', description: 'Escaneie o QR pessoal do condutor em até 30 segundos.' });
            scheduleReset(30_000);
            return;
          }

          // === PERSONAL CREDENTIAL: check if there's a pending vehicle session ===
          if (freshCredential.type === 'personal') {
            // Check for any pending vehicle session
            const { data: pendingSessions } = await supabase
              .from('access_sessions')
              .select('*')
              .eq('session_type', 'employee_vehicle')
              .eq('status', 'pending')
              .gt('expires_at', new Date().toISOString())
              .order('created_at', { ascending: false })
              .limit(1);

            const pendingSession = pendingSessions?.[0];

            if (pendingSession && pendingSession.vehicle_credential_id) {
              // Validate driver authorization
              const authorization = await checkAuthorizedDriver(
                pendingSession.vehicle_credential_id,
                freshCredential.id,
                null
              );

              if (authorization.authorized) {
                // Authorized! Complete session
                await supabase
                  .from('access_sessions')
                  .update({
                    status: 'completed',
                    person_credential_id: freshCredential.id,
                    authorization_type: authorization.authorization_type,
                    completed_at: new Date().toISOString(),
                  })
                  .eq('id', pendingSession.id);

                // Toggle both vehicle and person
                const vehicleResult = await executeToggle('employee', pendingSession.vehicle_credential_id);
                const personResult = await executeToggle('employee', freshCredential.id);

                await fetchRecentLogs('employee', freshCredential.id);

                playSuccess();
                setScanResult({
                  type: 'employee',
                  data: freshCredential,
                  action: personResult.success ? personResult.direction : 'in',
                  sessionInfo: { waitingFor: '', expiresIn: 0 },
                });
                toast({
                  title: personResult.direction === 'in' ? '✓ Entrada registrada!' : '✓ Saída registrada!',
                  description: `${freshCredential.fullName} — Condutor ${authorization.driverName || ''} (${authorization.authorization_type})`,
                });
                scheduleReset(3000);
                return;
              } else {
                // Not authorized — specific reason
                const denialReason = 'denial_reason' in authorization ? authorization.denial_reason : 'Condutor não autorizado';
                await supabase
                  .from('access_sessions')
                  .update({
                    status: 'denied',
                    person_credential_id: freshCredential.id,
                    denial_reason: denialReason,
                    completed_at: new Date().toISOString(),
                  })
                  .eq('id', pendingSession.id);

                playBlocked();
                setScanResult({ type: 'employee', data: freshCredential, action: 'session_denied' });
                logAuditAction('ACCESS_SCAN', {
                  subject_type: 'employee', subject_id: freshCredential.id,
                  result: 'DENIED', reason: denialReason,
                });
                toast({ title: '✕ Acesso negado', description: denialReason, variant: 'destructive' });
                scheduleReset(4000);
                return;
              }
            }

            // No pending vehicle session — normal pedestrian toggle
            const result = await executeToggle('employee', freshCredential.id);

            if (!result.success) {
              if (result.reason === 'duplicate') {
                playBlocked();
                setScanResult({ type: 'employee', data: freshCredential, action: 'duplicate' });
                toast({ title: '⏱️ Aguarde', description: 'Bip repetido. Aguarde 10 segundos.' });
                scheduleReset(2000);
              } else {
                playError();
                setScanError(result.reason || 'Erro ao registrar');
                scheduleReset(3000);
              }
              return;
            }

            await fetchRecentLogs('employee', freshCredential.id);

            playSuccess();
            setScanResult({ type: 'employee', data: freshCredential, action: result.direction });
            toast({
              title: result.direction === 'in' ? '✓ Entrada registrada!' : '✓ Saída registrada!',
              description: `${freshCredential.fullName} ${result.direction === 'in' ? 'entrou' : 'saiu'}.`,
            });
            scheduleReset(3000);
          }
        }
      } catch (error: any) {
        console.error('[SCAN] Erro:', error);
        playError();
        setScanError(error.message || 'Erro ao processar');
        scheduleReset(3000);
      }
    };

    process();
  }, [searchCode]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleScan = () => {
    if (!qrCode.trim()) {
      toast({ title: 'Código vazio', description: 'Digite ou escaneie o código.', variant: 'destructive' });
      inputRef.current?.focus();
      return;
    }

    const code = qrCode.toUpperCase().trim();
    
    if (!code.startsWith('VP-') && !code.startsWith('EC-') && !code.startsWith('VV-') && !code.startsWith('AG-')) {
      playError();
      setScanError('Código inválido. Use VP-, VV-, EC- ou AG-XXXXXXXX.');
      setQrCode('');
      scheduleReset(3000);
      return;
    }

    clearScan();
    setSearchCode(code);
  };

  const handleCameraScan = (code: string) => {
    const normalized = code.toUpperCase().trim();
    clearScan();
    
    if (normalized.startsWith('VP-') || normalized.startsWith('EC-') || normalized.startsWith('VV-') || normalized.startsWith('AG-')) {
      setSearchCode(normalized);
    } else {
      playError();
      setScanError('Código inválido.');
      scheduleReset(3000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScan();
    }
  };

  const isLoading = loadingVisitor || loadingCredential || isProcessing;

  // ============================================
  // RENDER
  // ============================================

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <QrCode className="w-8 h-8 text-primary" />
              Scanner de Acesso
            </h1>
            <p className="text-muted-foreground mt-1">Registro automático de entrada/saída</p>
          </div>
          <Link to="/scan/kiosk">
            <Button variant="outline" className="gap-2">
              <Maximize className="w-4 h-4" />
              <span className="hidden sm:inline">Modo Kiosk</span>
            </Button>
          </Link>
        </div>

        {/* Input Card */}
        <Card>
          <CardHeader>
            <CardTitle>Escanear Código</CardTitle>
            <CardDescription>
              Posicione o leitor. O sistema alterna automaticamente entrada/saída.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 sm:gap-4">
              <Input
                ref={inputRef}
                placeholder="VP- / VV- / EC-XXXXXXXX"
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value.toUpperCase())}
                className="font-mono text-lg"
                onKeyDown={handleKeyDown}
                autoFocus
                autoComplete="off"
              />
              <Button variant="outline" size="lg" onClick={() => setCameraOpen(true)} className="shrink-0 gap-2">
                <Camera className="w-5 h-5" />
                <span className="hidden sm:inline">Câmera</span>
              </Button>
              <Button onClick={handleScan} size="lg" disabled={isLoading} className="shrink-0">
                {isLoading ? 'Processando...' : 'Verificar'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              💡 Zero-clique: Toggle automático com proteção anti-bip repetido (10s)
            </p>
          </CardContent>
        </Card>

        <CameraScannerModal open={cameraOpen} onClose={() => setCameraOpen(false)} onScan={handleCameraScan} />

        {/* Error State */}
        {scanError && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-destructive" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-destructive">Erro</h3>
                  <p className="text-muted-foreground">{scanError}</p>
                </div>
              </div>
              <Button variant="outline" onClick={clearScan} className="mt-4 w-full">Escanear Outro</Button>
            </CardContent>
          </Card>
        )}

        {/* Visitor Result */}
        {scanResult?.type === 'visitor' && (
          <Card className={
            scanResult.action === 'in' ? 'border-success/50 bg-success/5' :
            scanResult.action === 'out' ? 'border-primary/50 bg-primary/5' :
            scanResult.action === 'duplicate' ? 'border-warning/50 bg-warning/5' :
            scanResult.action === 'waiting_second_qr' ? 'border-warning/50 bg-warning/5' :
            'border-destructive/50 bg-destructive/5'
          }>
            <CardContent className="pt-6">
              <div className={`mb-4 p-4 rounded-lg text-center text-white font-bold text-xl ${
                scanResult.action === 'in' ? 'bg-success' :
                scanResult.action === 'out' ? 'bg-primary' :
                scanResult.action === 'duplicate' ? 'bg-warning' :
                scanResult.action === 'waiting_second_qr' ? 'bg-warning' :
                'bg-destructive'
              }`}>
                {scanResult.action === 'in' && '✓ ENTRADA REGISTRADA'}
                {scanResult.action === 'out' && '✓ SAÍDA REGISTRADA'}
                {scanResult.action === 'duplicate' && '⏱️ AGUARDE - BIP REPETIDO'}
                {scanResult.action === 'blocked' && '✕ ACESSO NEGADO'}
                {scanResult.action === 'expired' && '✕ PASSE EXPIRADO'}
                {scanResult.action === 'expired_unused' && '✕ PASSE EXPIRADO (SEM USO)'}
                {scanResult.action === 'closed' && '✕ PASSE JÁ UTILIZADO'}
                {scanResult.action === 'waiting_second_qr' && '📷 AGUARDANDO SEGUNDO QR'}
              </div>

              <div className="flex items-start gap-4">
                <div className="w-20 h-20 rounded-xl bg-muted border flex items-center justify-center overflow-hidden shrink-0">
                  {scanResult.data.photoUrl ? (
                    <img src={scanResult.data.photoUrl} alt={scanResult.data.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-bold text-muted-foreground">{scanResult.data.fullName.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold">{scanResult.data.fullName}</h3>
                  <p className="text-muted-foreground">{scanResult.data.companyReason || scanResult.data.companyName || 'Visitante'}</p>
                  
                  {/* Vehicle info if present */}
                  {scanResult.data.vehiclePlate && (
                    <div className="mt-2 p-3 rounded-lg bg-muted">
                      <div className="flex items-center gap-2">
                        <Car className="w-5 h-5 text-primary" />
                        <p className="text-lg font-mono font-bold">{scanResult.data.vehiclePlate}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {scanResult.data.vehicleBrand} {scanResult.data.vehicleModel} - {scanResult.data.vehicleColor}
                      </p>
                    </div>
                  )}

                  <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-lg">
                      <span className="font-medium">DESTINO:</span>{' '}
                      <span className="font-bold">{scanResult.data.visitToType === 'setor' ? '📍 ' : '👤 '}{scanResult.data.visitToName}</span>
                    </p>
                    {scanResult.data.gateObs && <p className="text-warning font-bold mt-1">⚠️ {scanResult.data.gateObs}</p>}
                  </div>

                  {/* Session info for waiting states */}
                  {scanResult.action === 'waiting_second_qr' && scanResult.sessionInfo && (
                    <div className="mt-4 p-4 rounded-lg bg-warning/10 border border-warning/30 animate-pulse">
                      <p className="text-lg font-bold text-warning">⏳ Aguardando: {scanResult.sessionInfo.waitingFor}</p>
                      <p className="text-sm text-muted-foreground">Tempo restante: ~{scanResult.sessionInfo.expiresIn}s</p>
                    </div>
                  )}
                </div>
              </div>

              {recentLogs.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm text-muted-foreground">HISTÓRICO</span>
                  </div>
                  <div className="space-y-2">
                    {recentLogs.map(log => <LogItem key={log.id} log={log} />)}
                  </div>
                </div>
              )}

              <Button variant="ghost" onClick={clearScan} className="mt-4 w-full">Escanear Outro Código</Button>
            </CardContent>
          </Card>
        )}

        {/* Employee Result */}
        {scanResult?.type === 'employee' && (
          <Card className={
            scanResult.action === 'blocked' || scanResult.action === 'session_denied' ? 'border-destructive/50 bg-destructive/5' :
            scanResult.action === 'duplicate' ? 'border-warning/50 bg-warning/5' :
            scanResult.action === 'waiting_second_qr' ? 'border-warning/50 bg-warning/5' :
            scanResult.action === 'in' ? 'border-success/50 bg-success/5' :
            'border-primary/50 bg-primary/5'
          }>
            <CardContent className="pt-6">
              <div className={`mb-4 p-4 rounded-lg text-center text-white font-bold text-xl ${
                scanResult.action === 'blocked' || scanResult.action === 'session_denied' ? 'bg-destructive' :
                scanResult.action === 'duplicate' ? 'bg-warning' :
                scanResult.action === 'waiting_second_qr' ? 'bg-warning' :
                scanResult.action === 'in' ? 'bg-success' : 'bg-primary'
              }`}>
                {scanResult.action === 'in' && '✓ ENTRADA REGISTRADA'}
                {scanResult.action === 'out' && '✓ SAÍDA REGISTRADA'}
                {scanResult.action === 'blocked' && '✕ ACESSO BLOQUEADO'}
                {scanResult.action === 'duplicate' && '⏱️ AGUARDE - BIP REPETIDO'}
                {scanResult.action === 'waiting_second_qr' && '📷 AGUARDANDO CONDUTOR'}
                {scanResult.action === 'session_denied' && '✕ CONDUTOR NÃO AUTORIZADO'}
              </div>

              <div className="flex items-start gap-4">
                {scanResult.data.type === 'personal' ? (
                  <div className="w-24 h-24 rounded-xl bg-muted border flex items-center justify-center overflow-hidden shrink-0">
                    {scanResult.data.photoUrl ? (
                      <img src={scanResult.data.photoUrl} alt={scanResult.data.fullName} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-12 h-12 text-muted-foreground" />
                    )}
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-xl bg-muted border flex flex-col items-center justify-center shrink-0">
                    <Car className="w-10 h-10 text-muted-foreground mb-1" />
                    <p className="text-xs font-mono font-bold">{scanResult.data.vehiclePlate}</p>
                  </div>
                )}
                
                <div className="flex-1">
                  <h3 className="text-2xl font-bold">{scanResult.data.fullName}</h3>
                  
                  {scanResult.data.type === 'vehicle' && (
                    <div className="mt-2 p-3 rounded-lg bg-muted">
                      <p className="text-lg font-mono font-bold">{scanResult.data.vehiclePlate}</p>
                      <p className="text-sm text-muted-foreground">{scanResult.data.vehicleMakeModel}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Departamento</p>
                      <p className="font-medium flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        {scanResult.data.department?.name || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Cargo</p>
                      <p className="font-medium">{scanResult.data.jobTitle || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Session info for waiting states */}
                {scanResult.action === 'waiting_second_qr' && scanResult.sessionInfo && (
                  <div className="mt-4 p-4 rounded-lg bg-warning/10 border border-warning/30 animate-pulse">
                    <p className="text-lg font-bold text-warning">⏳ Aguardando: {scanResult.sessionInfo.waitingFor}</p>
                    <p className="text-sm text-muted-foreground">Tempo restante: ~{scanResult.sessionInfo.expiresIn}s</p>
                  </div>
                )}
              </div>

              {recentLogs.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm text-muted-foreground">HISTÓRICO</span>
                  </div>
                  <div className="space-y-2">
                    {recentLogs.map(log => <LogItem key={log.id} log={log} />)}
                  </div>
                </div>
              )}

              <Button variant="ghost" onClick={clearScan} className="mt-4 w-full">Escanear Outro Código</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default QRScanner;

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
type ScanAction = 'in' | 'out' | 'blocked' | 'expired' | 'closed' | 'duplicate';

type ScanResult = {
  type: 'visitor';
  data: Visitor;
  action: ScanAction;
} | {
  type: 'employee';
  data: EmployeeCredential;
  action: ScanAction;
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
      company: data.company,
      phone: data.phone,
      photoUrl: data.photo_url,
      visitToType: data.visit_to_type,
      visitToName: data.visit_to_name,
      gateObs: data.gate_obs,
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
    // Primeiro tenta buscar na tabela de credenciais pessoais
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
  // PROCESSAMENTO PRINCIPAL
  // ============================================
  
  useEffect(() => {
    if (!searchCode) return;
    if (processingRef.current) return;

    const process = async () => {
      // Mutex: evita duplo processamento
      if (processingRef.current) return;
      processingRef.current = true;
      setIsProcessing(true);

      try {
        // =============== VISITANTE ===============
        if (searchCode.startsWith('VP-')) {
          // CONSULTA DIRETA - Bypass total do cache
          const freshVisitor = await fetchFreshVisitor(searchCode);
          
          if (!freshVisitor) {
            playError();
            setScanError(`Passe ${searchCode} não encontrado`);
            scheduleReset(3000);
            return;
          }

          await fetchRecentLogs('visitor', freshVisitor.id);

          // BLOQUEIO: Passe fechado (reflexo instantâneo)
          if (freshVisitor.status === 'closed') {
            playBlocked();
            setScanResult({ type: 'visitor', data: freshVisitor, action: 'closed' });
            logAuditAction('ACCESS_SCAN', {
              subject_type: 'visitor', subject_id: freshVisitor.id,
              result: 'DENIED', reason: 'closed'
            });
            scheduleReset(4000);
            return;
          }

          // BLOQUEIO: Passe expirado
          if (new Date() > new Date(freshVisitor.validUntil)) {
            playBlocked();
            setScanResult({ type: 'visitor', data: freshVisitor, action: 'expired' });
            logAuditAction('ACCESS_SCAN', {
              subject_type: 'visitor', subject_id: freshVisitor.id,
              result: 'DENIED', reason: 'expired'
            });
            scheduleReset(4000);
            return;
          }

          // TOGGLE
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

          // Atualizar status do visitante
          if (result.direction === 'in') {
            await updateVisitorStatus.mutateAsync({ id: freshVisitor.id, status: 'inside' });
          } else {
            await updateVisitorStatus.mutateAsync({ id: freshVisitor.id, status: 'closed' });
          }

          // Recarregar logs para exibição
          await fetchRecentLogs('visitor', freshVisitor.id);

          playSuccess();
          setScanResult({ 
            type: 'visitor', 
            data: { ...freshVisitor, status: result.direction === 'in' ? 'inside' : 'closed' }, 
            action: result.direction 
          });
          toast({
            title: result.direction === 'in' ? '✓ Entrada registrada!' : '✓ Saída registrada!',
            description: `${freshVisitor.fullName} ${result.direction === 'in' ? 'entrou' : 'saiu'}.`,
          });
          scheduleReset(3000);

        // =============== COLABORADOR ===============
        } else if (searchCode.startsWith('EC-')) {
          // CONSULTA DIRETA - Bypass total do cache
          let freshCredential = await fetchFreshCredential(searchCode);
          
          if (!freshCredential) {
            playError();
            setScanError(`Credencial ${searchCode} não encontrada`);
            scheduleReset(3000);
            return;
          }

          // Para VEÍCULOS: buscar dados do proprietário (Cargo + Departamento)
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

          // BLOQUEIO: Credencial bloqueada (reflexo instantâneo)
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

          // TOGGLE
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

          // Recarregar logs
          await fetchRecentLogs('employee', freshCredential.id);

          playSuccess();
          setScanResult({ type: 'employee', data: freshCredential, action: result.direction });
          toast({
            title: result.direction === 'in' ? '✓ Entrada registrada!' : '✓ Saída registrada!',
            description: `${freshCredential.fullName} ${result.direction === 'in' ? 'entrou' : 'saiu'}.`,
          });
          scheduleReset(3000);
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
    
    if (!code.startsWith('VP-') && !code.startsWith('EC-')) {
      playError();
      setScanError('Código inválido. Use VP-XXXXXXXX ou EC-XXXXXXXX.');
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
    
    if (normalized.startsWith('VP-') || normalized.startsWith('EC-')) {
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
                placeholder="VP-XXXXXXXX ou EC-XXXXXXXX"
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
            'border-destructive/50 bg-destructive/5'
          }>
            <CardContent className="pt-6">
              <div className={`mb-4 p-4 rounded-lg text-center text-white font-bold text-xl ${
                scanResult.action === 'in' ? 'bg-success' :
                scanResult.action === 'out' ? 'bg-primary' :
                scanResult.action === 'duplicate' ? 'bg-warning' :
                'bg-destructive'
              }`}>
                {scanResult.action === 'in' && '✓ ENTRADA REGISTRADA'}
                {scanResult.action === 'out' && '✓ SAÍDA REGISTRADA'}
                {scanResult.action === 'duplicate' && '⏱️ AGUARDE - BIP REPETIDO'}
                {scanResult.action === 'blocked' && '✕ ACESSO NEGADO'}
                {scanResult.action === 'expired' && '✕ PASSE EXPIRADO'}
                {scanResult.action === 'closed' && '✕ PASSE JÁ UTILIZADO'}
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
                  <p className="text-muted-foreground">{scanResult.data.company || 'Visitante'}</p>
                  <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-lg">
                      <span className="font-medium">DESTINO:</span>{' '}
                      <span className="font-bold">{scanResult.data.visitToType === 'setor' ? '📍 ' : '👤 '}{scanResult.data.visitToName}</span>
                    </p>
                    {scanResult.data.gateObs && <p className="text-warning font-bold mt-1">⚠️ {scanResult.data.gateObs}</p>}
                  </div>
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
            scanResult.action === 'blocked' ? 'border-destructive/50 bg-destructive/5' :
            scanResult.action === 'duplicate' ? 'border-warning/50 bg-warning/5' :
            scanResult.action === 'in' ? 'border-success/50 bg-success/5' :
            'border-primary/50 bg-primary/5'
          }>
            <CardContent className="pt-6">
              <div className={`mb-4 p-4 rounded-lg text-center text-white font-bold text-xl ${
                scanResult.action === 'blocked' ? 'bg-destructive' :
                scanResult.action === 'duplicate' ? 'bg-warning' :
                scanResult.action === 'in' ? 'bg-success' : 'bg-primary'
              }`}>
                {scanResult.action === 'in' && '✓ ENTRADA REGISTRADA'}
                {scanResult.action === 'out' && '✓ SAÍDA REGISTRADA'}
                {scanResult.action === 'blocked' && '✕ ACESSO BLOQUEADO'}
                {scanResult.action === 'duplicate' && '⏱️ AGUARDE - BIP REPETIDO'}
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

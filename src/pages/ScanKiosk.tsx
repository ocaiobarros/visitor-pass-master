import { useState, useRef, useEffect, useCallback } from 'react';
import { useUpdateVisitorStatus } from '@/hooks/useVisitors';
import { useCreateAccessLog } from '@/hooks/useAccessLogs';
import { useScanFeedback } from '@/hooks/useScanFeedback';
import { Camera, User, Car, CheckCircle, XCircle, AlertTriangle, ArrowLeft, Printer, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Visitor, EmployeeCredential } from '@/types/visitor';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

type ScanResult = {
  type: 'visitor';
  data: Visitor;
  status: 'allowed' | 'blocked' | 'expired' | 'waiting_second_qr' | 'expired_unused';
  direction: 'in' | 'out';
  sessionInfo?: { waitingFor: string; expiresIn: number };
} | {
  type: 'employee';
  data: EmployeeCredential;
  status: 'allowed' | 'blocked' | 'waiting_second_qr' | 'session_denied';
  direction: 'in' | 'out';
  sessionInfo?: { waitingFor: string; expiresIn: number };
} | {
  type: 'error';
  code: string;
} | null;

// Anti-duplicate: 10s window
const ANTI_DUP_WINDOW_MS = 10_000;
const scanTimestamps = new Map<string, number>();

const mapDbToVisitor = (row: any): Visitor => ({
  id: row.id,
  passId: row.pass_id,
  fullName: row.full_name,
  document: row.document,
  companyId: row.company_id,
  companyName: row.company_name,
  phone: row.phone,
  photoUrl: row.photo_url,
  visitToType: row.visit_to_type,
  visitToName: row.visit_to_name,
  gateObs: row.gate_obs,
  companyReason: row.company_reason,
  accessType: row.access_type,
  vehiclePassId: row.vehicle_pass_id,
  vehiclePlate: row.vehicle_plate,
  vehicleBrand: row.vehicle_brand,
  vehicleModel: row.vehicle_model,
  vehicleColor: row.vehicle_color,
  validFrom: new Date(row.valid_from),
  validUntil: new Date(row.valid_until),
  status: row.status,
  createdBy: row.created_by,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
});

const mapDbToCredential = (row: any): EmployeeCredential => ({
  id: row.id,
  credentialId: row.credential_id,
  type: row.type,
  fullName: row.full_name,
  document: row.document,
  departmentId: row.department_id,
  jobTitle: row.job_title,
  photoUrl: row.photo_url,
  vehicleMakeModel: row.vehicle_make_model,
  vehiclePlate: row.vehicle_plate,
  status: row.status,
  createdBy: row.created_by,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
});

const ScanKiosk = () => {
  const [qrCode, setQrCode] = useState('');
  const [searchCode, setSearchCode] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsClicks, setSettingsClicks] = useState(0);
  const [currentTime, setCurrentTime] = useState(format(new Date(), 'HH:mm:ss'));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const focusIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const printRef = useRef<HTMLDivElement>(null);
  
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const userGateCode = authUser?.gateCode || 'SEM_GUARITA';
  const { playSuccess, playError, playBlocked } = useScanFeedback();
  const updateVisitorStatus = useUpdateVisitorStatus();
  const createAccessLog = useCreateAccessLog();

  // Update clock
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(format(new Date(), 'HH:mm:ss'));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Force focus on input (kiosk mode)
  const forceFocus = useCallback(() => {
    if (!scanResult && inputRef.current) {
      inputRef.current.focus();
    }
  }, [scanResult]);

  // Auto fullscreen on mount
  useEffect(() => {
    const enterFullscreen = async () => {
      try {
        if (containerRef.current && !document.fullscreenElement) {
          await containerRef.current.requestFullscreen();
          setIsFullscreen(true);
        }
      } catch (e) {}
    };
    enterFullscreen();
    
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    focusIntervalRef.current = setInterval(forceFocus, 1000);
    
    return () => {
      if (focusIntervalRef.current) clearInterval(focusIntervalRef.current);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [forceFocus]);

  useEffect(() => {
    if (!scanResult) {
      setTimeout(forceFocus, 100);
    }
  }, [scanResult, forceFocus]);

  const scheduleReset = useCallback((delay: number = 3000) => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setScanResult(null);
      setSearchCode('');
      setQrCode('');
    }, delay);
  }, []);

  /**
   * Deterministic direction toggle:
   * Queries get_last_access_direction RPC for the subject.
   * If last was 'in' → next is 'out'. If 'out' or null → next is 'in'.
   */
  const getNextDirection = async (subjectType: 'visitor' | 'employee', subjectId: string): Promise<'in' | 'out'> => {
    try {
      const { data, error } = await supabase.rpc('get_last_access_direction', {
        p_subject_type: subjectType,
        p_subject_id: subjectId,
      });
      if (error || !data) return 'in';
      return data === 'in' ? 'out' : 'in';
    } catch {
      return 'in';
    }
  };

  /**
   * Fetch fresh data directly from DB (bypass React Query cache)
   */
  const fetchFreshVisitor = async (field: string, value: string): Promise<Visitor | null> => {
    // Use raw query to avoid deep type instantiation
    const query = supabase.from('visitors').select('*, companies(name)');
    const { data, error } = await (query as any).eq(field, value).maybeSingle();
    if (error || !data) return null;
    return mapDbToVisitor({ ...data, company_name: data.companies?.name });
  };



  const fetchFreshCredential = async (credentialId: string): Promise<EmployeeCredential | null> => {
    const { data, error } = await supabase
      .from('employee_credentials')
      .select('*')
      .eq('credential_id', credentialId)
      .maybeSingle();
    if (error || !data) return null;
    return mapDbToCredential(data);
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

    let driverName: string | undefined;

    if (data.driver_type === 'employee' && data.employee_credential_id) {
      const { data: emp } = await supabase
        .from('employee_credentials')
        .select('full_name, status')
        .eq('id', data.employee_credential_id)
        .maybeSingle();
      if (emp?.status === 'blocked') {
        return { authorized: false, denial_reason: `Colaborador ${emp.full_name} bloqueado` };
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
        return { authorized: false, denial_reason: `Agregado ${assoc.full_name} suspenso` };
      }
      if (assoc?.status === 'expired') {
        return { authorized: false, denial_reason: `Agregado ${assoc.full_name} expirado` };
      }
      if (assoc?.status !== 'active') {
        return { authorized: false, denial_reason: `Agregado ${assoc.full_name} não está ativo` };
      }
      driverName = assoc?.full_name;
      if (assoc?.employee_credential_id) {
        const { data: empCred } = await supabase
          .from('employee_credentials')
          .select('status, full_name')
          .eq('id', assoc.employee_credential_id)
          .maybeSingle();
        if (empCred?.status === 'blocked') {
          return { authorized: false, denial_reason: `Responsável ${empCred.full_name} bloqueado` };
        }
      }
    }

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

  // Process scan
  useEffect(() => {
    if (!searchCode || isProcessing) return;

    const processScan = async () => {
      setIsProcessing(true);

      // Anti-duplicate check
      const now = Date.now();
      const lastScan = scanTimestamps.get(searchCode);
      if (lastScan && now - lastScan < ANTI_DUP_WINDOW_MS) {
        setIsProcessing(false);
        return;
      }
      scanTimestamps.set(searchCode, now);

      try {
        const { data: userData } = await supabase.auth.getUser();
        const operatorId = userData.user?.id || null;

        // =============== VISITANTE (VP- ou VV-) ===============
        if (searchCode.startsWith('VP-') || searchCode.startsWith('VV-')) {
          const field = searchCode.startsWith('VP-') ? 'pass_id' : 'vehicle_pass_id';
          const visitor = await fetchFreshVisitor(field, searchCode);

          if (!visitor) {
            playError();
            setScanResult({ type: 'error', code: searchCode });
            scheduleReset(3000);
            return;
          }

          // Status checks
          if (visitor.status === 'closed' || visitor.status === 'expired_unused') {
            playBlocked();
            setScanResult({ type: 'visitor', data: visitor, status: visitor.status === 'expired_unused' ? 'expired_unused' : 'blocked', direction: 'in' });
            scheduleReset(4000);
            return;
          }
          if (new Date() < visitor.validFrom) {
            playBlocked();
            setScanResult({ type: 'visitor', data: visitor, status: 'blocked', direction: 'in' });
            scheduleReset(4000);
            return;
          }
          if (new Date() > visitor.validUntil && visitor.status !== 'inside') {
            playBlocked();
            setScanResult({ type: 'visitor', data: visitor, status: 'expired', direction: 'in' });
            scheduleReset(4000);
            return;
          }

          // === VISITANTE CONDUTOR: dupla validação ===
          if (visitor.accessType === 'driver' && visitor.vehiclePassId) {
            const isPersonScan = searchCode.startsWith('VP-');
            const existingSession = await findPendingVisitorSession(visitor.id);

            // Second scan completes the session
            if (existingSession) {
              const completesSession = (isPersonScan && existingSession.first_scan === 'vehicle') ||
                                       (!isPersonScan && existingSession.first_scan === 'person');

              if (completesSession) {
                await supabase
                  .from('access_sessions')
                  .update({ status: 'completed', completed_at: new Date().toISOString() })
                  .eq('id', existingSession.id);

                const direction = await getNextDirection('visitor', visitor.id);
                const newStatus = direction === 'in' ? 'inside' as const : 'outside' as const;
                await updateVisitorStatus.mutateAsync({ id: visitor.id, status: newStatus });
                await createAccessLog.mutateAsync({ subjectType: 'visitor', subjectId: visitor.id, direction });

                playSuccess();
                setScanResult({ type: 'visitor', data: { ...visitor, status: newStatus }, status: 'allowed', direction });
                scheduleReset(3000);
                return;
              }

              // Same type scanned again — show waiting
              playBlocked();
              const waitingFor = isPersonScan ? `Veículo (${visitor.vehiclePassId})` : `Pessoal (${visitor.passId})`;
              const remaining = Math.max(0, Math.round((new Date(existingSession.expires_at).getTime() - Date.now()) / 1000));
              setScanResult({
                type: 'visitor', data: visitor, status: 'waiting_second_qr', direction: 'in',
                sessionInfo: { waitingFor, expiresIn: remaining },
              });
              scheduleReset(5000);
              return;
            }

            // No session — create one
            const expiresAt = new Date(Date.now() + 60_000).toISOString();
            await supabase.from('access_sessions').insert({
              session_type: 'visitor_driver',
              visitor_id: visitor.id,
              first_scan: isPersonScan ? 'person' : 'vehicle',
              expires_at: expiresAt,
              operator_id: operatorId,
            });

            playSuccess();
            const waitingFor = isPersonScan ? `Veículo (${visitor.vehiclePassId})` : `Pessoal (${visitor.passId})`;
            setScanResult({
              type: 'visitor', data: visitor, status: 'waiting_second_qr', direction: 'in',
              sessionInfo: { waitingFor, expiresIn: 60 },
            });
            scheduleReset(60_000);
            return;
          }

          // === VISITANTE PEDESTRE: fluxo normal ===
          const direction = await getNextDirection('visitor', visitor.id);
          playSuccess();
          const newVisitorStatus = direction === 'in' ? 'inside' as const : 'outside' as const;
          await updateVisitorStatus.mutateAsync({ id: visitor.id, status: newVisitorStatus });
          await createAccessLog.mutateAsync({ subjectType: 'visitor', subjectId: visitor.id, direction });
          setScanResult({ type: 'visitor', data: { ...visitor, status: newVisitorStatus }, status: 'allowed', direction });
          scheduleReset(3000);

        // =============== CREDENCIAL (EC-) ===============
        } else if (searchCode.startsWith('EC-')) {
          const credential = await fetchFreshCredential(searchCode);

          if (!credential) {
            playError();
            setScanResult({ type: 'error', code: searchCode });
            scheduleReset(3000);
            return;
          }

          if (credential.status === 'blocked') {
            playBlocked();
            setScanResult({ type: 'employee', data: credential, status: 'blocked', direction: 'in' });
            scheduleReset(3000);
            return;
          }

          // === VEHICLE CREDENTIAL: create session, wait for driver ===
          if (credential.type === 'vehicle') {
            const expiresAt = new Date(Date.now() + 30_000).toISOString();
            const { error: insertError } = await supabase.from('access_sessions').insert({
              session_type: 'employee_vehicle',
              vehicle_credential_id: credential.id,
              first_scan: 'vehicle',
              expires_at: expiresAt,
              operator_id: operatorId,
            });

            if (insertError) {
              // Unique index may reject — session already pending
              const existingSession = await findPendingVehicleSession(credential.id);
              if (existingSession) {
                playBlocked();
                setScanResult({
                  type: 'employee', data: credential, status: 'waiting_second_qr', direction: 'in',
                  sessionInfo: { waitingFor: 'QR pessoal do condutor', expiresIn: Math.max(0, Math.round((new Date(existingSession.expires_at).getTime() - Date.now()) / 1000)) },
                });
                scheduleReset(5000);
                return;
              }
            }

            playSuccess();
            setScanResult({
              type: 'employee', data: credential, status: 'waiting_second_qr', direction: 'in',
              sessionInfo: { waitingFor: 'QR pessoal do condutor autorizado', expiresIn: 30 },
            });
            scheduleReset(30_000);
            return;
          }

          // === PERSONAL CREDENTIAL: check if there's a pending vehicle session ===
          if (credential.type === 'personal') {
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
              const authorization = await checkAuthorizedDriver(
                pendingSession.vehicle_credential_id,
                credential.id,
                null
              );

              if (authorization.authorized) {
                // Authorized — complete session
                await supabase
                  .from('access_sessions')
                  .update({
                    status: 'completed',
                    person_credential_id: credential.id,
                    authorization_type: authorization.authorization_type,
                    completed_at: new Date().toISOString(),
                  })
                  .eq('id', pendingSession.id);

                // Toggle both
                const vehicleDir = await getNextDirection('employee', pendingSession.vehicle_credential_id);
                await createAccessLog.mutateAsync({ subjectType: 'employee', subjectId: pendingSession.vehicle_credential_id, direction: vehicleDir });

                const personDir = await getNextDirection('employee', credential.id);
                await createAccessLog.mutateAsync({ subjectType: 'employee', subjectId: credential.id, direction: personDir });

                playSuccess();
                setScanResult({ type: 'employee', data: credential, status: 'allowed', direction: personDir });
                scheduleReset(3000);
                return;
              } else {
                // Not authorized — specific reason
                const denialReason = 'denial_reason' in authorization ? authorization.denial_reason : 'Condutor não autorizado';
                await supabase
                  .from('access_sessions')
                  .update({
                    status: 'denied',
                    person_credential_id: credential.id,
                    denial_reason: denialReason,
                    completed_at: new Date().toISOString(),
                  })
                  .eq('id', pendingSession.id);

                playBlocked();
                setScanResult({ type: 'employee', data: credential, status: 'session_denied', direction: 'in' });
                scheduleReset(4000);
                return;
              }
            }

            // No pending vehicle session — normal pedestrian toggle
            const direction = await getNextDirection('employee', credential.id);
            playSuccess();
            await createAccessLog.mutateAsync({ subjectType: 'employee', subjectId: credential.id, direction });
            setScanResult({ type: 'employee', data: credential, status: 'allowed', direction });
            scheduleReset(3000);
          }
        // =============== AGREGADO (AG-) ===============
        } else if (searchCode.startsWith('AG-')) {
          const { data: assocData, error: assocError } = await supabase
            .from('associates')
            .select('*, employee_credentials!associates_employee_credential_id_fkey(full_name, status)')
            .eq('pass_id', searchCode)
            .maybeSingle();

          if (assocError || !assocData) {
            playError();
            setScanResult({ type: 'error', code: searchCode });
            scheduleReset(3000);
            return;
          }

          const empData = (assocData as any).employee_credentials;

          // Check associate status
          if (assocData.status === 'suspended') {
            playBlocked();
            setScanResult({ type: 'error', code: searchCode });
            scheduleReset(3000);
            return;
          }
          if (assocData.status === 'expired') {
            playBlocked();
            setScanResult({ type: 'error', code: searchCode });
            scheduleReset(3000);
            return;
          }
          if (assocData.status !== 'active') {
            playBlocked();
            setScanResult({ type: 'error', code: searchCode });
            scheduleReset(3000);
            return;
          }

          // Check responsible employee status
          if (empData?.status === 'blocked') {
            playBlocked();
            setScanResult({ type: 'error', code: searchCode });
            scheduleReset(3000);
            return;
          }

          // Check validity
          if (assocData.validity_type === 'temporary') {
            if (assocData.valid_from && new Date(assocData.valid_from) > new Date()) {
              playBlocked();
              setScanResult({ type: 'error', code: searchCode });
              scheduleReset(3000);
              return;
            }
            if (assocData.valid_until && new Date(assocData.valid_until) < new Date()) {
              playBlocked();
              setScanResult({ type: 'error', code: searchCode });
              scheduleReset(3000);
              return;
            }
          }

          // Check pending vehicle session — associate as driver
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
            const authorization = await checkAuthorizedDriver(
              pendingSession.vehicle_credential_id,
              null,
              assocData.id
            );

            if (authorization.authorized) {
              await supabase
                .from('access_sessions')
                .update({
                  status: 'completed',
                  associate_id: assocData.id,
                  authorization_type: authorization.authorization_type,
                  completed_at: new Date().toISOString(),
                })
                .eq('id', pendingSession.id);

              // Toggle vehicle
              const vehicleDir = await getNextDirection('employee', pendingSession.vehicle_credential_id);
              await createAccessLog.mutateAsync({ subjectType: 'employee', subjectId: pendingSession.vehicle_credential_id, direction: vehicleDir });

              // Toggle associate
              const assocDir = await getNextDirection('associate' as any, assocData.id);
              const { data: user } = await supabase.auth.getUser();
              await supabase.from('access_logs').insert({
                subject_type: 'associate' as any,
                subject_id: assocData.id,
                direction: assocDir,
                gate_id: 'GUARITA_01',
                operator_id: user.user?.id || null,
              });

              playSuccess();
              // Build a credential-like object for display
              const displayData: EmployeeCredential = {
                id: assocData.id,
                credentialId: assocData.pass_id,
                type: 'personal',
                fullName: assocData.full_name,
                document: assocData.document,
                status: 'allowed',
                createdAt: new Date(assocData.created_at),
                updatedAt: new Date(assocData.updated_at),
              };
              setScanResult({ type: 'employee', data: displayData, status: 'allowed', direction: assocDir });
              scheduleReset(3000);
              return;
            } else {
              const denialReason = 'denial_reason' in authorization ? authorization.denial_reason : 'Condutor não autorizado';
              await supabase
                .from('access_sessions')
                .update({
                  status: 'denied',
                  associate_id: assocData.id,
                  denial_reason: denialReason,
                  completed_at: new Date().toISOString(),
                })
                .eq('id', pendingSession.id);

              playBlocked();
              setScanResult({ type: 'error', code: searchCode });
              scheduleReset(4000);
              return;
            }
          }

          // No pending vehicle session — normal pedestrian access for associate
          const direction = await getNextDirection('associate' as any, assocData.id);
          const { data: user } = await supabase.auth.getUser();
          await supabase.from('access_logs').insert({
            subject_type: 'associate' as any,
            subject_id: assocData.id,
            direction,
            gate_id: 'GUARITA_01',
            operator_id: user.user?.id || null,
          });

          playSuccess();
          const displayData: EmployeeCredential = {
            id: assocData.id,
            credentialId: assocData.pass_id,
            type: 'personal',
            fullName: assocData.full_name,
            document: assocData.document,
            jobTitle: `Agregado de ${empData?.full_name || ''}`,
            status: 'allowed',
            createdAt: new Date(assocData.created_at),
            updatedAt: new Date(assocData.updated_at),
          };
          setScanResult({ type: 'employee', data: displayData, status: 'allowed', direction });
          scheduleReset(3000);

        } else {
          playError();
          setScanResult({ type: 'error', code: searchCode });
          scheduleReset(3000);
        }
      } catch (err) {
        console.error('[ScanKiosk] Error processing scan:', err);
        playError();
        setScanResult({ type: 'error', code: searchCode });
        scheduleReset(3000);
      } finally {
        setIsProcessing(false);
      }
    };

    processScan();
  }, [searchCode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && qrCode.trim()) {
      e.preventDefault();
      const code = qrCode.toUpperCase().trim();
      
      if (code.startsWith('VP-') || code.startsWith('VV-') || code.startsWith('EC-') || code.startsWith('AG-')) {
        setSearchCode(code);
      } else {
        playError();
        setScanResult({ type: 'error', code });
        scheduleReset(3000);
      }
      setQrCode('');
    }
  };

  const handleLogoClick = () => {
    setSettingsClicks(prev => prev + 1);
    setTimeout(() => setSettingsClicks(0), 2000);
    
    if (settingsClicks >= 2) {
      setShowSettings(true);
      setSettingsClicks(0);
    }
  };

  const handleExit = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
    navigate('/dashboard');
  };

  const handlePrint = () => {
    if (!scanResult || scanResult.type === 'error') return;
    window.print();
  };

  // ==================== RESULT SCREENS ====================
  
  // ALLOWED - Green fullscreen
  if (scanResult && scanResult.type !== 'error' && scanResult.status === 'allowed') {
    const isVehicle = scanResult.type === 'employee' && scanResult.data.type === 'vehicle';
    const isVisitor = scanResult.type === 'visitor';
    const directionLabel = scanResult.direction === 'in' ? 'ENTRADA' : 'SAÍDA';
    const directionIcon = scanResult.direction === 'in' ? '↓' : '↑';
    
    return (
      <div 
        ref={containerRef}
        className="min-h-screen flex flex-col items-center justify-center p-8 bg-kiosk-allowed print:bg-white"
      >
        <div className="absolute top-0 left-0 right-0 py-4 px-8 text-center bg-black/20 print:hidden">
          <h1 className="text-4xl md:text-5xl font-black tracking-wider text-white">
            ✓ ACESSO LIBERADO — {directionIcon} {directionLabel}
          </h1>
        </div>

        <div
          className="fixed z-50 print:hidden"
          style={{
            top: 'calc(1rem + env(safe-area-inset-top))',
            left: 'calc(1rem + env(safe-area-inset-left))',
          }}
        >
          <Button
            variant="outline"
            onClick={handleExit}
            className="gap-2 bg-background/90 shadow-lg border border-border"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
        </div>

        <div className="absolute top-4 right-4 z-20 print:hidden">
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            Imprimir
          </Button>
        </div>

        <div ref={printRef} className="flex flex-col md:flex-row items-center gap-8 md:gap-12 mt-16 print:mt-0 print:flex-col print:text-black">
          <div 
            className="w-40 h-40 md:w-56 md:h-56 rounded-2xl flex items-center justify-center overflow-hidden border-4 bg-white/90 border-white/50 print:w-32 print:h-32 print:border-gray-300"
            style={{ aspectRatio: '1/1' }}
          >
            {scanResult.data.photoUrl ? (
              <img 
                src={scanResult.data.photoUrl} 
                alt={scanResult.data.fullName} 
                className="w-full h-full"
                style={{ objectFit: 'cover', aspectRatio: '1/1' }}
              />
            ) : isVehicle ? (
              <Car className="w-24 h-24 text-foreground print:text-gray-700" />
            ) : (
              <User className="w-24 h-24 text-foreground print:text-gray-700" />
            )}
          </div>

          <div className="text-center md:text-left text-white print:text-black">
            {isVehicle && scanResult.type === 'employee' && (
              <>
                <p className="text-2xl mb-2 flex items-center justify-center md:justify-start gap-2 print:text-lg print:text-gray-600">
                  <Car className="w-8 h-8 print:w-5 print:h-5" /> VEÍCULO AUTORIZADO
                </p>
                <h2 className="text-5xl md:text-6xl font-black mb-4 print:text-3xl">{scanResult.data.vehiclePlate}</h2>
                {scanResult.data.vehicleMakeModel && (
                  <p className="text-2xl opacity-90 print:text-lg">{scanResult.data.vehicleMakeModel}</p>
                )}
                <p className="text-3xl mt-4 print:text-xl">Motorista: <strong>{scanResult.data.fullName}</strong></p>
              </>
            )}
            
            {!isVehicle && scanResult.type === 'employee' && (
              <>
                <h2 className="text-5xl md:text-6xl font-black mb-4 print:text-3xl">{scanResult.data.fullName}</h2>
                {scanResult.data.jobTitle && (
                  <p className="text-3xl opacity-90 print:text-xl">{scanResult.data.jobTitle}</p>
                )}
              </>
            )}
            
            {isVisitor && scanResult.type === 'visitor' && (
              <>
                <p className="text-2xl mb-2 print:text-lg print:text-gray-600">✓ VISITANTE OK</p>
                <h2 className="text-5xl md:text-6xl font-black mb-2 print:text-3xl">{scanResult.data.fullName}</h2>
                {scanResult.data.companyName && (
                  <p className="text-2xl opacity-90 mb-4 print:text-lg">{scanResult.data.companyName}</p>
                )}
                <div className="mt-6 p-4 rounded-xl bg-black/20 print:bg-gray-100 print:border print:border-gray-300">
                  <p className="text-2xl print:text-lg">
                    VEIO PARA: <strong className="text-3xl print:text-xl">{scanResult.data.visitToName}</strong>
                  </p>
                  {scanResult.data.gateObs && (
                    <p className="text-2xl mt-2 text-warning print:text-orange-600">
                      OBS: <strong>{scanResult.data.gateObs}</strong>
                    </p>
                  )}
                </div>
                <p className="text-xl mt-4 opacity-80 print:text-sm print:text-gray-500">
                  Validade: até {format(new Date(scanResult.data.validUntil), 'HH:mm', { locale: ptBR })}
                </p>
              </>
            )}

            <div className="mt-8 flex items-center justify-center md:justify-start gap-3 print:hidden">
              <CheckCircle className="w-8 h-8" />
              <span className="text-2xl">{directionIcon} {directionLabel} REGISTRADA</span>
            </div>
            
            <p className="text-xl mt-4 opacity-80 print:text-sm print:text-gray-500">
              ⏰ {directionLabel} registrada às {currentTime}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // WAITING SECOND QR - Yellow/Warning fullscreen
  if (scanResult && scanResult.type !== 'error' && scanResult.status === 'waiting_second_qr') {
    const label = scanResult.type === 'visitor' ? 'VISITANTE CONDUTOR' : 'VEÍCULO DE COLABORADOR';
    return (
      <div ref={containerRef} className="min-h-screen flex flex-col items-center justify-center p-8 bg-warning">
        <div className="absolute top-0 left-0 right-0 py-4 px-8 text-center bg-black/20">
          <h1 className="text-4xl md:text-5xl font-black tracking-wider text-white">
            📷 AGUARDANDO SEGUNDO QR
          </h1>
        </div>
        <div className="fixed z-50" style={{ top: 'calc(1rem + env(safe-area-inset-top))', left: 'calc(1rem + env(safe-area-inset-left))' }}>
          <Button variant="outline" onClick={handleExit} className="gap-2 bg-background/90 shadow-lg border border-border">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
        </div>
        <div className="text-center text-white">
          <Clock className="w-32 h-32 md:w-48 md:h-48 mx-auto mb-8 animate-pulse opacity-90" />
          <h2 className="text-4xl md:text-5xl font-black mb-4">{label}</h2>
          <p className="text-3xl font-bold mb-2">{scanResult.data.fullName}</p>
          {scanResult.sessionInfo && (
            <div className="mt-8 p-6 rounded-xl bg-black/20">
              <p className="text-2xl font-bold">Aguardando: {scanResult.sessionInfo.waitingFor}</p>
              <p className="text-xl mt-2 opacity-80">Tempo restante: ~{scanResult.sessionInfo.expiresIn}s</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // SESSION DENIED - Red fullscreen  
  if (scanResult && scanResult.type !== 'error' && scanResult.status === 'session_denied') {
    return (
      <div ref={containerRef} className="min-h-screen flex flex-col items-center justify-center p-8 bg-kiosk-blocked">
        <div className="absolute top-0 left-0 right-0 py-4 px-8 text-center bg-black/30">
          <h1 className="text-4xl md:text-5xl font-black tracking-wider text-white">✕ CONDUTOR NÃO AUTORIZADO</h1>
        </div>
        <div className="fixed z-50" style={{ top: 'calc(1rem + env(safe-area-inset-top))', left: 'calc(1rem + env(safe-area-inset-left))' }}>
          <Button variant="outline" onClick={handleExit} className="gap-2 bg-background/90 shadow-lg border border-border">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
        </div>
        <div className="text-center text-white">
          <XCircle className="w-32 h-32 md:w-48 md:h-48 mx-auto mb-8 opacity-90" />
          <h2 className="text-4xl md:text-5xl font-black mb-4">CONDUTOR NÃO AUTORIZADO</h2>
          <p className="text-3xl mb-8">{scanResult.data.fullName}</p>
          <div className="mt-12 p-6 rounded-xl bg-black/30">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
            <p className="text-2xl font-bold">ESTE COLABORADOR NÃO PODE CONDUZIR ESTE VEÍCULO</p>
          </div>
        </div>
      </div>
    );
  }

  // EXPIRED UNUSED - Red fullscreen
  if (scanResult && scanResult.type === 'visitor' && scanResult.status === 'expired_unused') {
    return (
      <div ref={containerRef} className="min-h-screen flex flex-col items-center justify-center p-8 bg-kiosk-blocked">
        <div className="absolute top-0 left-0 right-0 py-4 px-8 text-center bg-black/30">
          <h1 className="text-4xl md:text-5xl font-black tracking-wider text-white">✕ PASSE EXPIRADO</h1>
        </div>
        <div className="fixed z-50" style={{ top: 'calc(1rem + env(safe-area-inset-top))', left: 'calc(1rem + env(safe-area-inset-left))' }}>
          <Button variant="outline" onClick={handleExit} className="gap-2 bg-background/90 shadow-lg border border-border">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
        </div>
        <div className="text-center text-white">
          <XCircle className="w-32 h-32 md:w-48 md:h-48 mx-auto mb-8 opacity-90" />
          <h2 className="text-4xl md:text-5xl font-black mb-4">PASSE EXPIRADO SEM USO</h2>
          <p className="text-3xl mb-8">{scanResult.data.fullName}</p>
          <div className="mt-12 p-6 rounded-xl bg-black/30">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
            <p className="text-2xl font-bold">PASSE NÃO FOI UTILIZADO DENTRO DA VALIDADE</p>
          </div>
        </div>
      </div>
    );
  }

  // BLOCKED/EXPIRED - Red fullscreen
  if (scanResult && ((scanResult.type === 'visitor' && (scanResult.status === 'blocked' || scanResult.status === 'expired')) ||
      (scanResult.type === 'employee' && scanResult.status === 'blocked') ||
      scanResult.type === 'error')) {
    
    let reason = 'QR NÃO AUTORIZADO';
    let subReason = 'PROCURE O RESPONSÁVEL';
    
    if (scanResult.type === 'visitor') {
      if (scanResult.status === 'blocked') {
        reason = 'PASSE JÁ UTILIZADO';
        subReason = 'CADASTRO ENCERRADO';
      } else if (scanResult.status === 'expired') {
        reason = 'VISITA EXPIRADA';
        subReason = 'VALIDADE ULTRAPASSADA';
      }
    } else if (scanResult.type === 'employee') {
      reason = 'CADASTRO BLOQUEADO';
      subReason = scanResult.data.fullName;
    } else if (scanResult.type === 'error') {
      reason = 'QR NÃO CADASTRADO';
      subReason = scanResult.code;
    }

    return (
      <div 
        ref={containerRef}
        className="min-h-screen flex flex-col items-center justify-center p-8 bg-kiosk-blocked"
      >
        <div className="absolute top-0 left-0 right-0 py-4 px-8 text-center bg-black/30">
          <h1 className="text-4xl md:text-5xl font-black tracking-wider text-white">
            ✕ ACESSO NEGADO
          </h1>
        </div>

        <div
          className="fixed z-50"
          style={{
            top: 'calc(1rem + env(safe-area-inset-top))',
            left: 'calc(1rem + env(safe-area-inset-left))',
          }}
        >
          <Button
            variant="outline"
            onClick={handleExit}
            className="gap-2 bg-background/90 shadow-lg border border-border"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
        </div>

        <div className="text-center text-white">
          <XCircle className="w-32 h-32 md:w-48 md:h-48 mx-auto mb-8 opacity-90" />
          
          <h2 className="text-4xl md:text-5xl font-black mb-4">{reason}</h2>
          <p className="text-2xl md:text-3xl opacity-80 mb-8">{subReason}</p>
          
          <div className="mt-12 p-6 rounded-xl bg-black/30">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
            <p className="text-2xl font-bold">PROCURE O RESPONSÁVEL</p>
          </div>
        </div>
      </div>
    );
  }

  // ==================== IDLE SCREEN ====================
  return (
    <div 
      ref={containerRef}
      className="min-h-screen flex flex-col select-none bg-kiosk-idle"
    >
      {/* Hidden input for USB scanner */}
      <input
        ref={inputRef}
        type="text"
        value={qrCode}
        onChange={(e) => setQrCode(e.target.value.toUpperCase())}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(forceFocus, 50)}
        className="absolute opacity-0 w-0 h-0"
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
      />

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
          <div className="bg-card rounded-2xl p-8 max-w-sm w-full mx-4">
            <h3 className="text-xl font-bold mb-4 text-foreground">Configurações</h3>
            <button
              onClick={handleExit}
              className="w-full py-4 bg-destructive text-destructive-foreground rounded-lg font-bold text-lg mb-3"
            >
              Sair do Kiosk
            </button>
            <button
              onClick={() => setShowSettings(false)}
              className="w-full py-3 border-2 border-border rounded-lg font-medium text-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header
        className="fixed left-4 right-4 z-50 flex justify-between items-center print:hidden"
        style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}
      >
        <div onClick={handleLogoClick} className="cursor-pointer opacity-50 hover:opacity-100 transition-opacity">
          <BrandLogo size="sm" />
        </div>

        <Button 
          variant="default" 
          onClick={handleExit} 
          className="gap-2 shadow-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Sistema
        </Button>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-64 h-64 md:w-80 md:h-80 rounded-3xl border-4 border-dashed flex items-center justify-center mb-8 border-muted-foreground/30 bg-black/5">
          <Camera className="w-24 h-24 md:w-32 md:h-32 text-muted-foreground" />
        </div>

        <h1 className="text-4xl md:text-5xl font-black tracking-wide mb-4 text-foreground">
          📷 APONTE O QR
        </h1>
        
        <p className={cn(
          "text-xl md:text-2xl text-muted-foreground",
          isProcessing && "animate-pulse"
        )}>
          {isProcessing ? '⏳ Processando...' : '⏳ Aguardando leitura...'}
        </p>

        {isFullscreen && (
          <p className="text-sm text-muted-foreground mt-8 opacity-50">
            💡 Clique 3x no logo para sair do modo kiosk
          </p>
        )}

        <div className="absolute bottom-8 right-8 opacity-50">
          <p className="text-2xl font-mono text-foreground">
            {format(new Date(), 'HH:mm')}
          </p>
        </div>
      </main>

      {/* Print styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:bg-white,
          .print\\:bg-white * {
            visibility: visible;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ScanKiosk;

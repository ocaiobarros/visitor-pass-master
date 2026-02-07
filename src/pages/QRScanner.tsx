import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useVisitorByPassId, useUpdateVisitorStatus } from '@/hooks/useVisitors';
import { useCredentialByQrId, useUpdateCredentialStatus } from '@/hooks/useEmployeeCredentials';
import { useCreateAccessLog, useSubjectAccessLogs } from '@/hooks/useAccessLogs';
import { useScanFeedback } from '@/hooks/useScanFeedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { QrCode, UserCheck, UserX, AlertTriangle, CheckCircle, Ban, Car, User, Building2, Info, Camera, Maximize, Clock, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Visitor, EmployeeCredential, AccessLog, AccessDirection } from '@/types/visitor';
import { supabase } from '@/integrations/supabase/client';
import CameraScannerModal from '@/components/CameraScannerModal';
import { logAuditAction } from '@/hooks/useAuditLogs';

type ScanResult = {
  type: 'visitor';
  data: Visitor;
  lastDirection: AccessDirection | null;
  autoAction: 'in' | 'out' | 'blocked' | 'expired' | 'closed';
} | {
  type: 'employee';
  data: EmployeeCredential;
  lastDirection: AccessDirection | null;
  autoAction: 'in' | 'out' | 'blocked';
} | null;

const AccessLogItem = ({ log }: { log: AccessLog }) => (
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

/**
 * Fetches the REAL last access direction directly from the database.
 * This ensures toggle accuracy by always consulting fresh data.
 */
const fetchLastAccessDirection = async (
  subjectType: 'visitor' | 'employee',
  subjectId: string
): Promise<AccessDirection | null> => {
  const { data, error } = await supabase
    .from('access_logs')
    .select('direction')
    .eq('subject_type', subjectType)
    .eq('subject_id', subjectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching last direction:', error);
    return null;
  }
  return data?.direction as AccessDirection | null;
};

const QRScanner = () => {
  const [qrCode, setQrCode] = useState('');
  const [searchCode, setSearchCode] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoResetTimerRef = useRef<ReturnType<typeof setTimeout>>();
  
  const { toast } = useToast();
  const { playSuccess, playError, playBlocked } = useScanFeedback();
  const updateVisitorStatus = useUpdateVisitorStatus();
  const updateCredentialStatus = useUpdateCredentialStatus();
  const createAccessLog = useCreateAccessLog();

  // Query for visitor
  const { data: visitor, isLoading: isLoadingVisitor } = useVisitorByPassId(searchCode.startsWith('VP-') ? searchCode : '');
  
  // Query for employee credential
  const { data: credential, isLoading: isLoadingCredential } = useCredentialByQrId(searchCode.startsWith('EC-') ? searchCode : '');

  // Query for access logs of current subject
  const { data: accessLogs = [] } = useSubjectAccessLogs(
    scanResult?.type === 'visitor' ? 'visitor' : 'employee',
    scanResult?.data.id || ''
  );

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Re-focus after actions
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [scanResult, scanError]);

  // Clear scan and reset for next
  const clearScan = useCallback(() => {
    if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current);
    setQrCode('');
    setSearchCode('');
    setScanResult(null);
    setScanError(null);
    setIsProcessing(false);
    inputRef.current?.focus();
  }, []);

  // Schedule auto-reset after showing result
  const scheduleAutoReset = useCallback((delay: number = 3000) => {
    if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current);
    autoResetTimerRef.current = setTimeout(clearScan, delay);
  }, [clearScan]);

  // ZERO-CLICK AUTO-TOGGLE: Process scan and auto-register
  useEffect(() => {
    if (!searchCode || isProcessing) return;

    const processAutoToggle = async () => {
      // Wait for data to load
      if (searchCode.startsWith('VP-') && isLoadingVisitor) return;
      if (searchCode.startsWith('EC-') && isLoadingCredential) return;

      setIsProcessing(true);

      try {
        if (searchCode.startsWith('VP-')) {
          if (!visitor) {
            playError();
            setScanError(`Passe ${searchCode} não encontrado`);
            scheduleAutoReset(3000);
            return;
          }

          // CRITICAL: Fetch REAL last direction directly from DB
          const lastDir = await fetchLastAccessDirection('visitor', visitor.id);
          
          // Check status - visitor closed
          if (visitor.status === 'closed') {
            playBlocked();
            setScanResult({ type: 'visitor', data: visitor, lastDirection: lastDir, autoAction: 'closed' });
            // Log denied access
            logAuditAction('ACCESS_SCAN', {
              subject_type: 'visitor',
              subject_id: visitor.id,
              result: 'DENIED',
              reason: 'closed',
            });
            scheduleAutoReset(4000);
            return;
          }

          // Check expiration
          if (new Date() > new Date(visitor.validUntil)) {
            playBlocked();
            setScanResult({ type: 'visitor', data: visitor, lastDirection: lastDir, autoAction: 'expired' });
            logAuditAction('ACCESS_SCAN', {
              subject_type: 'visitor',
              subject_id: visitor.id,
              result: 'DENIED',
              reason: 'expired',
            });
            scheduleAutoReset(4000);
            return;
          }

          // TOGGLE LOGIC: last was 'in' → must register 'out', otherwise 'in'
          const nextDirection: AccessDirection = lastDir === 'in' ? 'out' : 'in';
          
          if (nextDirection === 'in') {
            // Entry
            await updateVisitorStatus.mutateAsync({ id: visitor.id, status: 'inside' });
            await createAccessLog.mutateAsync({
              subjectType: 'visitor',
              subjectId: visitor.id,
              direction: 'in',
            });
            playSuccess();
            setScanResult({ 
              type: 'visitor', 
              data: { ...visitor, status: 'inside' }, 
              lastDirection: 'in',
              autoAction: 'in' 
            });
            toast({
              title: '✓ Entrada registrada!',
              description: `${visitor.fullName} entrou.`,
            });
          } else {
            // Exit - close the pass
            await updateVisitorStatus.mutateAsync({ id: visitor.id, status: 'closed' });
            await createAccessLog.mutateAsync({
              subjectType: 'visitor',
              subjectId: visitor.id,
              direction: 'out',
            });
            playSuccess();
            setScanResult({ 
              type: 'visitor', 
              data: { ...visitor, status: 'closed' }, 
              lastDirection: 'out',
              autoAction: 'out' 
            });
            toast({
              title: '✓ Saída registrada!',
              description: `${visitor.fullName} saiu. Passe encerrado.`,
            });
          }
          scheduleAutoReset(3000);

        } else if (searchCode.startsWith('EC-')) {
          if (!credential) {
            playError();
            setScanError(`Credencial ${searchCode} não encontrada`);
            scheduleAutoReset(3000);
            return;
          }

          // CRITICAL: Fetch REAL last direction directly from DB
          const lastDir = await fetchLastAccessDirection('employee', credential.id);

          // Check if credential is blocked
          if (credential.status === 'blocked') {
            playBlocked();
            setScanResult({ type: 'employee', data: credential, lastDirection: lastDir, autoAction: 'blocked' });
            // Log denied access for audit
            logAuditAction('ACCESS_SCAN', {
              subject_type: 'employee',
              subject_id: credential.id,
              credential_id: credential.credentialId,
              result: 'DENIED',
              reason: 'blocked',
            });
            scheduleAutoReset(4000);
            return;
          }

          // TOGGLE LOGIC: last was 'in' → must register 'out', otherwise 'in'
          const nextDirection: AccessDirection = lastDir === 'in' ? 'out' : 'in';

          await createAccessLog.mutateAsync({
            subjectType: 'employee',
            subjectId: credential.id,
            direction: nextDirection,
          });
          
          playSuccess();
          setScanResult({ 
            type: 'employee', 
            data: credential, 
            lastDirection: nextDirection,
            autoAction: nextDirection 
          });
          toast({
            title: nextDirection === 'in' ? '✓ Entrada registrada!' : '✓ Saída registrada!',
            description: `${credential.fullName} ${nextDirection === 'in' ? 'entrou' : 'saiu'}.`,
          });
          scheduleAutoReset(3000);
        }
      } catch (error: any) {
        playError();
        setScanError(error.message || 'Erro ao processar');
        scheduleAutoReset(3000);
      }
    };

    processAutoToggle();
  }, [searchCode, visitor, credential, isLoadingVisitor, isLoadingCredential, isProcessing]);

  const handleScan = () => {
    if (!qrCode.trim()) {
      toast({
        title: 'Código vazio',
        description: 'Digite ou escaneie o código.',
        variant: 'destructive',
      });
      inputRef.current?.focus();
      return;
    }

    const code = qrCode.toUpperCase().trim();
    
    if (!code.startsWith('VP-') && !code.startsWith('EC-')) {
      playError();
      setScanError('Código inválido. Use VP-XXXXXXXX ou EC-XXXXXXXX.');
      setQrCode('');
      scheduleAutoReset(3000);
      return;
    }

    // Clear previous and trigger new search
    clearScan();
    setSearchCode(code);
  };

  const handleCameraScan = (code: string) => {
    const normalizedCode = code.toUpperCase().trim();
    clearScan();
    
    if (normalizedCode.startsWith('VP-') || normalizedCode.startsWith('EC-')) {
      setSearchCode(normalizedCode);
    } else {
      playError();
      setScanError('Código inválido.');
      scheduleAutoReset(3000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScan();
    }
  };

  const isLoading = isLoadingVisitor || isLoadingCredential || isProcessing;
  const recentLogs = accessLogs.slice(0, 5);

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <QrCode className="w-8 h-8 text-primary" />
              Scanner de Acesso
            </h1>
            <p className="text-muted-foreground mt-1">Escaneie para registro automático de entrada/saída</p>
          </div>
          <Link to="/scan/kiosk">
            <Button variant="outline" className="gap-2">
              <Maximize className="w-4 h-4" />
              <span className="hidden sm:inline">Modo Kiosk</span>
            </Button>
          </Link>
        </div>

        {/* Scanner Input */}
        <Card>
          <CardHeader>
            <CardTitle>Escanear Código</CardTitle>
            <CardDescription>
              Posicione o leitor e escaneie. O sistema registra automaticamente entrada ou saída.
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
              <Button 
                variant="outline" 
                size="lg" 
                onClick={() => setCameraOpen(true)}
                className="shrink-0 gap-2"
              >
                <Camera className="w-5 h-5" />
                <span className="hidden sm:inline">Câmera</span>
              </Button>
              <Button onClick={handleScan} size="lg" disabled={isLoading} className="shrink-0">
                {isLoading ? 'Processando...' : 'Verificar'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              💡 Zero-clique: O sistema alterna automaticamente entre entrada e saída
            </p>
          </CardContent>
        </Card>

        {/* Camera Scanner Modal */}
        <CameraScannerModal
          open={cameraOpen}
          onClose={() => setCameraOpen(false)}
          onScan={handleCameraScan}
        />

        {/* Scan Error */}
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
              <Button variant="outline" onClick={clearScan} className="mt-4 w-full">
                Escanear Outro
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Visitor Result */}
        {scanResult?.type === 'visitor' && (
          <Card className={
            scanResult.autoAction === 'in' ? 'border-success/50 bg-success/5' :
            scanResult.autoAction === 'out' ? 'border-primary/50 bg-primary/5' :
            'border-destructive/50 bg-destructive/5'
          }>
            <CardContent className="pt-6">
              {/* Status Banner */}
              <div className={`mb-4 p-4 rounded-lg text-center text-white font-bold text-xl ${
                scanResult.autoAction === 'in' ? 'bg-success' :
                scanResult.autoAction === 'out' ? 'bg-primary' :
                'bg-destructive'
              }`}>
                {scanResult.autoAction === 'in' && '✓ ENTRADA REGISTRADA'}
                {scanResult.autoAction === 'out' && '✓ SAÍDA REGISTRADA'}
                {scanResult.autoAction === 'blocked' && '✕ ACESSO NEGADO'}
                {scanResult.autoAction === 'expired' && '✕ PASSE EXPIRADO'}
                {scanResult.autoAction === 'closed' && '✕ PASSE JÁ UTILIZADO'}
              </div>

              <div className="flex items-start gap-4">
                <div className="w-20 h-20 rounded-xl bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0">
                  {scanResult.data.photoUrl ? (
                    <img src={scanResult.data.photoUrl} alt={scanResult.data.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-bold text-muted-foreground">{scanResult.data.fullName.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-foreground">{scanResult.data.fullName}</h3>
                  <p className="text-muted-foreground">{scanResult.data.company || 'Visitante'}</p>
                  
                  {/* Gate Info */}
                  <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-lg">
                      <span className="font-medium">DESTINO:</span>{' '}
                      <span className="font-bold">{scanResult.data.visitToType === 'setor' ? '📍 ' : '👤 '}{scanResult.data.visitToName}</span>
                    </p>
                    {scanResult.data.gateObs && (
                      <p className="text-warning font-bold mt-1">⚠️ {scanResult.data.gateObs}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Logs */}
              {recentLogs.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm text-muted-foreground">HISTÓRICO</span>
                  </div>
                  <div className="space-y-2">
                    {recentLogs.map((log) => (
                      <AccessLogItem key={log.id} log={log} />
                    ))}
                  </div>
                </div>
              )}

              <Button variant="ghost" onClick={clearScan} className="mt-4 w-full">
                Escanear Outro Código
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Employee Credential Result */}
        {scanResult?.type === 'employee' && (
          <Card className={
            scanResult.autoAction === 'blocked' ? 'border-destructive/50 bg-destructive/5' :
            scanResult.autoAction === 'in' ? 'border-success/50 bg-success/5' :
            'border-primary/50 bg-primary/5'
          }>
            <CardContent className="pt-6">
              {/* Status Banner */}
              <div className={`mb-4 p-4 rounded-lg text-center text-white font-bold text-xl ${
                scanResult.autoAction === 'blocked' ? 'bg-destructive' :
                scanResult.autoAction === 'in' ? 'bg-success' : 'bg-primary'
              }`}>
                {scanResult.autoAction === 'in' && '✓ ENTRADA REGISTRADA'}
                {scanResult.autoAction === 'out' && '✓ SAÍDA REGISTRADA'}
                {scanResult.autoAction === 'blocked' && '✕ ACESSO BLOQUEADO'}
              </div>

              <div className="flex items-start gap-4">
                {scanResult.data.type === 'personal' ? (
                  <div className="w-24 h-24 rounded-xl bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0">
                    {scanResult.data.photoUrl ? (
                      <img src={scanResult.data.photoUrl} alt={scanResult.data.fullName} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-12 h-12 text-muted-foreground" />
                    )}
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-xl bg-muted border border-border flex flex-col items-center justify-center shrink-0">
                    <Car className="w-10 h-10 text-muted-foreground mb-1" />
                    <p className="text-xs font-mono font-bold">{scanResult.data.vehiclePlate}</p>
                  </div>
                )}
                
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-foreground">{scanResult.data.fullName}</h3>
                  
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

              {/* Recent Logs */}
              {recentLogs.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm text-muted-foreground">HISTÓRICO</span>
                  </div>
                  <div className="space-y-2">
                    {recentLogs.map((log) => (
                      <AccessLogItem key={log.id} log={log} />
                    ))}
                  </div>
                </div>
              )}

              <Button variant="ghost" onClick={clearScan} className="mt-4 w-full">
                Escanear Outro Código
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default QRScanner;

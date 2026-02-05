import { useState, useRef, useEffect, useCallback } from 'react';
import { useVisitorByPassId, useUpdateVisitorStatus } from '@/hooks/useVisitors';
import { useCredentialByQrId, useUpdateCredentialStatus } from '@/hooks/useEmployeeCredentials';
import { useCreateAccessLog, useSubjectAccessLogs } from '@/hooks/useAccessLogs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useScanFeedback } from '@/hooks/useScanFeedback';
import ScanFeedbackOverlay from '@/components/ScanFeedbackOverlay';
import { 
  QrCode, UserCheck, UserX, AlertTriangle, CheckCircle, Ban, 
  Car, User, Building2, Info, Camera, Clock, ArrowDownLeft, 
  ArrowUpRight, Maximize, Minimize, LogOut 
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Visitor, EmployeeCredential, AccessLog } from '@/types/visitor';
import CameraScannerModal from '@/components/CameraScannerModal';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';

type ScanResult = {
  type: 'visitor';
  data: Visitor;
} | {
  type: 'employee';
  data: EmployeeCredential;
} | null;

type FeedbackStatus = 'success' | 'error' | 'blocked' | 'warning' | null;

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

const ScanKiosk = () => {
  const [qrCode, setQrCode] = useState('');
  const [searchCode, setSearchCode] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const focusIntervalRef = useRef<ReturnType<typeof setInterval>>();
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { playSuccess, playError, playBlocked, playWarning } = useScanFeedback();
  const updateVisitorStatus = useUpdateVisitorStatus();
  const updateCredentialStatus = useUpdateCredentialStatus();
  const createAccessLog = useCreateAccessLog();

  // Query for visitor
  const { data: visitor, isLoading: isLoadingVisitor } = useVisitorByPassId(
    searchCode.startsWith('VP-') ? searchCode : ''
  );
  
  // Query for employee credential
  const { data: credential, isLoading: isLoadingCredential } = useCredentialByQrId(
    searchCode.startsWith('EC-') ? searchCode : ''
  );

  // Query for access logs of current subject
  const { data: accessLogs = [] } = useSubjectAccessLogs(
    scanResult?.type === 'visitor' ? 'visitor' : 'employee',
    scanResult?.data.id || ''
  );

  // Aggressive auto-focus for kiosk mode
  const forceFocus = useCallback(() => {
    if (!cameraOpen && !feedbackStatus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [cameraOpen, feedbackStatus]);

  // Initial focus + continuous focus guard
  useEffect(() => {
    forceFocus();
    
    // Check focus every 2 seconds (kiosk resilience)
    focusIntervalRef.current = setInterval(forceFocus, 2000);
    
    return () => {
      if (focusIntervalRef.current) {
        clearInterval(focusIntervalRef.current);
      }
    };
  }, [forceFocus]);

  // Re-focus after feedback overlay closes
  useEffect(() => {
    if (!feedbackStatus) {
      const timer = setTimeout(forceFocus, 100);
      return () => clearTimeout(timer);
    }
  }, [feedbackStatus, forceFocus]);

  // Re-focus after scan result changes
  useEffect(() => {
    const timer = setTimeout(forceFocus, 100);
    return () => clearTimeout(timer);
  }, [scanResult, scanError, forceFocus]);

  // Prevent blur on input (kiosk mode)
  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Immediately refocus unless camera is open
    if (!cameraOpen && !feedbackStatus) {
      setTimeout(forceFocus, 50);
    }
  }, [cameraOpen, feedbackStatus, forceFocus]);

  // Toggle fullscreen
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Show feedback overlay
  const showFeedback = useCallback((status: FeedbackStatus, message: string = '') => {
    setFeedbackStatus(status);
    setFeedbackMessage(message);
    
    // Trigger sound/vibration
    switch (status) {
      case 'success':
        playSuccess();
        break;
      case 'error':
        playError();
        break;
      case 'blocked':
        playBlocked();
        break;
      case 'warning':
        playWarning();
        break;
    }
  }, [playSuccess, playError, playBlocked, playWarning]);

  const clearFeedback = useCallback(() => {
    setFeedbackStatus(null);
    setFeedbackMessage('');
  }, []);

  // Process scan result when data arrives
  useEffect(() => {
    if (!searchCode) return;

    const timer = setTimeout(() => {
      if (searchCode.startsWith('VP-')) {
        if (visitor) {
          setScanResult({ type: 'visitor', data: visitor });
          setScanError(null);
          
          // Check visitor status and show appropriate feedback
          if (visitor.status === 'closed') {
            showFeedback('blocked', 'Passe já encerrado');
          } else if (new Date() > new Date(visitor.validUntil)) {
            showFeedback('warning', 'Passe expirado');
          } else {
            showFeedback('success', visitor.fullName);
          }
        } else if (!isLoadingVisitor) {
          setScanError(`Passe ${searchCode} não encontrado`);
          setScanResult(null);
          showFeedback('error', searchCode);
        }
      } else if (searchCode.startsWith('EC-')) {
        if (credential) {
          setScanResult({ type: 'employee', data: credential });
          setScanError(null);
          
          // Check credential status
          if (credential.status === 'blocked') {
            showFeedback('blocked', credential.fullName);
          } else {
            showFeedback('success', credential.fullName);
          }
        } else if (!isLoadingCredential) {
          setScanError(`Credencial ${searchCode} não encontrada`);
          setScanResult(null);
          showFeedback('error', searchCode);
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchCode, visitor, credential, isLoadingVisitor, isLoadingCredential, showFeedback]);

  const handleScan = () => {
    if (!qrCode.trim()) {
      toast({
        title: 'Código vazio',
        description: 'Digite ou escaneie o código do passe/crachá.',
        variant: 'destructive',
      });
      forceFocus();
      return;
    }

    const code = qrCode.toUpperCase().trim();
    
    if (!code.startsWith('VP-') && !code.startsWith('EC-')) {
      setScanError('Código inválido. Use VP-XXXXXXXX para visitantes ou EC-XXXXXXXX para colaboradores.');
      setScanResult(null);
      showFeedback('error', 'Código inválido');
      setQrCode('');
      return;
    }

    // Clear previous state
    setScanResult(null);
    setScanError(null);
    setSearchCode(code);
    setQrCode('');
  };

  const handleCameraScan = (code: string) => {
    const normalizedCode = code.toUpperCase().trim();
    setQrCode('');
    setScanError(null);
    setScanResult(null);
    
    if (normalizedCode.startsWith('VP-') || normalizedCode.startsWith('EC-')) {
      setSearchCode(normalizedCode);
    } else {
      setScanError('Código inválido. Use VP-XXXXXXXX para visitantes ou EC-XXXXXXXX para colaboradores.');
      showFeedback('error', 'Código inválido');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScan();
    }
  };

  const handleCheckIn = async () => {
    if (!scanResult) return;

    if (scanResult.type === 'visitor') {
      const v = scanResult.data;
      
      if (v.status === 'closed') {
        showFeedback('blocked', 'Passe já encerrado');
        return;
      }

      if (new Date() > new Date(v.validUntil)) {
        showFeedback('warning', 'Passe expirado');
        return;
      }

      await updateVisitorStatus.mutateAsync({ id: v.id, status: 'inside' });
      await createAccessLog.mutateAsync({
        subjectType: 'visitor',
        subjectId: v.id,
        direction: 'in',
      });
      
      setScanResult({ type: 'visitor', data: { ...v, status: 'inside' } });
      showFeedback('success', `${v.fullName} - ENTRADA`);
    } else {
      const c = scanResult.data;
      
      if (c.status === 'blocked') {
        showFeedback('blocked', 'Acesso bloqueado');
        return;
      }

      await createAccessLog.mutateAsync({
        subjectType: 'employee',
        subjectId: c.id,
        direction: 'in',
      });
      
      showFeedback('success', `${c.fullName} - ENTRADA`);
    }
  };

  const handleCheckOut = async () => {
    if (!scanResult) return;

    if (scanResult.type === 'visitor') {
      const v = scanResult.data;
      
      await updateVisitorStatus.mutateAsync({ id: v.id, status: 'closed' });
      await createAccessLog.mutateAsync({
        subjectType: 'visitor',
        subjectId: v.id,
        direction: 'out',
      });
      
      setScanResult({ type: 'visitor', data: { ...v, status: 'closed' } });
      showFeedback('success', `${v.fullName} - SAÍDA`);
    } else {
      const c = scanResult.data;
      
      await createAccessLog.mutateAsync({
        subjectType: 'employee',
        subjectId: c.id,
        direction: 'out',
      });
      
      showFeedback('success', `${c.fullName} - SAÍDA`);
    }
  };

  const clearScan = () => {
    setQrCode('');
    setSearchCode('');
    setScanResult(null);
    setScanError(null);
    forceFocus();
  };

  const handleExit = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
    navigate('/dashboard');
  };

  const isLoading = isLoadingVisitor || isLoadingCredential;
  const recentLogs = accessLogs.slice(0, 5);

  return (
    <div 
      ref={containerRef}
      className="min-h-screen bg-background flex flex-col select-none"
    >
      {/* Feedback Overlay */}
      <ScanFeedbackOverlay
        status={feedbackStatus}
        message={feedbackMessage}
        onComplete={clearFeedback}
        duration={1200}
      />

      {/* Minimal Header */}
      <header className="bg-card border-b border-border px-4 py-2 flex items-center justify-between shrink-0">
        <BrandLogo size="sm" />
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            className="h-8 w-8"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleExit}
            title="Sair do modo kiosk"
            className="h-8 w-8"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6 overflow-auto">
        <div className="max-w-3xl mx-auto space-y-4">
          
          {/* Scanner Input - Large and prominent */}
          <div className="bg-card rounded-xl border-2 border-primary/30 p-4 md:p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <QrCode className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Scanner de Acesso</h1>
                <p className="text-sm text-muted-foreground">Posicione o QR Code no leitor</p>
              </div>
            </div>
            
            <div className="flex gap-2 sm:gap-3">
              <Input
                ref={inputRef}
                placeholder="Aguardando leitura..."
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value.toUpperCase())}
                onBlur={handleBlur}
                className="font-mono text-xl h-14 text-center tracking-wider border-2 focus:border-primary"
                onKeyDown={handleKeyDown}
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              <Button 
                variant="outline" 
                size="lg"
                className="h-14 px-4 shrink-0"
                onClick={() => setCameraOpen(true)}
              >
                <Camera className="w-5 h-5" />
              </Button>
              <Button 
                onClick={handleScan} 
                size="lg" 
                disabled={isLoading}
                className="h-14 px-6 shrink-0"
              >
                {isLoading ? 'Buscando...' : 'OK'}
              </Button>
            </div>
          </div>

          {/* Camera Scanner Modal */}
          <CameraScannerModal
            open={cameraOpen}
            onClose={() => setCameraOpen(false)}
            onScan={handleCameraScan}
          />

          {/* Scan Error */}
          {scanError && (
            <div className="bg-destructive/10 border-2 border-destructive/30 rounded-xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-destructive/20 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-8 h-8 text-destructive" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-destructive">NÃO ENCONTRADO</h3>
                  <p className="text-muted-foreground mt-1">{scanError}</p>
                </div>
              </div>
              <Button variant="outline" onClick={clearScan} className="mt-4 w-full h-12">
                Escanear Outro Código
              </Button>
            </div>
          )}

          {/* Visitor Result */}
          {scanResult?.type === 'visitor' && (
            <div className={`rounded-xl border-2 p-4 md:p-6 ${
              scanResult.data.status === 'closed' 
                ? 'bg-muted/50 border-muted' 
                : 'bg-success/5 border-success'
            }`}>
              <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                {/* Photo */}
                <div className="w-24 h-24 md:w-28 md:h-28 rounded-xl bg-muted border-2 border-border flex items-center justify-center overflow-hidden shrink-0 mx-auto md:mx-0">
                  {scanResult.data.photoUrl ? (
                    <img src={scanResult.data.photoUrl} alt={scanResult.data.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-12 h-12 text-muted-foreground" />
                  )}
                </div>
                
                {/* Info */}
                <div className="flex-1 text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                    {scanResult.data.status === 'closed' ? (
                      <>
                        <Ban className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm font-bold text-muted-foreground">PASSE ENCERRADO</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5 text-success" />
                        <span className="text-sm font-bold text-success">LIBERADO</span>
                      </>
                    )}
                  </div>
                  
                  <h2 className="text-2xl md:text-3xl font-bold text-foreground">{scanResult.data.fullName}</h2>
                  <p className="text-muted-foreground">{scanResult.data.company || 'Sem empresa'}</p>
                  
                  {/* Gate Info - Big and visible */}
                  <div className="mt-3 p-3 rounded-lg bg-primary/10 border border-primary/20 text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="w-4 h-4 text-primary" />
                      <span className="font-bold text-primary text-sm">INFORMAÇÕES</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-base">
                        <span className="font-medium">VEIO PARA:</span>{' '}
                        <span className="font-bold text-lg">
                          {scanResult.data.visitToType === 'setor' ? '📍 ' : '👤 '}
                          {scanResult.data.visitToName}
                        </span>
                      </p>
                      {scanResult.data.gateObs && (
                        <p className="text-base">
                          <span className="font-medium">OBS:</span>{' '}
                          <span className="font-bold text-warning">{scanResult.data.gateObs}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Válido até</p>
                      <p className="font-medium">
                        {format(new Date(scanResult.data.validUntil), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Status</p>
                      <p className="font-medium">
                        {scanResult.data.status === 'inside'
                          ? '🟢 Dentro'
                          : scanResult.data.status === 'outside'
                          ? '⚪ Fora'
                          : scanResult.data.status === 'pending'
                          ? '🟡 Pendente'
                          : '🔴 Encerrado'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Access Logs */}
              {recentLogs.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-xs text-muted-foreground">HISTÓRICO</span>
                  </div>
                  <div className="space-y-1.5">
                    {recentLogs.map((log) => (
                      <AccessLogItem key={log.id} log={log} />
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons - Large for touch */}
              {scanResult.data.status !== 'closed' && (
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <Button
                    onClick={handleCheckIn}
                    className="bg-success hover:bg-success/90 text-success-foreground gap-2 h-16 text-xl font-bold"
                    disabled={scanResult.data.status === 'inside' || updateVisitorStatus.isPending}
                  >
                    <UserCheck className="w-7 h-7" />
                    ENTRADA
                  </Button>
                  <Button
                    onClick={handleCheckOut}
                    variant="outline"
                    className="gap-2 h-16 text-xl font-bold border-2"
                    disabled={scanResult.data.status !== 'inside' || updateVisitorStatus.isPending}
                  >
                    <UserX className="w-7 h-7" />
                    SAÍDA
                  </Button>
                </div>
              )}

              <Button variant="ghost" onClick={clearScan} className="mt-3 w-full h-10">
                Escanear Outro
              </Button>
            </div>
          )}

          {/* Employee Credential Result */}
          {scanResult?.type === 'employee' && (
            <div className={`rounded-xl border-2 p-4 md:p-6 ${
              scanResult.data.status === 'blocked' 
                ? 'bg-destructive/5 border-destructive' 
                : 'bg-success/5 border-success'
            }`}>
              <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                {/* Photo/Icon */}
                <div className="w-24 h-24 md:w-28 md:h-28 rounded-xl bg-muted border-2 border-border flex items-center justify-center overflow-hidden shrink-0 mx-auto md:mx-0">
                  {scanResult.data.photoUrl ? (
                    <img src={scanResult.data.photoUrl} alt={scanResult.data.fullName} className="w-full h-full object-cover" />
                  ) : scanResult.data.type === 'vehicle' ? (
                    <Car className="w-12 h-12 text-muted-foreground" />
                  ) : (
                    <User className="w-12 h-12 text-muted-foreground" />
                  )}
                </div>
                
                {/* Info */}
                <div className="flex-1 text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                    {scanResult.data.status === 'blocked' ? (
                      <>
                        <Ban className="w-5 h-5 text-destructive" />
                        <span className="text-sm font-bold text-destructive">BLOQUEADO</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5 text-success" />
                        <span className="text-sm font-bold text-success">
                          {scanResult.data.type === 'vehicle' ? 'VEÍCULO LIBERADO' : 'COLABORADOR'}
                        </span>
                      </>
                    )}
                  </div>
                  
                  <h2 className="text-2xl md:text-3xl font-bold text-foreground">{scanResult.data.fullName}</h2>
                  
                  {scanResult.data.type === 'vehicle' ? (
                    <div className="flex items-center justify-center md:justify-start gap-2 mt-2">
                      <Car className="w-5 h-5 text-primary" />
                      <span className="text-xl font-mono font-bold">{scanResult.data.vehiclePlate}</span>
                      {scanResult.data.vehicleMakeModel && (
                        <span className="text-muted-foreground">({scanResult.data.vehicleMakeModel})</span>
                      )}
                    </div>
                  ) : (
                    <>
                      {scanResult.data.jobTitle && (
                        <p className="text-muted-foreground">{scanResult.data.jobTitle}</p>
                      )}
                      {scanResult.data.departmentId && (
                        <div className="flex items-center justify-center md:justify-start gap-1 mt-1 text-sm text-muted-foreground">
                          <Building2 className="w-4 h-4" />
                          <span>Setor vinculado</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Recent Access Logs */}
              {recentLogs.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-xs text-muted-foreground">HISTÓRICO</span>
                  </div>
                  <div className="space-y-1.5">
                    {recentLogs.map((log) => (
                      <AccessLogItem key={log.id} log={log} />
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {scanResult.data.status !== 'blocked' && (
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <Button
                    onClick={handleCheckIn}
                    className="bg-success hover:bg-success/90 text-success-foreground gap-2 h-16 text-xl font-bold"
                    disabled={createAccessLog.isPending}
                  >
                    <UserCheck className="w-7 h-7" />
                    ENTRADA
                  </Button>
                  <Button
                    onClick={handleCheckOut}
                    variant="outline"
                    className="gap-2 h-16 text-xl font-bold border-2"
                    disabled={createAccessLog.isPending}
                  >
                    <UserX className="w-7 h-7" />
                    SAÍDA
                  </Button>
                </div>
              )}

              <Button variant="ghost" onClick={clearScan} className="mt-3 w-full h-10">
                Escanear Outro
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ScanKiosk;

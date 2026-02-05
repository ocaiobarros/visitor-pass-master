import { useState, useRef, useEffect } from 'react';
import { useVisitorByPassId, useUpdateVisitorStatus } from '@/hooks/useVisitors';
import { useCredentialByQrId, useUpdateCredentialStatus } from '@/hooks/useEmployeeCredentials';
import { useCreateAccessLog, useSubjectAccessLogs } from '@/hooks/useAccessLogs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { QrCode, UserCheck, UserX, AlertTriangle, CheckCircle, Ban, Car, User, Building2, Info, Camera, Clock, ArrowDownLeft, ArrowUpRight, Maximize, Minimize, LogOut } from 'lucide-react';
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
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();
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

  // Auto-focus on mount and after actions
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Re-focus after scan result changes
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [scanResult, scanError]);

  // Process scan result when data arrives
  useEffect(() => {
    if (!searchCode) return;

    const timer = setTimeout(() => {
      if (searchCode.startsWith('VP-')) {
        if (visitor) {
          setScanResult({ type: 'visitor', data: visitor });
          setScanError(null);
        } else if (!isLoadingVisitor) {
          setScanError(`Passe ${searchCode} não encontrado`);
          setScanResult(null);
        }
      } else if (searchCode.startsWith('EC-')) {
        if (credential) {
          setScanResult({ type: 'employee', data: credential });
          setScanError(null);
        } else if (!isLoadingCredential) {
          setScanError(`Credencial ${searchCode} não encontrada`);
          setScanResult(null);
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchCode, visitor, credential, isLoadingVisitor, isLoadingCredential]);

  const handleScan = () => {
    if (!qrCode.trim()) {
      toast({
        title: 'Código vazio',
        description: 'Digite ou escaneie o código do passe/crachá.',
        variant: 'destructive',
      });
      inputRef.current?.focus();
      return;
    }

    const code = qrCode.toUpperCase().trim();
    
    if (!code.startsWith('VP-') && !code.startsWith('EC-')) {
      setScanError('Código inválido. Use VP-XXXXXXXX para visitantes ou EC-XXXXXXXX para colaboradores.');
      setScanResult(null);
      setQrCode('');
      inputRef.current?.focus();
      return;
    }

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
        toast({
          title: 'Acesso negado',
          description: 'Este passe já foi utilizado e encerrado.',
          variant: 'destructive',
        });
        return;
      }

      if (new Date() > new Date(v.validUntil)) {
        toast({
          title: 'Passe expirado',
          description: 'A validade deste passe já expirou.',
          variant: 'destructive',
        });
        return;
      }

      await updateVisitorStatus.mutateAsync({ id: v.id, status: 'inside' });
      await createAccessLog.mutateAsync({
        subjectType: 'visitor',
        subjectId: v.id,
        direction: 'in',
      });
      
      setScanResult({ type: 'visitor', data: { ...v, status: 'inside' } });
    } else {
      const c = scanResult.data;
      
      if (c.status === 'blocked') {
        toast({
          title: 'Acesso bloqueado',
          description: 'Este colaborador está com acesso bloqueado.',
          variant: 'destructive',
        });
        return;
      }

      await createAccessLog.mutateAsync({
        subjectType: 'employee',
        subjectId: c.id,
        direction: 'in',
      });
    }
    
    inputRef.current?.focus();
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
    } else {
      const c = scanResult.data;
      
      await createAccessLog.mutateAsync({
        subjectType: 'employee',
        subjectId: c.id,
        direction: 'out',
      });
    }
    
    inputRef.current?.focus();
  };

  const clearScan = () => {
    setQrCode('');
    setSearchCode('');
    setScanResult(null);
    setScanError(null);
    inputRef.current?.focus();
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
      className="min-h-screen bg-background flex flex-col"
    >
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
        <BrandLogo size="sm" />
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleExit}
            title="Sair do modo kiosk"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6 overflow-auto">
        <div className="max-w-3xl mx-auto space-y-6">
          
          {/* Scanner Input - Always visible */}
          <div className="bg-card rounded-xl border border-border p-4 md:p-6">
            <div className="flex items-center gap-3 mb-4">
              <QrCode className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-bold">Scanner de Acesso</h1>
            </div>
            
            <div className="flex gap-2 sm:gap-4">
              <Input
                ref={inputRef}
                placeholder="VP-XXXXXXXX ou EC-XXXXXXXX"
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value.toUpperCase())}
                className="font-mono text-lg h-12"
                onKeyDown={handleKeyDown}
                autoFocus
                autoComplete="off"
              />
              <Button 
                variant="outline" 
                size="lg"
                className="h-12 px-4"
                onClick={() => setCameraOpen(true)}
              >
                <Camera className="w-5 h-5" />
              </Button>
              <Button 
                onClick={handleScan} 
                size="lg" 
                disabled={isLoading}
                className="h-12 px-6"
              >
                {isLoading ? 'Buscando...' : 'Verificar'}
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
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl bg-destructive/20 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-10 h-10 text-destructive" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-destructive">NÃO CADASTRADO</h3>
                  <p className="text-muted-foreground mt-1">{scanError}</p>
                </div>
              </div>
              <Button variant="outline" onClick={clearScan} className="mt-6 w-full">
                Escanear Outro Código
              </Button>
            </div>
          )}

          {/* Visitor Result */}
          {scanResult?.type === 'visitor' && (
            <div className={`rounded-xl border-2 p-6 ${
              scanResult.data.status === 'closed' 
                ? 'bg-muted/50 border-muted' 
                : 'bg-success/5 border-success'
            }`}>
              <div className="flex flex-col md:flex-row gap-6">
                {/* Photo */}
                <div className="w-32 h-32 rounded-xl bg-muted border-2 border-border flex items-center justify-center overflow-hidden shrink-0 mx-auto md:mx-0">
                  {scanResult.data.photoUrl ? (
                    <img src={scanResult.data.photoUrl} alt={scanResult.data.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-16 h-16 text-muted-foreground" />
                  )}
                </div>
                
                {/* Info */}
                <div className="flex-1 text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                    {scanResult.data.status === 'closed' ? (
                      <>
                        <Ban className="w-6 h-6 text-muted-foreground" />
                        <span className="text-lg font-bold text-muted-foreground">PASSE ENCERRADO</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-6 h-6 text-success" />
                        <span className="text-lg font-bold text-success">LIBERADO</span>
                      </>
                    )}
                  </div>
                  
                  <h2 className="text-3xl font-bold text-foreground">{scanResult.data.fullName}</h2>
                  <p className="text-lg text-muted-foreground">{scanResult.data.company || 'Sem empresa'}</p>
                  
                  {/* Gate Info - Big and visible */}
                  <div className="mt-4 p-4 rounded-lg bg-primary/10 border border-primary/20 text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="w-5 h-5 text-primary" />
                      <span className="font-bold text-primary">INFORMAÇÕES PARA GUARITA</span>
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg">
                        <span className="font-medium">VEIO PARA:</span>{' '}
                        <span className="font-bold text-xl">
                          {scanResult.data.visitToType === 'setor' ? '📍 ' : '👤 '}
                          {scanResult.data.visitToName}
                        </span>
                      </p>
                      {scanResult.data.gateObs && (
                        <p className="text-lg">
                          <span className="font-medium">OBS:</span>{' '}
                          <span className="font-bold text-warning text-xl">{scanResult.data.gateObs}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Válido até</p>
                      <p className="font-medium">
                        {format(new Date(scanResult.data.validUntil), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status Atual</p>
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
                <div className="mt-6 pt-6 border-t border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm text-muted-foreground">HISTÓRICO DE ACESSOS</span>
                  </div>
                  <div className="space-y-2">
                    {recentLogs.map((log) => (
                      <AccessLogItem key={log.id} log={log} />
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {scanResult.data.status !== 'closed' && (
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <Button
                    onClick={handleCheckIn}
                    className="bg-success hover:bg-success/90 text-success-foreground gap-2 h-14 text-lg"
                    disabled={scanResult.data.status === 'inside' || updateVisitorStatus.isPending}
                  >
                    <UserCheck className="w-6 h-6" />
                    Entrada
                  </Button>
                  <Button
                    onClick={handleCheckOut}
                    variant="outline"
                    className="gap-2 h-14 text-lg"
                    disabled={scanResult.data.status !== 'inside' || updateVisitorStatus.isPending}
                  >
                    <UserX className="w-6 h-6" />
                    Saída
                  </Button>
                </div>
              )}

              <Button variant="ghost" onClick={clearScan} className="mt-4 w-full">
                Escanear Outro Código
              </Button>
            </div>
          )}

          {/* Employee Credential Result */}
          {scanResult?.type === 'employee' && (
            <div className={`rounded-xl border-2 p-6 ${
              scanResult.data.status === 'blocked' 
                ? 'bg-destructive/5 border-destructive' 
                : 'bg-success/5 border-success'
            }`}>
              <div className="flex flex-col md:flex-row gap-6">
                {/* Photo/Vehicle */}
                {scanResult.data.type === 'personal' ? (
                  <div className="w-32 h-32 rounded-xl bg-muted border-2 border-border flex items-center justify-center overflow-hidden shrink-0 mx-auto md:mx-0">
                    {scanResult.data.photoUrl ? (
                      <img src={scanResult.data.photoUrl} alt={scanResult.data.fullName} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-16 h-16 text-muted-foreground" />
                    )}
                  </div>
                ) : (
                  <div className="w-32 h-32 rounded-xl bg-muted border-2 border-border flex flex-col items-center justify-center shrink-0 mx-auto md:mx-0">
                    <Car className="w-12 h-12 text-muted-foreground mb-1" />
                    <p className="text-sm font-mono font-bold">{scanResult.data.vehiclePlate}</p>
                  </div>
                )}
                
                {/* Info */}
                <div className="flex-1 text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                    {scanResult.data.status === 'blocked' ? (
                      <>
                        <Ban className="w-6 h-6 text-destructive" />
                        <span className="text-lg font-bold text-destructive">BLOQUEADO</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-6 h-6 text-success" />
                        <span className="text-lg font-bold text-success">LIBERADO</span>
                      </>
                    )}
                  </div>
                  
                  <h2 className="text-3xl font-bold text-foreground">{scanResult.data.fullName}</h2>
                  
                  {scanResult.data.type === 'vehicle' && (
                    <div className="mt-3 p-3 rounded-lg bg-muted inline-block">
                      <p className="text-2xl font-mono font-bold">{scanResult.data.vehiclePlate}</p>
                      <p className="text-sm text-muted-foreground">{scanResult.data.vehicleMakeModel}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Departamento</p>
                      <p className="font-medium flex items-center gap-1 justify-center md:justify-start">
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

              {/* Recent Access Logs */}
              {recentLogs.length > 0 && (
                <div className="mt-6 pt-6 border-t border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm text-muted-foreground">HISTÓRICO DE ACESSOS</span>
                  </div>
                  <div className="space-y-2">
                    {recentLogs.map((log) => (
                      <AccessLogItem key={log.id} log={log} />
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons for Employee */}
              {scanResult.data.status === 'allowed' && (
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <Button
                    onClick={handleCheckIn}
                    className="bg-success hover:bg-success/90 text-success-foreground gap-2 h-14 text-lg"
                    disabled={createAccessLog.isPending}
                  >
                    <UserCheck className="w-6 h-6" />
                    Entrada
                  </Button>
                  <Button
                    onClick={handleCheckOut}
                    variant="outline"
                    className="gap-2 h-14 text-lg"
                    disabled={createAccessLog.isPending}
                  >
                    <UserX className="w-6 h-6" />
                    Saída
                  </Button>
                </div>
              )}

              <Button variant="ghost" onClick={clearScan} className="mt-4 w-full">
                Escanear Outro Código
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ScanKiosk;

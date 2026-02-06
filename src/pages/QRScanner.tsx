import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useVisitorByPassId, useUpdateVisitorStatus } from '@/hooks/useVisitors';
import { useCredentialByQrId, useUpdateCredentialStatus } from '@/hooks/useEmployeeCredentials';
import { useCreateAccessLog, useSubjectAccessLogs } from '@/hooks/useAccessLogs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { QrCode, UserCheck, UserX, AlertTriangle, CheckCircle, Ban, Car, User, Building2, Info, Camera, Maximize, Clock, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Visitor, EmployeeCredential, AccessLog } from '@/types/visitor';
import CameraScannerModal from '@/components/CameraScannerModal';

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

const QRScanner = () => {
  const [qrCode, setQrCode] = useState('');
  const [searchCode, setSearchCode] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
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

  // Auto-focus on mount and after actions
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Re-focus after scan result changes
  useEffect(() => {
    // Short delay to allow UI to update
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

  const handleScan = async () => {
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
    // Auto-registro será feito pelo useEffect após dados carregarem
  };

  // Auto-registrar entrada quando dados carregarem (após Verificar)
  const [autoRegister, setAutoRegister] = useState(false);
  
  useEffect(() => {
    if (!autoRegister || !scanResult) return;
    
    const doAutoRegister = async () => {
      setAutoRegister(false);
      
      if (scanResult.type === 'visitor') {
        const v = scanResult.data;
        if (v.status !== 'inside' && v.status !== 'closed' && new Date() <= new Date(v.validUntil)) {
          await handleCheckIn();
        }
      } else if (scanResult.type === 'employee') {
        const c = scanResult.data;
        if (c.status !== 'blocked') {
          await handleCheckIn();
        }
      }
    };
    
    doAutoRegister();
  }, [scanResult, autoRegister]);

  // Trigger auto-register quando searchCode muda
  useEffect(() => {
    if (searchCode) {
      setAutoRegister(true);
    }
  }, [searchCode]);

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
      
      // Check if visitor can enter
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
      toast({
        title: 'Entrada registrada!',
        description: `${v.fullName} entrou na empresa.`,
      });
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
      
      toast({
        title: 'Entrada registrada!',
        description: `${c.fullName} entrou na empresa.`,
      });
    }
    
    // Re-focus input for next scan
    inputRef.current?.focus();
  };

  const handleCheckOut = async () => {
    if (!scanResult) return;

    if (scanResult.type === 'visitor') {
      const v = scanResult.data;
      
      // On checkout, close the visitor pass
      await updateVisitorStatus.mutateAsync({ id: v.id, status: 'closed' });
      await createAccessLog.mutateAsync({
        subjectType: 'visitor',
        subjectId: v.id,
        direction: 'out',
      });
      
      setScanResult({ type: 'visitor', data: { ...v, status: 'closed' } });
      toast({
        title: 'Saída registrada!',
        description: `${v.fullName} saiu da empresa. Passe encerrado.`,
      });
    } else {
      const c = scanResult.data;
      
      await createAccessLog.mutateAsync({
        subjectType: 'employee',
        subjectId: c.id,
        direction: 'out',
      });
      
      toast({
        title: 'Saída registrada!',
        description: `${c.fullName} saiu da empresa.`,
      });
    }
    
    // Re-focus input for next scan
    inputRef.current?.focus();
  };

  const clearScan = () => {
    setQrCode('');
    setSearchCode('');
    setScanResult(null);
    setScanError(null);
    inputRef.current?.focus();
  };

  const isLoading = isLoadingVisitor || isLoadingCredential;
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
            <p className="text-muted-foreground mt-1">Escaneie ou digite o código para registrar entrada/saída</p>
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
              Posicione o leitor Bematech S-100 e escaneie o código. O sistema processa automaticamente.
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
                {isLoading ? 'Buscando...' : 'Verificar'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              💡 Use o leitor USB ou toque em "Câmera" para escanear pelo celular
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
                  <h3 className="text-xl font-bold text-destructive">Não Encontrado</h3>
                  <p className="text-muted-foreground">{scanError}</p>
                </div>
              </div>
              <Button variant="outline" onClick={clearScan} className="mt-4 w-full">
                Tentar Novamente
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Visitor Result */}
        {scanResult?.type === 'visitor' && (
          <Card className={scanResult.data.status === 'closed' ? 'border-muted' : 'border-success/50 bg-success/5'}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 rounded-xl bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0">
                  {scanResult.data.photoUrl ? (
                    <img src={scanResult.data.photoUrl} alt={scanResult.data.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-bold text-muted-foreground">{scanResult.data.fullName.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {scanResult.data.status === 'closed' ? (
                      <>
                        <Ban className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">Passe Encerrado</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5 text-success" />
                        <span className="text-sm font-medium text-success">Visitante Válido</span>
                      </>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-foreground mt-1">{scanResult.data.fullName}</h3>
                  <p className="text-muted-foreground">{scanResult.data.company || 'Sem empresa'}</p>
                  
                  {/* Gate Info - Big and visible */}
                  <div className="mt-4 p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="w-5 h-5 text-primary" />
                      <span className="font-bold text-primary">INFORMAÇÕES PARA GUARITA</span>
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg">
                        <span className="font-medium">VEIO PARA:</span>{' '}
                        <span className="font-bold">{scanResult.data.visitToType === 'setor' ? '📍 ' : '👤 '}{scanResult.data.visitToName}</span>
                      </p>
                      {scanResult.data.gateObs && (
                        <p className="text-lg">
                          <span className="font-medium">OBS:</span>{' '}
                          <span className="font-bold text-warning">{scanResult.data.gateObs}</span>
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
                      <p className="font-medium capitalize">
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
                    className="bg-success hover:bg-success/90 text-success-foreground gap-2"
                    disabled={scanResult.data.status === 'inside' || updateVisitorStatus.isPending}
                    size="lg"
                  >
                    <UserCheck className="w-5 h-5" />
                    Registrar Entrada
                  </Button>
                  <Button
                    onClick={handleCheckOut}
                    variant="outline"
                    className="gap-2"
                    disabled={scanResult.data.status !== 'inside' || updateVisitorStatus.isPending}
                    size="lg"
                  >
                    <UserX className="w-5 h-5" />
                    Registrar Saída
                  </Button>
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
          <Card className={scanResult.data.status === 'blocked' ? 'border-destructive/50 bg-destructive/5' : 'border-success/50 bg-success/5'}>
            <CardContent className="pt-6">
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
                  <div className="flex items-center gap-2">
                    {scanResult.data.status === 'blocked' ? (
                      <>
                        <Ban className="w-5 h-5 text-destructive" />
                        <span className="text-sm font-medium text-destructive">BLOQUEADO</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5 text-success" />
                        <span className="text-sm font-medium text-success">LIBERADO</span>
                      </>
                    )}
                  </div>
                  
                  <h3 className="text-2xl font-bold text-foreground mt-1">{scanResult.data.fullName}</h3>
                  
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

              {/* Recent Access Logs */}
              {recentLogs.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
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
                    className="bg-success hover:bg-success/90 text-success-foreground gap-2"
                    disabled={createAccessLog.isPending}
                    size="lg"
                  >
                    <UserCheck className="w-5 h-5" />
                    Registrar Entrada
                  </Button>
                  <Button
                    onClick={handleCheckOut}
                    variant="outline"
                    className="gap-2"
                    disabled={createAccessLog.isPending}
                    size="lg"
                  >
                    <UserX className="w-5 h-5" />
                    Registrar Saída
                  </Button>
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

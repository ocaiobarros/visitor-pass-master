import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useVisitorByPassId, useUpdateVisitorStatus } from '@/hooks/useVisitors';
import { useCredentialByQrId, useUpdateCredentialStatus } from '@/hooks/useEmployeeCredentials';
import { useCreateAccessLog } from '@/hooks/useAccessLogs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { QrCode, UserCheck, UserX, AlertTriangle, CheckCircle, Ban, Car, User, Building2, Info } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Visitor, EmployeeCredential } from '@/types/visitor';

type ScanResult = {
  type: 'visitor';
  data: Visitor;
} | {
  type: 'employee';
  data: EmployeeCredential;
} | null;

const QRScanner = () => {
  const [qrCode, setQrCode] = useState('');
  const [searchCode, setSearchCode] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  
  const { toast } = useToast();
  const updateVisitorStatus = useUpdateVisitorStatus();
  const updateCredentialStatus = useUpdateCredentialStatus();
  const createAccessLog = useCreateAccessLog();

  // Query for visitor
  const { data: visitor, isLoading: isLoadingVisitor } = useVisitorByPassId(searchCode.startsWith('VP-') ? searchCode : '');
  
  // Query for employee credential
  const { data: credential, isLoading: isLoadingCredential } = useCredentialByQrId(searchCode.startsWith('EC-') ? searchCode : '');

  const handleScan = () => {
    if (!qrCode.trim()) {
      toast({
        title: 'Código vazio',
        description: 'Digite ou escaneie o código do passe/crachá.',
        variant: 'destructive',
      });
      return;
    }

    const code = qrCode.toUpperCase();
    setSearchCode(code);
    setScanError(null);
    setScanResult(null);

    // Trigger the query by setting searchCode
    setTimeout(() => {
      if (code.startsWith('VP-')) {
        if (visitor) {
          setScanResult({ type: 'visitor', data: visitor });
        } else if (!isLoadingVisitor) {
          setScanError(`Passe ${code} não encontrado`);
        }
      } else if (code.startsWith('EC-')) {
        if (credential) {
          setScanResult({ type: 'employee', data: credential });
        } else if (!isLoadingCredential) {
          setScanError(`Credencial ${code} não encontrada`);
        }
      } else {
        setScanError('Código inválido. Use VP-XXXXXXXX para visitantes ou EC-XXXXXXXX para colaboradores.');
      }
    }, 500);
  };

  // Update scan result when data arrives
  useState(() => {
    if (searchCode.startsWith('VP-') && visitor) {
      setScanResult({ type: 'visitor', data: visitor });
    } else if (searchCode.startsWith('EC-') && credential) {
      setScanResult({ type: 'employee', data: credential });
    }
  });

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
  };

  const clearScan = () => {
    setQrCode('');
    setSearchCode('');
    setScanResult(null);
    setScanError(null);
  };

  const isLoading = isLoadingVisitor || isLoadingCredential;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <QrCode className="w-8 h-8 text-primary" />
            Scanner de Acesso
          </h1>
          <p className="text-muted-foreground mt-1">Escaneie ou digite o código para registrar entrada/saída</p>
        </div>

        {/* Scanner Input */}
        <Card>
          <CardHeader>
            <CardTitle>Escanear Código</CardTitle>
            <CardDescription>Digite o código ou use um leitor de código de barras</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                placeholder="VP-XXXXXXXX ou EC-XXXXXXXX"
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value.toUpperCase())}
                className="font-mono text-lg"
                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                autoFocus
              />
              <Button onClick={handleScan} size="lg" disabled={isLoading}>
                {isLoading ? 'Buscando...' : 'Verificar'}
              </Button>
            </div>
          </CardContent>
        </Card>

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

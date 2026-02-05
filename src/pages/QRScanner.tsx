import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useVisitors } from '@/context/VisitorContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { QrCode, UserCheck, UserX, AlertTriangle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Visitor } from '@/types/visitor';

const QRScanner = () => {
  const [passId, setPassId] = useState('');
  const [scannedVisitor, setScannedVisitor] = useState<Visitor | null>(null);
  const [scanResult, setScanResult] = useState<'success' | 'error' | null>(null);
  const { getVisitorByPassId, updateVisitorStatus } = useVisitors();
  const { toast } = useToast();

  const handleScan = () => {
    if (!passId.trim()) {
      toast({
        title: 'ID do passe vazio',
        description: 'Digite ou escaneie o ID do passe.',
        variant: 'destructive',
      });
      return;
    }

    const visitor = getVisitorByPassId(passId.toUpperCase());

    if (!visitor) {
      setScanResult('error');
      setScannedVisitor(null);
      toast({
        title: 'Passe não encontrado',
        description: `Nenhum visitante com o passe ${passId}`,
        variant: 'destructive',
      });
      return;
    }

    setScannedVisitor(visitor);
    setScanResult('success');
  };

  const handleCheckIn = () => {
    if (scannedVisitor) {
      updateVisitorStatus(scannedVisitor.id, 'inside', new Date());
      setScannedVisitor({ ...scannedVisitor, status: 'inside', checkInTime: new Date() });
      toast({
        title: 'Entrada registrada!',
        description: `${scannedVisitor.name} entrou na empresa.`,
      });
    }
  };

  const handleCheckOut = () => {
    if (scannedVisitor) {
      updateVisitorStatus(scannedVisitor.id, 'outside', new Date());
      setScannedVisitor({ ...scannedVisitor, status: 'outside', checkOutTime: new Date() });
      toast({
        title: 'Saída registrada!',
        description: `${scannedVisitor.name} saiu da empresa.`,
      });
    }
  };

  const clearScan = () => {
    setPassId('');
    setScannedVisitor(null);
    setScanResult(null);
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <QrCode className="w-8 h-8 text-primary" />
            Scanner de QR Code
          </h1>
          <p className="text-muted-foreground mt-1">Escaneie ou digite o ID do passe para registrar entrada/saída</p>
        </div>

        {/* Scanner Input */}
        <Card>
          <CardHeader>
            <CardTitle>Escanear Passe</CardTitle>
            <CardDescription>Digite o ID do passe ou use um leitor de código de barras</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                placeholder="VP-XXXXXXXX"
                value={passId}
                onChange={(e) => setPassId(e.target.value.toUpperCase())}
                className="font-mono text-lg"
                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
              />
              <Button onClick={handleScan} size="lg">
                Verificar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Scan Result */}
        {scanResult === 'error' && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-destructive" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-destructive">Passe Inválido</h3>
                  <p className="text-muted-foreground">O passe {passId} não foi encontrado no sistema.</p>
                </div>
              </div>
              <Button variant="outline" onClick={clearScan} className="mt-4 w-full">
                Tentar Novamente
              </Button>
            </CardContent>
          </Card>
        )}

        {scannedVisitor && (
          <Card className="border-success/50 bg-success/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 rounded-xl bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0">
                  {scannedVisitor.photo ? (
                    <img src={scannedVisitor.photo} alt={scannedVisitor.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-bold text-muted-foreground">{scannedVisitor.name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-success" />
                    <span className="text-sm font-medium text-success">Passe Válido</span>
                  </div>
                  <h3 className="text-xl font-bold text-foreground mt-1">{scannedVisitor.name}</h3>
                  <p className="text-muted-foreground">{scannedVisitor.company}</p>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Departamento</p>
                      <p className="font-medium">{scannedVisitor.department}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Responsável</p>
                      <p className="font-medium">{scannedVisitor.hostEmployee}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Válido até</p>
                      <p className="font-medium">
                        {format(new Date(scannedVisitor.validTill), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status Atual</p>
                      <p className="font-medium capitalize">
                        {scannedVisitor.status === 'inside'
                          ? '🟢 Dentro'
                          : scannedVisitor.status === 'outside'
                          ? '⚪ Fora'
                          : scannedVisitor.status === 'pending'
                          ? '🟡 Pendente'
                          : '🔴 Expirado'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-4 mt-6">
                <Button
                  onClick={handleCheckIn}
                  className="bg-success hover:bg-success/90 text-success-foreground gap-2"
                  disabled={scannedVisitor.status === 'inside'}
                  size="lg"
                >
                  <UserCheck className="w-5 h-5" />
                  Registrar Entrada
                </Button>
                <Button
                  onClick={handleCheckOut}
                  variant="outline"
                  className="gap-2"
                  disabled={scannedVisitor.status !== 'inside'}
                  size="lg"
                >
                  <UserX className="w-5 h-5" />
                  Registrar Saída
                </Button>
              </div>

              <Button variant="ghost" onClick={clearScan} className="mt-4 w-full">
                Escanear Outro Passe
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default QRScanner;

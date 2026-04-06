import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuthorizedDrivers, useCreateAuthorizedDriver, useToggleDriverStatus, type AuthorizationType, type DriverType } from '@/hooks/useAuthorizedDrivers';
import { useEmployeeCredentials } from '@/hooks/useEmployeeCredentials';
import { useAssociates } from '@/hooks/useAssociates';
import { Plus, ShieldCheck, ShieldOff, Loader2, Car } from 'lucide-react';

interface Props {
  vehicleCredentialId: string;
  vehiclePlate?: string;
}

const authLabels: Record<string, string> = {
  owner: 'Proprietário',
  delegated: 'Delegado',
  corporate_pool: 'Pool Corporativo',
};

const AuthorizedDriversPanel = ({ vehicleCredentialId, vehiclePlate }: Props) => {
  const { data: drivers = [], isLoading } = useAuthorizedDrivers(vehicleCredentialId);
  const createDriver = useCreateAuthorizedDriver();
  const toggleStatus = useToggleDriverStatus();
  const { data: credentials = [] } = useEmployeeCredentials();
  const { data: associates = [] } = useAssociates();

  const personalCredentials = credentials.filter(c => c.type === 'personal' && c.status === 'allowed');
  const activeAssociates = associates.filter(a => a.status === 'active');

  const [open, setOpen] = useState(false);
  const [driverType, setDriverType] = useState<DriverType>('employee');
  const [selectedId, setSelectedId] = useState('');
  const [authType, setAuthType] = useState<AuthorizationType>('owner');

  const handleAdd = () => {
    if (!selectedId) return;

    createDriver.mutate({
      vehicleCredentialId,
      driverType,
      employeeCredentialId: driverType === 'employee' ? selectedId : undefined,
      associateId: driverType === 'associate' ? selectedId : undefined,
      authorizationType: authType,
    }, {
      onSuccess: () => {
        setOpen(false);
        setSelectedId('');
      },
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Car className="w-5 h-5" />
          Condutores Autorizados {vehiclePlate && <span className="text-muted-foreground font-normal">— {vehiclePlate}</span>}
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="w-4 h-4" /> Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Autorizar Condutor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Tipo de Condutor</Label>
                <Select value={driverType} onValueChange={(v) => { setDriverType(v as DriverType); setSelectedId(''); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Colaborador</SelectItem>
                    <SelectItem value="associate">Agregado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{driverType === 'employee' ? 'Colaborador' : 'Agregado'}</Label>
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {driverType === 'employee'
                      ? personalCredentials.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.fullName} — {c.document}</SelectItem>
                        ))
                      : activeAssociates.map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.fullName} — {a.document}</SelectItem>
                        ))
                    }
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Autorização</Label>
                <Select value={authType} onValueChange={(v) => setAuthType(v as AuthorizationType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Proprietário</SelectItem>
                    <SelectItem value="delegated">Delegado</SelectItem>
                    <SelectItem value="corporate_pool">Pool Corporativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleAdd} disabled={!selectedId || createDriver.isPending} className="w-full gap-2">
                {createDriver.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Autorizar Condutor
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : drivers.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum condutor autorizado</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Autorização</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.driverName || '—'}</TableCell>
                  <TableCell>{d.driverType === 'employee' ? 'Colaborador' : 'Agregado'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{authLabels[d.authorizationType] || d.authorizationType}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={d.isActive ? 'default' : 'secondary'}>
                      {d.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleStatus.mutate({ id: d.id, isActive: !d.isActive, vehicleCredentialId })}
                      disabled={toggleStatus.isPending}
                    >
                      {d.isActive ? <ShieldOff className="w-4 h-4 text-warning" /> : <ShieldCheck className="w-4 h-4 text-success" />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default AuthorizedDriversPanel;

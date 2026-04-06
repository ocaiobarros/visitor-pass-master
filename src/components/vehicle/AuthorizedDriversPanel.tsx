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
import { Plus, ShieldCheck, ShieldOff, Loader2, Car, User, UsersRound, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Props {
  vehicleCredentialId: string;
  vehiclePlate?: string;
}

const authLabels: Record<string, string> = {
  owner: 'Proprietário',
  delegated: 'Delegado',
  corporate_pool: 'Pool Corporativo',
};

const authColors: Record<string, string> = {
  owner: 'bg-primary/10 text-primary border-primary/30',
  delegated: 'bg-accent/10 text-accent-foreground border-accent/30',
  corporate_pool: 'bg-secondary/10 text-secondary-foreground border-secondary/30',
};

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  allowed: { label: 'Ativo', variant: 'default' },
  active: { label: 'Ativo', variant: 'default' },
  blocked: { label: 'Bloqueado', variant: 'destructive' },
  suspended: { label: 'Suspenso', variant: 'destructive' },
  expired: { label: 'Expirado', variant: 'secondary' },
};

const AuthorizedDriversPanel = ({ vehicleCredentialId, vehiclePlate }: Props) => {
  const { data: drivers = [], isLoading } = useAuthorizedDrivers(vehicleCredentialId);
  const createDriver = useCreateAuthorizedDriver();
  const toggleStatus = useToggleDriverStatus();
  const { data: credentials = [] } = useEmployeeCredentials();
  const { data: associates = [] } = useAssociates();
  const { toast } = useToast();

  const personalCredentials = credentials.filter(c => c.type === 'personal' && c.status === 'allowed');
  const activeAssociates = associates.filter(a => a.status === 'active');

  const authorizedEmployeeIds = new Set(drivers.filter(d => d.isActive && d.employeeCredentialId).map(d => d.employeeCredentialId));
  const authorizedAssociateIds = new Set(drivers.filter(d => d.isActive && d.associateId).map(d => d.associateId));

  const [open, setOpen] = useState(false);
  const [driverType, setDriverType] = useState<DriverType>('employee');
  const [selectedId, setSelectedId] = useState('');
  const [authType, setAuthType] = useState<AuthorizationType>('owner');

  const availableEmployees = personalCredentials.filter(c => !authorizedEmployeeIds.has(c.id));
  const availableAssociates = activeAssociates.filter(a => !authorizedAssociateIds.has(a.id));

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
      onError: (error: any) => {
        if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
          toast({ title: 'Condutor já autorizado', description: 'Esta pessoa já possui autorização ativa para este veículo.', variant: 'destructive' });
        }
      },
    });
  };

  const isExpiredValidity = (d: { validUntil?: string }) => {
    return d.validUntil && new Date(d.validUntil) < new Date();
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
                      ? availableEmployees.length === 0
                        ? <SelectItem value="_none" disabled>Nenhum colaborador disponível</SelectItem>
                        : availableEmployees.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.fullName} — {c.document}</SelectItem>
                          ))
                      : availableAssociates.length === 0
                        ? <SelectItem value="_none" disabled>Nenhum agregado ativo disponível</SelectItem>
                        : availableAssociates.map(a => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.fullName} — {a.document}
                              {a.employeeName ? ` (resp: ${a.employeeName})` : ''}
                            </SelectItem>
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

              <Button onClick={handleAdd} disabled={!selectedId || selectedId === '_none' || createDriver.isPending} className="w-full gap-2">
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
                <TableHead>Condutor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Autorização</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.map(d => {
                const expired = isExpiredValidity(d);
                const driverStatusInfo = statusLabels[d.driverStatus || ''] || statusLabels['allowed'];
                const effectivelyInactive = !d.isActive || expired || d.driverStatus === 'blocked' || d.driverStatus === 'suspended';

                return (
                  <TableRow key={d.id} className={effectivelyInactive ? 'opacity-60' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {d.driverType === 'employee' 
                          ? <User className="w-4 h-4 text-primary shrink-0" />
                          : <UsersRound className="w-4 h-4 text-accent-foreground shrink-0" />
                        }
                        <div>
                          <p className="font-medium">{d.driverName || '—'}</p>
                          {d.driverDocument && <p className="text-xs text-muted-foreground">{d.driverDocument}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={d.driverType === 'employee' ? 'border-primary/30 text-primary' : 'border-accent/30 text-accent-foreground'}>
                        {d.driverType === 'employee' ? 'Colaborador' : 'Agregado'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={authColors[d.authorizationType] || ''}>
                        {authLabels[d.authorizationType] || d.authorizationType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {d.driverType === 'associate' && d.responsibleEmployeeName ? (
                        <span className="text-muted-foreground">{d.responsibleEmployeeName}</span>
                      ) : d.driverType === 'employee' ? (
                        <span className="text-muted-foreground italic">—</span>
                      ) : (
                        <span className="text-muted-foreground italic">N/D</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {d.validFrom || d.validUntil ? (
                        <div className="flex flex-col gap-0.5">
                          <span>
                            {d.validFrom && format(new Date(d.validFrom), 'dd/MM/yy')}
                            {d.validFrom && d.validUntil && ' — '}
                            {d.validUntil && format(new Date(d.validUntil), 'dd/MM/yy')}
                          </span>
                          {expired && (
                            <Badge variant="destructive" className="text-[10px] px-1 py-0 w-fit">
                              <AlertTriangle className="w-3 h-3 mr-0.5" /> Vencida
                            </Badge>
                          )}
                        </div>
                      ) : (
                        'Permanente'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={d.isActive ? 'default' : 'secondary'}>
                          {d.isActive ? 'Ativo' : 'Inativo'}
                        </Badge>
                        {d.driverStatus && d.driverStatus !== 'allowed' && d.driverStatus !== 'active' && (
                          <Badge variant={driverStatusInfo.variant}>
                            {driverStatusInfo.label}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleStatus.mutate({ id: d.id, isActive: !d.isActive, vehicleCredentialId })}
                        disabled={toggleStatus.isPending}
                        title={d.isActive ? 'Desativar autorização' : 'Reativar autorização'}
                      >
                        {d.isActive ? <ShieldOff className="w-4 h-4 text-destructive" /> : <ShieldCheck className="w-4 h-4 text-primary" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default AuthorizedDriversPanel;

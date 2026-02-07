import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useEmployeeCredentials, useUpdateCredentialStatus } from '@/hooks/useEmployeeCredentials';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Car, Plus, Search, Eye, Ban, CheckCircle, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const VehicleList = () => {
  const navigate = useNavigate();
  const { data: credentials = [], isLoading } = useEmployeeCredentials();
  const updateStatus = useUpdateCredentialStatus();
  const { isAdminOrRh } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  // Filter only vehicle credentials
  const vehicles = credentials.filter(c => c.type === 'vehicle');
  
  // Get all personal credentials for owner photo lookup
  const employees = credentials.filter(c => c.type === 'personal');

  // Find owner photo by document (CPF)
  const getOwnerPhoto = (document: string): string | null => {
    const owner = employees.find(e => e.document === document);
    return owner?.photoUrl || null;
  };

  const filteredVehicles = vehicles.filter((vehicle) =>
    vehicle.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.document.includes(searchTerm) ||
    vehicle.vehiclePlate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.vehicleMakeModel?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleStatus = async (id: string, currentStatus: string, plate: string) => {
    const newStatus = currentStatus === 'allowed' ? 'blocked' : 'allowed';
    try {
      await updateStatus.mutateAsync({ id, status: newStatus });
      toast({
        title: newStatus === 'blocked' ? 'Veículo bloqueado' : 'Veículo liberado',
        description: `${plate} foi ${newStatus === 'blocked' ? 'bloqueado' : 'liberado'}.`,
        variant: newStatus === 'blocked' ? 'destructive' : 'default',
      });
    } catch (error) {
      // Error handled by hook
    }
  };

  return (
    <DashboardLayout pageTitle="Veículos">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Car className="w-8 h-8 text-primary" />
            Veículos
          </h1>
          <p className="text-muted-foreground mt-1">Veículos autorizados a acessar as instalações</p>
        </div>
        {isAdminOrRh && (
          <Button onClick={() => navigate('/register/vehicle')} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Veículo
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Veículos</CardTitle>
          <CardDescription>{filteredVehicles.length} veículo(s) cadastrado(s)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, placa ou modelo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Table */}
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Carregando...</p>
          ) : filteredVehicles.length === 0 ? (
            <div className="text-center py-12">
              <Car className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum veículo encontrado</p>
              {isAdminOrRh && (
                <Button onClick={() => navigate('/register/vehicle')} variant="outline" className="mt-4">
                  Cadastrar primeiro veículo
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Foto</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead>Marca / Modelo</TableHead>
                    <TableHead>Proprietário</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVehicles.map((vehicle) => {
                    const ownerPhoto = getOwnerPhoto(vehicle.document);
                    return (
                      <TableRow key={vehicle.id}>
                        <TableCell>
                          <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden">
                            {ownerPhoto ? (
                              <img src={ownerPhoto} alt={vehicle.fullName} className="w-full h-full object-cover" />
                            ) : vehicle.photoUrl ? (
                              <img src={vehicle.photoUrl} alt={vehicle.fullName} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono font-bold text-lg">{vehicle.vehiclePlate}</TableCell>
                        <TableCell>{vehicle.vehicleMakeModel || '-'}</TableCell>
                        <TableCell className="font-medium">{vehicle.fullName}</TableCell>
                        <TableCell className="font-mono text-sm">{vehicle.document}</TableCell>
                        <TableCell>
                          <Badge variant={vehicle.status === 'allowed' ? 'default' : 'destructive'}>
                            {vehicle.status === 'allowed' ? 'Liberado' : 'Bloqueado'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(vehicle.createdAt, 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                            >
                              <Link to={`/credential/${vehicle.id}`}>
                                <Eye className="w-4 h-4 mr-1" />
                                Crachá
                              </Link>
                            </Button>
                            
                            {isAdminOrRh && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant={vehicle.status === 'allowed' ? 'destructive' : 'default'}
                                    size="sm"
                                    className="gap-1"
                                  >
                                    {vehicle.status === 'allowed' ? (
                                      <>
                                        <Ban className="w-4 h-4" />
                                        Bloquear
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle className="w-4 h-4" />
                                        Liberar
                                      </>
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      {vehicle.status === 'allowed' ? 'Bloquear veículo?' : 'Liberar veículo?'}
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {vehicle.status === 'allowed' 
                                        ? `O veículo ${vehicle.vehiclePlate} terá seu acesso bloqueado. O scanner exibirá "ACESSO NEGADO".`
                                        : `O veículo ${vehicle.vehiclePlate} terá seu acesso liberado novamente.`
                                      }
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleToggleStatus(vehicle.id, vehicle.status, vehicle.vehiclePlate || '')}
                                      className={vehicle.status === 'allowed' ? 'bg-destructive hover:bg-destructive/90' : ''}
                                    >
                                      {vehicle.status === 'allowed' ? 'Bloquear' : 'Liberar'}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
};

export default VehicleList;

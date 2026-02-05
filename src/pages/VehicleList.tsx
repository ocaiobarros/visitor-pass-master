import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useEmployeeCredentials } from '@/hooks/useEmployeeCredentials';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Car, Plus, Search, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/context/AuthContext';

const VehicleList = () => {
  const navigate = useNavigate();
  const { data: credentials = [], isLoading } = useEmployeeCredentials();
  const { isAdminOrRh } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  // Filter only vehicle credentials
  const vehicles = credentials.filter(c => c.type === 'vehicle');

  const filteredVehicles = vehicles.filter((vehicle) =>
    vehicle.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.document.includes(searchTerm) ||
    vehicle.vehiclePlate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.vehicleMakeModel?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                  {filteredVehicles.map((vehicle) => (
                    <TableRow key={vehicle.id}>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <Link to={`/credential/${vehicle.id}`}>
                            <Eye className="w-4 h-4 mr-1" />
                            Ver Crachá
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
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

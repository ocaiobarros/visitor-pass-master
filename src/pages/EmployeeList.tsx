import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useEmployeeCredentials } from '@/hooks/useEmployeeCredentials';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, Search, Eye, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/context/AuthContext';

const EmployeeList = () => {
  const navigate = useNavigate();
  const { data: credentials = [], isLoading } = useEmployeeCredentials();
  const { isAdminOrRh } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  // Filter only personal (employee) credentials
  const employees = credentials.filter(c => c.type === 'personal');

  const filteredEmployees = employees.filter((employee) =>
    employee.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.document.includes(searchTerm) ||
    employee.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout pageTitle="Funcionários">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            Funcionários
          </h1>
          <p className="text-muted-foreground mt-1">Colaboradores internos cadastrados</p>
        </div>
        {isAdminOrRh && (
          <Button onClick={() => navigate('/register/employee')} className="gap-2">
            <UserPlus className="w-4 h-4" />
            Novo Funcionário
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Funcionários</CardTitle>
          <CardDescription>{filteredEmployees.length} funcionário(s) cadastrado(s)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CPF ou cargo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Table */}
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Carregando...</p>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum funcionário encontrado</p>
              {isAdminOrRh && (
                <Button onClick={() => navigate('/register/employee')} variant="outline" className="mt-4">
                  Cadastrar primeiro funcionário
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{employee.fullName}</TableCell>
                      <TableCell className="font-mono text-sm">{employee.document}</TableCell>
                      <TableCell>
                        {employee.department ? (
                          <div className="flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-muted-foreground" />
                            {employee.department.name}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{employee.jobTitle || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={employee.status === 'allowed' ? 'default' : 'destructive'}>
                          {employee.status === 'allowed' ? 'Liberado' : 'Bloqueado'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(employee.createdAt, 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <Link to={`/credential/${employee.id}`}>
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

export default EmployeeList;

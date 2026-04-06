import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAssociates, useUpdateAssociateStatus, type Associate } from '@/hooks/useAssociates';
import { Search, Users, Loader2, ShieldCheck, ShieldOff, Eye } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

const statusLabels: Record<string, string> = {
  active: 'Ativo',
  suspended: 'Suspenso',
  expired: 'Expirado',
};

const statusColors: Record<string, string> = {
  active: 'bg-success/10 text-success border-success/30',
  suspended: 'bg-warning/10 text-warning border-warning/30',
  expired: 'bg-destructive/10 text-destructive border-destructive/30',
};

const relationshipLabels: Record<string, string> = {
  conjuge: 'Cônjuge',
  pai: 'Pai',
  mae: 'Mãe',
  filho: 'Filho',
  filha: 'Filha',
  irmao: 'Irmão',
  irma: 'Irmã',
  namorado: 'Namorado',
  namorada: 'Namorada',
  motorista_particular: 'Motorista Particular',
  outro: 'Outro',
};

const AssociateList = () => {
  const { isAdminOrRh } = useAuth();
  const { data: associates = [], isLoading } = useAssociates();
  const updateStatus = useUpdateAssociateStatus();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = associates.filter((a) => {
    const matchSearch = a.fullName.toLowerCase().includes(search.toLowerCase()) ||
      a.document.includes(search) ||
      (a.employeeName || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleToggleStatus = (associate: Associate) => {
    const newStatus = associate.status === 'active' ? 'suspended' : 'active';
    updateStatus.mutate({ id: associate.id, status: newStatus });
  };

  return (
    <DashboardLayout pageTitle="Agregados">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Agregados</h1>
            <p className="text-muted-foreground mt-1">Pessoas vinculadas a colaboradores</p>
          </div>
          {isAdminOrRh && (
            <Link to="/register/associate">
              <Button className="gap-2">
                <Users className="w-4 h-4" />
                Cadastrar Agregado
              </Button>
            </Link>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CPF ou colaborador..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="suspended">Suspenso</SelectItem>
                  <SelectItem value="expired">Expirado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">Nenhum agregado encontrado</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Vínculo</TableHead>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Passe</TableHead>
                      <TableHead>Status</TableHead>
                      {isAdminOrRh && <TableHead>Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.fullName}</TableCell>
                        <TableCell className="text-muted-foreground">{a.document}</TableCell>
                        <TableCell>{relationshipLabels[a.relationshipType] || a.relationshipType}</TableCell>
                        <TableCell>{a.employeeName || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{a.passId}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColors[a.status]}>
                            {statusLabels[a.status] || a.status}
                          </Badge>
                        </TableCell>
                        {isAdminOrRh && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Link to={`/associate-pass/${a.id}`}>
                                <Button variant="ghost" size="sm" title="Ver Passe">
                                  <Eye className="w-4 h-4 text-primary" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleStatus(a)}
                                disabled={updateStatus.isPending}
                              >
                                {a.status === 'active' ? (
                                  <ShieldOff className="w-4 h-4 text-warning" />
                                ) : (
                                  <ShieldCheck className="w-4 h-4 text-success" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AssociateList;

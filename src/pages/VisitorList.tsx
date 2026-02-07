import { useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useVisitors, useUpdateVisitorStatus } from '@/hooks/useVisitors';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Search, Eye, Printer, Filter, Loader2, Ban } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
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

const VisitorList = () => {
  const { data: visitors = [], isLoading } = useVisitors();
  const updateStatus = useUpdateVisitorStatus();
  const { isAdminOrRh } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredVisitors = visitors.filter((visitor) => {
    const matchesSearch =
      visitor.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (visitor.company?.toLowerCase().includes(search.toLowerCase()) || false) ||
      visitor.passId.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || visitor.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleClosePass = async (id: string, name: string) => {
    try {
      await updateStatus.mutateAsync({ id, status: 'closed' });
      toast({
        title: 'Passe encerrado',
        description: `O passe de ${name} foi encerrado. O QR Code não funcionará mais.`,
        variant: 'destructive',
      });
    } catch (error) {
      // Error handled by hook
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'inside':
        return <span className="status-badge-inside">Dentro</span>;
      case 'outside':
        return <span className="status-badge-outside">Fora</span>;
      case 'pending':
        return <span className="px-3 py-1 rounded-full text-sm font-medium bg-warning/10 text-warning">Pendente</span>;
      case 'closed':
        return <span className="status-badge-expired">Encerrado</span>;
      default:
        return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Users className="w-8 h-8 text-primary" />
              Lista de Visitantes
            </h1>
            <p className="text-muted-foreground mt-1">{filteredVisitors.length} visitante(s) encontrado(s)</p>
          </div>
          <Link to="/register">
            <Button>Novo Visitante</Button>
          </Link>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, empresa ou ID do passe..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar por status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="inside">Dentro</SelectItem>
                    <SelectItem value="outside">Fora</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="closed">Encerrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Visitantes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredVisitors.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">Nenhum visitante encontrado</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID Passe</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Destino</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVisitors.map((visitor) => (
                      <TableRow key={visitor.id}>
                        <TableCell className="font-mono text-sm">{visitor.passId}</TableCell>
                        <TableCell className="font-medium">{visitor.fullName}</TableCell>
                        <TableCell>{visitor.company || '-'}</TableCell>
                        <TableCell>
                          <span className="text-xs">
                            {visitor.visitToType === 'setor' ? '📍' : '👤'} {visitor.visitToName}
                          </span>
                        </TableCell>
                        <TableCell>{getStatusBadge(visitor.status)}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{format(new Date(visitor.validFrom), 'dd/MM HH:mm')}</p>
                            <p className="text-muted-foreground">até {format(new Date(visitor.validUntil), 'dd/MM HH:mm')}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link to={`/pass/${visitor.id}`}>
                              <Button variant="ghost" size="icon">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link to={`/pass/${visitor.id}?print=true`}>
                              <Button variant="ghost" size="icon">
                                <Printer className="h-4 w-4" />
                              </Button>
                            </Link>
                            
                            {isAdminOrRh && visitor.status !== 'closed' && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="icon">
                                    <Ban className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Encerrar passe?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      O passe de {visitor.fullName} será encerrado permanentemente. 
                                      O QR Code exibirá "ACESSO NEGADO" no scanner.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleClosePass(visitor.id, visitor.fullName)}
                                      className="bg-destructive hover:bg-destructive/90"
                                    >
                                      Encerrar Passe
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
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

export default VisitorList;

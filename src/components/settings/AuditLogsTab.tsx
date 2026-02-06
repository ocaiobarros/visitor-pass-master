import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuditLogs, AuditActionType, AuditLogFilters } from '@/hooks/useAuditLogs';
import { 
  FileText, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  Filter,
  Search,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PAGE_SIZE = 20;

const ACTION_TYPES: { value: AuditActionType; label: string }[] = [
  { value: 'LOGIN', label: 'Login' },
  { value: 'LOGOUT', label: 'Logout' },
  { value: 'LOGIN_FAILED', label: 'Login Falhou' },
  { value: 'USER_CREATE', label: 'Usuário Criado' },
  { value: 'USER_UPDATE', label: 'Usuário Atualizado' },
  { value: 'USER_DELETE', label: 'Usuário Excluído' },
  { value: 'USER_DEACTIVATE', label: 'Usuário Desativado' },
  { value: 'USER_ACTIVATE', label: 'Usuário Ativado' },
  { value: 'PASSWORD_RESET', label: 'Reset de Senha' },
  { value: 'PASSWORD_CHANGE', label: 'Senha Alterada' },
  { value: 'ROLE_UPDATE', label: 'Permissão Alterada' },
  { value: 'CONFIG_UPDATE', label: 'Config. Atualizada' },
  { value: 'VISITOR_CREATE', label: 'Visitante Criado' },
  { value: 'VISITOR_UPDATE', label: 'Visitante Atualizado' },
  { value: 'VISITOR_DELETE', label: 'Visitante Excluído' },
  { value: 'EMPLOYEE_CREATE', label: 'Colaborador Criado' },
  { value: 'EMPLOYEE_UPDATE', label: 'Colaborador Atualizado' },
  { value: 'EMPLOYEE_DELETE', label: 'Colaborador Excluído' },
  { value: 'DEPARTMENT_CREATE', label: 'Setor Criado' },
  { value: 'DEPARTMENT_DELETE', label: 'Setor Excluído' },
  { value: 'BACKUP_EXPORT', label: 'Backup Exportado' },
  { value: 'ACCESS_SCAN', label: 'Acesso Escaneado' },
];

const getActionVariant = (actionType: AuditActionType): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (actionType.includes('FAILED') || actionType.includes('DELETE')) return 'destructive';
  if (actionType.includes('CREATE')) return 'default';
  if (actionType.includes('DEACTIVATE')) return 'secondary';
  return 'outline';
};

const AuditLogsTab = () => {
  const { toast } = useToast();
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [tempFilters, setTempFilters] = useState<AuditLogFilters>({});

  const { data, isLoading } = useAuditLogs(filters, PAGE_SIZE, page * PAGE_SIZE);
  const logs = data?.data || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const applyFilters = () => {
    setFilters(tempFilters);
    setPage(0);
  };

  const clearFilters = () => {
    setTempFilters({});
    setFilters({});
    setPage(0);
  };

  const exportToCSV = () => {
    if (!logs.length) {
      toast({
        title: 'Nenhum dado para exportar',
        description: 'Aplique filtros ou aguarde os logs serem carregados.',
        variant: 'destructive',
      });
      return;
    }

    const headers = ['Data/Hora', 'Usuário', 'Ação', 'Detalhes', 'User Agent'];
    const csvContent = [
      headers.join(','),
      ...logs.map((log) =>
        [
          format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss'),
          log.user_email || 'Sistema',
          log.action_type,
          JSON.stringify(log.details).replace(/,/g, ';'),
          (log.user_agent || '').replace(/,/g, ';'),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Exportação concluída!',
      description: 'O arquivo CSV foi baixado com sucesso.',
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Logs de Auditoria
            </CardTitle>
            <CardDescription>
              Histórico completo de ações administrativas no sistema
            </CardDescription>
          </div>
          <Button onClick={exportToCSV} variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Exportar CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-lg bg-muted/50">
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Data Início
            </Label>
            <Input
              type="date"
              value={tempFilters.startDate?.split('T')[0] || ''}
              onChange={(e) =>
                setTempFilters({ ...tempFilters, startDate: e.target.value ? `${e.target.value}T00:00:00` : undefined })
              }
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Data Fim
            </Label>
            <Input
              type="date"
              value={tempFilters.endDate?.split('T')[0] || ''}
              onChange={(e) =>
                setTempFilters({ ...tempFilters, endDate: e.target.value ? `${e.target.value}T23:59:59` : undefined })
              }
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Filter className="w-3 h-3" />
              Tipo de Ação
            </Label>
            <Select
              value={tempFilters.actionType ?? 'all'}
              onValueChange={(value) =>
                setTempFilters({
                  ...tempFilters,
                  actionType: (value === 'all' ? undefined : (value as AuditActionType)),
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {ACTION_TYPES.map((action) => (
                  <SelectItem key={action.value} value={action.value}>
                    {action.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={applyFilters} className="flex-1 gap-2">
              <Search className="w-4 h-4" />
              Filtrar
            </Button>
            <Button onClick={clearFilters} variant="outline">
              Limpar
            </Button>
          </div>
        </div>

        {/* Results count */}
        <div className="text-sm text-muted-foreground">
          {totalCount} registro(s) encontrado(s)
        </div>

        {/* Table */}
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : logs.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhum log encontrado</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.user_email || <span className="text-muted-foreground">Sistema</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getActionVariant(log.action_type)}>
                        {ACTION_TYPES.find((a) => a.value === log.action_type)?.label || log.action_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {Object.keys(log.details || {}).length > 0 
                        ? JSON.stringify(log.details) 
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Página {page + 1} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Próximo
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AuditLogsTab;

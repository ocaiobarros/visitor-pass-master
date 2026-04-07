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
import { exportCSV, exportExcel, exportPDF, ExportColumn } from '@/lib/reportExport';
import { FileText, Download, ChevronLeft, ChevronRight, Filter, Search, Calendar, FileSpreadsheet } from 'lucide-react';
import { formatLocalDateTime } from '@/lib/dateUtils';

const PAGE_SIZE = 20;

type EventCategory = 'all' | 'access' | 'security' | 'admin';

const EVENT_CATEGORIES: Record<Exclude<EventCategory, 'all'>, AuditActionType[]> = {
  access: ['ACCESS_SCAN', 'ACCESS_SESSION_CREATE', 'ACCESS_SESSION_COMPLETE', 'ACCESS_SESSION_DENY', 'ACCESS_SESSION_EXPIRE'],
  security: ['LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'PASSWORD_RESET', 'PASSWORD_CHANGE'],
  admin: [
    'USER_CREATE', 'USER_UPDATE', 'USER_DELETE', 'USER_DEACTIVATE', 'USER_ACTIVATE',
    'ROLE_UPDATE', 'CONFIG_UPDATE', 'BACKUP_EXPORT',
    'VISITOR_CREATE', 'VISITOR_UPDATE', 'VISITOR_DELETE',
    'EMPLOYEE_CREATE', 'EMPLOYEE_UPDATE', 'EMPLOYEE_DELETE',
    'DEPARTMENT_CREATE', 'DEPARTMENT_DELETE',
    'ASSOCIATE_CREATE', 'ASSOCIATE_UPDATE', 'ASSOCIATE_DELETE',
  ],
};

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Login', LOGOUT: 'Logout', LOGIN_FAILED: 'Login Falhou',
  USER_CREATE: 'Usuário Criado', USER_UPDATE: 'Usuário Atualizado', USER_DELETE: 'Usuário Excluído',
  USER_DEACTIVATE: 'Usuário Desativado', USER_ACTIVATE: 'Usuário Ativado',
  PASSWORD_RESET: 'Reset de Senha', PASSWORD_CHANGE: 'Senha Alterada',
  ROLE_UPDATE: 'Permissão Alterada', CONFIG_UPDATE: 'Config. Atualizada',
  VISITOR_CREATE: 'Visitante Criado', VISITOR_UPDATE: 'Visitante Atualizado', VISITOR_DELETE: 'Visitante Excluído',
  EMPLOYEE_CREATE: 'Colaborador Criado', EMPLOYEE_UPDATE: 'Colaborador Atualizado', EMPLOYEE_DELETE: 'Colaborador Excluído',
  DEPARTMENT_CREATE: 'Setor Criado', DEPARTMENT_DELETE: 'Setor Excluído',
  BACKUP_EXPORT: 'Backup Exportado', ACCESS_SCAN: 'Acesso Escaneado',
  ASSOCIATE_CREATE: 'Agregado Criado', ASSOCIATE_UPDATE: 'Agregado Atualizado', ASSOCIATE_DELETE: 'Agregado Excluído',
  ACCESS_SESSION_CREATE: 'Sessão Criada', ACCESS_SESSION_COMPLETE: 'Sessão Concluída',
  ACCESS_SESSION_DENY: 'Sessão Negada', ACCESS_SESSION_EXPIRE: 'Sessão Expirada',
};

const getActionVariant = (t: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (t.includes('FAILED') || t.includes('DELETE') || t.includes('DENY')) return 'destructive';
  if (t.includes('CREATE')) return 'default';
  if (t.includes('DEACTIVATE') || t.includes('EXPIRE')) return 'secondary';
  return 'outline';
};

const formatDetails = (details: any): string => {
  if (!details || Object.keys(details).length === 0) return '-';
  const d = details as Record<string, any>;
  const parts: string[] = [];
  if (d.table) parts.push(`Tabela: ${d.table}`);
  if (d.operation) parts.push(`Op: ${d.operation}`);
  if (d.new_data?.full_name) parts.push(`Nome: ${d.new_data.full_name}`);
  if (d.new_data?.document) parts.push(`Doc: ${d.new_data.document}`);
  if (d.new_data?.status) parts.push(`Status: ${d.new_data.status}`);
  if (d.new_data?.direction) parts.push(`Dir: ${d.new_data.direction}`);
  if (d.denial_reason) parts.push(`Motivo: ${d.denial_reason}`);
  if (d.reason) parts.push(`Motivo: ${d.reason}`);
  if (parts.length > 0) return parts.join(' | ');
  return JSON.stringify(details).slice(0, 120);
};

const AuditLogsTab = () => {
  const { toast } = useToast();
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [tempFilters, setTempFilters] = useState<AuditLogFilters>({});
  const [category, setCategory] = useState<EventCategory>('all');

  const { data, isLoading } = useAuditLogs(filters, PAGE_SIZE, page * PAGE_SIZE);
  const allLogs = data?.data || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const logs = category === 'all'
    ? allLogs
    : allLogs.filter(l => EVENT_CATEGORIES[category]?.includes(l.action_type));

  const applyFilters = () => { setFilters(tempFilters); setPage(0); };
  const clearFilters = () => { setTempFilters({}); setFilters({}); setPage(0); setCategory('all'); };

  const exportColumns: ExportColumn[] = [
    { key: 'created_at_fmt', label: 'Data/Hora' },
    { key: 'user_email', label: 'Usuário' },
    { key: 'action_type_label', label: 'Ação' },
    { key: 'details_fmt', label: 'Detalhes' },
  ];

  const exportData = logs.map(log => ({
    ...log,
    created_at_fmt: format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss'),
    action_type_label: ACTION_LABELS[log.action_type] || log.action_type,
    details_fmt: formatDetails(log.details),
  }));

  const fname = `audit_logs_${format(new Date(), 'yyyy-MM-dd_HH-mm')}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" />Logs de Auditoria</CardTitle>
            <CardDescription>Histórico completo de ações administrativas no sistema</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => exportCSV(exportData, exportColumns, fname)} variant="outline" size="sm" className="gap-1" disabled={!logs.length}>
              <Download className="w-3 h-3" />CSV
            </Button>
            <Button onClick={() => exportExcel(exportData, exportColumns, fname)} variant="outline" size="sm" className="gap-1" disabled={!logs.length}>
              <FileSpreadsheet className="w-3 h-3" />Excel
            </Button>
            <Button onClick={() => exportPDF(exportData, exportColumns, 'Logs de Auditoria', fname)} variant="outline" size="sm" className="gap-1" disabled={!logs.length}>
              <FileText className="w-3 h-3" />PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Category quick filter */}
        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'all' as const, label: 'Todos' },
            { id: 'access' as const, label: '🚪 Acesso' },
            { id: 'security' as const, label: '🔒 Segurança' },
            { id: 'admin' as const, label: '⚙️ Administrativo' },
          ].map(c => (
            <Button key={c.id} size="sm" variant={category === c.id ? 'default' : 'outline'}
              onClick={() => setCategory(c.id)}>{c.label}</Button>
          ))}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-lg bg-muted/50">
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Calendar className="w-3 h-3" />Data Início</Label>
            <Input type="date" value={tempFilters.startDate?.split('T')[0] || ''}
              onChange={e => setTempFilters({ ...tempFilters, startDate: e.target.value ? `${e.target.value}T00:00:00` : undefined })} />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Calendar className="w-3 h-3" />Data Fim</Label>
            <Input type="date" value={tempFilters.endDate?.split('T')[0] || ''}
              onChange={e => setTempFilters({ ...tempFilters, endDate: e.target.value ? `${e.target.value}T23:59:59` : undefined })} />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Filter className="w-3 h-3" />Tipo de Ação</Label>
            <Select value={tempFilters.actionType ?? 'all'}
              onValueChange={v => setTempFilters({ ...tempFilters, actionType: v === 'all' ? undefined : v as AuditActionType })}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(ACTION_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={applyFilters} className="flex-1 gap-2"><Search className="w-4 h-4" />Filtrar</Button>
            <Button onClick={clearFilters} variant="outline">Limpar</Button>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">{logs.length} registro(s) exibido(s) de {totalCount}</div>

        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : logs.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhum log encontrado</p>
        ) : (
          <div className="rounded-md border overflow-auto max-h-[55vh]">
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
                {logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.user_email || <span className="text-muted-foreground">Sistema</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getActionVariant(log.action_type)}>
                        {ACTION_LABELS[log.action_type] || log.action_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[350px]">
                      <span className="block truncate" title={JSON.stringify(log.details)}>
                        {formatDetails(log.details)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Página {page + 1} de {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                <ChevronLeft className="w-4 h-4" />Anterior
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                Próximo<ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AuditLogsTab;

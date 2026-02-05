import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  FileBarChart, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  Filter,
  Search,
  Calendar,
  Users,
  FileText
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PAGE_SIZE = 25;

type ReportType = 'access' | 'visitors' | 'employees' | 'audit';

interface ReportFilters {
  startDate: string;
  endDate: string;
  reportType: ReportType;
  subjectType?: string;
  direction?: string;
}

const ReportsTab = () => {
  const { toast } = useToast();
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    reportType: 'access',
  });

  // Fetch report data based on type
  const { data, isLoading } = useQuery({
    queryKey: ['reports', filters, page],
    queryFn: async () => {
      const startDateTime = startOfDay(new Date(filters.startDate)).toISOString();
      const endDateTime = endOfDay(new Date(filters.endDate)).toISOString();

      switch (filters.reportType) {
        case 'access': {
          let query = supabase
            .from('access_logs')
            .select('*', { count: 'exact' })
            .gte('created_at', startDateTime)
            .lte('created_at', endDateTime)
            .order('created_at', { ascending: false })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

          if (filters.subjectType) {
            query = query.eq('subject_type', filters.subjectType as 'visitor' | 'employee');
          }
          if (filters.direction) {
            query = query.eq('direction', filters.direction as 'in' | 'out');
          }

          const { data, error, count } = await query;
          if (error) throw error;
          return { data, count: count || 0, type: 'access' as const };
        }

        case 'visitors': {
          const { data, error, count } = await supabase
            .from('visitors')
            .select('*', { count: 'exact' })
            .gte('created_at', startDateTime)
            .lte('created_at', endDateTime)
            .order('created_at', { ascending: false })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

          if (error) throw error;
          return { data, count: count || 0, type: 'visitors' as const };
        }

        case 'employees': {
          const { data, error, count } = await supabase
            .from('employee_credentials')
            .select('*', { count: 'exact' })
            .gte('created_at', startDateTime)
            .lte('created_at', endDateTime)
            .order('created_at', { ascending: false })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

          if (error) throw error;
          return { data, count: count || 0, type: 'employees' as const };
        }

        case 'audit': {
          const { data, error, count } = await supabase
            .from('audit_logs')
            .select('*', { count: 'exact' })
            .gte('created_at', startDateTime)
            .lte('created_at', endDateTime)
            .order('created_at', { ascending: false })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

          if (error) throw error;
          return { data, count: count || 0, type: 'audit' as const };
        }

        default:
          return { data: [], count: 0, type: 'access' as const };
      }
    },
  });

  const totalPages = Math.ceil((data?.count || 0) / PAGE_SIZE);

  const handleApplyFilters = () => {
    setPage(0);
  };

  const exportToCSV = () => {
    if (!data?.data?.length) {
      toast({
        title: 'Nenhum dado para exportar',
        description: 'Aplique filtros e aguarde os dados serem carregados.',
        variant: 'destructive',
      });
      return;
    }

    let headers: string[] = [];
    let rows: string[] = [];

    switch (filters.reportType) {
      case 'access':
        headers = ['Data/Hora', 'Tipo', 'Direção', 'Portão', 'Subject ID'];
        rows = (data.data as any[]).map((log) =>
          [
            format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss'),
            log.subject_type,
            log.direction,
            log.gate_id,
            log.subject_id,
          ].join(',')
        );
        break;

      case 'visitors':
        headers = ['Data/Hora', 'Nome', 'Documento', 'Empresa', 'Destino', 'Status'];
        rows = (data.data as any[]).map((v) =>
          [
            format(new Date(v.created_at), 'dd/MM/yyyy HH:mm:ss'),
            v.full_name,
            v.document,
            v.company || '-',
            v.visit_to_name,
            v.status,
          ].join(',')
        );
        break;

      case 'employees':
        headers = ['Data/Hora', 'Nome', 'Documento', 'Cargo', 'Tipo', 'Status'];
        rows = (data.data as any[]).map((e) =>
          [
            format(new Date(e.created_at), 'dd/MM/yyyy HH:mm:ss'),
            e.full_name,
            e.document,
            e.job_title || '-',
            e.type,
            e.status,
          ].join(',')
        );
        break;

      case 'audit':
        headers = ['Data/Hora', 'Usuário', 'Ação', 'Detalhes'];
        rows = (data.data as any[]).map((log) =>
          [
            format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss'),
            log.user_email || 'Sistema',
            log.action_type,
            JSON.stringify(log.details || {}).replace(/,/g, ';'),
          ].join(',')
        );
        break;
    }

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_${filters.reportType}_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Relatório exportado!',
      description: 'O arquivo CSV foi baixado com sucesso.',
    });
  };

  const renderTable = () => {
    if (isLoading) {
      return <p className="text-muted-foreground text-center py-8">Carregando...</p>;
    }

    if (!data?.data?.length) {
      return <p className="text-muted-foreground text-center py-8">Nenhum registro encontrado</p>;
    }

    switch (filters.reportType) {
      case 'access':
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Direção</TableHead>
                <TableHead>Portão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.data as any[]).map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">
                    {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={log.subject_type === 'visitor' ? 'secondary' : 'outline'}>
                      {log.subject_type === 'visitor' ? 'Visitante' : 'Colaborador'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={log.direction === 'in' ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}>
                      {log.direction === 'in' ? '↓ ENTRADA' : '↑ SAÍDA'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{log.gate_id}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case 'visitors':
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.data as any[]).map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="text-sm">
                    {format(new Date(v.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  <TableCell className="font-medium">{v.full_name}</TableCell>
                  <TableCell>{v.company || '-'}</TableCell>
                  <TableCell>{v.visit_to_name}</TableCell>
                  <TableCell>
                    <Badge variant={v.status === 'inside' ? 'default' : 'secondary'}>
                      {v.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case 'employees':
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.data as any[]).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm">
                    {format(new Date(e.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  <TableCell className="font-medium">{e.full_name}</TableCell>
                  <TableCell>{e.document}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {e.type === 'personal' ? 'Pessoal' : 'Veículo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={e.status === 'allowed' ? 'default' : 'destructive'}>
                      {e.status === 'allowed' ? 'Liberado' : 'Bloqueado'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case 'audit':
        return (
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
              {(data.data as any[]).map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>{log.user_email || 'Sistema'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.action_type}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {Object.keys(log.details || {}).length > 0 ? JSON.stringify(log.details) : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileBarChart className="w-5 h-5" />
              Relatórios Personalizados
            </CardTitle>
            <CardDescription>
              Gere relatórios detalhados com filtros avançados para análise e conformidade
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 p-4 rounded-lg bg-muted/50">
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              Tipo de Relatório
            </Label>
            <Select
              value={filters.reportType}
              onValueChange={(v) => setFilters({ ...filters, reportType: v as ReportType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="access">Logs de Acesso</SelectItem>
                <SelectItem value="visitors">Visitantes</SelectItem>
                <SelectItem value="employees">Colaboradores</SelectItem>
                <SelectItem value="audit">Auditoria</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Data Início
            </Label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Data Fim
            </Label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>

          {filters.reportType === 'access' && (
            <>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  Tipo de Sujeito
                </Label>
                <Select
                  value={filters.subjectType || ''}
                  onValueChange={(v) => setFilters({ ...filters, subjectType: v || undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    <SelectItem value="visitor">Visitantes</SelectItem>
                    <SelectItem value="employee">Colaboradores</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Filter className="w-3 h-3" />
                  Direção
                </Label>
                <Select
                  value={filters.direction || ''}
                  onValueChange={(v) => setFilters({ ...filters, direction: v || undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    <SelectItem value="in">Entrada</SelectItem>
                    <SelectItem value="out">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="flex items-end">
            <Button onClick={handleApplyFilters} className="w-full gap-2">
              <Search className="w-4 h-4" />
              Gerar Relatório
            </Button>
          </div>
        </div>

        {/* Results count */}
        <div className="text-sm text-muted-foreground">
          {data?.count || 0} registro(s) encontrado(s)
        </div>

        {/* Table */}
        <div className="rounded-md border">{renderTable()}</div>

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

export default ReportsTab;

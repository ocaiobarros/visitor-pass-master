import { useState, useMemo } from 'react';
import { useReport } from '@/hooks/useReports';
import { exportCSV, exportExcel, exportPDF, ExportColumn } from '@/lib/reportExport';
import { formatLocalDateTime, formatLocalDate, formatDuration, permanenceLevel } from '@/lib/dateUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, FileSpreadsheet, FileText, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 50;

export interface ColumnDef {
  key: string;
  label: string;
  format?: 'datetime' | 'date' | 'badge' | 'duration' | 'number' | 'session_status';
  badgeVariant?: (value: string) => 'default' | 'secondary' | 'destructive' | 'outline';
}

export interface FilterDef {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date';
  placeholder?: string;
  options?: { value: string; label: string }[];
  rpcParam: string;
}

export interface ReportConfig {
  title: string;
  rpcName: string;
  columns: ColumnDef[];
  filters: FilterDef[];
}

const directionBadge = (v: string) => v === 'in' ? 'default' as const : 'secondary' as const;
const statusBadge = (v: string) => {
  if (['allowed', 'active', 'inside', 'completed'].includes(v)) return 'default' as const;
  if (['blocked', 'denied', 'suspended'].includes(v)) return 'destructive' as const;
  return 'secondary' as const;
};
const personTypeBadge = (_v: string) => 'outline' as const;

const sessionStatusLabel: Record<string, string> = {
  inside: 'Dentro',
  completed: 'Finalizado',
  pending: 'Pendente',
  denied: 'Negado',
  expired: 'Expirado',
};

export { directionBadge, statusBadge, personTypeBadge };

const GenericReport = ({ config }: { config: ReportConfig }) => {
  const [page, setPage] = useState(0);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  const rpcParams = useMemo(() => {
    const params: Record<string, any> = { p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE };
    config.filters.forEach(f => {
      const val = filterValues[f.key];
      if (val && val !== 'all' && val !== '') {
        params[f.rpcParam] = f.type === 'date'
          ? (f.key.includes('start') || f.key.includes('from') ? `${val}T00:00:00` : `${val}T23:59:59`)
          : val;
      }
    });
    return params;
  }, [filterValues, page, config.filters]);

  const { data, isLoading } = useReport(config.rpcName, rpcParams);
  const rows = (data as any[]) || [];

  // Build export columns with local timezone conversion
  const exportCols: ExportColumn[] = config.columns.map(c => ({ key: c.key, label: c.label }));
  const fname = `${config.rpcName}_${format(new Date(), 'yyyy-MM-dd_HH-mm')}`;

  // Pre-process rows for export: convert dates to local timezone strings
  const exportRows = rows.map(row => {
    const processed: Record<string, any> = {};
    config.columns.forEach(c => {
      const val = row[c.key];
      if (val === null || val === undefined) {
        processed[c.key] = '-';
      } else if (c.format === 'datetime') {
        processed[c.key] = formatLocalDateTime(val);
      } else if (c.format === 'date') {
        processed[c.key] = formatLocalDate(val);
      } else if (c.format === 'duration') {
        processed[c.key] = formatDuration(val);
      } else if (c.format === 'session_status') {
        processed[c.key] = sessionStatusLabel[val] || val;
      } else {
        processed[c.key] = val;
      }
    });
    return processed;
  });

  const formatCell = (row: any, col: ColumnDef) => {
    const value = row[col.key];
    if (value === null || value === undefined) return <span className="text-muted-foreground">-</span>;
    switch (col.format) {
      case 'datetime': return formatLocalDateTime(value);
      case 'date': return formatLocalDate(value);
      case 'badge': return <Badge variant={col.badgeVariant?.(value) || 'outline'}>{value}</Badge>;
      case 'duration': {
        const level = permanenceLevel(value);
        return (
          <span className={cn(
            'font-mono',
            level === 'critical' && 'text-destructive font-bold',
            level === 'high' && 'text-yellow-600 font-semibold',
          )}>
            {formatDuration(value)}
          </span>
        );
      }
      case 'session_status': {
        const label = sessionStatusLabel[value] || value;
        const variant = value === 'inside' ? 'destructive' as const
          : value === 'completed' ? 'default' as const
          : value === 'denied' ? 'destructive' as const
          : 'secondary' as const;
        return <Badge variant={variant}>{label}</Badge>;
      }
      case 'number': return Number(value).toLocaleString('pt-BR');
      default: return String(value);
    }
  };

  return (
    <div className="space-y-4">
      {config.filters.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 rounded-lg bg-muted/50">
          {config.filters.map(f => (
            <div key={f.key} className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
              {f.type === 'select' ? (
                <Select value={filterValues[f.key] || 'all'} onValueChange={v => setFilterValues(prev => ({ ...prev, [f.key]: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {f.options?.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input type={f.type} placeholder={f.placeholder} value={filterValues[f.key] || ''}
                  onChange={e => setFilterValues(prev => ({ ...prev, [f.key]: e.target.value }))} />
              )}
            </div>
          ))}
          <div className="flex items-end gap-2">
            <Button onClick={() => setPage(0)} size="sm" className="gap-1"><Search className="w-3 h-3" />Filtrar</Button>
            <Button onClick={() => { setFilterValues({}); setPage(0); }} size="sm" variant="outline">Limpar</Button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{rows.length} registro(s){rows.length === PAGE_SIZE ? '+' : ''}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportCSV(exportRows, exportCols, fname)} disabled={!rows.length}>
            <Download className="w-3 h-3 mr-1" />CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportExcel(exportRows, exportCols, fname)} disabled={!rows.length}>
            <FileSpreadsheet className="w-3 h-3 mr-1" />Excel
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportPDF(exportRows, exportCols, config.title, fname)} disabled={!rows.length}>
            <FileText className="w-3 h-3 mr-1" />PDF
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-center py-8 text-muted-foreground">Carregando...</p>
      ) : rows.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">Nenhum registro encontrado</p>
      ) : (
        <div className="rounded-md border overflow-auto max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>{config.columns.map(c => <TableHead key={c.key} className="whitespace-nowrap">{c.label}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row: any, i: number) => (
                <TableRow key={row.id || row.subject_id || i}>
                  {config.columns.map(c => (
                    <TableCell key={c.key} className="text-sm whitespace-nowrap">{formatCell(row, c)}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">Página {page + 1}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
            <ChevronLeft className="w-4 h-4" />Anterior
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPage(p => p + 1)} disabled={rows.length < PAGE_SIZE}>
            Próximo<ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GenericReport;

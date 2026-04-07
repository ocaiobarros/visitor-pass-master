import { useState, useMemo } from 'react';
import { useReport } from '@/hooks/useReports';
import { useGates } from '@/hooks/useGates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { exportProfessionalPDF, ExportColumn } from '@/lib/reportExport';
import { formatLocalDate, formatLocalDateTime } from '@/lib/dateUtils';
import { format, subDays } from 'date-fns';
import { Users, Car, ShieldAlert, Clock, TrendingUp, Building2, FileText, LogIn, LogOut } from 'lucide-react';

const ExecutiveReport = () => {
  const [start, setStart] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [end, setEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { data: gates } = useGates();

  const gateNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (gates) {
      gates.forEach(g => { map[g.code] = g.name; map[g.id] = g.name; });
    }
    return map;
  }, [gates]);

  const resolveGate = (code: string) => gateNameMap[code] || code;

  const { data, isLoading } = useReport('report_executive_summary', {
    p_start: `${start}T00:00:00`,
    p_end: `${end}T23:59:59`,
  });

  const stats = data as any;

  if (isLoading) return <p className="text-center py-8 text-muted-foreground">Carregando resumo executivo...</p>;
  if (!stats) return <p className="text-center py-8 text-muted-foreground">Sem dados disponíveis para o período</p>;

  const cards = [
    { label: 'Entradas', value: stats.total_entries, icon: LogIn, color: 'text-green-600' },
    { label: 'Saídas', value: stats.total_exits, icon: LogOut, color: 'text-muted-foreground' },
    { label: 'Dentro Agora', value: stats.currently_inside, icon: Users, color: 'text-destructive' },
    { label: 'Visitantes', value: stats.unique_visitors, icon: Users, color: 'text-primary' },
    { label: 'Colaboradores', value: stats.unique_employees, icon: Users, color: 'text-primary' },
    { label: 'Agregados', value: stats.unique_associates, icon: Users, color: 'text-primary' },
    { label: 'Veículos', value: stats.unique_vehicles, icon: Car, color: 'text-primary' },
    { label: 'Negativas', value: stats.total_denials, icon: ShieldAlert, color: 'text-destructive' },
    { label: 'Passes Expirados', value: stats.total_expired_unused, icon: Clock, color: 'text-yellow-600' },
    { label: 'Hora Pico', value: stats.peak_hour !== null ? `${stats.peak_hour}h` : '-', icon: TrendingUp, color: 'text-primary' },
  ];

  const handleExport = () => {
    const summaryItems = cards.map(c => ({ label: c.label, value: c.value ?? 0 }));

    const mainCols: ExportColumn[] = [{ key: 'metric', label: 'Métrica' }, { key: 'value', label: 'Valor' }];
    const mainRows = cards.map(c => ({ metric: c.label, value: String(c.value ?? 0) }));

    const extraSections: { title: string; data: any[]; columns: ExportColumn[] }[] = [];

    if (stats.top_gates?.length) {
      extraSections.push({
        title: 'Top Portões',
        columns: [{ key: 'gate_id', label: 'Portão' }, { key: 'total', label: 'Total' }],
        data: stats.top_gates,
      });
    }
    if (stats.top_departments?.length) {
      extraSections.push({
        title: 'Top Departamentos',
        columns: [{ key: 'department', label: 'Departamento' }, { key: 'total', label: 'Total' }],
        data: stats.top_departments,
      });
    }
    if (stats.daily_breakdown?.length) {
      extraSections.push({
        title: 'Detalhamento Diário',
        columns: [
          { key: 'day', label: 'Data' },
          { key: 'entries', label: 'Entradas' },
          { key: 'exits', label: 'Saídas' },
          { key: 'unique_people', label: 'Pessoas' },
        ],
        data: stats.daily_breakdown.map((d: any) => ({
          ...d,
          day: formatLocalDate(d.day),
        })),
      });
    }

    exportProfessionalPDF({
      title: 'Resumo Executivo',
      subtitle: 'Visão consolidada de controle de acesso',
      filename: `executivo_${format(new Date(), 'yyyy-MM-dd')}`,
      columns: mainCols,
      data: mainRows,
      filters: `Período: ${formatLocalDate(start)} a ${formatLocalDate(end)}`,
      summary: summaryItems,
      accentColor: [22, 101, 52],
      extraSections,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Início</label>
          <Input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Fim</label>
          <Input type="date" value={end} onChange={e => setEnd(e.target.value)} className="w-40" />
        </div>
        <Button size="sm" variant="outline" onClick={handleExport}>
          <FileText className="w-3 h-3 mr-1" />Exportar PDF
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map(c => (
          <Card key={c.label}>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <c.icon className={`w-4 h-4 ${c.color}`} />
                <span className="text-xs text-muted-foreground">{c.label}</span>
              </div>
              <p className="text-2xl font-bold mt-1">{c.value ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.by_entity_type && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Movimentação por Tipo</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-6">
              <div><span className="text-sm text-muted-foreground">Visitantes:</span> <strong>{stats.by_entity_type.visitors}</strong></div>
              <div><span className="text-sm text-muted-foreground">Colaboradores:</span> <strong>{stats.by_entity_type.employees}</strong></div>
              <div><span className="text-sm text-muted-foreground">Agregados:</span> <strong>{stats.by_entity_type.associates}</strong></div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stats.top_gates?.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="w-4 h-4" />Top Portões</CardTitle></CardHeader>
            <CardContent>
              {stats.top_gates.map((g: any) => (
                <div key={g.gate_id} className="flex justify-between py-1 text-sm border-b last:border-0">
                  <span>{g.gate_id}</span><Badge variant="outline">{g.total}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        {stats.top_departments?.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="w-4 h-4" />Top Departamentos</CardTitle></CardHeader>
            <CardContent>
              {stats.top_departments.map((d: any) => (
                <div key={d.department} className="flex justify-between py-1 text-sm border-b last:border-0">
                  <span>{d.department}</span><Badge variant="outline">{d.total}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {stats.daily_breakdown?.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Detalhamento Diário</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-[300px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Data</th>
                    <th className="text-right py-2 font-medium">Entradas</th>
                    <th className="text-right py-2 font-medium">Saídas</th>
                    <th className="text-right py-2 font-medium">Pessoas</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.daily_breakdown.map((d: any) => (
                    <tr key={d.day} className="border-b last:border-0">
                      <td className="py-1">{formatLocalDate(d.day)}</td>
                      <td className="text-right">{d.entries}</td>
                      <td className="text-right">{d.exits}</td>
                      <td className="text-right">{d.unique_people}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ExecutiveReport;

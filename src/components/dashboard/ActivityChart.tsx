import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AccessLog {
  id: string;
  created_at: string;
  direction: 'in' | 'out';
  subject_type: 'visitor' | 'employee';
}

interface ActivityChartProps {
  accessLogs: AccessLog[];
}

const ActivityChart = ({ accessLogs }: ActivityChartProps) => {
  const chartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);

      const dayLogs = accessLogs.filter((log) => {
        const logDate = new Date(log.created_at);
        return logDate >= dayStart && logDate <= dayEnd;
      });

      const entries = dayLogs.filter((log) => log.direction === 'in').length;
      const exits = dayLogs.filter((log) => log.direction === 'out').length;

      return {
        day: format(date, 'EEE', { locale: ptBR }),
        date: format(date, 'dd/MM'),
        entradas: entries,
        saidas: exits,
      };
    });

    return last7Days;
  }, [accessLogs]);

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Atividade de Acesso (Últimos 7 Dias)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }} 
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 12 }} 
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ fontWeight: 'bold' }}
              />
              <Bar 
                dataKey="entradas" 
                fill="hsl(var(--success))" 
                name="Entradas"
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="saidas" 
                fill="hsl(var(--muted-foreground))" 
                name="Saídas"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default ActivityChart;

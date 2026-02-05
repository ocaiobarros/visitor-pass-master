import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Activity, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { startOfDay, endOfDay, subHours } from 'date-fns';

interface AccessLog {
  id: string;
  created_at: string;
  direction: 'in' | 'out';
  subject_type: 'visitor' | 'employee';
}

interface TodayStatsProps {
  accessLogs: AccessLog[];
}

const TodayStats = ({ accessLogs }: TodayStatsProps) => {
  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const last24h = subHours(now, 24);

    const todayLogs = accessLogs.filter((log) => {
      const logDate = new Date(log.created_at);
      return logDate >= todayStart && logDate <= todayEnd;
    });

    const last24hLogs = accessLogs.filter((log) => {
      const logDate = new Date(log.created_at);
      return logDate >= last24h;
    });

    const totalToday = todayLogs.length;
    const entriesHoje = todayLogs.filter((log) => log.direction === 'in').length;
    const exitsHoje = todayLogs.filter((log) => log.direction === 'out').length;
    
    // Calculate hourly rate
    const hoursElapsed = Math.max(1, (now.getTime() - todayStart.getTime()) / (1000 * 60 * 60));
    const avgPerHour = (totalToday / hoursElapsed).toFixed(1);

    // Compare with yesterday (approximate)
    const yesterdayLogs = accessLogs.filter((log) => {
      const logDate = new Date(log.created_at);
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const yesterdayEnd = new Date(todayEnd);
      yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
      return logDate >= yesterdayStart && logDate <= yesterdayEnd;
    });

    const trend = totalToday - yesterdayLogs.length;
    const trendPercentage = yesterdayLogs.length > 0 
      ? ((trend / yesterdayLogs.length) * 100).toFixed(0) 
      : '0';

    return {
      totalToday,
      entriesHoje,
      exitsHoje,
      avgPerHour,
      trend,
      trendPercentage,
    };
  }, [accessLogs]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Hoje</p>
              <p className="text-2xl font-bold text-primary">{stats.totalToday}</p>
              <div className="flex items-center gap-1 text-xs">
                {stats.trend >= 0 ? (
                  <TrendingUp className="w-3 h-3 text-success" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-destructive" />
                )}
                <span className={stats.trend >= 0 ? 'text-success' : 'text-destructive'}>
                  {stats.trend >= 0 ? '+' : ''}{stats.trendPercentage}%
                </span>
                <span className="text-muted-foreground">vs ontem</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Entradas</p>
              <p className="text-2xl font-bold text-success">{stats.entriesHoje}</p>
              <p className="text-xs text-muted-foreground">Hoje</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-muted to-muted/50 border-border">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted-foreground/20 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Saídas</p>
              <p className="text-2xl font-bold">{stats.exitsHoje}</p>
              <p className="text-xs text-muted-foreground">Hoje</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-secondary/50 to-secondary/30 border-secondary/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
              <Clock className="w-5 h-5 text-secondary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Média/Hora</p>
              <p className="text-2xl font-bold">{stats.avgPerHour}</p>
              <p className="text-xs text-muted-foreground">acessos</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TodayStats;

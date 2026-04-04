import { Card, CardContent } from '@/components/ui/card';
import { Activity, TrendingUp, TrendingDown, Clock, Loader2 } from 'lucide-react';
import { useTodayStats } from '@/hooks/useDashboardStats';

const TodayStats = () => {
  const { data: stats, isLoading } = useTodayStats();

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-4 pb-4 flex items-center justify-center h-24">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

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
              <p className="text-2xl font-bold text-primary">{stats.total_today}</p>
              <div className="flex items-center gap-1 text-xs">
                {stats.trend >= 0 ? (
                  <TrendingUp className="w-3 h-3 text-success" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-destructive" />
                )}
                <span className={stats.trend >= 0 ? 'text-success' : 'text-destructive'}>
                  {stats.trend >= 0 ? '+' : ''}{stats.trend_percentage}%
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
              <p className="text-2xl font-bold text-success">{stats.entries_today}</p>
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
              <p className="text-2xl font-bold">{stats.exits_today}</p>
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
              <p className="text-2xl font-bold">{stats.avg_per_hour}</p>
              <p className="text-xs text-muted-foreground">acessos</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TodayStats;

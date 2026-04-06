import { useDashboardStats, useRecentVisitors, useVisitorsInside } from '@/hooks/useDashboardStats';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, UserX, Clock, TrendingUp, CalendarDays, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ActivityChart from '@/components/dashboard/ActivityChart';
import StatusWidgets from '@/components/dashboard/StatusWidgets';
import CriticalEventsList from '@/components/dashboard/CriticalEventsList';
import TodayStats from '@/components/dashboard/TodayStats';

const Dashboard = () => {
  const { data: stats, isLoading: isLoadingStats } = useDashboardStats();
  const { data: recentVisitors = [], isLoading: isLoadingRecent } = useRecentVisitors(5);
  const { data: insideVisitors = [], isLoading: isLoadingInside } = useVisitorsInside(5);

  if (isLoadingStats) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const s = stats || {
    total_visitors: 0, visitors_inside: 0, visitors_outside: 0, visitors_pending: 0,
    visitors_expired_unused: 0, entries_today: 0, exits_today: 0, total_access_today: 0,
    employees_active: 0, vehicles_active: 0, associates_active: 0, total_users: 0,
    entries_yesterday: 0, avg_per_hour: 0,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>

        {/* Today Stats — 100% server-side */}
        <TodayStats />

        {/* Status Widgets — server-side stats */}
        <StatusWidgets
          totalUsers={s.total_users}
          activeGates={1}
          totalGates={1}
          visitorsInside={s.visitors_inside}
          employeesActive={s.employees_active}
          vehiclesActive={s.vehicles_active}
          associatesActive={s.associates_active}
        />

        {/* Activity Chart + Critical Events — 100% server-side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ActivityChart />
          <CriticalEventsList />
        </div>

        {/* Stats Cards — server-side aggregated */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="card-stats">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total de Visitantes</p>
                  <p className="text-3xl font-bold text-foreground">{s.total_visitors}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-stats border-success/30 bg-success/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Dentro da Empresa</p>
                  <p className="text-3xl font-bold text-success">{s.visitors_inside}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <UserCheck className="w-6 h-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-stats">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Saídas/Encerrados</p>
                  <p className="text-3xl font-bold text-foreground">{s.visitors_outside}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                  <UserX className="w-6 h-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-stats border-warning/30 bg-warning/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Aguardando Entrada</p>
                  <p className="text-3xl font-bold text-warning">{s.visitors_pending}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Two Columns — server-side JOINs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Currently Inside */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-success" />
                Visitantes Dentro da Empresa
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingInside ? (
                <p className="text-muted-foreground text-center py-8">Carregando...</p>
              ) : insideVisitors.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum visitante dentro da empresa</p>
              ) : (
                <div className="space-y-3">
                  {insideVisitors.map((visitor) => (
                    <div key={visitor.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">{visitor.full_name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{visitor.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {visitor.visit_to_type === 'setor' ? '📍' : '👤'} {visitor.visit_to_name}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="status-badge-inside">Dentro</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Visitors */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-primary" />
                Visitantes Recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingRecent ? (
                <p className="text-muted-foreground text-center py-8">Carregando...</p>
              ) : recentVisitors.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum visitante registrado</p>
              ) : (
                <div className="space-y-3">
                  {recentVisitors.map((visitor) => (
                    <div key={visitor.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                          <span className="text-sm font-medium">{visitor.full_name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{visitor.full_name}</p>
                          <p className="text-xs text-muted-foreground">{visitor.company_name || visitor.company_reason || 'Sem empresa'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={
                            visitor.status === 'inside'
                              ? 'status-badge-inside'
                              : visitor.status === 'outside'
                              ? 'status-badge-outside'
                              : visitor.status === 'closed'
                              ? 'status-badge-expired'
                              : 'status-badge-outside'
                          }
                        >
                          {visitor.status === 'inside'
                            ? 'Dentro'
                            : visitor.status === 'outside'
                            ? 'Fora'
                            : visitor.status === 'pending'
                            ? 'Pendente'
                            : 'Encerrado'}
                        </span>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(visitor.created_at), 'dd/MM HH:mm')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;

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
import RecentAccessList from '@/components/dashboard/RecentAccessList';
import OperationalOverview from '@/components/dashboard/OperationalOverview';

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

        {/* Today Stats */}
        <TodayStats />

        {/* Status Widgets */}
        <StatusWidgets
          totalUsers={s.total_users}
          activeGates={1}
          totalGates={1}
          visitorsInside={s.visitors_inside}
          employeesActive={s.employees_active}
          vehiclesActive={s.vehicles_active}
          associatesActive={s.associates_active}
        />

        {/* Activity Chart + Critical Events */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ActivityChart />
          <CriticalEventsList />
        </div>

        {/* Operational Overview + Recent Access */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <OperationalOverview />
          </div>
          <div className="lg:col-span-2">
            <RecentAccessList />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatsCard label="Total de Visitantes" value={s.total_visitors} icon={Users} variant="default" />
          <StatsCard label="Dentro da Empresa" value={s.visitors_inside} icon={UserCheck} variant="success" />
          <StatsCard label="Saídas/Encerrados" value={s.visitors_outside} icon={UserX} variant="default" />
          <StatsCard label="Aguardando Entrada" value={s.visitors_pending} icon={Clock} variant="warning" />
          <StatsCard label="Expirados (Sem Uso)" value={s.visitors_expired_unused} icon={Clock} variant="destructive" />
        </div>

        {/* Visitors Inside + Recent Visitors */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <VisitorsInsideCard visitors={insideVisitors} isLoading={isLoadingInside} />
          <RecentVisitorsCard visitors={recentVisitors} isLoading={isLoadingRecent} />
        </div>
      </div>
    </DashboardLayout>
  );
};

/* ---------- Sub-components ---------- */

interface StatsCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  variant: 'default' | 'success' | 'warning' | 'destructive';
}

const variantStyles: Record<string, { card: string; text: string; iconBg: string; iconText: string }> = {
  default:     { card: 'card-stats', text: 'text-foreground', iconBg: 'bg-primary/10', iconText: 'text-primary' },
  success:     { card: 'card-stats border-success/30 bg-success/5', text: 'text-success', iconBg: 'bg-success/10', iconText: 'text-success' },
  warning:     { card: 'card-stats border-warning/30 bg-warning/5', text: 'text-warning', iconBg: 'bg-warning/10', iconText: 'text-warning' },
  destructive: { card: 'card-stats border-destructive/30 bg-destructive/5', text: 'text-destructive', iconBg: 'bg-destructive/10', iconText: 'text-destructive' },
};

const StatsCard = ({ label, value, icon: Icon, variant }: StatsCardProps) => {
  const v = variantStyles[variant];
  return (
    <Card className={v.card}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className={`text-3xl font-bold ${v.text}`}>{value}</p>
          </div>
          <div className={`w-12 h-12 rounded-xl ${v.iconBg} flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${v.iconText}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface InsideVisitor {
  id: string;
  full_name: string;
  visit_to_type: string;
  visit_to_name: string;
  company_name: string | null;
  created_at: string;
}

const VisitorsInsideCard = ({ visitors, isLoading }: { visitors: InsideVisitor[]; isLoading: boolean }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-success" />
        Visitantes Dentro da Empresa
      </CardTitle>
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <p className="text-muted-foreground text-center py-8">Carregando...</p>
      ) : visitors.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">Nenhum visitante dentro da empresa</p>
      ) : (
        <div className="space-y-3">
          {visitors.map((visitor) => (
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
              <span className="status-badge-inside">Dentro</span>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

interface RecentVisitor {
  id: string;
  full_name: string;
  status: string;
  visit_to_type: string;
  visit_to_name: string;
  company_name: string | null;
  company_reason: string;
  created_at: string;
}

const RecentVisitorsCard = ({ visitors, isLoading }: { visitors: RecentVisitor[]; isLoading: boolean }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-primary" />
        Visitantes Recentes
      </CardTitle>
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <p className="text-muted-foreground text-center py-8">Carregando...</p>
      ) : visitors.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">Nenhum visitante registrado</p>
      ) : (
        <div className="space-y-3">
          {visitors.map((visitor) => (
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
                <span className={
                  visitor.status === 'inside' ? 'status-badge-inside'
                    : visitor.status === 'outside' ? 'status-badge-outside'
                    : visitor.status === 'closed' ? 'status-badge-expired'
                    : 'status-badge-outside'
                }>
                  {visitor.status === 'inside' ? 'Dentro'
                    : visitor.status === 'outside' ? 'Fora'
                    : visitor.status === 'pending' ? 'Pendente'
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
);

export default Dashboard;

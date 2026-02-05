import { useVisitors } from '@/hooks/useVisitors';
import { useAccessLogs } from '@/hooks/useAccessLogs';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, UserX, Clock, TrendingUp, CalendarDays, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const Dashboard = () => {
  const { data: visitors = [], isLoading } = useVisitors();
  const { data: logs = [] } = useAccessLogs(10);

  const stats = {
    total: visitors.length,
    inside: visitors.filter((v) => v.status === 'inside').length,
    outside: visitors.filter((v) => v.status === 'outside' || v.status === 'closed').length,
    pending: visitors.filter((v) => v.status === 'pending').length,
  };

  const recentVisitors = [...visitors]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const insideVisitors = visitors.filter((v) => v.status === 'inside');

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="card-stats">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total de Visitantes</p>
                  <p className="text-3xl font-bold text-foreground">{stats.total}</p>
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
                  <p className="text-3xl font-bold text-success">{stats.inside}</p>
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
                  <p className="text-3xl font-bold text-foreground">{stats.outside}</p>
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
                  <p className="text-3xl font-bold text-warning">{stats.pending}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Two Columns */}
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
              {insideVisitors.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum visitante dentro da empresa</p>
              ) : (
                <div className="space-y-3">
                  {insideVisitors.map((visitor) => (
                    <div key={visitor.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">{visitor.fullName.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{visitor.fullName}</p>
                          <p className="text-xs text-muted-foreground">
                            {visitor.visitToType === 'setor' ? '📍' : '👤'} {visitor.visitToName}
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
              {recentVisitors.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum visitante registrado</p>
              ) : (
                <div className="space-y-3">
                  {recentVisitors.map((visitor) => (
                    <div key={visitor.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                          <span className="text-sm font-medium">{visitor.fullName.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{visitor.fullName}</p>
                          <p className="text-xs text-muted-foreground">{visitor.company || 'Sem empresa'}</p>
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
                          {format(new Date(visitor.createdAt), 'dd/MM HH:mm')}
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

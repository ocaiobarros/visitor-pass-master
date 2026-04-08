import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, AlertTriangle, Clock, CheckCircle2, Loader2 } from 'lucide-react';

interface OverviewData {
  pending_visitors: number;
  inside_visitors: number;
  expired_unused: number;
  sessions_active: number;
}

const useOperationalOverview = () => {
  return useQuery({
    queryKey: ['operational-overview'],
    queryFn: async () => {
      const [visitorsRes, sessionsRes] = await Promise.all([
        supabase
          .from('visitors')
          .select('status', { count: 'exact', head: false }),
        supabase
          .from('access_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),
      ]);

      const visitors = visitorsRes.data || [];
      const pending = visitors.filter(v => v.status === 'pending').length;
      const inside = visitors.filter(v => v.status === 'inside').length;
      const expired = visitors.filter(v => v.status === 'expired_unused').length;

      return {
        pending_visitors: pending,
        inside_visitors: inside,
        expired_unused: expired,
        sessions_active: sessionsRes.count || 0,
      } as OverviewData;
    },
    refetchInterval: 30000,
  });
};

const OperationalOverview = () => {
  const { data, isLoading } = useOperationalOverview();

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-5 h-5 text-primary" />
            Painel Operacional
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const d = data || { pending_visitors: 0, inside_visitors: 0, expired_unused: 0, sessions_active: 0 };

  const items = [
    {
      label: 'Visitantes Dentro',
      value: d.inside_visitors,
      icon: CheckCircle2,
      color: 'text-success',
      bgColor: 'bg-success/10',
      borderColor: d.inside_visitors > 0 ? 'border-l-success' : 'border-l-transparent',
    },
    {
      label: 'Aguardando Entrada',
      value: d.pending_visitors,
      icon: Clock,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: d.pending_visitors > 0 ? 'border-l-warning' : 'border-l-transparent',
    },
    {
      label: 'Sessões Ativas',
      value: d.sessions_active,
      icon: Shield,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      borderColor: d.sessions_active > 0 ? 'border-l-primary' : 'border-l-transparent',
    },
    {
      label: 'Passes Expirados',
      value: d.expired_unused,
      icon: AlertTriangle,
      color: d.expired_unused > 0 ? 'text-destructive' : 'text-muted-foreground',
      bgColor: d.expired_unused > 0 ? 'bg-destructive/10' : 'bg-muted',
      borderColor: d.expired_unused > 0 ? 'border-l-destructive' : 'border-l-transparent',
    },
  ];

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="w-5 h-5 text-primary" />
          Painel Operacional
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3">
          {items.map((item) => (
            <div
              key={item.label}
              className={`flex items-center justify-between p-3 rounded-lg border-l-4 ${item.borderColor} bg-muted/30`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${item.bgColor} flex items-center justify-center`}>
                  <item.icon className={`w-4.5 h-4.5 ${item.color}`} />
                </div>
                <span className="text-sm font-medium text-foreground">{item.label}</span>
              </div>
              <span className={`text-2xl font-bold ${item.color}`}>{item.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default OperationalOverview;

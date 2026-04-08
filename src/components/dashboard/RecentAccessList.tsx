import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowDownLeft, ArrowUpRight, History, Loader2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AccessEvent {
  id: string;
  person_name: string;
  person_type: string;
  direction: string;
  created_at: string;
  gate_id: string;
  vehicle_plate: string | null;
}

const useRecentAccess = (limit = 8) => {
  return useQuery({
    queryKey: ['recent-access', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('access_events_enriched')
        .select('id, person_name, person_type, direction, created_at, gate_id, vehicle_plate')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as AccessEvent[];
    },
    refetchInterval: 15000,
  });
};

const typeLabels: Record<string, string> = {
  visitor: 'Visitante',
  employee: 'Colaborador',
  associate: 'Agregado',
};

const RecentAccessList = () => {
  const { data: events = [], isLoading } = useRecentAccess();

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="w-5 h-5 text-primary" />
          Últimos Acessos Registrados
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-muted-foreground text-center py-8 text-sm">Nenhum acesso registrado</p>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <div key={event.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    event.direction === 'in' ? 'bg-success/10' : 'bg-muted'
                  }`}>
                    {event.direction === 'in' ? (
                      <ArrowDownLeft className="w-4 h-4 text-success" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm leading-tight">{event.person_name || 'Desconhecido'}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        {typeLabels[event.person_type] || event.person_type}
                      </Badge>
                      {event.vehicle_plate && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          🚗 {event.vehicle_plate}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-medium ${
                    event.direction === 'in' ? 'text-success' : 'text-muted-foreground'
                  }`}>
                    {event.direction === 'in' ? 'Entrada' : 'Saída'}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentAccessList;

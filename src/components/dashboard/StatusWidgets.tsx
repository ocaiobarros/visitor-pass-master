import { Card, CardContent } from '@/components/ui/card';
import { Users, Shield, DoorOpen, UserCog } from 'lucide-react';

interface StatusWidgetsProps {
  totalUsers: number;
  activeGates: number;
  totalGates: number;
  visitorsInside: number;
  employeesActive: number;
}

const StatusWidgets = ({
  totalUsers,
  activeGates,
  totalGates,
  visitorsInside,
  employeesActive,
}: StatusWidgetsProps) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <DoorOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Portões</p>
              <p className="text-xl font-bold text-primary">
                {activeGates}/{totalGates}
              </p>
              <p className="text-xs text-muted-foreground">Ativos</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Visitantes</p>
              <p className="text-xl font-bold text-success">{visitorsInside}</p>
              <p className="text-xs text-muted-foreground">Dentro</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-secondary/50 to-secondary/30 border-secondary/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
              <Shield className="w-5 h-5 text-secondary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Colaboradores</p>
              <p className="text-xl font-bold">{employeesActive}</p>
              <p className="text-xs text-muted-foreground">Ativos</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-muted to-muted/50 border-border">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted-foreground/20 flex items-center justify-center">
              <UserCog className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Usuários</p>
              <p className="text-xl font-bold">{totalUsers}</p>
              <p className="text-xs text-muted-foreground">Sistema</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatusWidgets;

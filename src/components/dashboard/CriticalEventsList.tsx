import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, LogIn, LogOut, UserPlus, Shield, Clock, Loader2 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCriticalEvents, CriticalEvent } from '@/hooks/useDashboardStats';
import { AuditActionType } from '@/hooks/useAuditLogs';

const getActionIcon = (actionType: string) => {
  switch (actionType) {
    case 'LOGIN':
      return <LogIn className="w-4 h-4 text-success" />;
    case 'LOGOUT':
      return <LogOut className="w-4 h-4 text-muted-foreground" />;
    case 'LOGIN_FAILED':
      return <AlertTriangle className="w-4 h-4 text-destructive" />;
    case 'USER_CREATE':
    case 'VISITOR_CREATE':
    case 'EMPLOYEE_CREATE':
      return <UserPlus className="w-4 h-4 text-primary" />;
    case 'USER_DEACTIVATE':
    case 'USER_DELETE':
      return <AlertTriangle className="w-4 h-4 text-warning" />;
    case 'ROLE_UPDATE':
    case 'CONFIG_UPDATE':
      return <Shield className="w-4 h-4 text-primary" />;
    default:
      return <Clock className="w-4 h-4 text-muted-foreground" />;
  }
};

const getActionLabel = (actionType: string): string => {
  const labels: Record<string, string> = {
    LOGIN: 'Login',
    LOGOUT: 'Logout',
    LOGIN_FAILED: 'Login Falhou',
    USER_CREATE: 'Usuário Criado',
    USER_UPDATE: 'Usuário Atualizado',
    USER_DELETE: 'Usuário Excluído',
    USER_DEACTIVATE: 'Usuário Desativado',
    USER_ACTIVATE: 'Usuário Ativado',
    PASSWORD_RESET: 'Reset de Senha',
    PASSWORD_CHANGE: 'Senha Alterada',
    ROLE_UPDATE: 'Permissão Alterada',
    CONFIG_UPDATE: 'Config. Atualizada',
    VISITOR_CREATE: 'Visitante Criado',
    VISITOR_UPDATE: 'Visitante Atualizado',
    VISITOR_DELETE: 'Visitante Excluído',
    EMPLOYEE_CREATE: 'Colaborador Criado',
    EMPLOYEE_UPDATE: 'Colaborador Atualizado',
    EMPLOYEE_DELETE: 'Colaborador Excluído',
    DEPARTMENT_CREATE: 'Setor Criado',
    DEPARTMENT_DELETE: 'Setor Excluído',
    BACKUP_EXPORT: 'Backup Exportado',
    ACCESS_SCAN: 'Acesso Escaneado',
  };
  return labels[actionType] || actionType;
};

const getActionVariant = (actionType: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (actionType.includes('FAILED') || actionType.includes('DELETE')) return 'destructive';
  if (actionType.includes('CREATE')) return 'default';
  if (actionType.includes('DEACTIVATE')) return 'secondary';
  return 'outline';
};

const CriticalEventsList = () => {
  const { data: criticalLogs = [], isLoading } = useCriticalEvents(10);

  return (
    <Card className="h-full max-h-[500px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="w-5 h-5 text-warning" />
          Últimos 10 Eventos Críticos
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : criticalLogs.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhum evento crítico registrado</p>
        ) : (
          <div className="space-y-2">
            {criticalLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center">
                    {getActionIcon(log.action_type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getActionVariant(log.action_type)} className="text-xs">
                        {getActionLabel(log.action_type)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {log.user_email || 'Sistema'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    {format(new Date(log.created_at), 'HH:mm')}
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

export default CriticalEventsList;

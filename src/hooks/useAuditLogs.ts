import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export type AuditActionType = 
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_DELETE'
  | 'USER_DEACTIVATE'
  | 'USER_ACTIVATE'
  | 'PASSWORD_RESET'
  | 'PASSWORD_CHANGE'
  | 'ROLE_UPDATE'
  | 'CONFIG_UPDATE'
  | 'VISITOR_CREATE'
  | 'VISITOR_UPDATE'
  | 'VISITOR_DELETE'
  | 'EMPLOYEE_CREATE'
  | 'EMPLOYEE_UPDATE'
  | 'EMPLOYEE_DELETE'
  | 'DEPARTMENT_CREATE'
  | 'DEPARTMENT_DELETE'
  | 'BACKUP_EXPORT'
  | 'ACCESS_SCAN';

export interface AuditLog {
  id: string;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  action_type: AuditActionType;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
}

export interface AuditLogFilters {
  startDate?: string;
  endDate?: string;
  userId?: string;
  actionType?: AuditActionType;
}

export const useAuditLogs = (filters?: AuditLogFilters, limit = 50, offset = 0) => {
  return useQuery({
    queryKey: ['audit-logs', filters, limit, offset],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }
      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters?.actionType) {
        query = query.eq('action_type', filters.actionType);
      }

      const { data, error, count } = await query;

      if (error) throw error;
      return { data: data as AuditLog[], count: count || 0 };
    },
  });
};

export const useCreateAuditLog = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      action_type,
      details = {},
    }: {
      action_type: AuditActionType;
      details?: Record<string, unknown>;
    }) => {
      const { error } = await supabase.from('audit_logs').insert({
        action_type,
        details,
        user_agent: navigator.userAgent,
      } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
};

export const logAuditAction = async (
  action_type: AuditActionType,
  details: Record<string, unknown> = {},
  userInfo?: { id?: string; email?: string }
) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;

  await supabase.from('audit_logs').insert({
    user_id: userInfo?.id || session?.user?.id || null,
    user_email: userInfo?.email || session?.user?.email || null,
    action_type,
    details,
    user_agent: navigator.userAgent,
  } as any);
};

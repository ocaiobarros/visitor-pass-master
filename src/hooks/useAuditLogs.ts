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
      // Usar endpoint server-side para auditoria (RLS compliant)
      await logAuditAction(action_type, details);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
};

/**
 * Registra uma ação de auditoria via endpoint server-side.
 * 
 * IMPORTANTE: Esta função NÃO faz INSERT direto no banco.
 * Ela usa o endpoint POST /admin/audit que opera com SERVICE_ROLE_KEY,
 * garantindo compliance com RLS e imutabilidade dos logs.
 * 
 * A função é resiliente a falhas - nunca interrompe o fluxo principal.
 */
export const logAuditAction = async (
  action_type: AuditActionType,
  details: Record<string, unknown> = {},
  userInfo?: { id?: string; email?: string }
) => {
  try {
    // Obter token de sessão para autenticação
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;

    // Construir payload
    const payload = {
      action_type,
      details: {
        ...details,
        user_info: userInfo || null,
      },
      resource: details.resource || null,
    };

    // Determinar URL base da API
    const apiUrl = getApiUrl();
    
    // Headers com autenticação se disponível
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Adicionar apikey para passar pelo Kong (se disponível)
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (anonKey) {
      headers['apikey'] = anonKey;
    }

    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    // Enviar para endpoint server-side
    const response = await fetch(`${apiUrl}/admin/v1/audit`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // Log silencioso - não quebrar fluxo do usuário
      console.warn('[audit] Falha ao registrar auditoria:', response.status);
    }
  } catch (err) {
    // Falhas de auditoria NUNCA devem interromper o fluxo principal
    console.warn('[audit] Erro ao registrar auditoria:', err);
  }
};

/**
 * Determina a URL base da API considerando ambiente local e produção.
 */
function getApiUrl(): string {
  // Verificar se há variável de ambiente configurada
  const envApiUrl = import.meta.env.VITE_API_URL;
  if (envApiUrl) {
    return envApiUrl;
  }

  // Em produção (Docker), usar Kong Gateway na porta 8000
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    
    try {
      const url = new URL(origin);
      
      // Self-hosted: SEMPRE usar porta 8000 para API (Kong Gateway)
      // O frontend roda na porta 80 (Nginx), API está no Kong (8000)
      url.port = '8000';
      
      return url.origin;
    } catch {
      // Fallback se URL parsing falhar
      const host = window.location.hostname;
      return `http://${host}:8000`;
    }
  }
  
  return 'http://localhost:8000';
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DashboardStats {
  total_visitors: number;
  visitors_inside: number;
  visitors_outside: number;
  visitors_pending: number;
  entries_today: number;
  exits_today: number;
  total_access_today: number;
  employees_active: number;
  total_users: number;
  entries_yesterday: number;
  avg_per_hour: number;
}

export const useDashboardStats = () => {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_stats');
      if (error) throw error;
      return data as DashboardStats;
    },
    refetchInterval: 30000, // Refresh every 30s
  });
};

export interface RecentVisitor {
  id: string;
  full_name: string;
  status: string;
  visit_to_type: string;
  visit_to_name: string;
  company_name: string | null;
  company_reason: string;
  created_at: string;
}

export const useRecentVisitors = (limit = 5) => {
  return useQuery({
    queryKey: ['recent-visitors', limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_recent_visitors', { p_limit: limit });
      if (error) throw error;
      return (data || []) as RecentVisitor[];
    },
    refetchInterval: 30000,
  });
};

export interface InsideVisitor {
  id: string;
  full_name: string;
  visit_to_type: string;
  visit_to_name: string;
  company_name: string | null;
  created_at: string;
}

export const useVisitorsInside = (limit = 10) => {
  return useQuery({
    queryKey: ['visitors-inside', limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_visitors_inside', { p_limit: limit });
      if (error) throw error;
      return (data || []) as InsideVisitor[];
    },
    refetchInterval: 30000,
  });
};

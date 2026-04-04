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
      return data as unknown as DashboardStats;
    },
    refetchInterval: 30000,
  });
};

export interface TodayStatsData {
  total_today: number;
  entries_today: number;
  exits_today: number;
  avg_per_hour: number;
  total_yesterday: number;
  trend: number;
  trend_percentage: number;
}

export const useTodayStats = () => {
  return useQuery({
    queryKey: ['today-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_today_stats');
      if (error) throw error;
      return data as unknown as TodayStatsData;
    },
    refetchInterval: 30000,
  });
};

export interface ActivityChartDay {
  day: string;
  day_label: string;
  date_label: string;
  entries: number;
  exits: number;
}

export const useActivityChartData = () => {
  return useQuery({
    queryKey: ['activity-chart-data'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_activity_chart_data');
      if (error) throw error;
      return (data || []) as ActivityChartDay[];
    },
    refetchInterval: 30000,
  });
};

export interface CriticalEvent {
  id: string;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  action_type: string;
  details: Record<string, unknown>;
}

export const useCriticalEvents = (limit = 10) => {
  return useQuery({
    queryKey: ['critical-events', limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_critical_events', { p_limit: limit });
      if (error) throw error;
      return (data || []) as CriticalEvent[];
    },
    refetchInterval: 30000,
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

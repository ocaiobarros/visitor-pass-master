CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_visitors', (SELECT COUNT(*) FROM visitors),
    'visitors_inside', (SELECT COUNT(*) FROM visitors WHERE status = 'inside'),
    'visitors_outside', (SELECT COUNT(*) FROM visitors WHERE status IN ('outside', 'closed')),
    'visitors_pending', (SELECT COUNT(*) FROM visitors WHERE status = 'pending'),
    'entries_today', (SELECT COUNT(*) FROM access_logs WHERE direction = 'in' AND created_at::date = CURRENT_DATE),
    'exits_today', (SELECT COUNT(*) FROM access_logs WHERE direction = 'out' AND created_at::date = CURRENT_DATE),
    'total_access_today', (SELECT COUNT(*) FROM access_logs WHERE created_at::date = CURRENT_DATE),
    'employees_active', (SELECT COUNT(*) FROM employee_credentials WHERE status = 'allowed' AND type = 'personal'),
    'vehicles_active', (SELECT COUNT(*) FROM employee_credentials WHERE status = 'allowed' AND type = 'vehicle'),
    'total_users', (SELECT COUNT(*) FROM profiles),
    'entries_yesterday', (SELECT COUNT(*) FROM access_logs WHERE direction = 'in' AND created_at::date = CURRENT_DATE - 1),
    'avg_per_hour', (SELECT COALESCE(ROUND(COUNT(*)::numeric / GREATEST(EXTRACT(HOUR FROM now())::numeric, 1), 1), 0) FROM access_logs WHERE created_at::date = CURRENT_DATE)
  ) INTO result;
  RETURN result;
END;
$function$;
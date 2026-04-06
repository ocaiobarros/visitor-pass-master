
-- 1. Add expired_unused to visitor_status enum
ALTER TYPE public.visitor_status ADD VALUE IF NOT EXISTS 'expired_unused';

-- 2. Function to expire unused visitor passes
CREATE OR REPLACE FUNCTION public.expire_unused_visitor_passes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE visitors
  SET status = 'expired_unused', updated_at = now()
  WHERE status = 'pending'
    AND valid_until < now()
    AND id NOT IN (
      SELECT DISTINCT subject_id FROM access_logs WHERE subject_type = 'visitor'
    );
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- 3. Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE access_sessions
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- 4. Update get_dashboard_stats to include expired_unused and associates
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_visitors', (SELECT COUNT(*) FROM visitors),
    'visitors_inside', (SELECT COUNT(*) FROM visitors WHERE status = 'inside'),
    'visitors_outside', (SELECT COUNT(*) FROM visitors WHERE status IN ('outside', 'closed')),
    'visitors_pending', (SELECT COUNT(*) FROM visitors WHERE status = 'pending'),
    'visitors_expired_unused', (SELECT COUNT(*) FROM visitors WHERE status = 'expired_unused'),
    'entries_today', (SELECT COUNT(*) FROM access_logs WHERE direction = 'in' AND created_at::date = CURRENT_DATE),
    'exits_today', (SELECT COUNT(*) FROM access_logs WHERE direction = 'out' AND created_at::date = CURRENT_DATE),
    'total_access_today', (SELECT COUNT(*) FROM access_logs WHERE created_at::date = CURRENT_DATE),
    'employees_active', (SELECT COUNT(*) FROM employee_credentials WHERE status = 'allowed' AND type = 'personal'),
    'vehicles_active', (SELECT COUNT(*) FROM employee_credentials WHERE status = 'allowed' AND type = 'vehicle'),
    'associates_active', (SELECT COUNT(*) FROM associates WHERE status = 'active'),
    'total_users', (SELECT COUNT(*) FROM profiles),
    'entries_yesterday', (SELECT COUNT(*) FROM access_logs WHERE direction = 'in' AND created_at::date = CURRENT_DATE - 1),
    'avg_per_hour', (SELECT COALESCE(ROUND(COUNT(*)::numeric / GREATEST(EXTRACT(HOUR FROM now())::numeric, 1), 1), 0) FROM access_logs WHERE created_at::date = CURRENT_DATE)
  ) INTO result;
  RETURN result;
END;
$$;

-- 5. Update audit_trigger_func to cover associates and access_sessions
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_action audit_action_type;
  v_details JSONB;
  v_user_id UUID;
BEGIN
  v_action := CASE
    WHEN TG_TABLE_NAME = 'visitors' AND TG_OP = 'INSERT' THEN 'VISITOR_CREATE'
    WHEN TG_TABLE_NAME = 'visitors' AND TG_OP = 'UPDATE' THEN 'VISITOR_UPDATE'
    WHEN TG_TABLE_NAME = 'visitors' AND TG_OP = 'DELETE' THEN 'VISITOR_DELETE'
    WHEN TG_TABLE_NAME = 'employee_credentials' AND TG_OP = 'INSERT' THEN 'EMPLOYEE_CREATE'
    WHEN TG_TABLE_NAME = 'employee_credentials' AND TG_OP = 'UPDATE' THEN 'EMPLOYEE_UPDATE'
    WHEN TG_TABLE_NAME = 'employee_credentials' AND TG_OP = 'DELETE' THEN 'EMPLOYEE_DELETE'
    WHEN TG_TABLE_NAME = 'departments' AND TG_OP = 'INSERT' THEN 'DEPARTMENT_CREATE'
    WHEN TG_TABLE_NAME = 'departments' AND TG_OP = 'DELETE' THEN 'DEPARTMENT_DELETE'
    WHEN TG_TABLE_NAME = 'access_logs' AND TG_OP = 'INSERT' THEN 'ACCESS_SCAN'
    WHEN TG_TABLE_NAME = 'associates' AND TG_OP = 'INSERT' THEN 'ASSOCIATE_CREATE'
    WHEN TG_TABLE_NAME = 'associates' AND TG_OP = 'UPDATE' THEN 'ASSOCIATE_UPDATE'
    WHEN TG_TABLE_NAME = 'associates' AND TG_OP = 'DELETE' THEN 'ASSOCIATE_DELETE'
    WHEN TG_TABLE_NAME = 'access_sessions' AND TG_OP = 'INSERT' THEN 'ACCESS_SESSION_CREATE'
    WHEN TG_TABLE_NAME = 'access_sessions' AND TG_OP = 'UPDATE' THEN
      CASE
        WHEN NEW.status = 'completed' THEN 'ACCESS_SESSION_COMPLETE'
        WHEN NEW.status = 'denied' THEN 'ACCESS_SESSION_DENY'
        WHEN NEW.status = 'expired' THEN 'ACCESS_SESSION_EXPIRE'
        ELSE 'CONFIG_UPDATE'
      END
    ELSE 'CONFIG_UPDATE'
  END;

  v_user_id := auth.uid();

  IF TG_OP = 'DELETE' THEN
    v_details := jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP, 'old_data', to_jsonb(OLD));
  ELSIF TG_OP = 'INSERT' THEN
    v_details := jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP, 'new_data', to_jsonb(NEW));
  ELSE
    v_details := jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP, 'old_data', to_jsonb(OLD), 'new_data', to_jsonb(NEW));
  END IF;

  INSERT INTO audit_logs (action_type, user_id, details)
  VALUES (v_action, v_user_id, v_details);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- 6. Create audit triggers for associates and access_sessions
DROP TRIGGER IF EXISTS audit_trigger_associates ON public.associates;
CREATE TRIGGER audit_trigger_associates
  AFTER INSERT OR UPDATE OR DELETE ON public.associates
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_trigger_access_sessions ON public.access_sessions;
CREATE TRIGGER audit_trigger_access_sessions
  AFTER INSERT OR UPDATE OR DELETE ON public.access_sessions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

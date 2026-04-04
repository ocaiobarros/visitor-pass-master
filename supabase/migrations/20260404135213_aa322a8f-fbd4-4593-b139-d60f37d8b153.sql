
-- ============================================================
-- 1. TRIGGERS: Wire all existing functions to their tables
-- ============================================================

-- Audit triggers
CREATE TRIGGER audit_visitors
  AFTER INSERT OR UPDATE OR DELETE ON public.visitors
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_employee_credentials
  AFTER INSERT OR UPDATE OR DELETE ON public.employee_credentials
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_departments
  AFTER INSERT OR UPDATE OR DELETE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_access_logs
  AFTER INSERT ON public.access_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- ID generation triggers
CREATE TRIGGER trg_generate_visitor_pass_id
  BEFORE INSERT ON public.visitors
  FOR EACH ROW EXECUTE FUNCTION public.generate_visitor_pass_id();

CREATE TRIGGER trg_generate_visitor_vehicle_pass_id
  BEFORE INSERT ON public.visitors
  FOR EACH ROW EXECUTE FUNCTION public.generate_visitor_vehicle_pass_id();

CREATE TRIGGER trg_generate_credential_id
  BEFORE INSERT ON public.employee_credentials
  FOR EACH ROW EXECUTE FUNCTION public.generate_credential_id();

-- Updated_at triggers
CREATE TRIGGER trg_update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_update_visitors_updated_at
  BEFORE UPDATE ON public.visitors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_update_credentials_updated_at
  BEFORE UPDATE ON public.employee_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 2. VALIDATION: Prevent orphan records in access_logs
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_access_log_subject()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.subject_type = 'visitor' THEN
    IF NOT EXISTS (SELECT 1 FROM visitors WHERE id = NEW.subject_id) THEN
      RAISE EXCEPTION 'Visitor with id % does not exist', NEW.subject_id;
    END IF;
  ELSIF NEW.subject_type = 'employee' THEN
    IF NOT EXISTS (SELECT 1 FROM employee_credentials WHERE id = NEW.subject_id) THEN
      RAISE EXCEPTION 'Employee credential with id % does not exist', NEW.subject_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid subject_type: %', NEW.subject_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_access_log_subject
  BEFORE INSERT ON public.access_logs
  FOR EACH ROW EXECUTE FUNCTION public.validate_access_log_subject();

-- ============================================================
-- 3. RPCs: Server-side dashboard aggregations
-- ============================================================

-- Today Stats (replaces frontend useMemo)
CREATE OR REPLACE FUNCTION public.get_today_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  v_today_start TIMESTAMPTZ;
  v_yesterday_start TIMESTAMPTZ;
  v_yesterday_end TIMESTAMPTZ;
  v_hours_elapsed NUMERIC;
BEGIN
  v_today_start := date_trunc('day', now());
  v_yesterday_start := v_today_start - interval '1 day';
  v_yesterday_end := v_today_start;
  v_hours_elapsed := GREATEST(EXTRACT(EPOCH FROM (now() - v_today_start)) / 3600.0, 1);

  SELECT json_build_object(
    'total_today', (SELECT COUNT(*) FROM access_logs WHERE created_at >= v_today_start),
    'entries_today', (SELECT COUNT(*) FROM access_logs WHERE created_at >= v_today_start AND direction = 'in'),
    'exits_today', (SELECT COUNT(*) FROM access_logs WHERE created_at >= v_today_start AND direction = 'out'),
    'avg_per_hour', ROUND((SELECT COUNT(*) FROM access_logs WHERE created_at >= v_today_start)::numeric / v_hours_elapsed, 1),
    'total_yesterday', (SELECT COUNT(*) FROM access_logs WHERE created_at >= v_yesterday_start AND created_at < v_yesterday_end),
    'trend', (SELECT COUNT(*) FROM access_logs WHERE created_at >= v_today_start) - 
             (SELECT COUNT(*) FROM access_logs WHERE created_at >= v_yesterday_start AND created_at < v_yesterday_end),
    'trend_percentage', CASE 
      WHEN (SELECT COUNT(*) FROM access_logs WHERE created_at >= v_yesterday_start AND created_at < v_yesterday_end) > 0 
      THEN ROUND(
        ((SELECT COUNT(*) FROM access_logs WHERE created_at >= v_today_start) - 
         (SELECT COUNT(*) FROM access_logs WHERE created_at >= v_yesterday_start AND created_at < v_yesterday_end))::numeric * 100.0 /
        (SELECT COUNT(*) FROM access_logs WHERE created_at >= v_yesterday_start AND created_at < v_yesterday_end), 0
      )
      ELSE 0
    END
  ) INTO result;
  RETURN result;
END;
$$;

-- Activity Chart Data (last 7 days, replaces frontend useMemo)
CREATE OR REPLACE FUNCTION public.get_activity_chart_data()
RETURNS TABLE(day DATE, day_label TEXT, date_label TEXT, entries BIGINT, exits BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d::date AS day,
    to_char(d, 'Dy') AS day_label,
    to_char(d, 'DD/MM') AS date_label,
    COUNT(*) FILTER (WHERE al.direction = 'in') AS entries,
    COUNT(*) FILTER (WHERE al.direction = 'out') AS exits
  FROM generate_series(
    (CURRENT_DATE - interval '6 days')::date,
    CURRENT_DATE::date,
    '1 day'::interval
  ) AS d
  LEFT JOIN access_logs al ON al.created_at::date = d::date
  GROUP BY d
  ORDER BY d;
$$;

-- Critical Events (replaces frontend filter on audit_logs)
CREATE OR REPLACE FUNCTION public.get_critical_events(p_limit INTEGER DEFAULT 10)
RETURNS TABLE(
  id UUID,
  created_at TIMESTAMPTZ,
  user_id UUID,
  user_email TEXT,
  action_type audit_action_type,
  details JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT al.id, al.created_at, al.user_id, al.user_email, al.action_type, al.details::jsonb
  FROM audit_logs al
  WHERE al.action_type IN (
    'LOGIN_FAILED', 'USER_CREATE', 'USER_DELETE', 'USER_DEACTIVATE',
    'ROLE_UPDATE', 'PASSWORD_RESET', 'CONFIG_UPDATE', 'BACKUP_EXPORT'
  )
  ORDER BY al.created_at DESC
  LIMIT p_limit;
$$;

-- Deterministic direction toggle for scanner
CREATE OR REPLACE FUNCTION public.get_last_access_direction(p_subject_type subject_type, p_subject_id UUID)
RETURNS access_direction
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT direction FROM access_logs
  WHERE subject_type = p_subject_type AND subject_id = p_subject_id
  ORDER BY created_at DESC
  LIMIT 1;
$$;

-- ============================================================
-- 4. INDICES for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_access_logs_created_date ON public.access_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_access_logs_subject_lookup ON public.access_logs (subject_type, subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON public.audit_logs (action_type, created_at DESC);

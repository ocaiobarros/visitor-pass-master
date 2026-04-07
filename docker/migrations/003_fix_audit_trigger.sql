-- Fix audit_trigger_func: use JSONB dynamic access instead of direct NEW.status
-- This prevents errors on tables without a 'status' column (e.g. access_logs, departments)

CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_action audit_action_type;
  v_details JSONB;
  v_user_id UUID;
  v_new_json JSONB;
BEGIN
  -- Convert NEW to JSONB once for dynamic field access (avoids compile-time errors
  -- when trigger is attached to tables without certain columns like 'status')
  IF TG_OP != 'DELETE' THEN
    v_new_json := to_jsonb(NEW);
  END IF;

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
        WHEN v_new_json->>'status' = 'completed' THEN 'ACCESS_SESSION_COMPLETE'
        WHEN v_new_json->>'status' = 'denied' THEN 'ACCESS_SESSION_DENY'
        WHEN v_new_json->>'status' = 'expired' THEN 'ACCESS_SESSION_EXPIRE'
        ELSE 'CONFIG_UPDATE'
      END
    ELSE 'CONFIG_UPDATE'
  END;

  -- Safe user ID extraction
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  IF TG_OP = 'DELETE' THEN
    v_details := jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP, 'old_data', to_jsonb(OLD));
  ELSIF TG_OP = 'INSERT' THEN
    v_details := jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP, 'new_data', v_new_json);
  ELSE
    v_details := jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP, 'old_data', to_jsonb(OLD), 'new_data', v_new_json);
  END IF;

  BEGIN
    INSERT INTO audit_logs (action_type, user_id, details) VALUES (v_action, v_user_id, v_details);
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'audit_trigger_func error: % %', SQLERRM, SQLSTATE;
  END;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

-- Ensure triggers are attached to all critical tables
DO $$
DECLARE
  tbl TEXT;
  v_trigger_name TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['visitors','employee_credentials','access_logs','associates','access_sessions','departments'] LOOP
    v_trigger_name := 'audit_' || tbl || '_trigger';
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.triggers t
      WHERE t.event_object_table = tbl AND t.trigger_name = v_trigger_name
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func()',
        v_trigger_name, tbl
      );
      RAISE NOTICE 'Trigger % criado para %', v_trigger_name, tbl;
    END IF;
  END LOOP;
END $$;

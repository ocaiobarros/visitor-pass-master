
-- ============================================================
-- 1. TABELA COMPANIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Companies visíveis para autenticados"
  ON public.companies FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/RH gerenciam companies"
  ON public.companies FOR ALL TO authenticated
  USING (is_admin_or_rh())
  WITH CHECK (is_admin_or_rh());

-- ============================================================
-- 2. MIGRAR DADOS: company texto → companies tabela
-- ============================================================
INSERT INTO public.companies (name)
SELECT DISTINCT company FROM public.visitors
WHERE company IS NOT NULL AND company != ''
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 3. ADICIONAR company_id AO visitors
-- ============================================================
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

-- Atualizar company_id com base no texto existente
UPDATE public.visitors v
SET company_id = c.id
FROM public.companies c
WHERE v.company = c.name AND v.company IS NOT NULL AND v.company != '';

-- Remover coluna company (texto livre)
ALTER TABLE public.visitors DROP COLUMN IF EXISTS company;

CREATE INDEX IF NOT EXISTS idx_visitors_company_id ON public.visitors(company_id);

-- ============================================================
-- 4. FUNÇÕES DE AGREGAÇÃO SERVER-SIDE
-- ============================================================

-- Dashboard stats: todas as métricas num único RPC
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    'employees_active', (SELECT COUNT(*) FROM employee_credentials WHERE status = 'allowed'),
    'total_users', (SELECT COUNT(*) FROM profiles),
    'entries_yesterday', (SELECT COUNT(*) FROM access_logs WHERE direction = 'in' AND created_at::date = CURRENT_DATE - 1),
    'avg_per_hour', (SELECT COALESCE(ROUND(COUNT(*)::numeric / GREATEST(EXTRACT(HOUR FROM now())::numeric, 1), 1), 0) FROM access_logs WHERE created_at::date = CURRENT_DATE)
  ) INTO result;
  RETURN result;
END;
$$;

-- Visitantes recentes com JOIN na empresa
CREATE OR REPLACE FUNCTION public.get_recent_visitors(p_limit INT DEFAULT 5)
RETURNS TABLE(
  id UUID,
  full_name TEXT,
  status visitor_status,
  visit_to_type visit_to_type,
  visit_to_name TEXT,
  company_name TEXT,
  company_reason TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id, v.full_name, v.status, v.visit_to_type, v.visit_to_name,
         c.name AS company_name, v.company_reason, v.created_at
  FROM visitors v
  LEFT JOIN companies c ON v.company_id = c.id
  ORDER BY v.created_at DESC
  LIMIT p_limit;
$$;

-- Visitantes dentro da empresa com JOIN
CREATE OR REPLACE FUNCTION public.get_visitors_inside(p_limit INT DEFAULT 10)
RETURNS TABLE(
  id UUID,
  full_name TEXT,
  visit_to_type visit_to_type,
  visit_to_name TEXT,
  company_name TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id, v.full_name, v.visit_to_type, v.visit_to_name,
         c.name AS company_name, v.created_at
  FROM visitors v
  LEFT JOIN companies c ON v.company_id = c.id
  WHERE v.status = 'inside'
  ORDER BY v.created_at DESC
  LIMIT p_limit;
$$;

-- Relatório de acessos agregado por dia
CREATE OR REPLACE FUNCTION public.report_access_summary(
  p_start DATE,
  p_end DATE
)
RETURNS TABLE(
  day DATE,
  total_entries BIGINT,
  total_exits BIGINT,
  unique_visitors BIGINT,
  unique_employees BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    created_at::date AS day,
    COUNT(*) FILTER (WHERE direction = 'in') AS total_entries,
    COUNT(*) FILTER (WHERE direction = 'out') AS total_exits,
    COUNT(DISTINCT subject_id) FILTER (WHERE subject_type = 'visitor') AS unique_visitors,
    COUNT(DISTINCT subject_id) FILTER (WHERE subject_type = 'employee') AS unique_employees
  FROM access_logs
  WHERE created_at::date BETWEEN p_start AND p_end
  GROUP BY created_at::date
  ORDER BY day DESC;
$$;

-- Relatório de visitantes por empresa
CREATE OR REPLACE FUNCTION public.report_visitors_by_company(
  p_start DATE,
  p_end DATE
)
RETURNS TABLE(
  company_name TEXT,
  total_visitors BIGINT,
  visitors_inside BIGINT,
  visitors_closed BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(c.name, 'Sem empresa') AS company_name,
    COUNT(*) AS total_visitors,
    COUNT(*) FILTER (WHERE v.status = 'inside') AS visitors_inside,
    COUNT(*) FILTER (WHERE v.status = 'closed') AS visitors_closed
  FROM visitors v
  LEFT JOIN companies c ON v.company_id = c.id
  WHERE v.created_at::date BETWEEN p_start AND p_end
  GROUP BY c.name
  ORDER BY total_visitors DESC;
$$;

-- ============================================================
-- 5. TRIGGERS DE AUDITORIA AUTOMÁTICA (SERVER-SIDE)
-- ============================================================

-- Função genérica de auditoria
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action audit_action_type;
  v_details JSONB;
  v_user_id UUID;
BEGIN
  -- Determinar action_type baseado na tabela e operação
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
    ELSE 'CONFIG_UPDATE'
  END;

  -- Extrair user_id do contexto auth
  v_user_id := auth.uid();

  -- Construir details
  IF TG_OP = 'DELETE' THEN
    v_details := jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP, 'old_data', to_jsonb(OLD));
  ELSIF TG_OP = 'INSERT' THEN
    v_details := jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP, 'new_data', to_jsonb(NEW));
  ELSE
    v_details := jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP, 'old_data', to_jsonb(OLD), 'new_data', to_jsonb(NEW));
  END IF;

  -- Inserir log de auditoria
  INSERT INTO audit_logs (action_type, user_id, details)
  VALUES (v_action, v_user_id, v_details);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Triggers em visitors
DROP TRIGGER IF EXISTS audit_visitors_trigger ON public.visitors;
CREATE TRIGGER audit_visitors_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.visitors
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- Triggers em employee_credentials
DROP TRIGGER IF EXISTS audit_credentials_trigger ON public.employee_credentials;
CREATE TRIGGER audit_credentials_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.employee_credentials
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- Triggers em departments
DROP TRIGGER IF EXISTS audit_departments_trigger ON public.departments;
CREATE TRIGGER audit_departments_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- Triggers em access_logs
DROP TRIGGER IF EXISTS audit_access_logs_trigger ON public.access_logs;
CREATE TRIGGER audit_access_logs_trigger
  AFTER INSERT ON public.access_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

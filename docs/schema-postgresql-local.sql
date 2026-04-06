-- ============================================================
-- GUARDA OPERACIONAL - Schema SQL para PostgreSQL 15/16 Local
-- Gerado em: 2026-02-10
-- Compatível com: PostgreSQL 15/16 padrão (sem extensões Supabase)
-- NOTA: Não depende de auth.* - usa funções locais para JWT claims
-- ============================================================

-- ============================================================
-- PARTE 0: SCHEMAS, EXTENSÕES E ROLES
-- ============================================================

-- Garantir que os schemas existam ANTES de qualquer tabela
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS auth;

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA public;

-- Criar roles necessárias para PostgREST/GoTrue
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN;
  END IF;
END
$$;

-- Conceder permissões ao authenticator
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;

-- Permissões no schema auth (GoTrue precisa de acesso total)
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA auth TO postgres;
GRANT ALL ON SCHEMA auth TO service_role;

-- Permissões no schema public
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- Permissões default para futuras tabelas no schema auth
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON ROUTINES TO postgres;

-- ============================================================
-- PARTE 1: TIPOS ENUM
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'access_direction') THEN
    CREATE TYPE public.access_direction AS ENUM ('in', 'out');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'rh', 'security');
    -- operador_acesso adicionado após criação inicial
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credential_status') THEN
    CREATE TYPE public.credential_status AS ENUM ('allowed', 'blocked');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credential_type') THEN
    CREATE TYPE public.credential_type AS ENUM ('personal', 'vehicle');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subject_type') THEN
    CREATE TYPE public.subject_type AS ENUM ('visitor', 'employee');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visit_to_type') THEN
    CREATE TYPE public.visit_to_type AS ENUM ('setor', 'pessoa');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visitor_status') THEN
    CREATE TYPE public.visitor_status AS ENUM ('pending', 'inside', 'outside', 'closed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visitor_access_type') THEN
    CREATE TYPE public.visitor_access_type AS ENUM ('pedestrian', 'driver');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_action_type') THEN
    CREATE TYPE public.audit_action_type AS ENUM (
      'LOGIN',
      'LOGOUT',
      'LOGIN_FAILED',
      'USER_CREATE',
      'USER_UPDATE',
      'USER_DELETE',
      'USER_DEACTIVATE',
      'USER_ACTIVATE',
      'PASSWORD_RESET',
      'PASSWORD_CHANGE',
      'ROLE_UPDATE',
      'CONFIG_UPDATE',
      'VISITOR_CREATE',
      'VISITOR_UPDATE',
      'VISITOR_DELETE',
      'EMPLOYEE_CREATE',
      'EMPLOYEE_UPDATE',
      'EMPLOYEE_DELETE',
      'DEPARTMENT_CREATE',
      'DEPARTMENT_DELETE',
      'BACKUP_EXPORT',
      'ACCESS_SCAN',
      'ASSOCIATE_CREATE',
      'ASSOCIATE_UPDATE',
      'ASSOCIATE_DELETE',
      'ACCESS_SESSION_CREATE',
      'ACCESS_SESSION_COMPLETE',
      'ACCESS_SESSION_DENY',
      'ACCESS_SESSION_EXPIRE'
    );
  END IF;
END $$;

-- ============================================================
-- PARTE 2: TABELAS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role public.app_role NOT NULL DEFAULT 'security',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.visitors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pass_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  document TEXT NOT NULL,
  company_id UUID REFERENCES public.companies(id),
  phone TEXT,
  photo_url TEXT,
  visit_to_type public.visit_to_type NOT NULL DEFAULT 'setor',
  visit_to_name TEXT NOT NULL,
  gate_obs TEXT,
  company_reason TEXT NOT NULL DEFAULT '',
  access_type public.visitor_access_type NOT NULL DEFAULT 'pedestrian',
  vehicle_pass_id TEXT,
  vehicle_plate TEXT,
  vehicle_brand TEXT,
  vehicle_model TEXT,
  vehicle_color TEXT,
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  status public.visitor_status NOT NULL DEFAULT 'pending',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credential_id TEXT NOT NULL UNIQUE,
  type public.credential_type NOT NULL,
  full_name TEXT NOT NULL,
  document TEXT NOT NULL,
  department_id UUID REFERENCES public.departments(id),
  job_title TEXT,
  photo_url TEXT,
  vehicle_make_model TEXT,
  vehicle_plate TEXT,
  status public.credential_status NOT NULL DEFAULT 'allowed',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.access_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_type public.subject_type NOT NULL,
  subject_id UUID NOT NULL,
  direction public.access_direction NOT NULL,
  gate_id TEXT NOT NULL DEFAULT 'GUARITA_01',
  operator_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID,
  user_email TEXT,
  action_type public.audit_action_type NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT
);

-- Tabela: associates (Agregados)
CREATE TABLE IF NOT EXISTS public.associates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  document TEXT NOT NULL UNIQUE,
  phone TEXT,
  photo_url TEXT,
  employee_credential_id UUID NOT NULL REFERENCES public.employee_credentials(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('spouse', 'father', 'mother', 'private_driver', 'other')),
  validity_type TEXT NOT NULL DEFAULT 'permanent' CHECK (validity_type IN ('permanent', 'temporary')),
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired')),
  pass_id TEXT NOT NULL UNIQUE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela: vehicle_authorized_drivers
CREATE TABLE IF NOT EXISTS public.vehicle_authorized_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_credential_id UUID NOT NULL REFERENCES public.employee_credentials(id) ON DELETE CASCADE,
  driver_type TEXT NOT NULL CHECK (driver_type IN ('employee', 'associate')),
  employee_credential_id UUID REFERENCES public.employee_credentials(id) ON DELETE CASCADE,
  associate_id UUID REFERENCES public.associates(id) ON DELETE CASCADE,
  authorization_type TEXT NOT NULL CHECK (authorization_type IN ('owner', 'delegated', 'corporate_pool')),
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_driver_source CHECK (
    (driver_type = 'employee' AND employee_credential_id IS NOT NULL AND associate_id IS NULL)
    OR
    (driver_type = 'associate' AND associate_id IS NOT NULL AND employee_credential_id IS NULL)
  )
);

-- Tabela: access_sessions
CREATE TABLE IF NOT EXISTS public.access_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_type TEXT NOT NULL CHECK (session_type IN ('visitor_driver', 'employee_vehicle')),
  visitor_id UUID REFERENCES public.visitors(id),
  vehicle_credential_id UUID REFERENCES public.employee_credentials(id),
  person_credential_id UUID REFERENCES public.employee_credentials(id),
  associate_id UUID REFERENCES public.associates(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'denied', 'expired')),
  first_scan TEXT NOT NULL CHECK (first_scan IN ('person', 'vehicle')),
  denial_reason TEXT,
  authorization_type TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  operator_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_visitors_pass_id ON public.visitors(pass_id);
CREATE INDEX IF NOT EXISTS idx_visitors_status ON public.visitors(status);
CREATE INDEX IF NOT EXISTS idx_visitors_valid_until ON public.visitors(valid_until);
CREATE INDEX IF NOT EXISTS idx_employee_credentials_credential_id ON public.employee_credentials(credential_id);
CREATE INDEX IF NOT EXISTS idx_employee_credentials_status ON public.employee_credentials(status);
CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON public.access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_subject ON public.access_logs(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON public.audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_associates_employee ON public.associates(employee_credential_id);
CREATE INDEX IF NOT EXISTS idx_associates_document ON public.associates(document);
CREATE INDEX IF NOT EXISTS idx_associates_status ON public.associates(status);
CREATE INDEX IF NOT EXISTS idx_vad_vehicle ON public.vehicle_authorized_drivers(vehicle_credential_id);
CREATE INDEX IF NOT EXISTS idx_vad_employee ON public.vehicle_authorized_drivers(employee_credential_id);
CREATE INDEX IF NOT EXISTS idx_vad_associate ON public.vehicle_authorized_drivers(associate_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.access_sessions(status);

-- Índice único parcial: impedir sessões pendentes conflitantes
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_vehicle_session ON public.access_sessions(vehicle_credential_id) WHERE status = 'pending' AND vehicle_credential_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_visitor_session ON public.access_sessions(visitor_id) WHERE status = 'pending' AND visitor_id IS NOT NULL;

-- ============================================================
-- PARTE 3: FUNÇÕES UTILITÁRIAS
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_visitor_pass_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.pass_id := 'VP-' || upper(substring(md5(random()::text) from 1 for 8));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_credential_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.credential_id := 'EC-' || upper(substring(md5(random()::text) from 1 for 8));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_visitor_vehicle_pass_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.access_type = 'driver' THEN
    NEW.vehicle_pass_id := 'VV-' || upper(substring(md5(random()::text) from 1 for 8));
  ELSE
    NEW.vehicle_pass_id := NULL;
    NEW.vehicle_plate := NULL;
    NEW.vehicle_brand := NULL;
    NEW.vehicle_model := NULL;
    NEW.vehicle_color := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- PARTE 4: FUNÇÕES DE AUTORIZAÇÃO (independentes de auth.*)
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid,
    NULLIF((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'), '')::uuid
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    NULLIF((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'), '')
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(check_role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = public.current_user_id()
      AND role = check_role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_rh()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = public.current_user_id()
      AND role IN ('admin', 'rh', 'operador_acesso')
  );
END;
$$;

-- Gerador de pass_id para agregados
CREATE OR REPLACE FUNCTION public.generate_associate_pass_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.pass_id IS NULL OR NEW.pass_id = '' THEN
    NEW.pass_id := 'AG-' || upper(substring(md5(random()::text) from 1 for 8));
  END IF;
  RETURN NEW;
END;
$$;

-- Cascata: colaborador bloqueado → agregados suspensos
CREATE OR REPLACE FUNCTION public.cascade_employee_deactivation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'blocked' AND (OLD.status IS NULL OR OLD.status != 'blocked') THEN
    UPDATE public.associates
    SET status = 'suspended', updated_at = now()
    WHERE employee_credential_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- PARTE 5: TRIGGERS
-- ============================================================

-- Drop triggers first to avoid duplicates on re-run
DROP TRIGGER IF EXISTS update_visitors_updated_at ON public.visitors;
DROP TRIGGER IF EXISTS update_employee_credentials_updated_at ON public.employee_credentials;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS generate_visitor_pass_id_trigger ON public.visitors;
DROP TRIGGER IF EXISTS generate_visitor_vehicle_pass_id_trigger ON public.visitors;
DROP TRIGGER IF EXISTS generate_credential_id_trigger ON public.employee_credentials;
DROP TRIGGER IF EXISTS trg_generate_associate_pass_id ON public.associates;
DROP TRIGGER IF EXISTS trg_associates_updated_at ON public.associates;
DROP TRIGGER IF EXISTS trg_cascade_employee_deactivation ON public.employee_credentials;

CREATE TRIGGER update_visitors_updated_at
  BEFORE UPDATE ON public.visitors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_employee_credentials_updated_at
  BEFORE UPDATE ON public.employee_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER generate_visitor_pass_id_trigger
  BEFORE INSERT ON public.visitors
  FOR EACH ROW
  WHEN (NEW.pass_id IS NULL)
  EXECUTE FUNCTION public.generate_visitor_pass_id();

CREATE TRIGGER generate_visitor_vehicle_pass_id_trigger
  BEFORE INSERT ON public.visitors
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_visitor_vehicle_pass_id();

CREATE TRIGGER generate_credential_id_trigger
  BEFORE INSERT ON public.employee_credentials
  FOR EACH ROW
  WHEN (NEW.credential_id IS NULL)
  EXECUTE FUNCTION public.generate_credential_id();

-- Agregados: pass_id automático
CREATE TRIGGER trg_generate_associate_pass_id
  BEFORE INSERT ON public.associates
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_associate_pass_id();

-- Agregados: updated_at
CREATE TRIGGER trg_associates_updated_at
  BEFORE UPDATE ON public.associates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Cascata: colaborador bloqueado → agregados suspensos
CREATE TRIGGER trg_cascade_employee_deactivation
  AFTER UPDATE ON public.employee_credentials
  FOR EACH ROW
  WHEN (NEW.status = 'blocked')
  EXECUTE FUNCTION public.cascade_employee_deactivation();

-- ============================================================
-- PARTE 6: DADOS INICIAIS
-- ============================================================

INSERT INTO public.departments (name)
SELECT name FROM (VALUES
  ('TI'), ('RH'), ('Financeiro'), ('Comercial'), ('Operações'),
  ('Logística'), ('Administrativo'), ('Produção'), ('Manutenção'), ('Segurança')
) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM public.departments LIMIT 1);

-- ============================================================
-- PARTE 7: ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.associates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_authorized_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas para departments
DO $$ BEGIN
  DROP POLICY IF EXISTS "Departamentos visíveis para autenticados" ON public.departments;
  DROP POLICY IF EXISTS "Admin gerencia departamentos" ON public.departments;
  CREATE POLICY "Departamentos visíveis para autenticados" ON public.departments FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Admin gerencia departamentos" ON public.departments FOR ALL TO authenticated USING (has_role('admin'));
END $$;

-- Políticas para profiles
DO $$ BEGIN
  DROP POLICY IF EXISTS "Profiles visíveis para autenticados" ON public.profiles;
  DROP POLICY IF EXISTS "Usuários editam próprio perfil" ON public.profiles;
  DROP POLICY IF EXISTS "Service role insere profiles" ON public.profiles;
  CREATE POLICY "Profiles visíveis para autenticados" ON public.profiles FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Usuários editam próprio perfil" ON public.profiles FOR UPDATE TO authenticated USING (user_id = public.current_user_id());
  CREATE POLICY "Service role insere profiles" ON public.profiles FOR INSERT TO service_role WITH CHECK (true);
END $$;

-- Políticas para user_roles
DO $$ BEGIN
  DROP POLICY IF EXISTS "Roles visíveis para autenticados" ON public.user_roles;
  DROP POLICY IF EXISTS "Admin gerencia roles" ON public.user_roles;
  DROP POLICY IF EXISTS "Service role insere roles" ON public.user_roles;
  CREATE POLICY "Roles visíveis para autenticados" ON public.user_roles FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Admin gerencia roles" ON public.user_roles FOR ALL TO authenticated USING (has_role('admin'));
  CREATE POLICY "Service role insere roles" ON public.user_roles FOR INSERT TO service_role WITH CHECK (true);
END $$;

-- Políticas para visitors
DO $$ BEGIN
  DROP POLICY IF EXISTS "Visitantes visíveis para autenticados" ON public.visitors;
  DROP POLICY IF EXISTS "RH/Admin criam visitantes" ON public.visitors;
  DROP POLICY IF EXISTS "RH/Admin editam visitantes" ON public.visitors;
  DROP POLICY IF EXISTS "Security atualiza status visitante" ON public.visitors;
  CREATE POLICY "Visitantes visíveis para autenticados" ON public.visitors FOR SELECT TO authenticated USING (true);
  CREATE POLICY "RH/Admin criam visitantes" ON public.visitors FOR INSERT TO authenticated WITH CHECK (is_admin_or_rh());
  CREATE POLICY "RH/Admin editam visitantes" ON public.visitors FOR UPDATE TO authenticated USING (is_admin_or_rh());
  CREATE POLICY "Security atualiza status visitante" ON public.visitors FOR UPDATE TO authenticated USING (has_role('security'));
END $$;

-- Políticas para employee_credentials
DO $$ BEGIN
  DROP POLICY IF EXISTS "Credenciais visíveis para autenticados" ON public.employee_credentials;
  DROP POLICY IF EXISTS "RH/Admin criam credenciais" ON public.employee_credentials;
  DROP POLICY IF EXISTS "RH/Admin editam credenciais" ON public.employee_credentials;
  DROP POLICY IF EXISTS "RH/Admin deletam credenciais" ON public.employee_credentials;
  CREATE POLICY "Credenciais visíveis para autenticados" ON public.employee_credentials FOR SELECT TO authenticated USING (true);
  CREATE POLICY "RH/Admin criam credenciais" ON public.employee_credentials FOR INSERT TO authenticated WITH CHECK (is_admin_or_rh());
  CREATE POLICY "RH/Admin editam credenciais" ON public.employee_credentials FOR UPDATE TO authenticated USING (is_admin_or_rh());
  CREATE POLICY "RH/Admin deletam credenciais" ON public.employee_credentials FOR DELETE TO authenticated USING (is_admin_or_rh());
END $$;

-- Políticas para access_logs
DO $$ BEGIN
  DROP POLICY IF EXISTS "Logs visíveis para autenticados" ON public.access_logs;
  DROP POLICY IF EXISTS "Autenticados criam logs" ON public.access_logs;
  CREATE POLICY "Logs visíveis para autenticados" ON public.access_logs FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Autenticados criam logs" ON public.access_logs FOR INSERT TO authenticated WITH CHECK (public.current_user_id() IS NOT NULL);
END $$;

-- Políticas para audit_logs
DO $$ BEGIN
  DROP POLICY IF EXISTS "Audit logs visíveis para admin" ON public.audit_logs;
  DROP POLICY IF EXISTS "Autenticados inserem audit logs" ON public.audit_logs;
  DROP POLICY IF EXISTS "Service role insere audit logs" ON public.audit_logs;
  CREATE POLICY "Audit logs visíveis para admin" ON public.audit_logs FOR SELECT TO authenticated USING (has_role('admin'));
  CREATE POLICY "Autenticados inserem audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "Service role insere audit logs" ON public.audit_logs FOR INSERT TO service_role WITH CHECK (true);
END $$;

-- Políticas para associates
DO $$ BEGIN
  DROP POLICY IF EXISTS "Autenticados visualizam agregados" ON public.associates;
  DROP POLICY IF EXISTS "Admin/Operador gerenciam agregados" ON public.associates;
  CREATE POLICY "Autenticados visualizam agregados" ON public.associates FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Admin/Operador gerenciam agregados" ON public.associates FOR ALL TO authenticated USING (is_admin_or_rh()) WITH CHECK (is_admin_or_rh());
END $$;

-- Políticas para vehicle_authorized_drivers
DO $$ BEGIN
  DROP POLICY IF EXISTS "Autenticados visualizam condutores" ON public.vehicle_authorized_drivers;
  DROP POLICY IF EXISTS "Admin/Operador gerenciam condutores" ON public.vehicle_authorized_drivers;
  CREATE POLICY "Autenticados visualizam condutores" ON public.vehicle_authorized_drivers FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Admin/Operador gerenciam condutores" ON public.vehicle_authorized_drivers FOR ALL TO authenticated USING (is_admin_or_rh()) WITH CHECK (is_admin_or_rh());
END $$;

-- Políticas para access_sessions
DO $$ BEGIN
  DROP POLICY IF EXISTS "Autenticados visualizam sessões" ON public.access_sessions;
  DROP POLICY IF EXISTS "Autenticados criam sessões" ON public.access_sessions;
  DROP POLICY IF EXISTS "Autenticados atualizam sessões" ON public.access_sessions;
  CREATE POLICY "Autenticados visualizam sessões" ON public.access_sessions FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Autenticados criam sessões" ON public.access_sessions FOR INSERT TO authenticated WITH CHECK (public.current_user_id() IS NOT NULL);
  CREATE POLICY "Autenticados atualizam sessões" ON public.access_sessions FOR UPDATE TO authenticated USING (public.current_user_id() IS NOT NULL);
END $$;


-- Adicionar operador_acesso ao enum (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'operador_acesso'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'operador_acesso';
  END IF;
END $$;

-- Adicionar novos valores de auditoria (Fase 2)
DO $$
DECLARE v TEXT;
BEGIN
  FOREACH v IN ARRAY ARRAY['ASSOCIATE_CREATE','ASSOCIATE_UPDATE','ASSOCIATE_DELETE','ACCESS_SESSION_CREATE','ACCESS_SESSION_COMPLETE','ACCESS_SESSION_DENY','ACCESS_SESSION_EXPIRE']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'audit_action_type' AND e.enumlabel = v
    ) THEN
      EXECUTE format('ALTER TYPE public.audit_action_type ADD VALUE %L', v);
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE result JSON;
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
    'avg_per_hour', COALESCE(ROUND((SELECT COUNT(*) FROM access_logs WHERE created_at::date = CURRENT_DATE)::numeric / GREATEST(EXTRACT(HOUR FROM now())::numeric, 1), 1), 0)
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_today_stats()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE result JSON; v_today_start TIMESTAMPTZ; v_yesterday_start TIMESTAMPTZ; v_yesterday_end TIMESTAMPTZ; v_hours_elapsed NUMERIC;
BEGIN
  v_today_start := date_trunc('day', now()); v_yesterday_start := v_today_start - interval '1 day'; v_yesterday_end := v_today_start;
  v_hours_elapsed := GREATEST(EXTRACT(EPOCH FROM (now() - v_today_start)) / 3600.0, 1);
  SELECT json_build_object(
    'total_today', (SELECT COUNT(*) FROM access_logs WHERE created_at >= v_today_start),
    'entries_today', (SELECT COUNT(*) FROM access_logs WHERE created_at >= v_today_start AND direction = 'in'),
    'exits_today', (SELECT COUNT(*) FROM access_logs WHERE created_at >= v_today_start AND direction = 'out'),
    'avg_per_hour', ROUND((SELECT COUNT(*) FROM access_logs WHERE created_at >= v_today_start)::numeric / v_hours_elapsed, 1),
    'total_yesterday', (SELECT COUNT(*) FROM access_logs WHERE created_at >= v_yesterday_start AND created_at < v_yesterday_end),
    'trend', (SELECT COUNT(*) FROM access_logs WHERE created_at >= v_today_start) - (SELECT COUNT(*) FROM access_logs WHERE created_at >= v_yesterday_start AND created_at < v_yesterday_end),
    'trend_percentage', CASE WHEN (SELECT COUNT(*) FROM access_logs WHERE created_at >= v_yesterday_start AND created_at < v_yesterday_end) > 0
      THEN ROUND(((SELECT COUNT(*) FROM access_logs WHERE created_at >= v_today_start) - (SELECT COUNT(*) FROM access_logs WHERE created_at >= v_yesterday_start AND created_at < v_yesterday_end))::numeric * 100.0 / (SELECT COUNT(*) FROM access_logs WHERE created_at >= v_yesterday_start AND created_at < v_yesterday_end), 0)
      ELSE 0 END
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_activity_chart_data()
RETURNS TABLE(day date, day_label text, date_label text, entries bigint, exits bigint)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT d::date AS day, to_char(d, 'Dy') AS day_label, to_char(d, 'DD/MM') AS date_label,
    COUNT(*) FILTER (WHERE al.direction = 'in') AS entries, COUNT(*) FILTER (WHERE al.direction = 'out') AS exits
  FROM generate_series((CURRENT_DATE - interval '6 days')::date, CURRENT_DATE::date, '1 day'::interval) AS d
  LEFT JOIN access_logs al ON al.created_at::date = d::date GROUP BY d ORDER BY d;
$$;

CREATE OR REPLACE FUNCTION public.get_critical_events(p_limit integer DEFAULT 10)
RETURNS TABLE(id uuid, created_at timestamptz, user_id uuid, user_email text, action_type audit_action_type, details jsonb)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT al.id, al.created_at, al.user_id, al.user_email, al.action_type, al.details::jsonb
  FROM audit_logs al WHERE al.action_type IN ('LOGIN_FAILED','USER_CREATE','USER_DELETE','USER_DEACTIVATE','ROLE_UPDATE','PASSWORD_RESET','CONFIG_UPDATE','BACKUP_EXPORT')
  ORDER BY al.created_at DESC LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.get_recent_visitors(p_limit integer DEFAULT 5)
RETURNS TABLE(id uuid, full_name text, status visitor_status, visit_to_type visit_to_type, visit_to_name text, company_name text, company_reason text, created_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT v.id, v.full_name, v.status, v.visit_to_type, v.visit_to_name, c.name AS company_name, v.company_reason, v.created_at
  FROM visitors v LEFT JOIN companies c ON v.company_id = c.id ORDER BY v.created_at DESC LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.get_visitors_inside(p_limit integer DEFAULT 10)
RETURNS TABLE(id uuid, full_name text, visit_to_type visit_to_type, visit_to_name text, company_name text, created_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT v.id, v.full_name, v.visit_to_type, v.visit_to_name, c.name AS company_name, v.created_at
  FROM visitors v LEFT JOIN companies c ON v.company_id = c.id WHERE v.status = 'inside' ORDER BY v.created_at DESC LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.get_last_access_direction(p_subject_type subject_type, p_subject_id uuid)
RETURNS access_direction LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT direction FROM access_logs WHERE subject_type = p_subject_type AND subject_id = p_subject_id ORDER BY created_at DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.validate_access_log_subject() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.subject_type = 'visitor' THEN
    IF NOT EXISTS (SELECT 1 FROM visitors WHERE id = NEW.subject_id) THEN RAISE EXCEPTION 'Visitor % does not exist', NEW.subject_id; END IF;
  ELSIF NEW.subject_type = 'employee' THEN
    IF NOT EXISTS (SELECT 1 FROM employee_credentials WHERE id = NEW.subject_id) THEN RAISE EXCEPTION 'Employee % does not exist', NEW.subject_id; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_access_log_subject ON public.access_logs;
CREATE TRIGGER trg_validate_access_log_subject BEFORE INSERT ON public.access_logs FOR EACH ROW EXECUTE FUNCTION public.validate_access_log_subject();

CREATE OR REPLACE FUNCTION public.report_access_summary(p_start date, p_end date)
RETURNS TABLE(day date, total_entries bigint, total_exits bigint, unique_visitors bigint, unique_employees bigint)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT created_at::date AS day, COUNT(*) FILTER (WHERE direction = 'in'), COUNT(*) FILTER (WHERE direction = 'out'),
    COUNT(DISTINCT subject_id) FILTER (WHERE subject_type = 'visitor'), COUNT(DISTINCT subject_id) FILTER (WHERE subject_type = 'employee')
  FROM access_logs WHERE created_at::date BETWEEN p_start AND p_end GROUP BY created_at::date ORDER BY day DESC;
$$;

CREATE OR REPLACE FUNCTION public.report_visitors_by_company(p_start date, p_end date)
RETURNS TABLE(company_name text, total_visitors bigint, visitors_inside bigint, visitors_closed bigint)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(c.name, 'Sem empresa'), COUNT(*), COUNT(*) FILTER (WHERE v.status = 'inside'), COUNT(*) FILTER (WHERE v.status = 'closed')
  FROM visitors v LEFT JOIN companies c ON v.company_id = c.id WHERE v.created_at::date BETWEEN p_start AND p_end GROUP BY c.name ORDER BY 2 DESC;
$$;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================

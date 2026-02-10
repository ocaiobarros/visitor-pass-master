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
      'ACCESS_SCAN'
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
  company TEXT,
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

-- Índices (IF NOT EXISTS para idempotência)
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
      AND role IN ('admin', 'rh')
  );
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

-- ============================================================
-- PERMISSÕES FINAIS: Garantir acesso às tabelas criadas
-- ============================================================

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================

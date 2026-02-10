-- ============================================================
-- GUARDA OPERACIONAL - SCHEMA COMPLETO IDEMPOTENTE
-- ============================================================
-- Executar no Postgres do container Debian:
-- 
-- docker compose exec postgres psql -U postgres -d guarda_operacional -c "$(cat docs/schema-operacional.sql)"
--
-- OU copiar o conteúdo e colar no psql
-- ============================================================

BEGIN;

-- ============================================================
-- EXTENSÕES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. TIPOS ENUM (Idempotente)
-- ============================================================
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin', 'rh', 'security'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.access_direction AS ENUM ('in', 'out'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.subject_type AS ENUM ('visitor', 'employee'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.credential_status AS ENUM ('allowed', 'blocked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.credential_type AS ENUM ('personal', 'vehicle'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.visitor_status AS ENUM ('pending', 'inside', 'outside', 'closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.visit_to_type AS ENUM ('setor', 'pessoa'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.visitor_access_type AS ENUM ('pedestrian', 'driver'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.audit_action_type AS ENUM (
    'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
    'USER_CREATE', 'USER_UPDATE', 'USER_DELETE',
    'USER_DEACTIVATE', 'USER_ACTIVATE',
    'PASSWORD_RESET', 'PASSWORD_CHANGE',
    'ROLE_UPDATE', 'CONFIG_UPDATE',
    'VISITOR_CREATE', 'VISITOR_UPDATE', 'VISITOR_DELETE',
    'EMPLOYEE_CREATE', 'EMPLOYEE_UPDATE', 'EMPLOYEE_DELETE',
    'DEPARTMENT_CREATE', 'DEPARTMENT_DELETE',
    'BACKUP_EXPORT', 'ACCESS_SCAN'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 2. TABELA: profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    photo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    must_change_password BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

-- ============================================================
-- 3. TABELA: user_roles (RBAC)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL,
    role public.app_role NOT NULL DEFAULT 'security',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- ============================================================
-- 4. TABELA: departments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. TABELA: employee_credentials
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    credential_id TEXT NOT NULL UNIQUE,
    type public.credential_type NOT NULL,
    full_name TEXT NOT NULL,
    document TEXT NOT NULL,
    photo_url TEXT,
    department_id UUID REFERENCES public.departments(id),
    job_title TEXT,
    vehicle_plate TEXT,
    vehicle_make_model TEXT,
    status public.credential_status NOT NULL DEFAULT 'allowed',
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credentials_status ON public.employee_credentials(status);
CREATE INDEX IF NOT EXISTS idx_credentials_type ON public.employee_credentials(type);
CREATE INDEX IF NOT EXISTS idx_credentials_document ON public.employee_credentials(document);
CREATE INDEX IF NOT EXISTS idx_credentials_credential_id ON public.employee_credentials(credential_id);

-- ============================================================
-- 6. TABELA: visitors
-- ============================================================
CREATE TABLE IF NOT EXISTS public.visitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    status public.visitor_status NOT NULL DEFAULT 'pending',
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visitors_status ON public.visitors(status);
CREATE INDEX IF NOT EXISTS idx_visitors_pass_id ON public.visitors(pass_id);

-- ============================================================
-- 7. TABELA: access_logs (CORAÇÃO DO TOGGLE)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.access_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_type public.subject_type NOT NULL,
    subject_id UUID NOT NULL,
    direction public.access_direction NOT NULL,
    gate_id TEXT NOT NULL DEFAULT 'GUARITA_01',
    operator_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ÍNDICE CRÍTICO: Busca do último registro por subject
CREATE INDEX IF NOT EXISTS idx_access_logs_subject_created 
    ON public.access_logs(subject_type, subject_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_access_logs_created_at 
    ON public.access_logs(created_at DESC);

-- ============================================================
-- 8. TABELA: audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_type public.audit_action_type NOT NULL,
    user_id UUID,
    user_email TEXT,
    ip_address TEXT,
    user_agent TEXT,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- ============================================================
-- 9. FUNÇÕES AUXILIARES (RBAC)
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_role(check_role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = check_role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_rh()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'rh')
  );
END;
$$;

-- ============================================================
-- 10. TRIGGER: Atualizar updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_credentials_updated_at ON public.employee_credentials;
CREATE TRIGGER update_credentials_updated_at
    BEFORE UPDATE ON public.employee_credentials
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_visitors_updated_at ON public.visitors;
CREATE TRIGGER update_visitors_updated_at
    BEFORE UPDATE ON public.visitors
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 11. TRIGGER: Auditoria de Alteração de is_active
-- ============================================================
CREATE OR REPLACE FUNCTION public.audit_profile_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
    INSERT INTO public.audit_logs (action_type, user_id, details)
    VALUES (
      CASE WHEN NEW.is_active THEN 'USER_ACTIVATE' ELSE 'USER_DEACTIVATE' END,
      NEW.user_id,
      jsonb_build_object(
        'profile_id', NEW.id,
        'previous_status', OLD.is_active,
        'new_status', NEW.is_active
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_profile_status ON public.profiles;
CREATE TRIGGER audit_profile_status
    AFTER UPDATE OF is_active ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.audit_profile_status_change();

-- ============================================================
-- 11b. TRIGGERS: Geração automática de IDs (pass_id e vehicle_pass_id)
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_visitor_pass_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.pass_id := 'VP-' || upper(substring(md5(random()::text) from 1 for 8));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_visitor_pass_id ON public.visitors;
CREATE TRIGGER set_visitor_pass_id
    BEFORE INSERT ON public.visitors
    FOR EACH ROW EXECUTE FUNCTION public.generate_visitor_pass_id();

CREATE OR REPLACE FUNCTION public.generate_visitor_vehicle_pass_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
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

DROP TRIGGER IF EXISTS set_visitor_vehicle_pass_id ON public.visitors;
CREATE TRIGGER set_visitor_vehicle_pass_id
    BEFORE INSERT ON public.visitors
    FOR EACH ROW EXECUTE FUNCTION public.generate_visitor_vehicle_pass_id();

CREATE OR REPLACE FUNCTION public.generate_credential_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.credential_id := 'EC-' || upper(substring(md5(random()::text) from 1 for 8));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_credential_id ON public.employee_credentials;
CREATE TRIGGER set_credential_id
    BEFORE INSERT ON public.employee_credentials
    FOR EACH ROW EXECUTE FUNCTION public.generate_credential_id();

-- ============================================================
-- 12. DESABILITAR RLS (Ambiente Local Dev)
-- Evita erros 401/403/42501 no fluxo do admin
-- ============================================================
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_credentials DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitors DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 13. CONFIGURAR ADMIN PADRÃO (Idempotente)
-- ============================================================
UPDATE public.profiles 
SET is_active = true, must_change_password = false
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'admin@sistema.local');

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'admin@sistema.local'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

COMMIT;

-- ============================================================
-- NOTA SOBRE AUDITORIA DE LOGIN
-- ============================================================
-- 
-- Login ocorre via GoTrue (auth.users). Auditoria via:
-- Frontend chama POST /admin/v1/audit após sessão válida.
-- O endpoint Node.js (admin-api) insere o log com IP/User-Agent.
-- 
-- Motivo:
-- 1. GoTrue não expõe hooks customizáveis
-- 2. service_role não vai para o browser (segurança)
-- 3. Captura IP/User-Agent real do request
-- 
-- AuthContext.tsx já chama logAuditAction('LOGIN')
-- ============================================================

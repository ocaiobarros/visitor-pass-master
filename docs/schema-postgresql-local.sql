-- ============================================================
-- GUARDA OPERACIONAL - Schema SQL para PostgreSQL 15/16 Local
-- Gerado em: 2026-02-05
-- Compatível com: PostgreSQL 15/16 padrão (sem extensões Supabase)
-- NOTA: Não depende de auth.* - usa funções locais para JWT claims
-- ============================================================

-- ============================================================
-- PARTE 1: TIPOS ENUM
-- ============================================================

CREATE TYPE public.access_direction AS ENUM ('in', 'out');
CREATE TYPE public.app_role AS ENUM ('admin', 'rh', 'security');
CREATE TYPE public.credential_status AS ENUM ('allowed', 'blocked');
CREATE TYPE public.credential_type AS ENUM ('personal', 'vehicle');
CREATE TYPE public.subject_type AS ENUM ('visitor', 'employee');
CREATE TYPE public.visit_to_type AS ENUM ('setor', 'pessoa');
CREATE TYPE public.visitor_status AS ENUM ('pending', 'inside', 'outside', 'closed');
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

-- ============================================================
-- PARTE 2: TABELAS
-- ============================================================

-- Tabela de departamentos
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de perfis de usuário
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de roles de usuário
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role public.app_role NOT NULL DEFAULT 'security',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Tabela de visitantes
CREATE TABLE public.visitors (
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
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  status public.visitor_status NOT NULL DEFAULT 'pending',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de credenciais de colaboradores
CREATE TABLE public.employee_credentials (
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

-- Tabela de logs de acesso
CREATE TABLE public.access_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_type public.subject_type NOT NULL,
  subject_id UUID NOT NULL,
  direction public.access_direction NOT NULL,
  gate_id TEXT NOT NULL DEFAULT 'GUARITA_01',
  operator_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de logs de auditoria
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID,
  user_email TEXT,
  action_type public.audit_action_type NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT
);

-- Índices
CREATE INDEX idx_visitors_pass_id ON public.visitors(pass_id);
CREATE INDEX idx_visitors_status ON public.visitors(status);
CREATE INDEX idx_visitors_valid_until ON public.visitors(valid_until);
CREATE INDEX idx_employee_credentials_credential_id ON public.employee_credentials(credential_id);
CREATE INDEX idx_employee_credentials_status ON public.employee_credentials(status);
CREATE INDEX idx_access_logs_created_at ON public.access_logs(created_at DESC);
CREATE INDEX idx_access_logs_subject ON public.access_logs(subject_type, subject_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action_type ON public.audit_logs(action_type);

-- ============================================================
-- PARTE 3: FUNÇÕES UTILITÁRIAS
-- ============================================================

-- Função para atualizar updated_at automaticamente
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

-- Função para gerar ID de passe de visitante
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

-- Função para gerar ID de credencial de colaborador
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

-- ============================================================
-- PARTE 4: FUNÇÕES DE AUTORIZAÇÃO (independentes de auth.*)
-- ============================================================
-- Essas funções leem JWT claims do PostgREST/GoTrue sem depender
-- do schema auth existir no momento do init do Postgres.
-- ============================================================

-- Obtém o user_id do JWT (equivalente a auth.uid())
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- Obtém a role do JWT (equivalente a auth.role())
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.role', true), '');
$$;

-- Função para verificar se usuário tem role
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

-- Função para verificar se é admin ou RH
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

-- Trigger para updated_at em visitors
CREATE TRIGGER update_visitors_updated_at
  BEFORE UPDATE ON public.visitors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Trigger para updated_at em employee_credentials
CREATE TRIGGER update_employee_credentials_updated_at
  BEFORE UPDATE ON public.employee_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Trigger para updated_at em profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Trigger para gerar pass_id automaticamente
CREATE TRIGGER generate_visitor_pass_id_trigger
  BEFORE INSERT ON public.visitors
  FOR EACH ROW
  WHEN (NEW.pass_id IS NULL)
  EXECUTE FUNCTION public.generate_visitor_pass_id();

-- Trigger para gerar credential_id automaticamente
CREATE TRIGGER generate_credential_id_trigger
  BEFORE INSERT ON public.employee_credentials
  FOR EACH ROW
  WHEN (NEW.credential_id IS NULL)
  EXECUTE FUNCTION public.generate_credential_id();

-- ============================================================
-- PARTE 6: DADOS INICIAIS
-- ============================================================

-- Departamentos padrão
INSERT INTO public.departments (name) VALUES
  ('TI'),
  ('RH'),
  ('Financeiro'),
  ('Comercial'),
  ('Operações'),
  ('Logística'),
  ('Administrativo'),
  ('Produção'),
  ('Manutenção'),
  ('Segurança');

-- ============================================================
-- PARTE 7: ROW LEVEL SECURITY (RLS)
-- ============================================================
-- Usa public.current_user_id() ao invés de auth.uid()
-- para não depender do schema auth existir no init.
-- ============================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para departments
CREATE POLICY "Departamentos visíveis para autenticados"
  ON public.departments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin gerencia departamentos"
  ON public.departments FOR ALL
  TO authenticated
  USING (has_role('admin'));

-- Políticas para profiles
CREATE POLICY "Profiles visíveis para autenticados"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários editam próprio perfil"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (user_id = public.current_user_id());

-- Service role pode inserir profiles (para admin-api)
CREATE POLICY "Service role insere profiles"
  ON public.profiles FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Políticas para user_roles
CREATE POLICY "Roles visíveis para autenticados"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin gerencia roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (has_role('admin'));

-- Service role pode inserir roles (para admin-api)
CREATE POLICY "Service role insere roles"
  ON public.user_roles FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Políticas para visitors
CREATE POLICY "Visitantes visíveis para autenticados"
  ON public.visitors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "RH/Admin criam visitantes"
  ON public.visitors FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_rh());

CREATE POLICY "RH/Admin editam visitantes"
  ON public.visitors FOR UPDATE
  TO authenticated
  USING (is_admin_or_rh());

CREATE POLICY "Security atualiza status visitante"
  ON public.visitors FOR UPDATE
  TO authenticated
  USING (has_role('security'));

-- Políticas para employee_credentials
CREATE POLICY "Credenciais visíveis para autenticados"
  ON public.employee_credentials FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "RH/Admin criam credenciais"
  ON public.employee_credentials FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_rh());

CREATE POLICY "RH/Admin editam credenciais"
  ON public.employee_credentials FOR UPDATE
  TO authenticated
  USING (is_admin_or_rh());

CREATE POLICY "RH/Admin deletam credenciais"
  ON public.employee_credentials FOR DELETE
  TO authenticated
  USING (is_admin_or_rh());

-- Políticas para access_logs
CREATE POLICY "Logs visíveis para autenticados"
  ON public.access_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Autenticados criam logs"
  ON public.access_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_id() IS NOT NULL);

-- Políticas para audit_logs
CREATE POLICY "Audit logs visíveis para admin"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (has_role('admin'));

CREATE POLICY "Autenticados inserem audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Service role pode inserir audit logs (para admin-api)
CREATE POLICY "Service role insere audit logs"
  ON public.audit_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================

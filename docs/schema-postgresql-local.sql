-- ============================================================
-- GUARDA OPERACIONAL - Schema SQL para PostgreSQL 15/16 Local
-- Gerado em: 2026-02-05
-- Compatível com: PostgreSQL 15/16 padrão (sem extensões Supabase)
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

-- Índices
CREATE INDEX idx_visitors_pass_id ON public.visitors(pass_id);
CREATE INDEX idx_visitors_status ON public.visitors(status);
CREATE INDEX idx_visitors_valid_until ON public.visitors(valid_until);
CREATE INDEX idx_employee_credentials_credential_id ON public.employee_credentials(credential_id);
CREATE INDEX idx_employee_credentials_status ON public.employee_credentials(status);
CREATE INDEX idx_access_logs_created_at ON public.access_logs(created_at DESC);
CREATE INDEX idx_access_logs_subject ON public.access_logs(subject_type, subject_id);

-- ============================================================
-- PARTE 3: FUNÇÕES (PLpgSQL padrão)
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
-- NOTA SOBRE FUNÇÕES DE AUTENTICAÇÃO
-- ============================================================
-- As funções abaixo usam auth.uid() que é específico do Supabase.
-- Para PostgreSQL local, você precisará implementar sua própria
-- lógica de autenticação. Sugestões:
-- 
-- 1. Usar variáveis de sessão: SET my_app.current_user_id = 'uuid';
-- 2. Criar uma função wrapper: 
--    CREATE FUNCTION auth.uid() RETURNS uuid AS $$
--      SELECT current_setting('my_app.current_user_id', true)::uuid;
--    $$ LANGUAGE sql STABLE;
-- ============================================================

-- Função para verificar se usuário tem role (ADAPTAR para local)
CREATE OR REPLACE FUNCTION public.has_role(check_role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Para PostgreSQL local, substitua auth.uid() pela sua lógica
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = current_setting('app.current_user_id', true)::uuid
      AND role = check_role
  );
END;
$$;

-- Função para verificar se é admin ou RH (ADAPTAR para local)
CREATE OR REPLACE FUNCTION public.is_admin_or_rh()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Para PostgreSQL local, substitua pela sua lógica de auth
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = current_setting('app.current_user_id', true)::uuid
      AND role IN ('admin', 'rh')
  );
END;
$$;

-- Função para lidar com novo usuário (ADAPTAR para seu sistema de auth)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Criar perfil
  INSERT INTO public.profiles (user_id, full_name, must_change_password)
  VALUES (
    NEW.id, 
    COALESCE(NEW.full_name, NEW.email),
    CASE WHEN NEW.email = 'admin@sistema.local' THEN true ELSE false END
  );
  
  -- Atribuir role baseado no email
  IF NEW.email = 'admin@sistema.local' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'security');
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================
-- PARTE 4: TRIGGERS
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
-- PARTE 5: DADOS INICIAIS
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
-- PARTE 6: ROW LEVEL SECURITY (RLS)
-- ============================================================
-- NOTA: RLS no PostgreSQL local funciona da mesma forma,
-- mas você precisará configurar roles de usuário do banco.
-- As políticas abaixo usam as funções has_role() e is_admin_or_rh()
-- que você precisará adaptar conforme sua autenticação.
-- ============================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para departments
CREATE POLICY "Departamentos visíveis para autenticados"
  ON public.departments FOR SELECT
  USING (true);

CREATE POLICY "Admin gerencia departamentos"
  ON public.departments FOR ALL
  USING (has_role('admin'));

-- Políticas para profiles
CREATE POLICY "Profiles visíveis para autenticados"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Usuários editam próprio perfil"
  ON public.profiles FOR UPDATE
  USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- Políticas para user_roles
CREATE POLICY "Roles visíveis para autenticados"
  ON public.user_roles FOR SELECT
  USING (true);

CREATE POLICY "Admin gerencia roles"
  ON public.user_roles FOR ALL
  USING (has_role('admin'));

-- Políticas para visitors
CREATE POLICY "Visitantes visíveis para autenticados"
  ON public.visitors FOR SELECT
  USING (true);

CREATE POLICY "RH/Admin criam visitantes"
  ON public.visitors FOR INSERT
  WITH CHECK (is_admin_or_rh());

CREATE POLICY "RH/Admin editam visitantes"
  ON public.visitors FOR UPDATE
  USING (is_admin_or_rh());

CREATE POLICY "Security atualiza status visitante"
  ON public.visitors FOR UPDATE
  USING (has_role('security'));

-- Políticas para employee_credentials
CREATE POLICY "Credenciais visíveis para autenticados"
  ON public.employee_credentials FOR SELECT
  USING (true);

CREATE POLICY "RH/Admin criam credenciais"
  ON public.employee_credentials FOR INSERT
  WITH CHECK (is_admin_or_rh());

CREATE POLICY "RH/Admin editam credenciais"
  ON public.employee_credentials FOR UPDATE
  USING (is_admin_or_rh());

CREATE POLICY "RH/Admin deletam credenciais"
  ON public.employee_credentials FOR DELETE
  USING (is_admin_or_rh());

-- Políticas para access_logs
CREATE POLICY "Logs visíveis para autenticados"
  ON public.access_logs FOR SELECT
  USING (true);

CREATE POLICY "Autenticados criam logs"
  ON public.access_logs FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================

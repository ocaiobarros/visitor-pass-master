-- Enums para o sistema
CREATE TYPE public.app_role AS ENUM ('admin', 'rh', 'security');
CREATE TYPE public.visitor_status AS ENUM ('pending', 'inside', 'outside', 'closed');
CREATE TYPE public.credential_type AS ENUM ('personal', 'vehicle');
CREATE TYPE public.credential_status AS ENUM ('allowed', 'blocked');
CREATE TYPE public.access_direction AS ENUM ('in', 'out');
CREATE TYPE public.subject_type AS ENUM ('visitor', 'employee');
CREATE TYPE public.visit_to_type AS ENUM ('setor', 'pessoa');

-- Tabela de perfis de usuários
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela de roles de usuários
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL DEFAULT 'security',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

-- Tabela de departamentos
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Inserir departamentos padrão
INSERT INTO public.departments (name) VALUES 
  ('Administrativo'),
  ('Comercial'),
  ('Financeiro'),
  ('Logística'),
  ('Operações'),
  ('Produção'),
  ('RH'),
  ('TI'),
  ('Manutenção'),
  ('Segurança');

-- Tabela de visitantes
CREATE TABLE public.visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  document TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  photo_url TEXT,
  visit_to_type public.visit_to_type NOT NULL DEFAULT 'setor',
  visit_to_name TEXT NOT NULL,
  gate_obs TEXT,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  status public.visitor_status NOT NULL DEFAULT 'pending',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela de credenciais de colaboradores
CREATE TABLE public.employee_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT vehicle_fields_check CHECK (
    (type = 'vehicle' AND vehicle_make_model IS NOT NULL AND vehicle_plate IS NOT NULL) OR
    (type = 'personal' AND vehicle_make_model IS NULL AND vehicle_plate IS NULL)
  )
);

-- Tabela de logs de acesso unificada
CREATE TABLE public.access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type public.subject_type NOT NULL,
  subject_id UUID NOT NULL,
  direction public.access_direction NOT NULL,
  gate_id TEXT NOT NULL DEFAULT 'GUARITA_01',
  operator_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

-- Função para verificar role do usuário
CREATE OR REPLACE FUNCTION public.has_role(check_role public.app_role)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = check_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para verificar se é admin ou RH
CREATE OR REPLACE FUNCTION public.is_admin_or_rh()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'rh')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para gerar pass_id de visitante
CREATE OR REPLACE FUNCTION public.generate_visitor_pass_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.pass_id := 'VP-' || upper(substring(md5(random()::text) from 1 for 8));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Função para gerar credential_id de colaborador
CREATE OR REPLACE FUNCTION public.generate_credential_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.credential_id := 'EC-' || upper(substring(md5(random()::text) from 1 for 8));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers para gerar IDs
CREATE TRIGGER generate_visitor_pass_id_trigger
  BEFORE INSERT ON public.visitors
  FOR EACH ROW
  WHEN (NEW.pass_id IS NULL)
  EXECUTE FUNCTION public.generate_visitor_pass_id();

CREATE TRIGGER generate_credential_id_trigger
  BEFORE INSERT ON public.employee_credentials
  FOR EACH ROW
  WHEN (NEW.credential_id IS NULL)
  EXECUTE FUNCTION public.generate_credential_id();

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_visitors_updated_at
  BEFORE UPDATE ON public.visitors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_employee_credentials_updated_at
  BEFORE UPDATE ON public.employee_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Função para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'security');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para criar perfil ao registrar
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies

-- Profiles: usuários podem ver todos, editar apenas o próprio
CREATE POLICY "Profiles visíveis para autenticados"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários editam próprio perfil"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- User Roles: somente admin pode gerenciar
CREATE POLICY "Roles visíveis para autenticados"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin gerencia roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role('admin'));

-- Departments: todos podem ver
CREATE POLICY "Departamentos visíveis para autenticados"
  ON public.departments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin gerencia departamentos"
  ON public.departments FOR ALL
  TO authenticated
  USING (public.has_role('admin'));

-- Visitors: todos podem ver, RH/Admin podem criar/editar, Security pode atualizar status
CREATE POLICY "Visitantes visíveis para autenticados"
  ON public.visitors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "RH/Admin criam visitantes"
  ON public.visitors FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_rh());

CREATE POLICY "RH/Admin editam visitantes"
  ON public.visitors FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_rh());

CREATE POLICY "Security atualiza status visitante"
  ON public.visitors FOR UPDATE
  TO authenticated
  USING (public.has_role('security'));

-- Employee Credentials: todos podem ver, RH/Admin podem gerenciar
CREATE POLICY "Credenciais visíveis para autenticados"
  ON public.employee_credentials FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "RH/Admin criam credenciais"
  ON public.employee_credentials FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_rh());

CREATE POLICY "RH/Admin editam credenciais"
  ON public.employee_credentials FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_rh());

CREATE POLICY "RH/Admin deletam credenciais"
  ON public.employee_credentials FOR DELETE
  TO authenticated
  USING (public.is_admin_or_rh());

-- Access Logs: todos podem ver, todos podem criar (para registrar entrada/saída)
CREATE POLICY "Logs visíveis para autenticados"
  ON public.access_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Autenticados criam logs"
  ON public.access_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Índices para performance
CREATE INDEX idx_visitors_pass_id ON public.visitors(pass_id);
CREATE INDEX idx_visitors_status ON public.visitors(status);
CREATE INDEX idx_employee_credentials_credential_id ON public.employee_credentials(credential_id);
CREATE INDEX idx_employee_credentials_type ON public.employee_credentials(type);
CREATE INDEX idx_access_logs_subject ON public.access_logs(subject_type, subject_id);
CREATE INDEX idx_access_logs_created_at ON public.access_logs(created_at DESC);
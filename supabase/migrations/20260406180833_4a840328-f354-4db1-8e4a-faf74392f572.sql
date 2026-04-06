
-- =====================================================
-- FASE 2: MODELAGEM GUARDA OPERACIONAL v2
-- =====================================================

-- 1) Novos valores de auditoria
ALTER TYPE public.audit_action_type ADD VALUE IF NOT EXISTS 'ASSOCIATE_CREATE';
ALTER TYPE public.audit_action_type ADD VALUE IF NOT EXISTS 'ASSOCIATE_UPDATE';
ALTER TYPE public.audit_action_type ADD VALUE IF NOT EXISTS 'ASSOCIATE_DELETE';
ALTER TYPE public.audit_action_type ADD VALUE IF NOT EXISTS 'ACCESS_SESSION_CREATE';
ALTER TYPE public.audit_action_type ADD VALUE IF NOT EXISTS 'ACCESS_SESSION_COMPLETE';
ALTER TYPE public.audit_action_type ADD VALUE IF NOT EXISTS 'ACCESS_SESSION_DENY';
ALTER TYPE public.audit_action_type ADD VALUE IF NOT EXISTS 'ACCESS_SESSION_EXPIRE';

-- 2) Tabela: associates (Agregados)
CREATE TABLE public.associates (
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

-- Trigger: gerar pass_id automático AG-XXXXXXXX
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

CREATE TRIGGER trg_generate_associate_pass_id
  BEFORE INSERT ON public.associates
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_associate_pass_id();

-- Trigger: updated_at
CREATE TRIGGER trg_associates_updated_at
  BEFORE UPDATE ON public.associates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Índices
CREATE INDEX idx_associates_employee ON public.associates(employee_credential_id);
CREATE INDEX idx_associates_document ON public.associates(document);
CREATE INDEX idx_associates_status ON public.associates(status);

-- RLS
ALTER TABLE public.associates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados visualizam agregados"
  ON public.associates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin/Operador gerenciam agregados"
  ON public.associates FOR ALL
  TO authenticated
  USING (is_admin_or_rh())
  WITH CHECK (is_admin_or_rh());

-- 3) Tabela: vehicle_authorized_drivers
CREATE TABLE public.vehicle_authorized_drivers (
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

-- Índices
CREATE INDEX idx_vad_vehicle ON public.vehicle_authorized_drivers(vehicle_credential_id);
CREATE INDEX idx_vad_employee ON public.vehicle_authorized_drivers(employee_credential_id);
CREATE INDEX idx_vad_associate ON public.vehicle_authorized_drivers(associate_id);

-- RLS
ALTER TABLE public.vehicle_authorized_drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados visualizam condutores"
  ON public.vehicle_authorized_drivers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin/Operador gerenciam condutores"
  ON public.vehicle_authorized_drivers FOR ALL
  TO authenticated
  USING (is_admin_or_rh())
  WITH CHECK (is_admin_or_rh());

-- 4) Tabela: access_sessions
CREATE TABLE public.access_sessions (
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

-- Índice único parcial: impedir múltiplas sessões pendentes por veículo
CREATE UNIQUE INDEX uniq_active_vehicle_session
  ON public.access_sessions(vehicle_credential_id)
  WHERE status = 'pending' AND vehicle_credential_id IS NOT NULL;

-- Índice único parcial: impedir múltiplas sessões pendentes por visitante
CREATE UNIQUE INDEX uniq_active_visitor_session
  ON public.access_sessions(visitor_id)
  WHERE status = 'pending' AND visitor_id IS NOT NULL;

-- Índices gerais
CREATE INDEX idx_sessions_status ON public.access_sessions(status);
CREATE INDEX idx_sessions_expires ON public.access_sessions(expires_at) WHERE status = 'pending';

-- RLS
ALTER TABLE public.access_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados visualizam sessões"
  ON public.access_sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Autenticados criam sessões"
  ON public.access_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados atualizam sessões"
  ON public.access_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 5) Trigger de cascata: colaborador bloqueado → agregados suspensos
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

CREATE TRIGGER trg_cascade_employee_deactivation
  AFTER UPDATE ON public.employee_credentials
  FOR EACH ROW
  WHEN (NEW.status = 'blocked')
  EXECUTE FUNCTION public.cascade_employee_deactivation();

-- 6) Auditoria automática para associates
CREATE TRIGGER trg_audit_associates
  AFTER INSERT OR UPDATE OR DELETE ON public.associates
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger_func();

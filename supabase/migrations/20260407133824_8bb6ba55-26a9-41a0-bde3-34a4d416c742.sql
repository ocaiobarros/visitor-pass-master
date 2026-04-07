
-- 1. Create gates table
CREATE TABLE public.gates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.gates ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies
CREATE POLICY "Gates visíveis para autenticados"
  ON public.gates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin gerencia gates"
  ON public.gates FOR ALL
  TO authenticated
  USING (public.has_role('admin'::app_role))
  WITH CHECK (public.has_role('admin'::app_role));

-- 4. Add gate_id to profiles
ALTER TABLE public.profiles
  ADD COLUMN gate_id UUID REFERENCES public.gates(id) ON DELETE SET NULL;

-- 5. Trigger for updated_at
CREATE TRIGGER update_gates_updated_at
  BEFORE UPDATE ON public.gates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- 6. Insert default gates
INSERT INTO public.gates (code, name, description) VALUES
  ('PORTAO_NORTE', 'Portão Norte', 'Entrada principal norte'),
  ('PORTAO_SUL', 'Portão Sul', 'Entrada principal sul'),
  ('PORTARIA_ADM', 'Portaria Administrativa', 'Acesso administrativo'),
  ('EXPEDICAO', 'Acesso Expedição', 'Portão de carga e expedição');

-- 7. Also add this migration to docker/migrations tracking
-- Update access_logs default to remove hardcoded value
ALTER TABLE public.access_logs ALTER COLUMN gate_id DROP DEFAULT;

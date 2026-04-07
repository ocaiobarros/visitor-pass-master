-- Migration: Create gates table and link to profiles
-- Matches Cloud schema applied via supabase--migration

-- 1. Create gates table
CREATE TABLE IF NOT EXISTS public.gates (
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
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='gates' AND policyname='Gates visíveis para autenticados') THEN
    CREATE POLICY "Gates visíveis para autenticados" ON public.gates FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='gates' AND policyname='Admin gerencia gates') THEN
    CREATE POLICY "Admin gerencia gates" ON public.gates FOR ALL TO authenticated
      USING (public.has_role('admin'::app_role)) WITH CHECK (public.has_role('admin'::app_role));
  END IF;
END $$;

-- 4. Add gate_id to profiles (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='gate_id') THEN
    ALTER TABLE public.profiles ADD COLUMN gate_id UUID REFERENCES public.gates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Trigger for updated_at
DROP TRIGGER IF EXISTS update_gates_updated_at ON public.gates;
CREATE TRIGGER update_gates_updated_at
  BEFORE UPDATE ON public.gates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 6. Insert default gates (idempotent)
INSERT INTO public.gates (code, name, description) VALUES
  ('PORTAO_NORTE', 'Portão Norte', 'Entrada principal norte'),
  ('PORTAO_SUL', 'Portão Sul', 'Entrada principal sul'),
  ('PORTARIA_ADM', 'Portaria Administrativa', 'Acesso administrativo'),
  ('EXPEDICAO', 'Acesso Expedição', 'Portão de carga e expedição')
ON CONFLICT (code) DO NOTHING;

-- 7. Remove hardcoded default from access_logs.gate_id
ALTER TABLE public.access_logs ALTER COLUMN gate_id DROP DEFAULT;

-- 8. Grant permissions
GRANT SELECT ON public.gates TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.gates TO authenticated, service_role;

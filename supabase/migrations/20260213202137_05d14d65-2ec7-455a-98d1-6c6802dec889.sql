
-- Add missing columns to visitors table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='visitors' AND column_name='access_type') THEN
    ALTER TABLE public.visitors ADD COLUMN access_type visitor_access_type NOT NULL DEFAULT 'pedestrian';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='visitors' AND column_name='vehicle_pass_id') THEN
    ALTER TABLE public.visitors ADD COLUMN vehicle_pass_id TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='visitors' AND column_name='vehicle_plate') THEN
    ALTER TABLE public.visitors ADD COLUMN vehicle_plate TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='visitors' AND column_name='vehicle_brand') THEN
    ALTER TABLE public.visitors ADD COLUMN vehicle_brand TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='visitors' AND column_name='vehicle_model') THEN
    ALTER TABLE public.visitors ADD COLUMN vehicle_model TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='visitors' AND column_name='vehicle_color') THEN
    ALTER TABLE public.visitors ADD COLUMN vehicle_color TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='visitors' AND column_name='company_reason') THEN
    ALTER TABLE public.visitors ADD COLUMN company_reason TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

-- Recreate triggers for vehicle pass ID generation
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

DROP TRIGGER IF EXISTS set_visitor_vehicle_pass_id ON public.visitors;
CREATE TRIGGER set_visitor_vehicle_pass_id
  BEFORE INSERT ON public.visitors
  FOR EACH ROW EXECUTE FUNCTION public.generate_visitor_vehicle_pass_id();

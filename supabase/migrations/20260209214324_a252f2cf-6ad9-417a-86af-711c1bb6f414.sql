
-- Novo enum para tipo de acesso do visitante
CREATE TYPE public.visitor_access_type AS ENUM ('pedestrian', 'driver');

-- Adicionar novos campos à tabela visitors
ALTER TABLE public.visitors
  ADD COLUMN company_reason text NOT NULL DEFAULT '',
  ADD COLUMN access_type public.visitor_access_type NOT NULL DEFAULT 'pedestrian',
  ADD COLUMN vehicle_pass_id text,
  ADD COLUMN vehicle_plate text,
  ADD COLUMN vehicle_brand text,
  ADD COLUMN vehicle_model text,
  ADD COLUMN vehicle_color text;

-- Trigger para gerar vehicle_pass_id automaticamente para motoristas
CREATE OR REPLACE FUNCTION public.generate_visitor_vehicle_pass_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
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
$function$;

CREATE TRIGGER set_visitor_vehicle_pass_id
  BEFORE INSERT ON public.visitors
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_visitor_vehicle_pass_id();

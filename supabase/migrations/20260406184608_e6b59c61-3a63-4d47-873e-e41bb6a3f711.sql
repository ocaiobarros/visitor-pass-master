
-- 1. Enhance cascade: when employee is blocked, also deactivate their driver authorizations
-- AND deactivate driver authorizations for their suspended associates
CREATE OR REPLACE FUNCTION public.cascade_employee_deactivation()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'blocked' AND (OLD.status IS NULL OR OLD.status != 'blocked') THEN
    -- Suspend associates
    UPDATE public.associates
    SET status = 'suspended', updated_at = now()
    WHERE employee_credential_id = NEW.id
      AND status = 'active';

    -- Deactivate driver authorizations for the employee
    UPDATE public.vehicle_authorized_drivers
    SET is_active = false
    WHERE employee_credential_id = NEW.id
      AND is_active = true;

    -- Deactivate driver authorizations for associates of this employee
    UPDATE public.vehicle_authorized_drivers
    SET is_active = false
    WHERE associate_id IN (
      SELECT id FROM public.associates WHERE employee_credential_id = NEW.id
    )
    AND is_active = true;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. New trigger: when associate status changes to suspended/expired, deactivate their driver authorizations
CREATE OR REPLACE FUNCTION public.cascade_associate_deactivation()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IN ('suspended', 'expired') AND OLD.status = 'active' THEN
    UPDATE public.vehicle_authorized_drivers
    SET is_active = false
    WHERE associate_id = NEW.id
      AND is_active = true;
  END IF;
  RETURN NEW;
END;
$function$;

-- Attach trigger to associates table
DROP TRIGGER IF EXISTS trg_cascade_associate_deactivation ON public.associates;
CREATE TRIGGER trg_cascade_associate_deactivation
  AFTER UPDATE ON public.associates
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_associate_deactivation();

-- 3. Unique constraint: prevent duplicate authorization (same person for same vehicle)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_driver_employee_vehicle
  ON public.vehicle_authorized_drivers (vehicle_credential_id, employee_credential_id)
  WHERE employee_credential_id IS NOT NULL AND is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_driver_associate_vehicle
  ON public.vehicle_authorized_drivers (vehicle_credential_id, associate_id)
  WHERE associate_id IS NOT NULL AND is_active = true;

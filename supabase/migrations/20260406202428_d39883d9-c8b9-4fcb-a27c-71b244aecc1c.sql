-- Add 'associate' to the subject_type enum
ALTER TYPE public.subject_type ADD VALUE IF NOT EXISTS 'associate';

-- Replace the validation trigger to handle associates
CREATE OR REPLACE FUNCTION public.validate_access_log_subject()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.subject_type = 'visitor' THEN
    IF NOT EXISTS (SELECT 1 FROM visitors WHERE id = NEW.subject_id) THEN
      RAISE EXCEPTION 'Visitor with id % does not exist', NEW.subject_id;
    END IF;
  ELSIF NEW.subject_type = 'employee' THEN
    IF NOT EXISTS (SELECT 1 FROM employee_credentials WHERE id = NEW.subject_id) THEN
      RAISE EXCEPTION 'Employee credential with id % does not exist', NEW.subject_id;
    END IF;
  ELSIF NEW.subject_type = 'associate' THEN
    IF NOT EXISTS (SELECT 1 FROM associates WHERE id = NEW.subject_id) THEN
      RAISE EXCEPTION 'Associate with id % does not exist', NEW.subject_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid subject_type: %', NEW.subject_type;
  END IF;
  RETURN NEW;
END;
$$;

-- Update get_last_access_direction to accept the new enum value (already works since it uses the enum type)

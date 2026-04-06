
-- associates → employee_credentials
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'associates_employee_credential_id_fkey' AND table_name = 'associates') THEN
    ALTER TABLE public.associates ADD CONSTRAINT associates_employee_credential_id_fkey FOREIGN KEY (employee_credential_id) REFERENCES public.employee_credentials(id) ON DELETE CASCADE;
  END IF;
END $$;

-- vehicle_authorized_drivers → employee_credentials (vehicle)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'vehicle_authorized_drivers_vehicle_credential_id_fkey' AND table_name = 'vehicle_authorized_drivers') THEN
    ALTER TABLE public.vehicle_authorized_drivers ADD CONSTRAINT vehicle_authorized_drivers_vehicle_credential_id_fkey FOREIGN KEY (vehicle_credential_id) REFERENCES public.employee_credentials(id) ON DELETE CASCADE;
  END IF;
END $$;

-- vehicle_authorized_drivers → employee_credentials (employee driver)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'vehicle_authorized_drivers_employee_credential_id_fkey' AND table_name = 'vehicle_authorized_drivers') THEN
    ALTER TABLE public.vehicle_authorized_drivers ADD CONSTRAINT vehicle_authorized_drivers_employee_credential_id_fkey FOREIGN KEY (employee_credential_id) REFERENCES public.employee_credentials(id) ON DELETE CASCADE;
  END IF;
END $$;

-- vehicle_authorized_drivers → associates
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'vehicle_authorized_drivers_associate_id_fkey' AND table_name = 'vehicle_authorized_drivers') THEN
    ALTER TABLE public.vehicle_authorized_drivers ADD CONSTRAINT vehicle_authorized_drivers_associate_id_fkey FOREIGN KEY (associate_id) REFERENCES public.associates(id) ON DELETE CASCADE;
  END IF;
END $$;

-- access_sessions FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'access_sessions_visitor_id_fkey' AND table_name = 'access_sessions') THEN
    ALTER TABLE public.access_sessions ADD CONSTRAINT access_sessions_visitor_id_fkey FOREIGN KEY (visitor_id) REFERENCES public.visitors(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'access_sessions_vehicle_credential_id_fkey' AND table_name = 'access_sessions') THEN
    ALTER TABLE public.access_sessions ADD CONSTRAINT access_sessions_vehicle_credential_id_fkey FOREIGN KEY (vehicle_credential_id) REFERENCES public.employee_credentials(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'access_sessions_person_credential_id_fkey' AND table_name = 'access_sessions') THEN
    ALTER TABLE public.access_sessions ADD CONSTRAINT access_sessions_person_credential_id_fkey FOREIGN KEY (person_credential_id) REFERENCES public.employee_credentials(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'access_sessions_associate_id_fkey' AND table_name = 'access_sessions') THEN
    ALTER TABLE public.access_sessions ADD CONSTRAINT access_sessions_associate_id_fkey FOREIGN KEY (associate_id) REFERENCES public.associates(id);
  END IF;
END $$;

-- Ensure GRANT permissions for self-hosted compatibility
GRANT SELECT, INSERT, UPDATE ON public.associates TO authenticated;
GRANT SELECT ON public.associates TO anon;
GRANT SELECT, INSERT, UPDATE ON public.vehicle_authorized_drivers TO authenticated;
GRANT SELECT ON public.vehicle_authorized_drivers TO anon;
GRANT SELECT, INSERT, UPDATE ON public.access_sessions TO authenticated;
GRANT SELECT ON public.access_sessions TO anon;

-- Add email column to profiles and update handle_new_user trigger

-- Add column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Add gate_id column if missing (was added in earlier Cloud migration)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gate_id UUID REFERENCES public.gates(id);

-- Backfill emails from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id
  AND p.email IS NULL;

-- Update handle_new_user to capture email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, must_change_password)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    CASE WHEN NEW.email = 'admin@sistema.local' THEN true ELSE false END
  );

  IF NEW.email = 'admin@sistema.local' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'security');
  END IF;

  RETURN NEW;
END;
$$;

-- Admin update policy for profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Admin pode atualizar qualquer perfil'
  ) THEN
    CREATE POLICY "Admin pode atualizar qualquer perfil"
      ON public.profiles FOR UPDATE TO authenticated
      USING (public.has_role('admin'::public.app_role))
      WITH CHECK (public.has_role('admin'::public.app_role));
  END IF;
END $$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

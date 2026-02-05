-- Adicionar coluna para controle de primeiro acesso
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- Atualizar a função handle_new_user para auto-elevar admin@sistema.local
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Criar perfil
  INSERT INTO public.profiles (user_id, full_name, must_change_password)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    -- Admin padrão deve trocar senha no primeiro acesso
    CASE WHEN NEW.email = 'admin@sistema.local' THEN true ELSE false END
  );
  
  -- Atribuir role baseado no email
  IF NEW.email = 'admin@sistema.local' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'security');
  END IF;
  
  RETURN NEW;
END;
$function$;
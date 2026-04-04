
-- Atualizar is_admin_or_rh para incluir operador_acesso
CREATE OR REPLACE FUNCTION public.is_admin_or_rh()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'rh', 'operador_acesso')
  );
END;
$$;

-- Atualizar has_role para funcionar com ambos os valores
-- (não precisa mudar, já é genérica)

-- Atualizar handle_new_user para usar operador_acesso em vez de security como default
-- (mantém security como default para novos usuários comuns)

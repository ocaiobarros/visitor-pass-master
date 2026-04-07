-- Allow admins to update any profile (e.g. assign gate_id)
CREATE POLICY "Admin pode atualizar qualquer perfil"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role('admin'::app_role))
WITH CHECK (public.has_role('admin'::app_role));

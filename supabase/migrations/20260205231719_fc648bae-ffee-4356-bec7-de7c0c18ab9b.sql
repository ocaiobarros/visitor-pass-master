-- Fix RLS policies for visitors table (INSERT permission)
DROP POLICY IF EXISTS "RH/Admin criam visitantes" ON public.visitors;

CREATE POLICY "RH/Admin criam visitantes" ON public.visitors
FOR INSERT TO public
WITH CHECK (is_admin_or_rh());

-- Ensure audit_logs INSERT works for all authenticated
DROP POLICY IF EXISTS "Usuários autenticados inserem audit logs" ON public.audit_logs;

CREATE POLICY "Usuários autenticados inserem audit logs" ON public.audit_logs
FOR INSERT TO public
WITH CHECK (auth.uid() IS NOT NULL);
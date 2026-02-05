-- Corrigir RLS policy de INSERT para audit_logs
-- Restringir inserção apenas para usuários autenticados
DROP POLICY IF EXISTS "Usuários autenticados inserem audit logs" ON public.audit_logs;

CREATE POLICY "Usuários autenticados inserem audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
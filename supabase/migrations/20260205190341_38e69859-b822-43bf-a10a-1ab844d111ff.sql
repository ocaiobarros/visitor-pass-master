-- Corrigir RLS policy de INSERT para access_logs
DROP POLICY IF EXISTS "Autenticados criam logs" ON public.access_logs;

CREATE POLICY "Autenticados criam logs"
ON public.access_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
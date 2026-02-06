-- =============================================
-- FIX: RLS Policy para employee_credentials
-- Permitir INSERT para usuários admin/rh
-- =============================================

-- Drop existing insert policy if exists
DROP POLICY IF EXISTS "Admins and RH can insert credentials" ON public.employee_credentials;
DROP POLICY IF EXISTS "Users can insert employee credentials" ON public.employee_credentials;
DROP POLICY IF EXISTS "Authenticated users can insert employee credentials" ON public.employee_credentials;

-- Create INSERT policy for admin/rh users
CREATE POLICY "Admins and RH can insert credentials"
ON public.employee_credentials
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_rh());

-- Ensure UPDATE policy exists for admin/rh
DROP POLICY IF EXISTS "Admins and RH can update credentials" ON public.employee_credentials;
CREATE POLICY "Admins and RH can update credentials"
ON public.employee_credentials
FOR UPDATE
TO authenticated
USING (public.is_admin_or_rh())
WITH CHECK (public.is_admin_or_rh());

-- Ensure SELECT policy exists for all authenticated
DROP POLICY IF EXISTS "Authenticated users can view credentials" ON public.employee_credentials;
CREATE POLICY "Authenticated users can view credentials"
ON public.employee_credentials
FOR SELECT
TO authenticated
USING (true);

-- =============================================
-- FIX: RLS Policy para profiles - permitir update do próprio usuário
-- =============================================

-- Drop and recreate update policy for profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
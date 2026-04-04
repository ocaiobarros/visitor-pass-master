
-- ============================================================
-- RENOMEAR app_role: 'rh' → 'operador_acesso'
-- ============================================================

-- 1. Adicionar novo valor ao enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operador_acesso';

-- COMMIT implícito necessário antes de usar o novo valor
-- Em Supabase migrations, cada statement roda em transaction separada

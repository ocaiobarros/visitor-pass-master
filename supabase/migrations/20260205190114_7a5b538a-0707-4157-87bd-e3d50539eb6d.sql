-- =============================================
-- AUDIT LOGS TABLE - Sistema de Auditoria
-- Compatível com PostgreSQL 15/16 padrão
-- =============================================

-- Criar ENUM para tipos de ação
CREATE TYPE public.audit_action_type AS ENUM (
  'LOGIN',
  'LOGOUT',
  'LOGIN_FAILED',
  'USER_CREATE',
  'USER_UPDATE',
  'USER_DELETE',
  'USER_DEACTIVATE',
  'USER_ACTIVATE',
  'PASSWORD_RESET',
  'PASSWORD_CHANGE',
  'ROLE_UPDATE',
  'CONFIG_UPDATE',
  'VISITOR_CREATE',
  'VISITOR_UPDATE',
  'VISITOR_DELETE',
  'EMPLOYEE_CREATE',
  'EMPLOYEE_UPDATE',
  'EMPLOYEE_DELETE',
  'DEPARTMENT_CREATE',
  'DEPARTMENT_DELETE',
  'BACKUP_EXPORT',
  'ACCESS_SCAN'
);

-- Criar tabela de audit logs
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action_type audit_action_type NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT
);

-- Índices para performance
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action_type ON public.audit_logs(action_type);

-- Habilitar RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Apenas admin pode visualizar logs de auditoria
CREATE POLICY "Admin visualiza audit logs"
ON public.audit_logs
FOR SELECT
USING (has_role('admin'::app_role));

-- Qualquer usuário autenticado pode inserir logs (para registrar suas próprias ações)
CREATE POLICY "Usuários autenticados inserem audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (true);

-- Ninguém pode deletar ou atualizar logs de auditoria (imutabilidade)
-- (Sem policies para UPDATE e DELETE = bloqueado por padrão)

-- Adicionar coluna is_active na tabela profiles para desativação de usuários
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
#!/bin/bash
# ============================================
# Guarda Operacional - Database Initialization
# ============================================
# Este script é executado automaticamente na primeira
# inicialização do container PostgreSQL.
# ============================================

set -e

echo "============================================"
echo "  Guarda Operacional - Inicializando DB"
echo "============================================"

# Variáveis
DB_NAME="${POSTGRES_DB:-guarda_operacional}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@sistema.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin@123}"
ADMIN_NAME="${ADMIN_NAME:-Administrador}"

echo "→ Criando extensões necessárias..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DB_NAME" <<-EOSQL
    -- Extensões necessárias
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
EOSQL

echo "→ Criando schema de autenticação..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DB_NAME" <<-EOSQL
    -- Schema para autenticação (compatível com Supabase GoTrue)
    CREATE SCHEMA IF NOT EXISTS auth;
    
    -- Tabela de usuários do auth
    CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email TEXT UNIQUE NOT NULL,
        encrypted_password TEXT,
        email_confirmed_at TIMESTAMPTZ,
        invited_at TIMESTAMPTZ,
        confirmation_token TEXT,
        confirmation_sent_at TIMESTAMPTZ,
        recovery_token TEXT,
        recovery_sent_at TIMESTAMPTZ,
        email_change_token_new TEXT,
        email_change TEXT,
        email_change_sent_at TIMESTAMPTZ,
        last_sign_in_at TIMESTAMPTZ,
        raw_app_meta_data JSONB DEFAULT '{}'::jsonb,
        raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
        is_super_admin BOOLEAN DEFAULT false,
        role TEXT DEFAULT 'authenticated',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        phone TEXT,
        phone_confirmed_at TIMESTAMPTZ,
        phone_change TEXT,
        phone_change_token TEXT,
        phone_change_sent_at TIMESTAMPTZ,
        confirmed_at TIMESTAMPTZ GENERATED ALWAYS AS (
            LEAST(email_confirmed_at, phone_confirmed_at)
        ) STORED,
        email_change_token_current TEXT,
        email_change_confirm_status SMALLINT DEFAULT 0,
        banned_until TIMESTAMPTZ,
        reauthentication_token TEXT,
        reauthentication_sent_at TIMESTAMPTZ,
        is_sso_user BOOLEAN DEFAULT false,
        deleted_at TIMESTAMPTZ
    );
    
    -- Índices para auth.users
    CREATE INDEX IF NOT EXISTS users_email_idx ON auth.users (email);
    
    -- Roles para API
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
            CREATE ROLE anon NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
            CREATE ROLE authenticated NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
            CREATE ROLE service_role NOLOGIN;
        END IF;
    END
    \$\$;
    
    -- Permissões
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA auth TO service_role;
EOSQL

echo "→ Aplicando schema principal..."
# O schema.sql é montado via volume e executado automaticamente pelo PostgreSQL

echo "→ Criando usuário administrador inicial..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DB_NAME" \
    -v admin_email="$ADMIN_EMAIL" \
    -v admin_password="$ADMIN_PASSWORD" \
    -v admin_name="$ADMIN_NAME" <<-'EOSQL'
    -- Inserir usuário admin no auth.users
    INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_user_meta_data,
        role,
        created_at,
        updated_at
    ) VALUES (
        uuid_generate_v4(),
        :'admin_email',
        crypt(:'admin_password', gen_salt('bf')),
        now(),
        jsonb_build_object('full_name', :'admin_name'),
        'authenticated',
        now(),
        now()
    ) ON CONFLICT (email) DO NOTHING;
    
    -- Buscar o ID do admin criado e criar perfil/role
    DO $$
    DECLARE
        admin_id UUID;
        v_admin_email TEXT := current_setting('psql.admin_email', true);
        v_admin_name TEXT := current_setting('psql.admin_name', true);
    BEGIN
        SELECT id INTO admin_id FROM auth.users WHERE email = v_admin_email;
        
        IF admin_id IS NOT NULL THEN
            -- Criar perfil
            INSERT INTO public.profiles (user_id, full_name, must_change_password)
            VALUES (admin_id, v_admin_name, true)
            ON CONFLICT (user_id) DO NOTHING;
            
            -- Atribuir role admin
            INSERT INTO public.user_roles (user_id, role)
            VALUES (admin_id, 'admin')
            ON CONFLICT (user_id, role) DO NOTHING;
            
            RAISE NOTICE 'Usuário administrador criado com sucesso!';
        END IF;
    END
    $$;
EOSQL

echo "============================================"
echo "  ✓ Banco de dados inicializado!"
echo "  ✓ Admin: ${ADMIN_EMAIL}"
echo "============================================"

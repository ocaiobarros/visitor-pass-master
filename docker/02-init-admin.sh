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
    -- Schema para autenticação (compatível com GoTrue)
    CREATE SCHEMA IF NOT EXISTS auth;

    -- Tabelas mínimas esperadas pelo GoTrue (evita conflito de migração/índices)
    CREATE TABLE IF NOT EXISTS auth.users (
        instance_id uuid NULL,
        id uuid NOT NULL UNIQUE,
        aud varchar(255) NULL,
        "role" varchar(255) NULL,
        email varchar(255) NULL UNIQUE,
        encrypted_password varchar(255) NULL,
        confirmed_at timestamptz NULL,
        invited_at timestamptz NULL,
        confirmation_token varchar(255) NULL,
        confirmation_sent_at timestamptz NULL,
        recovery_token varchar(255) NULL,
        recovery_sent_at timestamptz NULL,
        email_change_token varchar(255) NULL,
        email_change varchar(255) NULL,
        email_change_sent_at timestamptz NULL,
        last_sign_in_at timestamptz NULL,
        raw_app_meta_data jsonb NULL,
        raw_user_meta_data jsonb NULL,
        is_super_admin bool NULL,
        created_at timestamptz NULL,
        updated_at timestamptz NULL,
        CONSTRAINT users_pkey PRIMARY KEY (id)
    );

    CREATE INDEX IF NOT EXISTS users_instance_id_email_idx ON auth.users USING btree (instance_id, email);
    CREATE INDEX IF NOT EXISTS users_instance_id_idx ON auth.users USING btree (instance_id);

    CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
        instance_id uuid NULL,
        id bigserial NOT NULL,
        "token" varchar(255) NULL,
        user_id varchar(255) NULL,
        revoked bool NULL,
        created_at timestamptz NULL,
        updated_at timestamptz NULL,
        CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id)
    );

    CREATE INDEX IF NOT EXISTS refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);
    CREATE INDEX IF NOT EXISTS refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);
    CREATE INDEX IF NOT EXISTS refresh_tokens_token_idx ON auth.refresh_tokens USING btree ("token");

    CREATE TABLE IF NOT EXISTS auth.instances (
        id uuid NOT NULL,
        uuid uuid NULL,
        raw_base_config text NULL,
        created_at timestamptz NULL,
        updated_at timestamptz NULL,
        CONSTRAINT instances_pkey PRIMARY KEY (id)
    );

    CREATE TABLE IF NOT EXISTS auth.audit_log_entries (
        instance_id uuid NULL,
        id uuid NOT NULL,
        payload json NULL,
        created_at timestamptz NULL,
        CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id)
    );

    CREATE INDEX IF NOT EXISTS audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);

    CREATE TABLE IF NOT EXISTS auth.schema_migrations (
        "version" varchar(255) NOT NULL,
        CONSTRAINT schema_migrations_pkey PRIMARY KEY ("version")
    );

    -- Funções usadas por RLS/PostgREST (claims do JWT)
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$ LANGUAGE sql STABLE;

    CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$
      SELECT nullif(current_setting('request.jwt.claim.role', true), '')::text;
    $$ LANGUAGE sql STABLE;

    -- Roles para API
    DO $$
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
    $$;

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
    -- Inserir usuário admin no auth.users (compatível com GoTrue)
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        "role",
        email,
        encrypted_password,
        confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        created_at,
        updated_at
    ) VALUES (
        NULL,
        uuid_generate_v4(),
        'authenticated',
        'authenticated',
        :'admin_email',
        crypt(:'admin_password', gen_salt('bf')),
        now(),
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
        jsonb_build_object('full_name', :'admin_name'),
        false,
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

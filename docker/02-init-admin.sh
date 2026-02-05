#!/bin/bash
# ============================================
# Guarda Operacional - Database Initialization
# ============================================
# Este script é executado automaticamente na primeira
# inicialização do container PostgreSQL.
# 
# IMPORTANTE: NÃO cria schema auth.* - deixa o GoTrue gerenciar
# ============================================

set -e

echo "============================================"
echo "  Guarda Operacional - Inicializando DB"
echo "============================================"

# Variáveis
DB_NAME="${POSTGRES_DB:-guarda_operacional}"

echo "→ Criando extensões necessárias..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DB_NAME" <<-EOSQL
    -- Extensões necessárias
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
EOSQL

echo "→ Criando schema auth para GoTrue..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DB_NAME" <<-EOSQL
    -- Schema auth (GoTrue gerencia as tabelas)
    CREATE SCHEMA IF NOT EXISTS auth;
EOSQL

echo "→ Criando roles para API..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DB_NAME" <<-EOSQL
    -- Roles para API (PostgREST + GoTrue)
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
    
    -- Permissões no schema public
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
EOSQL

echo "============================================"
echo "  ✓ Extensões e roles criados!"
echo "  ✓ Schema auth.* será criado pelo GoTrue"
echo "============================================"

#!/bin/bash
# ============================================
# Guarda Operacional - Database Initialization
# ============================================
# Este script roda APÓS o 01-schema.sql e garante
# que o postgres tem permissões totais no schema auth
# (necessário para as migrations do GoTrue).
# ============================================

set -e

DB_NAME="${POSTGRES_DB:-guarda_operacional}"

echo "============================================"
echo "  Guarda Operacional - Ajustando Permissões"
echo "============================================"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DB_NAME" <<-EOSQL
    -- Garantir que postgres é dono do schema auth
    ALTER SCHEMA auth OWNER TO $POSTGRES_USER;

    -- Permissões totais para postgres no schema auth
    GRANT ALL ON SCHEMA auth TO $POSTGRES_USER;
    GRANT ALL ON ALL TABLES IN SCHEMA auth TO $POSTGRES_USER;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO $POSTGRES_USER;
    GRANT ALL ON ALL ROUTINES IN SCHEMA auth TO $POSTGRES_USER;

    -- Default privileges para tabelas futuras no auth (criadas pelo GoTrue)
    ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO $POSTGRES_USER;
    ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON SEQUENCES TO $POSTGRES_USER;
    ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON ROUTINES TO $POSTGRES_USER;

    -- Permissões para roles do PostgREST/GoTrue
    GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
    GRANT ALL ON SCHEMA auth TO service_role;
EOSQL

echo "============================================"
echo "  ✓ Permissões do schema auth configuradas!"
echo "============================================"

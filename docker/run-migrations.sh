#!/bin/bash
# ============================================
# Guarda Operacional - Migration Runner
# ============================================
# Aplica migrations versionadas incrementalmente.
# Rastreia estado em public.schema_migrations.
# Idempotente: seguro para executar múltiplas vezes.
# ============================================

set -e

DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-guarda_operacional}"
MIGRATIONS_DIR="/migrations"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[MIGRATE]${NC} $1"; }
warn() { echo -e "${YELLOW}[MIGRATE]${NC} $1"; }
err()  { echo -e "${RED}[MIGRATE]${NC} $1"; }

export PGPASSWORD="$DB_PASSWORD"
PSQL="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -v ON_ERROR_STOP=1"

# ==========================================
# Wait for database
# ==========================================
log "Aguardando banco de dados..."
for i in $(seq 1 30); do
  if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
  err "FATAL: Banco de dados não disponível após 60s"
  exit 1
fi

log "Banco de dados disponível."

# ==========================================
# Create migrations tracking table
# ==========================================
$PSQL -c "
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  description TEXT
);
" > /dev/null 2>&1

log "Tabela schema_migrations verificada."

# ==========================================
# Apply migrations
# ==========================================
if [ ! -d "$MIGRATIONS_DIR" ] || [ -z "$(ls -A "$MIGRATIONS_DIR"/*.sql 2>/dev/null)" ]; then
  log "Nenhuma migration encontrada em $MIGRATIONS_DIR."
  exit 0
fi

APPLIED=0
SKIPPED=0

for migration_file in "$MIGRATIONS_DIR"/*.sql; do
  filename=$(basename "$migration_file")
  version="${filename%.sql}"

  # Check if already applied
  already_applied=$($PSQL -t -c "SELECT COUNT(*) FROM public.schema_migrations WHERE version = '$version';" 2>/dev/null | tr -d ' ')

  if [ "$already_applied" = "1" ]; then
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  log "Aplicando migration: $filename ..."

  if $PSQL -f "$migration_file"; then
    # Record successful migration
    # Extract description from first comment line
    description=$(head -1 "$migration_file" | sed 's/^-- *//' | head -c 200)
    $PSQL -c "INSERT INTO public.schema_migrations (version, description) VALUES ('$version', '$description');" > /dev/null 2>&1
    APPLIED=$((APPLIED + 1))
    log "  ✓ $filename aplicada com sucesso"
  else
    err "  ✗ FALHA ao aplicar $filename"
    exit 1
  fi
done

log "Resultado: $APPLIED aplicada(s), $SKIPPED já existente(s)."

# ==========================================
# Notify PostgREST to reload schema cache
# ==========================================
if [ "$APPLIED" -gt 0 ]; then
  log "Notificando PostgREST para recarregar schema..."
  $PSQL -c "NOTIFY pgrst, 'reload schema';" > /dev/null 2>&1
  log "Schema reload notificado."
fi

log "Migration runner finalizado."
exit 0

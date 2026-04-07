#!/bin/bash
# ============================================
# Guarda Operacional - Migration Runner v2
# ============================================
# Aplica migrations versionadas incrementalmente.
# Rastreia estado em public.schema_migrations.
# Idempotente: seguro para executar múltiplas vezes.
# Valida RPCs críticas após aplicação.
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
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[MIGRATE]${NC} $1"; }
warn() { echo -e "${YELLOW}[MIGRATE]${NC} $1"; }
err()  { echo -e "${RED}[MIGRATE]${NC} $1"; }
info() { echo -e "${CYAN}[MIGRATE]${NC} $1"; }

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
# Advisory lock to prevent concurrent runs
# ==========================================
LOCK_ACQUIRED=$($PSQL -t -c "SELECT pg_try_advisory_lock(hashtext('migration_runner'));" 2>/dev/null | tr -d ' ')

if [ "$LOCK_ACQUIRED" != "t" ]; then
  warn "Outra instância do migration runner em execução. Aguardando..."
  $PSQL -c "SELECT pg_advisory_lock(hashtext('migration_runner'));" > /dev/null 2>&1
  log "Lock adquirido."
fi

# ==========================================
# Apply migrations
# ==========================================
if [ ! -d "$MIGRATIONS_DIR" ] || [ -z "$(ls -A "$MIGRATIONS_DIR"/*.sql 2>/dev/null)" ]; then
  log "Nenhuma migration encontrada em $MIGRATIONS_DIR."
  # Still run validation even with no new migrations
else
  APPLIED=0
  SKIPPED=0
  FAILED=0

  for migration_file in "$MIGRATIONS_DIR"/*.sql; do
    filename=$(basename "$migration_file")
    version="${filename%.sql}"

    # Check if already applied
    already_applied=$($PSQL -t -c "SELECT COUNT(*) FROM public.schema_migrations WHERE version = '$version';" 2>/dev/null | tr -d ' ')

    if [ "$already_applied" = "1" ]; then
      SKIPPED=$((SKIPPED + 1))
      info "  ⏭ $filename (já aplicada)"
      continue
    fi

    log "Aplicando migration: $filename ..."

    if $PSQL -f "$migration_file" 2>&1; then
      # Record successful migration
      description=$(head -1 "$migration_file" | sed 's/^-- *//' | head -c 200)
      $PSQL -c "INSERT INTO public.schema_migrations (version, description) VALUES ('$version', '$description');" > /dev/null 2>&1
      APPLIED=$((APPLIED + 1))
      log "  ✓ $filename aplicada com sucesso"
    else
      FAILED=$((FAILED + 1))
      err "  ✗ FALHA ao aplicar $filename"
      err "FATAL: Migration falhou. Container abortando para evitar estado inconsistente."
      # Release lock before exit
      $PSQL -c "SELECT pg_advisory_unlock(hashtext('migration_runner'));" > /dev/null 2>&1
      exit 1
    fi
  done

  log "Resultado: $APPLIED aplicada(s), $SKIPPED já existente(s), $FAILED falha(s)."

  # ==========================================
  # Notify PostgREST to reload schema cache
  # ==========================================
  if [ "$APPLIED" -gt 0 ]; then
    log "Notificando PostgREST para recarregar schema..."
    $PSQL -c "NOTIFY pgrst, 'reload schema';" > /dev/null 2>&1
    log "Schema reload notificado."
  fi
fi

# ==========================================
# Validate critical RPCs exist
# ==========================================
log "Validando RPCs críticas..."

CRITICAL_RPCS="report_person_timeline report_sessions report_presence_now report_denials report_permanence report_executive_summary report_employees_detailed report_visitors_detailed report_associates_detailed report_vehicle_activity"
MISSING_RPCS=""

for rpc in $CRITICAL_RPCS; do
  exists=$($PSQL -t -c "SELECT COUNT(*) FROM pg_proc WHERE proname = '$rpc';" 2>/dev/null | tr -d ' ')
  if [ "$exists" = "0" ]; then
    MISSING_RPCS="$MISSING_RPCS $rpc"
    err "  ✗ RPC ausente: $rpc"
  else
    info "  ✓ RPC: $rpc"
  fi
done

if [ -n "$MISSING_RPCS" ]; then
  err "FATAL: RPCs críticas ausentes:$MISSING_RPCS"
  err "O banco está inconsistente. Verifique as migrations."
  $PSQL -c "SELECT pg_advisory_unlock(hashtext('migration_runner'));" > /dev/null 2>&1
  exit 1
fi

log "Todas RPCs críticas validadas."

# ==========================================
# Sanity check - core tables
# ==========================================
log "Sanity check..."

CORE_TABLES="access_logs access_sessions employee_credentials visitors associates profiles user_roles audit_logs gates"
for tbl in $CORE_TABLES; do
  exists=$($PSQL -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='$tbl';" 2>/dev/null | tr -d ' ')
  if [ "$exists" = "0" ]; then
    err "  ✗ Tabela ausente: $tbl"
    $PSQL -c "SELECT pg_advisory_unlock(hashtext('migration_runner'));" > /dev/null 2>&1
    exit 1
  fi
done

# Validate view
VIEW_EXISTS=$($PSQL -t -c "SELECT COUNT(*) FROM information_schema.views WHERE table_schema='public' AND table_name='access_events_enriched';" 2>/dev/null | tr -d ' ')
if [ "$VIEW_EXISTS" = "0" ]; then
  err "  ✗ View ausente: access_events_enriched"
  $PSQL -c "SELECT pg_advisory_unlock(hashtext('migration_runner'));" > /dev/null 2>&1
  exit 1
fi

# Log stats
ACCESS_COUNT=$($PSQL -t -c "SELECT COUNT(*) FROM access_logs;" 2>/dev/null | tr -d ' ')
RPC_COUNT=$($PSQL -t -c "SELECT COUNT(*) FROM pg_proc WHERE proname LIKE 'report_%';" 2>/dev/null | tr -d ' ')
MIGRATION_COUNT=$($PSQL -t -c "SELECT COUNT(*) FROM schema_migrations;" 2>/dev/null | tr -d ' ')

info "  Tabelas: OK | View: OK"
info "  access_logs: $ACCESS_COUNT registros"
info "  RPCs report_*: $RPC_COUNT funções"
info "  Migrations aplicadas: $MIGRATION_COUNT"

# ==========================================
# Release advisory lock
# ==========================================
$PSQL -c "SELECT pg_advisory_unlock(hashtext('migration_runner'));" > /dev/null 2>&1

log "Migration runner finalizado com sucesso."
exit 0

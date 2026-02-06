#!/bin/bash
# ============================================
# Guarda Operacional - Release Gate Script
# ============================================
#
# Pipeline completo de validação:
#   1. Build e start do stack
#   2. Healthcheck real (sem sleep fixo)
#   3. Seed admin determinístico
#   4. Auth smoke gate (fail-fast)
#   5. Suite E2E completa
#
# Exit code 0 = PASS, != 0 = FAIL
#
# Uso: ./scripts/release-gate.sh [--skip-build] [--keep-up]
# ============================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Diretório do script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Args
SKIP_BUILD=false
KEEP_UP=false

for arg in "$@"; do
  case $arg in
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --keep-up)
      KEEP_UP=true
      shift
      ;;
  esac
done

# Criar diretório de artifacts
mkdir -p ./e2e-artifacts/diagnostics

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  GUARDA OPERACIONAL - Release Gate 2026${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# ==========================================
# Função para coletar diagnósticos em falha
# ==========================================
collect_diagnostics() {
  echo -e "${RED}Coletando diagnósticos...${NC}"
  
  DIAG_DIR="./e2e-artifacts/diagnostics/$(date +%Y%m%d_%H%M%S)"
  mkdir -p "$DIAG_DIR"

  echo "→ Container status..."
  docker compose ps > "$DIAG_DIR/containers.txt" 2>&1 || true

  echo "→ Logs do Kong..."
  docker compose logs --tail 200 kong > "$DIAG_DIR/kong.log" 2>&1 || true

  echo "→ Logs do Auth..."
  docker compose logs --tail 200 auth > "$DIAG_DIR/auth.log" 2>&1 || true

  echo "→ Logs do PostgREST..."
  docker compose logs --tail 200 postgrest > "$DIAG_DIR/postgrest.log" 2>&1 || true

  echo "→ Logs do Admin API..."
  docker compose logs --tail 200 admin-api > "$DIAG_DIR/admin-api.log" 2>&1 || true

  echo "→ Logs do App..."
  docker compose logs --tail 200 app > "$DIAG_DIR/app.log" 2>&1 || true

  echo "→ Dump de auth.users..."
  docker exec guarda-db psql -U postgres -d guarda_operacional \
    -c "SELECT id, email, email_confirmed_at, created_at FROM auth.users ORDER BY created_at DESC LIMIT 20;" \
    > "$DIAG_DIR/auth_users.txt" 2>&1 || true

  echo "→ Dump de user_roles..."
  docker exec guarda-db psql -U postgres -d guarda_operacional \
    -c "SELECT * FROM public.user_roles LIMIT 20;" \
    > "$DIAG_DIR/user_roles.txt" 2>&1 || true

  echo "→ Variáveis de ambiente relevantes..."
  cat > "$DIAG_DIR/env_vars.txt" << EOF
BASE_URL=${BASE_URL:-http://localhost}
API_URL=${API_URL:-http://localhost:8000}
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@sistema.local}
ANON_KEY=${ANON_KEY:+SET (${#ANON_KEY} chars)}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY:+SET (${#SERVICE_ROLE_KEY} chars)}
EOF

  echo ""
  echo -e "${RED}============================================${NC}"
  echo -e "${RED}  ❌ RELEASE GATE FAILED${NC}"
  echo -e "${RED}============================================${NC}"
  echo ""
  echo "Diagnósticos salvos em: $DIAG_DIR"
  echo ""
  echo "Para investigar manualmente:"
  echo "  docker compose ps"
  echo "  docker compose logs auth | tail -100"
  echo "  docker compose logs admin-api | tail -100"
  echo "  cat $DIAG_DIR/auth_users.txt"
  echo ""
}

# Trap para coletar diagnósticos em falha
cleanup() {
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    collect_diagnostics
  fi
  
  if [ "$KEEP_UP" = false ] && [ $exit_code -eq 0 ]; then
    echo "→ Parando containers..."
    docker compose down 2>/dev/null || true
  fi
  
  exit $exit_code
}
trap cleanup EXIT

# ==========================================
# STEP 1: Build e Start
# ==========================================
if [ "$SKIP_BUILD" = false ]; then
  echo -e "${YELLOW}[1/5] Building and starting stack...${NC}"
  
  # Preparar diretório de logs
  mkdir -p /var/log/visitor-pass 2>/dev/null || true
  chmod 775 /var/log/visitor-pass 2>/dev/null || true
  chown -R 1001:1001 /var/log/visitor-pass 2>/dev/null || true

  docker compose down --remove-orphans 2>/dev/null || true
  docker compose up -d --build --remove-orphans
  echo "→ Containers iniciados; seguindo imediatamente para healthchecks reais..."
  echo -e "${YELLOW}[1/5] Skipping build (--skip-build)${NC}"
fi

# ==========================================
# STEP 2: Healthcheck Real
# ==========================================
echo ""
echo -e "${YELLOW}[2/5] Healthcheck real (sem sleep fixo)...${NC}"

wait_for_healthy() {
  local container=$1
  local max_attempts=${2:-30}
  local attempt=0
  
  while [ $attempt -lt $max_attempts ]; do
    local health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "not_found")
    
    if [ "$health" = "healthy" ]; then
      echo -e "  ${GREEN}✓${NC} $container is healthy"
      return 0
    fi
    
    if [ "$health" = "not_found" ]; then
      echo -e "  ${RED}✗${NC} $container not found"
      return 1
    fi
    
    attempt=$((attempt + 1))
    sleep 2
  done
  
  echo -e "  ${RED}✗${NC} $container did not become healthy (status: $health)"
  return 1
}

# Aguardar containers críticos
echo "→ Aguardando containers ficarem healthy..."

CRITICAL_CONTAINERS="guarda-db guarda-auth guarda-gateway guarda-api guarda-admin-api guarda-app"

for container in $CRITICAL_CONTAINERS; do
  if ! wait_for_healthy "$container" 60; then
    echo -e "${RED}FATAL: Container $container não ficou healthy${NC}"
    docker compose ps
    exit 1
  fi
done

echo -e "${GREEN}✓ Todos os containers estão healthy${NC}"

# ==========================================
# STEP 3: Seed Admin Determinístico
# ==========================================
echo ""
echo -e "${YELLOW}[3/5] Executando seed admin...${NC}"

# Carregar variáveis do .env
if [ -f ".env" ]; then
  set -a
  source .env
  set +a
fi

# Exportar variáveis para o seed
export SUPABASE_URL="${API_URL:-http://localhost:8000}"
export SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-}"
export ADMIN_EMAIL="${ADMIN_EMAIL:-admin@sistema.local}"
export ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin@123}"
export ANON_KEY="${ANON_KEY:-}"

# Executar seed via Docker (usa script montado como volume)
docker compose run --rm -T \
  --entrypoint "npx" \
  -e SUPABASE_URL="http://kong:8000" \
  -e SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
  -e ADMIN_EMAIL="$ADMIN_EMAIL" \
  -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  -e ANON_KEY="$ANON_KEY" \
  e2e ts-node /e2e/scripts/seed-admin.ts

if [ $? -ne 0 ]; then
  echo -e "${RED}FATAL: Seed admin falhou${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Seed admin concluído${NC}"

# ==========================================
# STEP 4: Auth Smoke Gate
# ==========================================
echo ""
echo -e "${YELLOW}[4/5] Executando auth smoke gate...${NC}"

# Executar apenas o teste de auth gate
docker compose run --rm -T \
  --entrypoint "npx" \
  -e BASE_URL="http://kong:8000" \
  -e API_URL="http://kong:8000" \
  -e ADMIN_EMAIL="$ADMIN_EMAIL" \
  -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  -e ANON_KEY="$ANON_KEY" \
  e2e playwright test 00-auth-gate --reporter=list

if [ $? -ne 0 ]; then
  echo -e "${RED}FATAL: Auth smoke gate falhou${NC}"
  echo ""
  echo "Isso indica que a autenticação não está funcionando."
  echo "Verifique:"
  echo "  1. ANON_KEY e SERVICE_ROLE_KEY são JWTs válidos?"
  echo "  2. O admin foi criado corretamente?"
  echo "  3. O GoTrue está acessível?"
  exit 1
fi

echo -e "${GREEN}✓ Auth smoke gate passou${NC}"

# ==========================================
# STEP 5: Suite E2E Completa
# ==========================================
echo ""
echo -e "${YELLOW}[5/5] Executando suite E2E completa...${NC}"

docker compose run --rm e2e

if [ $? -ne 0 ]; then
  echo -e "${RED}E2E tests failed${NC}"
  exit 1
fi

# ==========================================
# SUCCESS
# ==========================================
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  ✓ RELEASE GATE PASSED${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Relatório HTML: ./e2e-artifacts/report/index.html"
echo "Resultados JSON: ./e2e-artifacts/results.json"
echo ""

exit 0

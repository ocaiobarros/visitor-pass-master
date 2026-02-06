#!/bin/bash
# ============================================
# Guarda Operacional - Release Gate Script
# ============================================
#
# Executa E2E tests e valida deploy.
# Exit code 0 = PASS, != 0 = FAIL
#
# Uso: ./release-gate.sh [--skip-build] [--keep-up]
# ============================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Diretório do script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

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

echo -e "${YELLOW}============================================${NC}"
echo -e "${YELLOW}  GUARDA OPERACIONAL - Release Gate${NC}"
echo -e "${YELLOW}============================================${NC}"
echo ""

# Função para coletar diagnósticos em caso de falha
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

  echo "→ Logs do visitor-pass..."
  if [ -f "/var/log/visitor-pass/app.log" ]; then
    tail -n 200 /var/log/visitor-pass/app.log > "$DIAG_DIR/visitor-pass-app.log" 2>&1 || true
  fi
  if [ -f "/var/log/visitor-pass/error.log" ]; then
    tail -n 200 /var/log/visitor-pass/error.log > "$DIAG_DIR/visitor-pass-error.log" 2>&1 || true
  fi

  echo ""
  echo -e "${RED}============================================${NC}"
  echo -e "${RED}  ❌ E2E TESTS FAILED${NC}"
  echo -e "${RED}============================================${NC}"
  echo ""
  echo "Diagnósticos salvos em: $DIAG_DIR"
  echo ""
  echo "Para investigar manualmente:"
  echo "  docker compose ps"
  echo "  docker compose logs kong | tail -100"
  echo "  docker compose logs auth | tail -100"
  echo "  docker compose logs admin-api | tail -100"
  echo "  tail -f /var/log/visitor-pass/app.log"
  echo ""
  echo "Artifacts de teste: ./e2e-artifacts/"
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

# Step 1: Build e Start
if [ "$SKIP_BUILD" = false ]; then
  echo -e "${YELLOW}[1/4] Building and starting stack...${NC}"
  
  # Preparar diretório de logs
  mkdir -p /var/log/visitor-pass
  chmod 775 /var/log/visitor-pass
  chown -R 1001:1001 /var/log/visitor-pass 2>/dev/null || true

  docker compose down 2>/dev/null || true
  docker compose up -d --build

  echo "→ Aguardando healthchecks (60s max)..."
  sleep 10
  
  # Aguardar todos ficarem healthy
  RETRIES=12
  while [ $RETRIES -gt 0 ]; do
    HEALTHY=$(docker compose ps --format json 2>/dev/null | grep -c '"healthy"' || echo "0")
    TOTAL=$(docker compose ps --format json 2>/dev/null | grep -c '"running"' || echo "0")
    
    if [ "$HEALTHY" -ge 5 ]; then
      echo -e "${GREEN}✓ Stack healthy ($HEALTHY containers)${NC}"
      break
    fi
    
    echo "  Aguardando... ($HEALTHY healthy, $RETRIES tentativas restantes)"
    sleep 5
    RETRIES=$((RETRIES - 1))
  done

  if [ $RETRIES -eq 0 ]; then
    echo -e "${RED}✗ Stack não ficou healthy a tempo${NC}"
    docker compose ps
    exit 1
  fi
else
  echo -e "${YELLOW}[1/4] Skipping build (--skip-build)${NC}"
fi

# Step 2: Verificar stack
echo ""
echo -e "${YELLOW}[2/4] Verificando stack...${NC}"
docker compose ps

# Step 3: Build E2E container
echo ""
echo -e "${YELLOW}[3/4] Building E2E test container...${NC}"
docker compose build e2e

# Step 4: Run E2E tests
echo ""
echo -e "${YELLOW}[4/4] Running E2E tests...${NC}"
echo ""

# Executar testes
docker compose run --rm e2e

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  ✓ E2E TESTS PASSED${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Relatório HTML: ./e2e-artifacts/report/index.html"
echo "Resultados JSON: ./e2e-artifacts/results.json"
echo ""

exit 0

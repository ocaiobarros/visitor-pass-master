#!/bin/bash
# ============================================
# Guarda Operacional - Gerador de Chaves JWT
# ============================================
#
# Este script gera ANON_KEY e SERVICE_ROLE_KEY como JWTs válidos.
# 
# Pré-requisito: ter JWT_SECRET definido no .env
#
# Uso:
#   1. Certifique-se de ter JWT_SECRET no .env
#   2. Execute: ./generate-keys.sh
#   3. Cole os valores gerados no seu .env
#
# ============================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${YELLOW}============================================${NC}"
echo -e "${YELLOW}  GUARDA OPERACIONAL - Gerador de Chaves${NC}"
echo -e "${YELLOW}============================================${NC}"
echo ""

# Verificar se .env existe
if [ ! -f ".env" ]; then
  echo -e "${RED}Erro: Arquivo .env não encontrado!${NC}"
  echo "Copie .env.example para .env antes de continuar."
  exit 1
fi

# Carregar JWT_SECRET do .env
source .env 2>/dev/null || true

if [ -z "$JWT_SECRET" ]; then
  echo -e "${RED}Erro: JWT_SECRET não está definido no .env!${NC}"
  echo ""
  echo "Gere um JWT_SECRET com:"
  echo "  openssl rand -base64 32"
  echo ""
  echo "E adicione ao .env antes de rodar este script."
  exit 1
fi

echo -e "${GREEN}✓ JWT_SECRET encontrado${NC}"
echo ""

# Verificar se temos Docker
if ! command -v docker &> /dev/null; then
  echo -e "${RED}Erro: Docker não encontrado!${NC}"
  echo "Este script precisa do Docker para gerar os JWTs."
  exit 1
fi

echo "Gerando chaves JWT..."
echo ""

# Gerar as chaves usando Docker + Node
KEYS=$(docker run --rm -e JWT_SECRET="$JWT_SECRET" node:20-alpine sh -c '
  npm install -s jsonwebtoken@9 2>/dev/null
  node -e "
    const jwt = require(\"jsonwebtoken\");
    const secret = process.env.JWT_SECRET;
    const anon = jwt.sign({ role: \"anon\", iss: \"supabase\" }, secret, { expiresIn: \"10y\" });
    const service = jwt.sign({ role: \"service_role\", iss: \"supabase\" }, secret, { expiresIn: \"10y\" });
    console.log(\"ANON_KEY=\" + anon);
    console.log(\"SERVICE_ROLE_KEY=\" + service);
  "
')

if [ -z "$KEYS" ]; then
  echo -e "${RED}Erro ao gerar chaves!${NC}"
  exit 1
fi

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Chaves geradas com sucesso!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Cole as linhas abaixo no seu .env:"
echo ""
echo -e "${YELLOW}$KEYS${NC}"
echo ""
echo "============================================"
echo ""
echo "Depois de atualizar o .env, reconstrua o stack:"
echo "  docker compose down"
echo "  docker compose up -d --build"
echo ""

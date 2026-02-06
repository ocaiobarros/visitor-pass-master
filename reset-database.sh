#!/bin/bash
# ============================================
# Guarda Operacional - Reset Completo do Banco
# ============================================
# 
# Este script apaga todos os dados e recria o banco do zero.
# USE COM CUIDADO - todos os dados serão perdidos!
#
# Uso: ./reset-database.sh
# ============================================

set -e

echo "============================================"
echo "  GUARDA OPERACIONAL - Reset do Banco"
echo "============================================"
echo ""
echo "⚠️  ATENÇÃO: Este script irá APAGAR TODOS OS DADOS!"
echo ""
read -p "Tem certeza que deseja continuar? (digite 'SIM' para confirmar): " confirm

if [ "$confirm" != "SIM" ]; then
    echo "Operação cancelada."
    exit 0
fi

echo ""
echo "→ Parando containers..."
docker compose down

echo "→ Removendo volume do PostgreSQL..."
docker volume rm visitor-pass-master_postgres_data 2>/dev/null || true

echo "→ Limpando cache do Docker (opcional)..."
docker system prune -f 2>/dev/null || true

echo "→ Reconstruindo e iniciando containers..."
docker compose up --build -d

echo ""
echo "→ Aguardando serviços iniciarem (30s)..."
sleep 30

echo ""
echo "============================================"
echo "  ✓ Reset concluído!"
echo "============================================"
echo ""
echo "Próximos passos:"
echo "  1. Acesse: http://$(grep HOST_IP .env 2>/dev/null | cut -d= -f2 || echo 'localhost')"
echo "  2. Vá para /install-wizard se aparecer"
echo "  3. Ou faça login com as credenciais do .env:"
echo "     Email: $(grep ADMIN_EMAIL .env 2>/dev/null | cut -d= -f2 || echo 'admin@sistema.local')"
echo "     Senha: $(grep ADMIN_PASSWORD .env 2>/dev/null | cut -d= -f2 || echo '(definida no .env)')"
echo ""
echo "Para ver logs: docker compose logs -f"
echo ""

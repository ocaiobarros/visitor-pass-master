#!/bin/bash
# ============================================
# GUARDA OPERACIONAL - Setup de Logs
# ============================================
# Execute este script no servidor para configurar
# o sistema de logs centralizado.
#
# Uso: sudo ./setup-logs.sh
# ============================================

set -e

LOG_DIR="/var/log/visitor-pass"
LOGROTATE_CONF="/etc/logrotate.d/visitor-pass"

echo "============================================"
echo "  GUARDA OPERACIONAL - Setup de Logs"
echo "============================================"

# 1. Criar diretório de logs
echo "→ Criando diretório de logs: $LOG_DIR"
mkdir -p "$LOG_DIR"
chmod 755 "$LOG_DIR"

# 2. Criar arquivos de log iniciais
echo "→ Criando arquivos de log..."
touch "$LOG_DIR/app.log"
touch "$LOG_DIR/error.log"
chmod 644 "$LOG_DIR/app.log" "$LOG_DIR/error.log"

# 3. Instalar configuração do logrotate
echo "→ Instalando configuração do logrotate..."
if [ -f "docker/logrotate-visitor-pass" ]; then
    cp docker/logrotate-visitor-pass "$LOGROTATE_CONF"
    chmod 644 "$LOGROTATE_CONF"
    echo "  ✓ Configuração instalada em $LOGROTATE_CONF"
else
    echo "  ⚠ Arquivo docker/logrotate-visitor-pass não encontrado"
    echo "  Criando configuração padrão..."
    cat > "$LOGROTATE_CONF" << 'EOF'
/var/log/visitor-pass/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 0644 root root
    sharedscripts
    postrotate
        docker kill --signal=HUP guarda-admin-api 2>/dev/null || true
    endscript
}
EOF
    chmod 644 "$LOGROTATE_CONF"
fi

# 4. Testar configuração do logrotate
echo "→ Testando configuração do logrotate..."
if logrotate -d "$LOGROTATE_CONF" 2>/dev/null; then
    echo "  ✓ Configuração válida"
else
    echo "  ⚠ Aviso: logrotate pode não estar instalado ou configuração inválida"
fi

# 5. Verificar permissões do Docker
echo "→ Verificando permissões para Docker..."
if [ -d "$LOG_DIR" ]; then
    # Garantir que o container pode escrever
    chmod 777 "$LOG_DIR" 2>/dev/null || true
    echo "  ✓ Permissões configuradas"
fi

echo ""
echo "============================================"
echo "  ✓ Setup concluído!"
echo "============================================"
echo ""
echo "Para monitorar logs em tempo real:"
echo "  tail -f $LOG_DIR/app.log"
echo ""
echo "Para ver apenas erros:"
echo "  tail -f $LOG_DIR/error.log"
echo ""
echo "Para testar o sistema de logs:"
echo "  curl http://localhost:8000/admin/v1/debug/log-test"
echo ""

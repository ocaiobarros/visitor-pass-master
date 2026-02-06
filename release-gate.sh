#!/bin/bash
# ============================================
# Guarda Operacional - Release Gate Wrapper
# ============================================
# Este script é um wrapper para o release-gate.sh em scripts/
# Mantido na raiz para compatibilidade.
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Executar o script principal
exec "$SCRIPT_DIR/scripts/release-gate.sh" "$@"

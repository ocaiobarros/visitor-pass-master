#!/bin/bash
# ============================================
# Guarda Operacional - Backup Automático
# ============================================
#
# USO:
#   ./backup.sh              # Backup normal
#   ./backup.sh --restore    # Listar backups disponíveis
#
# CRON (backup diário às 2h):
#   0 2 * * * /caminho/visitor-pass-master/backup.sh >> /var/log/guarda-backup.log 2>&1
#
# ============================================

set -e

# Configurações
BACKUP_DIR="${BACKUP_DIR:-/var/backups/guarda-operacional}"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=${RETENTION_DAYS:-30}
DB_CONTAINER="guarda-db"
DB_NAME="guarda_operacional"
DB_USER="postgres"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Criar diretório de backup se não existir
create_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        log_info "Criando diretório de backup: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
    fi
}

# Verificar se container está rodando
check_container() {
    if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
        log_error "Container $DB_CONTAINER não está rodando!"
        log_info "Execute: docker compose up -d"
        exit 1
    fi
}

# Executar backup
do_backup() {
    create_backup_dir
    check_container
    
    BACKUP_FILE="$BACKUP_DIR/backup_$DATE.sql"
    
    log_info "Iniciando backup do banco de dados..."
    log_info "Arquivo: $BACKUP_FILE"
    
    cd "$PROJECT_DIR"
    
    # Criar backup
    docker compose exec -T "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"
    
    if [ $? -eq 0 ] && [ -s "$BACKUP_FILE" ]; then
        # Comprimir
        log_info "Comprimindo backup..."
        gzip "$BACKUP_FILE"
        
        FINAL_FILE="${BACKUP_FILE}.gz"
        SIZE=$(du -h "$FINAL_FILE" | cut -f1)
        
        log_info "✅ Backup concluído com sucesso!"
        log_info "Arquivo: $FINAL_FILE"
        log_info "Tamanho: $SIZE"
        
        # Limpar backups antigos
        cleanup_old_backups
    else
        log_error "Falha ao criar backup!"
        rm -f "$BACKUP_FILE"
        exit 1
    fi
}

# Limpar backups antigos
cleanup_old_backups() {
    log_info "Removendo backups com mais de $RETENTION_DAYS dias..."
    
    DELETED=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
    
    if [ "$DELETED" -gt 0 ]; then
        log_info "Removidos $DELETED backups antigos"
    fi
}

# Listar backups disponíveis
list_backups() {
    log_info "Backups disponíveis em $BACKUP_DIR:"
    echo ""
    
    if [ -d "$BACKUP_DIR" ]; then
        ls -lh "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null || log_warn "Nenhum backup encontrado"
    else
        log_warn "Diretório de backup não existe"
    fi
    
    echo ""
    log_info "Para restaurar, use:"
    echo "  gunzip -c ARQUIVO.sql.gz | docker compose exec -T guarda-db psql -U postgres guarda_operacional"
}

# Main
case "${1:-}" in
    --restore|--list|-l)
        list_backups
        ;;
    --help|-h)
        echo "Uso: $0 [opção]"
        echo ""
        echo "Opções:"
        echo "  (nenhuma)    Executar backup"
        echo "  --list, -l   Listar backups disponíveis"
        echo "  --help, -h   Mostrar esta ajuda"
        echo ""
        echo "Variáveis de ambiente:"
        echo "  BACKUP_DIR       Diretório de backup (padrão: /var/backups/guarda-operacional)"
        echo "  RETENTION_DAYS   Dias para manter backups (padrão: 30)"
        ;;
    *)
        do_backup
        ;;
esac

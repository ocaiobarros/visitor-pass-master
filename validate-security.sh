#!/bin/bash
# ============================================
# Guarda Operacional - Validação de Segurança
# ============================================
#
# Execute após deploy para validar hardening.
# Saída: PASS/FAIL para cada check + relatório.
#
# USO:
#   chmod +x validate-security.sh
#   ./validate-security.sh
#   ./validate-security.sh --full  # inclui teste de restore
#
# ============================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASS_COUNT++))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAIL_COUNT++))
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARN_COUNT++))
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

header() {
    echo ""
    echo "============================================"
    echo " $1"
    echo "============================================"
}

# ==========================================
# 1. Superfície de Rede
# ==========================================
check_network_surface() {
    header "1. SUPERFÍCIE DE REDE"
    
    log_info "Portas em escuta (ss -tulpn):"
    ss -tulpn 2>/dev/null | grep LISTEN || true
    echo ""
    
    # Verificar portas proibidas
    FORBIDDEN_PORTS="5432 3000 9999 8000 8080 8081 1433"
    
    for port in $FORBIDDEN_PORTS; do
        if ss -tulpn 2>/dev/null | grep -q ":$port "; then
            log_fail "Porta $port está exposta! Deve estar apenas interna."
        else
            log_pass "Porta $port não exposta"
        fi
    done
    
    # Verificar portas permitidas
    REQUIRED_PORTS="80 443"
    for port in $REQUIRED_PORTS; do
        if ss -tulpn 2>/dev/null | grep -q ":$port "; then
            log_pass "Porta $port está ativa (esperado)"
        else
            log_warn "Porta $port não encontrada"
        fi
    done
}

# ==========================================
# 2. Docker Containers
# ==========================================
check_docker_containers() {
    header "2. CONTAINERS DOCKER"
    
    log_info "Containers e portas publicadas:"
    docker ps --format 'table {{.Names}}\t{{.Ports}}' 2>/dev/null || {
        log_warn "Docker não disponível ou sem containers"
        return
    }
    echo ""
    
    # Verificar se portas internas estão publicadas
    INTERNAL_CONTAINERS="guarda-db guarda-api guarda-auth"
    
    for container in $INTERNAL_CONTAINERS; do
        PORTS=$(docker inspect "$container" --format '{{json .HostConfig.PortBindings}}' 2>/dev/null || echo "{}")
        if [ "$PORTS" = "{}" ] || [ "$PORTS" = "null" ]; then
            log_pass "$container: sem portas publicadas"
        else
            log_fail "$container: tem portas publicadas: $PORTS"
        fi
    done
    
    # Verificar read_only
    log_info "Verificando read_only filesystem:"
    for container in $(docker ps -q 2>/dev/null); do
        NAME=$(docker inspect "$container" --format '{{.Name}}' | tr -d '/')
        READONLY=$(docker inspect "$container" --format '{{.HostConfig.ReadonlyRootfs}}' 2>/dev/null)
        if [ "$READONLY" = "true" ]; then
            log_pass "$NAME: filesystem read_only"
        else
            log_warn "$NAME: filesystem NOT read_only (verifique se precisa escrever)"
        fi
    done
    
    # Verificar no-new-privileges
    log_info "Verificando no-new-privileges:"
    for container in $(docker ps -q 2>/dev/null); do
        NAME=$(docker inspect "$container" --format '{{.Name}}' | tr -d '/')
        SECOPT=$(docker inspect "$container" --format '{{.HostConfig.SecurityOpt}}' 2>/dev/null)
        if echo "$SECOPT" | grep -q "no-new-privileges"; then
            log_pass "$NAME: no-new-privileges ativo"
        else
            log_warn "$NAME: no-new-privileges não encontrado"
        fi
    done
}

# ==========================================
# 3. Firewall (UFW)
# ==========================================
check_firewall() {
    header "3. FIREWALL (UFW)"
    
    if command -v ufw &> /dev/null; then
        log_info "Status do UFW:"
        ufw status verbose 2>/dev/null || log_warn "Não foi possível obter status do UFW"
        echo ""
        
        # Verificar se está ativo
        if ufw status 2>/dev/null | grep -q "Status: active"; then
            log_pass "UFW está ativo"
        else
            log_fail "UFW não está ativo!"
        fi
        
        # Verificar regras de deny
        if ufw status 2>/dev/null | grep -q "8000.*DENY"; then
            log_pass "Porta 8000 bloqueada"
        else
            log_warn "Porta 8000 não tem regra DENY explícita"
        fi
    else
        log_warn "UFW não instalado"
    fi
}

# ==========================================
# 4. Headers de Segurança HTTP
# ==========================================
check_http_headers() {
    header "4. HEADERS DE SEGURANÇA HTTP"
    
    HOST="${1:-localhost}"
    
    log_info "Verificando headers em http://$HOST"
    HEADERS=$(curl -sI "http://$HOST" 2>/dev/null || echo "")
    
    if [ -z "$HEADERS" ]; then
        log_fail "Não foi possível conectar a http://$HOST"
        return
    fi
    
    echo "$HEADERS" | head -20
    echo ""
    
    # Verificar headers obrigatórios
    REQUIRED_HEADERS="X-Frame-Options X-Content-Type-Options X-XSS-Protection Referrer-Policy"
    
    for h in $REQUIRED_HEADERS; do
        if echo "$HEADERS" | grep -qi "$h"; then
            log_pass "Header $h presente"
        else
            log_fail "Header $h AUSENTE"
        fi
    done
    
    # HTTPS específico
    if curl -sI "https://$HOST" 2>/dev/null | grep -qi "Strict-Transport-Security"; then
        log_pass "HSTS ativo"
    else
        log_warn "HSTS não encontrado (ok se não usa HTTPS)"
    fi
}

# ==========================================
# 5. Rate Limiting
# ==========================================
check_rate_limiting() {
    header "5. RATE LIMITING"
    
    HOST="${1:-localhost}"
    AUTH_ENDPOINT="http://$HOST:8000/auth/v1/token"
    
    log_info "Testando rate limit em $AUTH_ENDPOINT (15 requests)..."
    
    GOT_429=false
    for i in {1..15}; do
        CODE=$(curl -s -o /dev/null -w "%{http_code}" "$AUTH_ENDPOINT" 2>/dev/null || echo "000")
        if [ "$CODE" = "429" ]; then
            GOT_429=true
            break
        fi
        echo -n "."
    done
    echo ""
    
    if [ "$GOT_429" = true ]; then
        log_pass "Rate limiting funcionando (recebeu 429)"
    else
        log_warn "Rate limiting não disparou em 15 requests (pode estar ok dependendo do limite)"
    fi
}

# ==========================================
# 6. Segredos e Permissões
# ==========================================
check_secrets() {
    header "6. SEGREDOS E PERMISSÕES"
    
    # Verificar .env
    if [ -f ".env" ]; then
        PERMS=$(stat -c "%a" .env 2>/dev/null || stat -f "%OLp" .env 2>/dev/null)
        if [ "$PERMS" = "600" ]; then
            log_pass ".env tem permissão 600"
        else
            log_fail ".env tem permissão $PERMS (deveria ser 600)"
        fi
        
        OWNER=$(stat -c "%U" .env 2>/dev/null || stat -f "%Su" .env 2>/dev/null)
        log_info ".env pertence a: $OWNER"
    else
        log_warn ".env não encontrado no diretório atual"
    fi
    
    # Verificar se há senhas no git
    if git rev-parse --is-inside-work-tree &>/dev/null; then
        if git ls-files | xargs grep -l "password\s*=" 2>/dev/null | grep -v ".example" | grep -v ".md"; then
            log_fail "Possíveis senhas encontradas em arquivos versionados!"
        else
            log_pass "Nenhuma senha encontrada em arquivos versionados"
        fi
    fi
    
    # Verificar :latest
    if grep -r ":latest" docker-compose.yml 2>/dev/null; then
        log_fail "Encontrado ':latest' no docker-compose.yml - use versão fixa!"
    else
        log_pass "Nenhum ':latest' no docker-compose.yml"
    fi
}

# ==========================================
# 7. Backups
# ==========================================
check_backups() {
    header "7. BACKUPS"
    
    BACKUP_DIR="${BACKUP_DIR:-/var/backups/guarda-operacional}"
    
    if [ -d "$BACKUP_DIR" ]; then
        log_pass "Diretório de backup existe: $BACKUP_DIR"
        
        BACKUP_COUNT=$(find "$BACKUP_DIR" -name "*.sql.gz" 2>/dev/null | wc -l)
        log_info "Backups encontrados: $BACKUP_COUNT"
        
        if [ "$BACKUP_COUNT" -gt 0 ]; then
            LATEST=$(ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -1)
            log_info "Backup mais recente: $LATEST"
            
            # Verificar idade
            if [ -n "$LATEST" ]; then
                AGE_DAYS=$(( ($(date +%s) - $(stat -c %Y "$LATEST" 2>/dev/null || stat -f %m "$LATEST" 2>/dev/null)) / 86400 ))
                if [ "$AGE_DAYS" -lt 2 ]; then
                    log_pass "Backup recente (< 2 dias)"
                else
                    log_warn "Backup com $AGE_DAYS dias - verifique o cron"
                fi
            fi
        else
            log_warn "Nenhum backup encontrado - execute ./backup.sh"
        fi
    else
        log_fail "Diretório de backup não existe: $BACKUP_DIR"
    fi
    
    # Verificar cron
    if crontab -l 2>/dev/null | grep -q "backup"; then
        log_pass "Cron de backup configurado"
    else
        log_warn "Cron de backup não encontrado"
    fi
}

# ==========================================
# 8. Teste de Restore (opcional)
# ==========================================
test_restore() {
    header "8. TESTE DE RESTORE"
    
    BACKUP_DIR="${BACKUP_DIR:-/var/backups/guarda-operacional}"
    LATEST=$(ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -1)
    
    if [ -z "$LATEST" ]; then
        log_fail "Nenhum backup para testar restore"
        return
    fi
    
    log_info "Testando restore de: $LATEST"
    
    # Criar container temporário para teste
    TEST_CONTAINER="guarda-restore-test-$$"
    
    log_info "Criando container de teste..."
    docker run -d --name "$TEST_CONTAINER" \
        -e POSTGRES_PASSWORD=testpass \
        postgres:15-alpine >/dev/null 2>&1
    
    sleep 5  # Aguardar inicialização
    
    log_info "Restaurando backup..."
    if gunzip -c "$LATEST" | docker exec -i "$TEST_CONTAINER" psql -U postgres -d postgres >/dev/null 2>&1; then
        log_pass "Restore executado com sucesso!"
        
        # Verificar tabelas
        TABLES=$(docker exec "$TEST_CONTAINER" psql -U postgres -d postgres -c "\dt" 2>/dev/null | grep -c "table" || echo "0")
        log_info "Tabelas restauradas: $TABLES"
    else
        log_fail "Restore falhou!"
    fi
    
    # Limpar
    log_info "Removendo container de teste..."
    docker rm -f "$TEST_CONTAINER" >/dev/null 2>&1
}

# ==========================================
# 9. SSH
# ==========================================
check_ssh() {
    header "9. CONFIGURAÇÃO SSH"
    
    if [ -f /etc/ssh/sshd_config ]; then
        ROOT_LOGIN=$(grep -E "^PermitRootLogin" /etc/ssh/sshd_config 2>/dev/null | awk '{print $2}')
        if [ "$ROOT_LOGIN" = "no" ]; then
            log_pass "PermitRootLogin = no"
        else
            log_warn "PermitRootLogin = $ROOT_LOGIN (recomendado: no)"
        fi
        
        PASS_AUTH=$(grep -E "^PasswordAuthentication" /etc/ssh/sshd_config 2>/dev/null | awk '{print $2}')
        if [ "$PASS_AUTH" = "no" ]; then
            log_pass "PasswordAuthentication = no (usa chave)"
        else
            log_warn "PasswordAuthentication = $PASS_AUTH (recomendado: no)"
        fi
    else
        log_warn "sshd_config não encontrado"
    fi
}

# ==========================================
# 10. Docker Daemon
# ==========================================
check_docker_daemon() {
    header "10. DOCKER DAEMON"
    
    if [ -f /etc/docker/daemon.json ]; then
        log_pass "daemon.json existe"
        
        if grep -q "max-size" /etc/docker/daemon.json; then
            log_pass "Log rotation configurado"
        else
            log_warn "Log rotation não configurado"
        fi
    else
        log_warn "daemon.json não existe - logs podem crescer indefinidamente"
    fi
}

# ==========================================
# RELATÓRIO FINAL
# ==========================================
print_report() {
    header "RELATÓRIO FINAL"
    
    echo ""
    echo -e "${GREEN}PASS: $PASS_COUNT${NC}"
    echo -e "${RED}FAIL: $FAIL_COUNT${NC}"
    echo -e "${YELLOW}WARN: $WARN_COUNT${NC}"
    echo ""
    
    if [ "$FAIL_COUNT" -eq 0 ]; then
        echo -e "${GREEN}✅ Hardening validado - nenhuma falha crítica${NC}"
        exit 0
    else
        echo -e "${RED}❌ Hardening incompleto - corrija os FAILs acima${NC}"
        exit 1
    fi
}

# ==========================================
# MAIN
# ==========================================
main() {
    echo ""
    echo "============================================"
    echo " GUARDA OPERACIONAL - VALIDAÇÃO DE SEGURANÇA"
    echo " $(date)"
    echo "============================================"
    
    HOST="${2:-localhost}"
    
    check_network_surface
    check_docker_containers
    check_firewall
    check_http_headers "$HOST"
    check_rate_limiting "$HOST"
    check_secrets
    check_backups
    check_ssh
    check_docker_daemon
    
    # Teste de restore opcional
    if [ "$1" = "--full" ]; then
        test_restore
    else
        log_info "Use --full para incluir teste de restore"
    fi
    
    print_report
}

main "$@"

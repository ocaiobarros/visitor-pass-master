#!/bin/bash
# ============================================
# Guarda Operacional - Validação de Segurança
# ============================================
#
# Script de validação com exit codes para CI/monitoramento.
# FALHA (exit 1) em qualquer item crítico.
#
# USO:
#   ./validate-security.sh              # Normal
#   ./validate-security.sh --full       # Inclui teste de restore
#   ./validate-security.sh --json       # Saída JSON para Zabbix/Grafana
#   ./validate-security.sh --ci         # Exit 1 em qualquer FAIL
#
# CRON (validação diária):
#   0 6 * * * /opt/guarda/validate-security.sh >> /var/log/guarda/validation.log 2>&1
#
# ============================================

set -euo pipefail

# ==========================================
# CONFIGURAÇÃO
# ==========================================
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST="${VALIDATE_HOST:-localhost}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/guarda-operacional}"
LOG_FILE="${LOG_FILE:-/var/log/guarda/validation-$(date +%Y%m%d-%H%M%S).log}"

# Portas que DEVEM estar expostas
ALLOWED_PORTS="22 80 443"

# Portas que NÃO PODEM estar expostas (internas)
FORBIDDEN_PORTS="5432 3000 9999 8000 8080 8081 1433 27017"

# Containers que NÃO podem ter portas publicadas
INTERNAL_CONTAINERS="guarda-db guarda-api guarda-auth"

# Headers obrigatórios
REQUIRED_HEADERS="X-Frame-Options X-Content-Type-Options X-XSS-Protection Referrer-Policy"

# ==========================================
# VARIÁVEIS GLOBAIS
# ==========================================
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
CRITICAL_FAIL=false
JSON_OUTPUT=false
FULL_MODE=false
CI_MODE=false
declare -a RESULTS=()

# Cores (desabilitadas se não for TTY)
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    BOLD='\033[1m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' BOLD='' NC=''
fi

# ==========================================
# FUNÇÕES DE LOG
# ==========================================
log_pass() {
    local check="$1"
    local detail="${2:-}"
    echo -e "${GREEN}[PASS]${NC} $check ${detail:+($detail)}"
    ((PASS_COUNT++))
    RESULTS+=("{\"check\":\"$check\",\"status\":\"PASS\",\"detail\":\"$detail\"}")
}

log_fail() {
    local check="$1"
    local detail="${2:-}"
    local critical="${3:-false}"
    echo -e "${RED}[FAIL]${NC} $check ${detail:+($detail)}"
    ((FAIL_COUNT++))
    RESULTS+=("{\"check\":\"$check\",\"status\":\"FAIL\",\"detail\":\"$detail\",\"critical\":$critical}")
    if [ "$critical" = "true" ]; then
        CRITICAL_FAIL=true
    fi
}

log_warn() {
    local check="$1"
    local detail="${2:-}"
    echo -e "${YELLOW}[WARN]${NC} $check ${detail:+($detail)}"
    ((WARN_COUNT++))
    RESULTS+=("{\"check\":\"$check\",\"status\":\"WARN\",\"detail\":\"$detail\"}")
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

header() {
    echo ""
    echo -e "${BOLD}============================================${NC}"
    echo -e "${BOLD} $1${NC}"
    echo -e "${BOLD}============================================${NC}"
}

# ==========================================
# 1. SUPERFÍCIE DE REDE
# ==========================================
check_network_surface() {
    header "1. SUPERFÍCIE DE REDE"
    
    local listening_ports
    listening_ports=$(ss -tulpn 2>/dev/null | grep LISTEN || true)
    
    log_info "Portas em escuta:"
    echo "$listening_ports" | head -20
    echo ""
    
    # Verificar portas proibidas (CRÍTICO)
    for port in $FORBIDDEN_PORTS; do
        if echo "$listening_ports" | grep -qE ":${port}\s"; then
            log_fail "Porta $port exposta" "Deve estar apenas interna" true
        else
            log_pass "Porta $port não exposta"
        fi
    done
    
    # Verificar portas permitidas
    for port in $ALLOWED_PORTS; do
        if echo "$listening_ports" | grep -qE ":${port}\s"; then
            log_pass "Porta $port ativa" "esperado"
        else
            log_warn "Porta $port não encontrada"
        fi
    done
}

# ==========================================
# 2. DOCKER CONTAINERS
# ==========================================
check_docker_containers() {
    header "2. CONTAINERS DOCKER"
    
    if ! command -v docker &>/dev/null; then
        log_warn "Docker não instalado"
        return
    fi
    
    if ! docker ps &>/dev/null; then
        log_warn "Docker não acessível"
        return
    fi
    
    log_info "Containers e portas:"
    docker ps --format 'table {{.Names}}\t{{.Ports}}' 2>/dev/null || true
    echo ""
    
    # Verificar containers internos (CRÍTICO)
    for container in $INTERNAL_CONTAINERS; do
        if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${container}$"; then
            log_warn "$container não está rodando"
            continue
        fi
        
        local ports
        ports=$(docker inspect "$container" --format '{{json .HostConfig.PortBindings}}' 2>/dev/null || echo "{}")
        
        if [ "$ports" = "{}" ] || [ "$ports" = "null" ]; then
            log_pass "$container sem portas publicadas"
        else
            # Verificar se é 0.0.0.0 ou 127.0.0.1
            if echo "$ports" | grep -q '"HostIp":"0.0.0.0"'; then
                log_fail "$container exposto em 0.0.0.0" "$ports" true
            elif echo "$ports" | grep -q '"HostIp":"127.0.0.1"'; then
                log_pass "$container exposto apenas em localhost" "$ports"
            else
                log_fail "$container tem portas publicadas" "$ports" true
            fi
        fi
    done
    
    # Verificar security options
    log_info "Verificando no-new-privileges:"
    for container in $(docker ps -q 2>/dev/null); do
        local name secopt
        name=$(docker inspect "$container" --format '{{.Name}}' 2>/dev/null | tr -d '/')
        secopt=$(docker inspect "$container" --format '{{.HostConfig.SecurityOpt}}' 2>/dev/null || echo "[]")
        
        if echo "$secopt" | grep -q "no-new-privileges"; then
            log_pass "$name: no-new-privileges"
        else
            log_warn "$name: sem no-new-privileges"
        fi
    done
}

# ==========================================
# 3. DOCKER NAT BYPASS (CRÍTICO)
# ==========================================
check_docker_nat() {
    header "3. DOCKER NAT/FIREWALL BYPASS"
    
    log_info "Verificando regras DNAT do Docker..."
    
    local dnat_rules=""
    
    # Tentar iptables primeiro
    if command -v iptables &>/dev/null; then
        dnat_rules=$(iptables -t nat -L DOCKER -n 2>/dev/null | grep DNAT || true)
    fi
    
    # Tentar nftables se iptables não disponível
    if [ -z "$dnat_rules" ] && command -v nft &>/dev/null; then
        dnat_rules=$(nft list ruleset 2>/dev/null | grep -E "dnat to.*:(5432|3000|9999|8000|8080|1433)" || true)
    fi
    
    if [ -z "$dnat_rules" ]; then
        log_pass "Nenhum DNAT para portas internas"
    else
        echo "$dnat_rules"
        
        # Verificar cada porta proibida
        for port in $FORBIDDEN_PORTS; do
            if echo "$dnat_rules" | grep -qE ":${port}\b"; then
                log_fail "DNAT encontrado para porta $port" "Docker bypass firewall!" true
            fi
        done
        
        # Verificar portas permitidas
        local allowed_dnat=true
        if echo "$dnat_rules" | grep -qE ":(80|443)\b"; then
            log_pass "DNAT para 80/443 é esperado"
        fi
    fi
    
    # Verificar se Docker está configurado para não mexer no firewall
    if [ -f /etc/docker/daemon.json ]; then
        if grep -q '"iptables": false' /etc/docker/daemon.json; then
            log_pass "Docker configurado com iptables: false"
        else
            log_info "Docker gerencia iptables (normal, mas monitore)"
        fi
    fi
}

# ==========================================
# 4. FIREWALL UFW
# ==========================================
check_firewall() {
    header "4. FIREWALL (UFW)"
    
    if ! command -v ufw &>/dev/null; then
        log_warn "UFW não instalado"
        return
    fi
    
    local ufw_status
    ufw_status=$(ufw status verbose 2>/dev/null || echo "")
    
    if echo "$ufw_status" | grep -q "Status: active"; then
        log_pass "UFW ativo"
    else
        log_fail "UFW não está ativo" "" true
        return
    fi
    
    echo "$ufw_status" | head -20
    echo ""
    
    # Verificar default deny
    if echo "$ufw_status" | grep -q "Default: deny (incoming)"; then
        log_pass "Default deny incoming"
    else
        log_fail "Default não é deny incoming" "" true
    fi
}

# ==========================================
# 5. HEADERS HTTP
# ==========================================
check_http_headers() {
    header "5. HEADERS DE SEGURANÇA HTTP"
    
    local headers
    headers=$(curl -sI "http://$HOST" 2>/dev/null || echo "")
    
    if [ -z "$headers" ]; then
        log_fail "Não foi possível conectar a http://$HOST" "" true
        return
    fi
    
    echo "$headers" | head -15
    echo ""
    
    # Verificar headers obrigatórios
    for h in $REQUIRED_HEADERS; do
        if echo "$headers" | grep -qi "^$h:"; then
            local value
            value=$(echo "$headers" | grep -i "^$h:" | head -1 | cut -d: -f2- | tr -d '\r')
            log_pass "Header $h presente" "$value"
        else
            log_fail "Header $h AUSENTE" "" true
        fi
    done
    
    # Verificar Content-Security-Policy
    if echo "$headers" | grep -qi "^Content-Security-Policy:"; then
        local csp
        csp=$(echo "$headers" | grep -i "^Content-Security-Policy:" | head -1)
        
        if echo "$csp" | grep -q "unsafe-eval"; then
            log_warn "CSP contém unsafe-eval" "Risco de XSS"
        else
            log_pass "CSP sem unsafe-eval"
        fi
        
        if echo "$csp" | grep -q "default-src"; then
            log_pass "CSP tem default-src"
        else
            log_warn "CSP sem default-src"
        fi
    else
        log_warn "Content-Security-Policy ausente"
    fi
    
    # Verificar server_tokens off (nginx não deve revelar versão)
    if echo "$headers" | grep -qi "^Server:.*nginx/"; then
        log_fail "Nginx revelando versão" "Adicione server_tokens off"
    elif echo "$headers" | grep -qi "^Server:.*nginx"; then
        log_pass "server_tokens off ativo"
    fi
    
    # HTTPS específico
    local https_headers
    https_headers=$(curl -sI "https://$HOST" 2>/dev/null || echo "")
    
    if [ -n "$https_headers" ]; then
        if echo "$https_headers" | grep -qi "Strict-Transport-Security"; then
            log_pass "HSTS ativo"
        else
            log_warn "HSTS não encontrado em HTTPS"
        fi
    else
        log_info "HTTPS não disponível (ok para rede interna)"
    fi
}

# ==========================================
# 6. RATE LIMITING
# ==========================================
check_rate_limiting() {
    header "6. RATE LIMITING"
    
    local endpoint="http://$HOST:8000/auth/v1/token"
    
    log_info "Testando rate limit em $endpoint..."
    
    local got_429=false
    local codes=""
    
    for i in {1..20}; do
        local code
        code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$endpoint" 2>/dev/null || echo "000")
        codes="$codes $code"
        
        if [ "$code" = "429" ]; then
            got_429=true
            log_pass "Rate limiting funcionando" "429 após $i requests"
            break
        fi
    done
    
    if [ "$got_429" = false ]; then
        log_warn "Rate limiting não disparou em 20 requests" "Códigos: $codes"
    fi
}

# ==========================================
# 7. SEGREDOS E PERMISSÕES
# ==========================================
check_secrets() {
    header "7. SEGREDOS E PERMISSÕES"
    
    # Verificar .env (CRÍTICO)
    if [ -f "$SCRIPT_DIR/.env" ]; then
        local perms
        perms=$(stat -c "%a" "$SCRIPT_DIR/.env" 2>/dev/null || stat -f "%OLp" "$SCRIPT_DIR/.env" 2>/dev/null || echo "unknown")
        
        if [ "$perms" = "600" ]; then
            log_pass ".env tem permissão 600"
        else
            log_fail ".env tem permissão $perms" "Deveria ser 600" true
        fi
        
        local owner
        owner=$(stat -c "%U:%G" "$SCRIPT_DIR/.env" 2>/dev/null || stat -f "%Su:%Sg" "$SCRIPT_DIR/.env" 2>/dev/null || echo "unknown")
        log_info ".env pertence a: $owner"
    else
        log_warn ".env não encontrado em $SCRIPT_DIR"
    fi
    
    # Verificar senhas no git (CRÍTICO)
    if git -C "$SCRIPT_DIR" rev-parse --is-inside-work-tree &>/dev/null; then
        local leaked_files
        leaked_files=$(git -C "$SCRIPT_DIR" ls-files 2>/dev/null | xargs grep -l -E "(password|secret|api_key)\s*[:=]" 2>/dev/null | grep -vE "\.(example|md|sh)$" || true)
        
        if [ -n "$leaked_files" ]; then
            log_fail "Possíveis secrets em arquivos versionados" "$leaked_files" true
        else
            log_pass "Nenhum secret encontrado em arquivos versionados"
        fi
    fi
    
    # Verificar :latest (CRÍTICO)
    if grep -qE "image:.*:latest" "$SCRIPT_DIR/docker-compose.yml" 2>/dev/null; then
        log_fail ":latest encontrado no docker-compose.yml" "Use versões fixas" true
    else
        log_pass "Nenhum :latest no docker-compose.yml"
    fi
}

# ==========================================
# 8. BACKUPS
# ==========================================
check_backups() {
    header "8. BACKUPS"
    
    if [ ! -d "$BACKUP_DIR" ]; then
        log_fail "Diretório de backup não existe" "$BACKUP_DIR" true
        return
    fi
    
    log_pass "Diretório de backup existe"
    
    local backup_count
    backup_count=$(find "$BACKUP_DIR" -name "*.sql.gz" 2>/dev/null | wc -l)
    log_info "Backups encontrados: $backup_count"
    
    if [ "$backup_count" -eq 0 ]; then
        log_fail "Nenhum backup encontrado" "" true
        return
    fi
    
    local latest
    latest=$(ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -1)
    log_info "Backup mais recente: $(basename "$latest")"
    
    # Verificar idade
    local age_hours
    age_hours=$(( ($(date +%s) - $(stat -c %Y "$latest" 2>/dev/null || stat -f %m "$latest" 2>/dev/null)) / 3600 ))
    
    if [ "$age_hours" -lt 48 ]; then
        log_pass "Backup recente" "< 48h"
    else
        log_fail "Backup com ${age_hours}h" "Deveria ser < 48h"
    fi
    
    # Verificar cron
    if crontab -l 2>/dev/null | grep -q "backup"; then
        log_pass "Cron de backup configurado"
    else
        log_warn "Cron de backup não encontrado"
    fi
}

# ==========================================
# 9. TESTE DE RESTORE (opcional)
# ==========================================
test_restore() {
    header "9. TESTE DE RESTORE"
    
    local latest
    latest=$(ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -1)
    
    if [ -z "$latest" ]; then
        log_fail "Nenhum backup para testar restore"
        return
    fi
    
    log_info "Testando restore de: $(basename "$latest")"
    
    local test_container="guarda-restore-test-$$"
    
    # Criar container temporário
    if docker run -d --name "$test_container" -e POSTGRES_PASSWORD=testpass postgres:15-alpine >/dev/null 2>&1; then
        sleep 8  # Aguardar inicialização
        
        if gunzip -c "$latest" | docker exec -i "$test_container" psql -U postgres -d postgres >/dev/null 2>&1; then
            local tables
            tables=$(docker exec "$test_container" psql -U postgres -d postgres -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'" 2>/dev/null | tr -d ' ')
            
            log_pass "Restore executado com sucesso" "$tables tabelas"
            log_info "Restore testado em: $(date '+%Y-%m-%d %H:%M:%S')"
        else
            log_fail "Restore falhou"
        fi
        
        docker rm -f "$test_container" >/dev/null 2>&1
    else
        log_warn "Não foi possível criar container de teste"
    fi
}

# ==========================================
# 10. SSH
# ==========================================
check_ssh() {
    header "10. CONFIGURAÇÃO SSH"
    
    if [ ! -f /etc/ssh/sshd_config ]; then
        log_warn "sshd_config não encontrado"
        return
    fi
    
    # PermitRootLogin (CRÍTICO)
    local root_login
    root_login=$(grep -E "^PermitRootLogin" /etc/ssh/sshd_config 2>/dev/null | awk '{print $2}' || echo "not set")
    
    if [ "$root_login" = "no" ]; then
        log_pass "PermitRootLogin = no"
    else
        log_fail "PermitRootLogin = $root_login" "Deveria ser 'no'" true
    fi
    
    # PasswordAuthentication (CRÍTICO)
    local pass_auth
    pass_auth=$(grep -E "^PasswordAuthentication" /etc/ssh/sshd_config 2>/dev/null | awk '{print $2}' || echo "not set")
    
    if [ "$pass_auth" = "no" ]; then
        log_pass "PasswordAuthentication = no"
    else
        log_warn "PasswordAuthentication = $pass_auth" "Recomendado: no"
    fi
}

# ==========================================
# 11. DOCKER DAEMON
# ==========================================
check_docker_daemon() {
    header "11. DOCKER DAEMON"
    
    if [ -f /etc/docker/daemon.json ]; then
        log_pass "daemon.json existe"
        
        if grep -q '"max-size"' /etc/docker/daemon.json; then
            log_pass "Log rotation configurado"
        else
            log_fail "Log rotation não configurado" "Disco pode encher" true
        fi
        
        if grep -q '"no-new-privileges"' /etc/docker/daemon.json; then
            log_pass "no-new-privileges global"
        fi
    else
        log_fail "daemon.json não existe" "Logs crescem indefinidamente" true
    fi
}

# ==========================================
# RELATÓRIO FINAL
# ==========================================
print_report() {
    header "RELATÓRIO FINAL"
    
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo ""
    echo -e "Timestamp: $timestamp"
    echo -e "Host: $HOST"
    echo ""
    echo -e "${GREEN}PASS: $PASS_COUNT${NC}"
    echo -e "${RED}FAIL: $FAIL_COUNT${NC}"
    echo -e "${YELLOW}WARN: $WARN_COUNT${NC}"
    echo ""
    
    # Resumo por categoria
    echo "============================================"
    echo " RESUMO POR CATEGORIA"
    echo "============================================"
    echo ""
    
    if [ "$CRITICAL_FAIL" = true ]; then
        echo -e "${RED}Surface: FAIL (portas internas expostas)${NC}"
    else
        echo -e "${GREEN}Surface: PASS (22/80/443 only)${NC}"
    fi
    
    # Gerar hash de evidência
    local evidence_hash
    evidence_hash=$(echo "$timestamp|PASS:$PASS_COUNT|FAIL:$FAIL_COUNT|WARN:$WARN_COUNT|HOST:$HOST" | sha256sum | cut -d' ' -f1)
    
    echo ""
    echo "============================================"
    echo " HASH DE EVIDÊNCIA (AUDITORIA)"
    echo "============================================"
    echo "SHA256: $evidence_hash"
    echo "Timestamp: $timestamp"
    echo ""
    
    # Decisão final
    if [ "$CRITICAL_FAIL" = true ]; then
        echo -e "${RED}❌ HARDENING INCOMPLETO - FALHAS CRÍTICAS DETECTADAS${NC}"
        echo ""
        echo "Corrija os itens marcados como [FAIL] (critical) antes de ir para produção."
        return 1
    elif [ "$FAIL_COUNT" -gt 0 ]; then
        echo -e "${YELLOW}⚠️ HARDENING PARCIAL - ALGUMAS FALHAS DETECTADAS${NC}"
        return 1
    else
        echo -e "${GREEN}✅ HARDENING VALIDADO - NENHUMA FALHA CRÍTICA${NC}"
        return 0
    fi
}

# ==========================================
# OUTPUT JSON
# ==========================================
print_json() {
    local timestamp
    timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
    
    local evidence_hash
    evidence_hash=$(echo "$timestamp|PASS:$PASS_COUNT|FAIL:$FAIL_COUNT|WARN:$WARN_COUNT|HOST:$HOST" | sha256sum | cut -d' ' -f1)
    
    echo "{"
    echo "  \"timestamp\": \"$timestamp\","
    echo "  \"host\": \"$HOST\","
    echo "  \"summary\": {"
    echo "    \"pass\": $PASS_COUNT,"
    echo "    \"fail\": $FAIL_COUNT,"
    echo "    \"warn\": $WARN_COUNT,"
    echo "    \"critical_failure\": $CRITICAL_FAIL"
    echo "  },"
    echo "  \"evidence_hash\": \"$evidence_hash\","
    echo "  \"results\": ["
    
    local first=true
    for result in "${RESULTS[@]}"; do
        if [ "$first" = true ]; then
            first=false
        else
            echo ","
        fi
        echo -n "    $result"
    done
    
    echo ""
    echo "  ]"
    echo "}"
}

# ==========================================
# MAIN
# ==========================================
main() {
    # Parse argumentos
    while [[ $# -gt 0 ]]; do
        case $1 in
            --json)
                JSON_OUTPUT=true
                shift
                ;;
            --full)
                FULL_MODE=true
                shift
                ;;
            --ci)
                CI_MODE=true
                shift
                ;;
            --host)
                HOST="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done
    
    if [ "$JSON_OUTPUT" = false ]; then
        echo ""
        echo "============================================"
        echo " GUARDA OPERACIONAL - VALIDAÇÃO DE SEGURANÇA"
        echo " $(date '+%Y-%m-%d %H:%M:%S')"
        echo " Host: $HOST"
        echo "============================================"
    fi
    
    # Executar checks
    check_network_surface
    check_docker_containers
    check_docker_nat
    check_firewall
    check_http_headers
    check_rate_limiting
    check_secrets
    check_backups
    check_ssh
    check_docker_daemon
    
    # Teste de restore opcional
    if [ "$FULL_MODE" = true ]; then
        test_restore
    fi
    
    # Output
    if [ "$JSON_OUTPUT" = true ]; then
        print_json
    else
        print_report
    fi
    
    # Exit code
    if [ "$CRITICAL_FAIL" = true ]; then
        exit 1
    elif [ "$CI_MODE" = true ] && [ "$FAIL_COUNT" -gt 0 ]; then
        exit 1
    else
        exit 0
    fi
}

main "$@"

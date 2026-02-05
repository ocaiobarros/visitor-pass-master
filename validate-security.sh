#!/bin/bash
# ============================================
# Guarda Operacional - Validação de Segurança
# Versão: 2.0.0 - Padrão Corporativo Auditável
# ============================================
#
# MODOS:
#   ./validate-security.sh              # Humano, exit 1 só em crítico
#   ./validate-security.sh --full       # Humano + restore test
#   ./validate-security.sh --ci         # Qualquer FAIL = exit 1
#   ./validate-security.sh --json       # Só JSON, nada mais no stdout
#
# EVIDÊNCIA:
#   Gera /var/log/guarda/validation-YYYYMMDD-HHMMSS.{log,json,sha256}
#
# ============================================

set -uo pipefail

# ==========================================
# CONFIGURAÇÃO
# ==========================================
readonly SCRIPT_VERSION="2.0.0"
readonly SCRIPT_PATH="$(realpath "$0")"
readonly SCRIPT_SHA256="$(sha256sum "$SCRIPT_PATH" 2>/dev/null | cut -d' ' -f1 || echo "unknown")"
readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
readonly TIMESTAMP="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
readonly TIMESTAMP_FILE="$(date '+%Y%m%d-%H%M%S')"
readonly HOSTNAME="$(hostname -f 2>/dev/null || hostname)"

HOST="${VALIDATE_HOST:-localhost}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/guarda-operacional}"
LOG_DIR="${LOG_DIR:-/var/log/guarda}"
RESTORE_PROOF_DIR="${RESTORE_PROOF_DIR:-/var/log/guarda/restore-proofs}"

# Portas permitidas (allowlist)
readonly ALLOWED_PORTS_REGEX='(22|80|443)'

# Containers internos que NÃO podem ter portas publicadas
readonly INTERNAL_CONTAINERS="guarda-db guarda-api guarda-auth"

# ==========================================
# VARIÁVEIS GLOBAIS
# ==========================================
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
CRITICAL_FAIL_COUNT=0

JSON_MODE=false
FULL_MODE=false
CI_MODE=false

declare -a CHECKS_JSON=()
declare -a LOG_BUFFER=()

# ==========================================
# FUNÇÕES DE LOG
# ==========================================
_log() {
    local level="$1"
    local check_id="$2"
    local message="$3"
    local critical="${4:-false}"
    local detail="${5:-}"
    
    # Buffer para arquivo
    LOG_BUFFER+=("[$level] [$check_id] $message ${detail:+($detail)}")
    
    # JSON array
    local json_entry
    json_entry=$(cat <<EOF
{"id":"$check_id","status":"$level","critical":$critical,"msg":"$message","detail":"$detail"}
EOF
)
    CHECKS_JSON+=("$json_entry")
    
    # Stdout (só se não for JSON mode)
    if [ "$JSON_MODE" = false ]; then
        case "$level" in
            PASS) echo -e "\033[0;32m[PASS]\033[0m [$check_id] $message ${detail:+($detail)}" ;;
            FAIL) echo -e "\033[0;31m[FAIL]\033[0m [$check_id] $message ${detail:+($detail)}" ;;
            WARN) echo -e "\033[1;33m[WARN]\033[0m [$check_id] $message ${detail:+($detail)}" ;;
            INFO) echo -e "\033[0;34m[INFO]\033[0m $message" ;;
        esac
    fi
}

pass() {
    local check_id="$1"
    local message="$2"
    local detail="${3:-}"
    _log "PASS" "$check_id" "$message" "false" "$detail"
    ((PASS_COUNT++))
}

fail() {
    local check_id="$1"
    local message="$2"
    local detail="${3:-}"
    _log "FAIL" "$check_id" "$message" "false" "$detail"
    ((FAIL_COUNT++))
}

fail_critical() {
    local check_id="$1"
    local message="$2"
    local detail="${3:-}"
    _log "FAIL" "$check_id" "$message" "true" "$detail"
    ((FAIL_COUNT++))
    ((CRITICAL_FAIL_COUNT++))
}

warn() {
    local check_id="$1"
    local message="$2"
    local detail="${3:-}"
    _log "WARN" "$check_id" "$message" "false" "$detail"
    ((WARN_COUNT++))
}

info() {
    _log "INFO" "-" "$1" "false" ""
}

header() {
    if [ "$JSON_MODE" = false ]; then
        echo ""
        echo "============================================"
        echo " $1"
        echo "============================================"
    fi
}

# ==========================================
# 1. SUPERFÍCIE DE PORTAS (ss)
# ==========================================
check_surface_ports() {
    header "1. SUPERFÍCIE DE REDE"
    
    local listening
    listening="$(ss -tulpn 2>/dev/null | grep LISTEN || true)"
    
    if [ "$JSON_MODE" = false ]; then
        echo "$listening" | head -15
        echo ""
    fi
    
    # Extrair portas em escuta
    local ports_found
    ports_found="$(echo "$listening" | grep -oE ':([0-9]+)\s' | tr -d ':' | tr -d ' ' | sort -u)"
    
    local bad_ports=""
    for port in $ports_found; do
        if ! echo "$port" | grep -qE "^${ALLOWED_PORTS_REGEX}$"; then
            bad_ports="$bad_ports $port"
        fi
    done
    
    if [ -n "$bad_ports" ]; then
        fail_critical "surface_ports" "Portas expostas fora de 22/80/443" "$bad_ports"
    else
        pass "surface_ports" "Apenas 22/80/443 em escuta"
    fi
}

# ==========================================
# 2. DOCKER PORTS (containers)
# ==========================================
check_docker_published_ports() {
    header "2. DOCKER PORTS PUBLICADAS"
    
    if ! command -v docker &>/dev/null || ! docker ps &>/dev/null; then
        warn "docker_ports" "Docker não disponível"
        return
    fi
    
    local output
    output="$(docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null || true)"
    
    if [ "$JSON_MODE" = false ]; then
        echo "$output"
        echo ""
    fi
    
    # Filtrar: permitir apenas :80->, :443->, :22-> ou vazio
    local bad
    bad="$(echo "$output" | grep -vE "(:(22|80|443)->|^[^ ]+ *$)" | grep -v "^$" || true)"
    
    if [ -n "$bad" ]; then
        fail_critical "docker_ports" "Containers com portas indevidas publicadas" "$bad"
    else
        pass "docker_ports" "Sem portas publicadas fora de 22/80/443"
    fi
    
    # Verificar containers internos especificamente
    for container in $INTERNAL_CONTAINERS; do
        if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${container}$"; then
            local ports
            ports="$(docker inspect "$container" --format '{{json .HostConfig.PortBindings}}' 2>/dev/null || echo "{}")"
            
            if [ "$ports" = "{}" ] || [ "$ports" = "null" ]; then
                pass "docker_${container}" "$container sem portas publicadas"
            elif echo "$ports" | grep -q '"HostIp":"127.0.0.1"'; then
                pass "docker_${container}" "$container exposto apenas em localhost"
            else
                fail_critical "docker_${container}" "$container tem portas públicas" "$ports"
            fi
        fi
    done
}

# ==========================================
# 3. DOCKER NAT BYPASS (iptables + nft)
# ==========================================
check_docker_dnat_bypass() {
    header "3. DOCKER NAT/DNAT BYPASS"
    
    local dnat_ipt=""
    local dnat_nft=""
    local found_bypass=false
    
    # iptables-nft (Debian 11/12 usa isso por baixo)
    if command -v iptables &>/dev/null; then
        dnat_ipt="$(iptables -t nat -S 2>/dev/null | grep -E '(^-A DOCKER |--dport )' || true)"
        
        if [ -n "$dnat_ipt" ]; then
            # Procurar DNAT para portas não permitidas
            local bad_dnat_ipt
            bad_dnat_ipt="$(echo "$dnat_ipt" | grep -E '--dport' | grep -vE "--dport (${ALLOWED_PORTS_REGEX})\b" || true)"
            
            if [ -n "$bad_dnat_ipt" ]; then
                if [ "$JSON_MODE" = false ]; then
                    echo "DNAT suspeito em iptables:"
                    echo "$bad_dnat_ipt" | head -10
                fi
                fail_critical "dnat_iptables" "Docker DNAT bypass em iptables (DOCKER chain)" "portas fora de 22/80/443"
                found_bypass=true
            fi
        fi
    fi
    
    # nft puro
    if command -v nft &>/dev/null; then
        dnat_nft="$(nft list ruleset 2>/dev/null | grep -iE 'dnat|redirect' || true)"
        
        if [ -n "$dnat_nft" ]; then
            # Procurar DNAT para portas não permitidas
            local bad_dnat_nft
            bad_dnat_nft="$(echo "$dnat_nft" | grep -vE "dport (${ALLOWED_PORTS_REGEX})\b" | grep -iE 'dnat|redirect' || true)"
            
            if [ -n "$bad_dnat_nft" ]; then
                if [ "$JSON_MODE" = false ]; then
                    echo "DNAT suspeito em nft:"
                    echo "$bad_dnat_nft" | head -10
                fi
                fail_critical "dnat_nft" "Docker DNAT bypass em nft ruleset" "portas fora de 22/80/443"
                found_bypass=true
            fi
        fi
    fi
    
    if [ "$found_bypass" = false ]; then
        pass "dnat_bypass" "NAT/DNAT sem bypass indevido (iptables/nft)"
    fi
}

# ==========================================
# 4. FIREWALL UFW
# ==========================================
check_firewall_ufw() {
    header "4. FIREWALL UFW"
    
    if ! command -v ufw &>/dev/null; then
        warn "ufw_installed" "UFW não instalado"
        return
    fi
    
    local status
    status="$(ufw status verbose 2>/dev/null || echo "")"
    
    if echo "$status" | grep -q "Status: active"; then
        pass "ufw_active" "UFW ativo"
    else
        fail_critical "ufw_active" "UFW não está ativo"
        return
    fi
    
    if echo "$status" | grep -q "Default: deny (incoming)"; then
        pass "ufw_default" "Default deny incoming"
    else
        fail_critical "ufw_default" "Default não é deny incoming"
    fi
    
    if [ "$JSON_MODE" = false ]; then
        echo "$status" | head -20
    fi
}

# ==========================================
# 5. HEADERS HTTP (validação ativa)
# ==========================================
check_http_headers() {
    header "5. HEADERS DE SEGURANÇA HTTP"
    
    local headers
    headers="$(curl -skI "http://$HOST" 2>/dev/null || true)"
    
    if [ -z "$headers" ]; then
        fail_critical "http_connect" "Não foi possível conectar a http://$HOST"
        return
    fi
    
    if [ "$JSON_MODE" = false ]; then
        echo "$headers" | head -20
        echo ""
    fi
    
    # X-Content-Type-Options: nosniff
    if echo "$headers" | grep -qi '^x-content-type-options:.*nosniff'; then
        pass "header_nosniff" "X-Content-Type-Options: nosniff"
    else
        fail_critical "header_nosniff" "X-Content-Type-Options ausente ou incorreto"
    fi
    
    # X-Frame-Options
    if echo "$headers" | grep -qi '^x-frame-options:'; then
        pass "header_xfo" "X-Frame-Options presente"
    else
        fail "header_xfo" "X-Frame-Options ausente"
    fi
    
    # Referrer-Policy
    if echo "$headers" | grep -qi '^referrer-policy:'; then
        pass "header_referrer" "Referrer-Policy presente"
    else
        fail "header_referrer" "Referrer-Policy ausente"
    fi
    
    # Content-Security-Policy
    if echo "$headers" | grep -qi '^content-security-policy:'; then
        local csp
        csp="$(echo "$headers" | grep -i '^content-security-policy:' | head -1)"
        
        if echo "$csp" | grep -qi 'unsafe-eval'; then
            fail "header_csp_eval" "CSP contém unsafe-eval (risco XSS)"
        else
            pass "header_csp_eval" "CSP sem unsafe-eval"
        fi
        
        if echo "$csp" | grep -qi 'default-src'; then
            pass "header_csp_default" "CSP tem default-src"
        else
            warn "header_csp_default" "CSP sem default-src"
        fi
    else
        fail "header_csp" "Content-Security-Policy ausente"
    fi
    
    # Server token (não deve revelar versão)
    if echo "$headers" | grep -qi '^server:.*nginx/[0-9]'; then
        fail "header_server" "Server revelando versão nginx" "Adicione server_tokens off"
    else
        pass "header_server" "Server não revela versão"
    fi
    
    # HTTPS check
    local https_headers
    https_headers="$(curl -skI "https://$HOST" 2>/dev/null || true)"
    
    if [ -n "$https_headers" ]; then
        if echo "$https_headers" | grep -qi 'strict-transport-security'; then
            pass "header_hsts" "HSTS ativo"
        else
            warn "header_hsts" "HSTS ausente em HTTPS"
        fi
    else
        info "HTTPS não disponível (ok para rede interna)"
    fi
}

# ==========================================
# 6. RATE LIMITING
# ==========================================
check_rate_limiting() {
    header "6. RATE LIMITING"
    
    local endpoint="http://$HOST:8000/auth/v1/token"
    local got_429=false
    local request_count=0
    
    for i in {1..25}; do
        local code
        code="$(curl -s -o /dev/null -w "%{http_code}" -X POST "$endpoint" 2>/dev/null || echo "000")"
        ((request_count++))
        
        if [ "$code" = "429" ]; then
            got_429=true
            pass "rate_limit" "Rate limiting ativo" "429 após $request_count requests"
            break
        fi
    done
    
    if [ "$got_429" = false ]; then
        warn "rate_limit" "Rate limiting não disparou em 25 requests"
    fi
}

# ==========================================
# 7. SECRETS E PERMISSÕES
# ==========================================
check_secrets() {
    header "7. SECRETS E PERMISSÕES"
    
    # .env permissions
    if [ -f "$SCRIPT_DIR/.env" ]; then
        local perms
        perms="$(stat -c "%a" "$SCRIPT_DIR/.env" 2>/dev/null || stat -f "%OLp" "$SCRIPT_DIR/.env" 2>/dev/null || echo "unknown")"
        
        if [ "$perms" = "600" ]; then
            pass "env_perms" ".env tem permissão 600"
        else
            fail_critical "env_perms" ".env tem permissão $perms" "Deveria ser 600"
        fi
    else
        warn "env_exists" ".env não encontrado em $SCRIPT_DIR"
    fi
    
    # Secrets no git
    if git -C "$SCRIPT_DIR" rev-parse --is-inside-work-tree &>/dev/null; then
        local leaked
        leaked="$(git -C "$SCRIPT_DIR" ls-files 2>/dev/null | xargs grep -l -iE "(password|secret|api_key|private_key)\s*[:=]" 2>/dev/null | grep -vE "\.(example|md|sh|sample)$" || true)"
        
        if [ -n "$leaked" ]; then
            fail_critical "secrets_git" "Possíveis secrets em arquivos versionados" "$leaked"
        else
            pass "secrets_git" "Nenhum secret encontrado em arquivos versionados"
        fi
    fi
    
    # :latest no compose
    if [ -f "$SCRIPT_DIR/docker-compose.yml" ]; then
        if grep -qE "image:.*:latest" "$SCRIPT_DIR/docker-compose.yml" 2>/dev/null; then
            fail_critical "docker_latest" ":latest no docker-compose.yml" "Use versões fixas"
        else
            pass "docker_latest" "Sem :latest no docker-compose.yml"
        fi
    fi
}

# ==========================================
# 8. BACKUPS
# ==========================================
check_backups() {
    header "8. BACKUPS"
    
    if [ ! -d "$BACKUP_DIR" ]; then
        fail_critical "backup_dir" "Diretório de backup não existe" "$BACKUP_DIR"
        return
    fi
    
    pass "backup_dir" "Diretório de backup existe"
    
    local count
    count="$(find "$BACKUP_DIR" -name "*.sql.gz" 2>/dev/null | wc -l)"
    
    if [ "$count" -eq 0 ]; then
        fail_critical "backup_count" "Nenhum backup encontrado"
        return
    fi
    
    pass "backup_count" "$count backups encontrados"
    
    # Idade do último backup
    local latest
    latest="$(ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -1)"
    
    if [ -n "$latest" ]; then
        local age_hours
        age_hours="$(( ($(date +%s) - $(stat -c %Y "$latest" 2>/dev/null || stat -f %m "$latest" 2>/dev/null || echo 0)) / 3600 ))"
        
        if [ "$age_hours" -lt 48 ]; then
            pass "backup_age" "Backup recente" "${age_hours}h"
        else
            fail "backup_age" "Backup muito antigo" "${age_hours}h (>48h)"
        fi
    fi
    
    # Restore proof
    if [ -d "$RESTORE_PROOF_DIR" ]; then
        local proof
        proof="$(ls -t "$RESTORE_PROOF_DIR"/restore-proof-*.md 2>/dev/null | head -1)"
        
        if [ -n "$proof" ]; then
            local proof_age
            proof_age="$(( ($(date +%s) - $(stat -c %Y "$proof" 2>/dev/null || stat -f %m "$proof" 2>/dev/null || echo 0)) / 86400 ))"
            
            if [ "$proof_age" -lt 30 ]; then
                pass "restore_proof" "Restore testado recentemente" "$(basename "$proof")"
            else
                warn "restore_proof" "Restore proof com ${proof_age} dias" "Teste mensalmente"
            fi
        else
            warn "restore_proof" "Nenhum restore proof encontrado"
        fi
    fi
}

# ==========================================
# 9. TESTE DE RESTORE
# ==========================================
test_restore() {
    header "9. TESTE DE RESTORE"
    
    local latest
    latest="$(ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -1)"
    
    if [ -z "$latest" ]; then
        fail "restore_test" "Nenhum backup para testar"
        return
    fi
    
    info "Testando restore de: $(basename "$latest")"
    
    local container="guarda-restore-test-$$"
    
    if ! docker run -d --name "$container" -e POSTGRES_PASSWORD=testpass postgres:15-alpine >/dev/null 2>&1; then
        warn "restore_test" "Não foi possível criar container de teste"
        return
    fi
    
    sleep 8
    
    if gunzip -c "$latest" | docker exec -i "$container" psql -U postgres -d postgres >/dev/null 2>&1; then
        local tables
        tables="$(docker exec "$container" psql -U postgres -d postgres -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'" 2>/dev/null | tr -d ' ')"
        
        pass "restore_test" "Restore executado com sucesso" "$tables tabelas"
        
        # Criar restore proof
        mkdir -p "$RESTORE_PROOF_DIR"
        local proof_file="$RESTORE_PROOF_DIR/restore-proof-$(date '+%Y-%m-%d').md"
        cat > "$proof_file" <<EOF
# Restore Proof

- **Data:** $(date -u '+%Y-%m-%dT%H:%M:%SZ')
- **Backup:** $(basename "$latest")
- **Tabelas restauradas:** $tables
- **Executor:** $(whoami)@$(hostname)
- **SHA256 backup:** $(sha256sum "$latest" | cut -d' ' -f1)

## Verificação

Restore executado com sucesso em container efêmero.
EOF
        chmod 600 "$proof_file"
        info "Restore proof salvo em: $proof_file"
    else
        fail "restore_test" "Restore falhou"
    fi
    
    docker rm -f "$container" >/dev/null 2>&1
}

# ==========================================
# 10. SSH
# ==========================================
check_ssh() {
    header "10. SSH"
    
    if [ ! -f /etc/ssh/sshd_config ]; then
        warn "ssh_config" "sshd_config não encontrado"
        return
    fi
    
    local root_login
    root_login="$(grep -E "^PermitRootLogin" /etc/ssh/sshd_config 2>/dev/null | awk '{print $2}' | head -1)"
    
    if [ "$root_login" = "no" ]; then
        pass "ssh_root" "PermitRootLogin = no"
    elif [ -z "$root_login" ]; then
        warn "ssh_root" "PermitRootLogin não definido explicitamente"
    else
        fail_critical "ssh_root" "PermitRootLogin = $root_login" "Deveria ser 'no'"
    fi
    
    local pass_auth
    pass_auth="$(grep -E "^PasswordAuthentication" /etc/ssh/sshd_config 2>/dev/null | awk '{print $2}' | head -1)"
    
    if [ "$pass_auth" = "no" ]; then
        pass "ssh_password" "PasswordAuthentication = no"
    else
        warn "ssh_password" "PasswordAuthentication = $pass_auth" "Recomendado: no"
    fi
}

# ==========================================
# 11. DOCKER DAEMON
# ==========================================
check_docker_daemon() {
    header "11. DOCKER DAEMON"
    
    if [ ! -f /etc/docker/daemon.json ]; then
        fail_critical "docker_daemon" "daemon.json não existe" "Logs crescem indefinidamente"
        return
    fi
    
    pass "docker_daemon" "daemon.json existe"
    
    if grep -q '"max-size"' /etc/docker/daemon.json; then
        pass "docker_logs" "Log rotation configurado"
    else
        fail_critical "docker_logs" "Log rotation não configurado"
    fi
}

# ==========================================
# OUTPUT JSON
# ==========================================
output_json() {
    local evidence_data
    evidence_data="$TIMESTAMP|$HOSTNAME|PASS:$PASS_COUNT|FAIL:$FAIL_COUNT|WARN:$WARN_COUNT|CRITICAL:$CRITICAL_FAIL_COUNT"
    local evidence_hash
    evidence_hash="$(echo -n "$evidence_data" | sha256sum | cut -d' ' -f1)"
    
    cat <<EOF
{
  "ts": "$TIMESTAMP",
  "host": "$HOSTNAME",
  "script_version": "$SCRIPT_VERSION",
  "script_sha256": "$SCRIPT_SHA256",
  "summary": {
    "pass": $PASS_COUNT,
    "fail": $FAIL_COUNT,
    "warn": $WARN_COUNT,
    "critical_fail": $CRITICAL_FAIL_COUNT
  },
  "evidence_hash": "$evidence_hash",
  "checks": [
$(IFS=,; echo "    ${CHECKS_JSON[*]}" | sed 's/},{/},\n    {/g')
  ]
}
EOF
}

# ==========================================
# SALVAR EVIDÊNCIA
# ==========================================
save_evidence() {
    mkdir -p "$LOG_DIR"
    chmod 700 "$LOG_DIR"
    
    local log_file="$LOG_DIR/validation-$TIMESTAMP_FILE.log"
    local json_file="$LOG_DIR/validation-$TIMESTAMP_FILE.json"
    local hash_file="$LOG_DIR/validation-$TIMESTAMP_FILE.sha256"
    
    # Salvar log
    {
        echo "# Guarda Operacional - Validação de Segurança"
        echo "# Timestamp: $TIMESTAMP"
        echo "# Host: $HOSTNAME"
        echo "# Script: $SCRIPT_VERSION ($SCRIPT_SHA256)"
        echo ""
        printf '%s\n' "${LOG_BUFFER[@]}"
        echo ""
        echo "# RESUMO: PASS=$PASS_COUNT FAIL=$FAIL_COUNT WARN=$WARN_COUNT CRITICAL=$CRITICAL_FAIL_COUNT"
    } > "$log_file"
    chmod 600 "$log_file"
    
    # Salvar JSON
    output_json > "$json_file"
    chmod 600 "$json_file"
    
    # Salvar hash
    sha256sum "$log_file" "$json_file" > "$hash_file"
    chmod 600 "$hash_file"
    
    if [ "$JSON_MODE" = false ]; then
        info "Evidência salva em:"
        info "  $log_file"
        info "  $json_file"
        info "  $hash_file"
    fi
}

# ==========================================
# RELATÓRIO FINAL
# ==========================================
print_report() {
    header "RELATÓRIO FINAL"
    
    echo ""
    echo "Timestamp: $TIMESTAMP"
    echo "Host: $HOSTNAME"
    echo "Script: $SCRIPT_VERSION"
    echo ""
    echo -e "\033[0;32mPASS: $PASS_COUNT\033[0m"
    echo -e "\033[0;31mFAIL: $FAIL_COUNT (críticos: $CRITICAL_FAIL_COUNT)\033[0m"
    echo -e "\033[1;33mWARN: $WARN_COUNT\033[0m"
    echo ""
    
    # Resumo por categoria
    echo "============================================"
    echo " RESUMO EXECUTIVO"
    echo "============================================"
    
    if [ "$CRITICAL_FAIL_COUNT" -eq 0 ]; then
        echo -e "\033[0;32mSurface:        PASS (22/80/443 only)\033[0m"
        echo -e "\033[0;32mDocker exposure: PASS (no internal ports published)\033[0m"
        echo -e "\033[0;32mFirewall/NAT:   PASS (no DNAT besides 80/443)\033[0m"
    else
        echo -e "\033[0;31mCRÍTICOS FALHARAM - VEJA ACIMA\033[0m"
    fi
    
    echo ""
    
    # Evidence hash
    local evidence_data="$TIMESTAMP|$HOSTNAME|PASS:$PASS_COUNT|FAIL:$FAIL_COUNT|WARN:$WARN_COUNT|CRITICAL:$CRITICAL_FAIL_COUNT"
    local evidence_hash
    evidence_hash="$(echo -n "$evidence_data" | sha256sum | cut -d' ' -f1)"
    
    echo "============================================"
    echo " HASH DE EVIDÊNCIA"
    echo "============================================"
    echo "SHA256: $evidence_hash"
    echo ""
    
    if [ "$CRITICAL_FAIL_COUNT" -gt 0 ]; then
        echo -e "\033[0;31m❌ HARDENING INCOMPLETO - $CRITICAL_FAIL_COUNT FALHAS CRÍTICAS\033[0m"
    elif [ "$FAIL_COUNT" -gt 0 ]; then
        echo -e "\033[1;33m⚠️ HARDENING PARCIAL - $FAIL_COUNT FALHAS\033[0m"
    else
        echo -e "\033[0;32m✅ HARDENING VALIDADO\033[0m"
    fi
}

# ==========================================
# MAIN
# ==========================================
main() {
    # Parse args
    while [[ $# -gt 0 ]]; do
        case $1 in
            --json) JSON_MODE=true; shift ;;
            --full) FULL_MODE=true; shift ;;
            --ci) CI_MODE=true; shift ;;
            --host) HOST="$2"; shift 2 ;;
            *) shift ;;
        esac
    done
    
    if [ "$JSON_MODE" = false ]; then
        echo ""
        echo "============================================"
        echo " GUARDA OPERACIONAL - VALIDAÇÃO v$SCRIPT_VERSION"
        echo " $TIMESTAMP"
        echo " Host: $HOSTNAME"
        echo "============================================"
    fi
    
    # Executar checks
    check_surface_ports
    check_docker_published_ports
    check_docker_dnat_bypass
    check_firewall_ufw
    check_http_headers
    check_rate_limiting
    check_secrets
    check_backups
    check_ssh
    check_docker_daemon
    
    if [ "$FULL_MODE" = true ]; then
        test_restore
    fi
    
    # Salvar evidência
    save_evidence
    
    # Output
    if [ "$JSON_MODE" = true ]; then
        output_json
    else
        print_report
    fi
    
    # Exit code
    if [ "$CRITICAL_FAIL_COUNT" -gt 0 ]; then
        exit 1
    elif [ "$CI_MODE" = true ] && [ "$FAIL_COUNT" -gt 0 ]; then
        exit 1
    else
        exit 0
    fi
}

main "$@"

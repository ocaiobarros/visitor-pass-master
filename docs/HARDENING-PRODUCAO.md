# 🔒 Hardening de Produção - Guarda Operacional

Guia de segurança nível corporativo para deploy em produção.

## 📋 Checklist Rápido

- [ ] Firewall UFW configurado (apenas 22, 80, 443)
- [ ] Portas internas não expostas (DB, Auth, API)
- [ ] TLS com Let's Encrypt ou PKI corporativa
- [ ] Arquivo .env com permissões restritas (600)
- [ ] Senhas geradas com `openssl rand`
- [ ] Docker daemon com limite de logs
- [ ] Backup automático + teste de restore
- [ ] Healthchecks ativos em todos os serviços

---

## 1️⃣ Firewall (UFW)

```bash
# Política padrão: negar entrada, permitir saída
sudo ufw default deny incoming
sudo ufw default allow outgoing

# SSH apenas de rede admin (ajuste o CIDR)
sudo ufw allow from 172.16.0.0/12 to any port 22 proto tcp
# Ou IP fixo: sudo ufw allow from X.X.X.X to any port 22 proto tcp

# HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# BLOQUEAR portas internas (caso estejam expostas)
sudo ufw deny 8000/tcp
sudo ufw deny 3000/tcp
sudo ufw deny 9999/tcp
sudo ufw deny 5432/tcp

# Ativar
sudo ufw enable
sudo ufw status verbose
```

---

## 2️⃣ Nginx como Reverse Proxy no Host

Deixe os containers na rede interna e use nginx no host como porta de entrada.

### 2.1 Criar vhost

```bash
sudo nano /etc/nginx/sites-available/guarda
```

```nginx
# Rate limiting para login
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

server {
    listen 80;
    server_name _;

    # Headers de segurança
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Rate limit no login
    location /auth/ {
        limit_req zone=login burst=10 nodelay;
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API Gateway
    location /rest/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2.2 Ativar

```bash
sudo ln -s /etc/nginx/sites-available/guarda /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 3️⃣ TLS com Let's Encrypt

### Com DNS público

```bash
sudo apt update && sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d guarita.suaempresa.com.br
```

### Verificar renovação automática

```bash
sudo certbot renew --dry-run
```

### Rede interna sem DNS

Use PKI corporativa (AD CS) ou mkcert para desenvolvimento.

---

## 4️⃣ Proteção do .env

```bash
# Permissões restritas
chmod 600 .env
chown root:root .env

# Gerar senhas seguras
DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
JWT_SECRET=$(openssl rand -base64 32)
```

---

## 5️⃣ Docker Daemon - Limite de Logs

```bash
sudo nano /etc/docker/daemon.json
```

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "5"
  }
}
```

```bash
sudo systemctl restart docker
```

---

## 6️⃣ Backup Automático

### Criar diretório

```bash
sudo mkdir -p /opt/guarda-backups
sudo chmod 700 /opt/guarda-backups
```

### Cron job (backup 2h + retenção 14 dias)

```bash
sudo nano /etc/cron.d/guarda-backup
```

```cron
# Backup diário às 2h
0 2 * * * root cd /root/visitor-pass-master && docker compose exec -T guarda-db pg_dump -U postgres guarda_operacional | gzip > /opt/guarda-backups/guarda_$(date +\%F).sql.gz

# Limpeza de backups antigos (>14 dias)
5 2 * * * root find /opt/guarda-backups -type f -name "guarda_*.sql.gz" -mtime +14 -delete
```

### Teste de restore (MENSAL!)

```bash
# Descompactar e restaurar em container de teste
gunzip -c /opt/guarda-backups/guarda_2024-01-15.sql.gz | \
  docker run --rm -i postgres:15-alpine psql -U postgres -d postgres
```

> ⚠️ **Backup que não restaura = placebo.** Teste mensalmente.

---

## 7️⃣ Validação de Segurança

Execute e verifique:

```bash
# Portas expostas (deve mostrar apenas 22, 80, 443)
ss -tulpn | grep LISTEN

# Containers rodando
docker compose ps

# Redes docker
docker network ls

# IPs internos dos containers
docker inspect $(docker ps -q) --format '{{.Name}} -> {{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}'

# Status do firewall
sudo ufw status verbose

# Configuração nginx
sudo nginx -T | grep -E "server_name|listen|proxy_pass|limit_req"
```

### Resultado esperado

```
✅ Apenas portas 22, 80, 443 em LISTEN
✅ Containers com IPs internos (172.x.x.x)
✅ UFW deny em 8000, 3000, 9999, 5432
✅ Nginx com rate limiting em /auth
```

---

## 8️⃣ Processo de Atualização Controlada

```bash
# 1. Backup antes de qualquer coisa
./backup.sh

# 2. Pull do código
git pull origin main

# 3. Pull das imagens
docker compose pull

# 4. Subir com rebuild
docker compose up -d --build

# 5. Smoke test
curl -s http://localhost/health
# Testar: login, cadastro visitante, scan QR

# 6. Se falhar: rollback
git checkout HEAD~1
docker compose up -d --build
```

---

## 9️⃣ Segurança da Aplicação

### Já implementado ✅

- [x] Logs de auditoria (tabela `audit_logs`)
- [x] CORS configurado
- [x] Headers de segurança no nginx
- [x] Sessão com expiração (JWT_EXPIRY)
- [x] RLS no banco (Row Level Security)

### Recomendado adicionar

- [ ] Troca de senha obrigatória no primeiro login
- [ ] 2FA para administradores
- [ ] IP allowlist para painel admin
- [ ] Alerta de tentativas de login falhas

---

## 📊 Resumo da Arquitetura Segura

```
                    INTERNET
                        │
                    ┌───▼───┐
                    │  UFW  │ (22, 80, 443 only)
                    └───┬───┘
                        │
                ┌───────▼───────┐
                │  Nginx Host   │ (TLS + Rate Limit)
                │   :80/:443    │
                └───────┬───────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
   ┌────▼────┐    ┌─────▼─────┐   ┌─────▼─────┐
   │   App   │    │   Kong    │   │   Auth    │
   │  (web)  │    │ (gateway) │   │ (GoTrue)  │
   └─────────┘    └─────┬─────┘   └───────────┘
                        │
                  ┌─────▼─────┐
                  │ PostgREST │
                  │   (API)   │
                  └─────┬─────┘
                        │
                  ┌─────▼─────┐
                  │ PostgreSQL│ (interno, sem porta exposta)
                  └───────────┘
```

**Superfície de ataque mínima:** apenas nginx responde à internet.

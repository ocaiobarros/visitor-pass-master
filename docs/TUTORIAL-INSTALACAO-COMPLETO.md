# 🚀 Tutorial Completo: Instalação do Guarda Operacional em Produção

> **Versão:** 2.0 | **Ambiente:** Debian 12 | **Nível:** Corporativo/Industrial

---

## 📋 Índice

1. [Requisitos](#-requisitos)
2. [Instalação do Docker](#-parte-1-instalação-do-docker)
3. [Deploy da Aplicação](#-parte-2-deploy-da-aplicação)
4. [Configuração Inicial](#-parte-3-configuração-inicial)
5. [Hardening de Segurança](#-parte-4-hardening-de-segurança)
6. [HTTPS (Certificado SSL)](#-parte-5-https-certificado-ssl)
7. [Backup e Recuperação](#-parte-6-backup-e-recuperação)
8. [Modo Kiosk na Guarita](#-parte-7-modo-kiosk-na-guarita)
9. [Validação de Segurança](#-parte-8-validação-de-segurança)
10. [Manutenção e Operação](#-parte-9-manutenção-e-operação)
11. [Solução de Problemas](#-solução-de-problemas)

---

## 📦 Requisitos

### Hardware Mínimo

| Componente | Mínimo | Recomendado |
|------------|--------|-------------|
| **CPU** | 2 cores | 4 cores |
| **RAM** | 2 GB | 4 GB |
| **Disco** | 20 GB | 50 GB SSD |
| **Rede** | 100 Mbps LAN | Gigabit LAN |

### Software

- Debian 11 ou 12 (servidor limpo)
- Acesso SSH com usuário sudo
- Conexão com internet (para downloads iniciais)

### Equipamento da Guarita

- Monitor (mínimo 21", recomendado 24"+)
- Leitor QR USB (Bematech S-100 ou similar)
- Opcional: Webcam USB para scan via câmera

---

## 🐳 PARTE 1: Instalação do Docker

### 1.1 Conectar ao Servidor

```bash
ssh usuario@IP_DO_SERVIDOR
```

### 1.2 Atualizar Sistema

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install curl git wget gnupg lsb-release ca-certificates -y
```

### 1.3 Instalar Docker

```bash
# Adicionar repositório oficial
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-compose-plugin -y

# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER

# IMPORTANTE: Sair e entrar novamente para aplicar
exit
```

### 1.4 Verificar Instalação

```bash
ssh usuario@IP_DO_SERVIDOR
docker --version
docker compose version
```

---

## 📥 PARTE 2: Deploy da Aplicação

### 2.1 Baixar Projeto

```bash
cd ~
git clone https://github.com/ocaiobarros/visitor-pass-master.git
cd visitor-pass-master
```

### 2.2 Gerar Credenciais Seguras

```bash
# Senha do banco (32 caracteres alfanuméricos)
DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
echo "DB_PASSWORD: $DB_PASSWORD"

# Chave JWT
JWT_SECRET=$(openssl rand -base64 32)
echo "JWT_SECRET: $JWT_SECRET"

# IP do servidor
HOST_IP=$(hostname -I | awk '{print $1}')
echo "HOST_IP: $HOST_IP"
```

> ⚠️ **ANOTE ESSES VALORES!** Você precisará deles no próximo passo.

### 2.3 Configurar Ambiente

```bash
cp .env.example .env
nano .env
```

**Preencha os valores obrigatórios:**

```env
# OBRIGATÓRIO - Cole os valores gerados acima
DB_PASSWORD=SEU_DB_PASSWORD_GERADO
JWT_SECRET=SEU_JWT_SECRET_GERADO
HOST_IP=SEU_IP_DO_SERVIDOR

# OBRIGATÓRIO - URL do sistema
SITE_URL=http://SEU_IP_DO_SERVIDOR

# RECOMENDADO - Altere a senha padrão do admin
ADMIN_PASSWORD=SuaSenhaForte123!
```

Salvar: `Ctrl+O` → `Enter` → `Ctrl+X`

### 2.4 Proteger Arquivo de Configuração

```bash
chmod 600 .env
```

### 2.5 Iniciar Sistema

```bash
docker compose up -d --build
```

> ⏳ Primeira execução leva 5-10 minutos.

### 2.6 Verificar Status

```bash
docker compose ps
```

Todos devem mostrar `Up (healthy)`:

```
NAME              STATUS
guarda-db         Up (healthy)
guarda-api        Up (healthy)
guarda-auth       Up (healthy)
guarda-gateway    Up (healthy)
guarda-app        Up (healthy)
```

---

## ⚙️ PARTE 3: Configuração Inicial

### 3.1 Acessar Sistema

Abra no navegador:

```
http://IP_DO_SERVIDOR
```

### 3.2 Login Inicial

| Campo | Valor |
|-------|-------|
| **Email** | `admin@sistema.local` |
| **Senha** | A que você definiu em `ADMIN_PASSWORD` |

### 3.3 Trocar Senha do Admin

> ⚠️ **OBRIGATÓRIO** - O sistema solicitará troca de senha no primeiro login.

### 3.4 Criar Usuário para Guarita

1. Vá em **Configurações → Usuários**
2. Clique em **Novo Usuário**
3. Preencha:
   - Nome: `Guarita Principal`
   - Email: `guarita@sistema.local`
   - Perfil: `security`
   - Senha: (gere uma senha forte)

---

## 🔒 PARTE 4: Hardening de Segurança

### 4.1 Configurar Firewall (UFW)

```bash
# Política padrão
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Permitir apenas o necessário
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'

# BLOQUEAR portas internas (segurança crítica)
sudo ufw deny 8000/tcp comment 'Kong interno'
sudo ufw deny 3000/tcp comment 'PostgREST interno'
sudo ufw deny 9999/tcp comment 'Auth interno'
sudo ufw deny 5432/tcp comment 'PostgreSQL interno'

# Ativar
sudo ufw enable
sudo ufw status verbose
```

### 4.2 Configurar Limite de Logs do Docker

```bash
sudo nano /etc/docker/daemon.json
```

Cole:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "5"
  },
  "no-new-privileges": true
}
```

Reiniciar Docker:

```bash
sudo systemctl restart docker
```

### 4.3 Hardening SSH

```bash
sudo nano /etc/ssh/sshd_config
```

Garanta estas configurações:

```
PermitRootLogin no
PasswordAuthentication no  # Use chave SSH
MaxAuthTries 3
```

Reiniciar SSH:

```bash
sudo systemctl restart sshd
```

### 4.4 Instalar Fail2Ban

```bash
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## 🔐 PARTE 5: HTTPS (Certificado SSL)

> ⚠️ **IMPORTANTE:** A câmera do celular requer HTTPS para funcionar!

### Opção A: Rede Interna (mkcert)

Para redes internas sem domínio público:

```bash
# Instalar mkcert
sudo apt install libnss3-tools wget -y
wget -O mkcert https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64
chmod +x mkcert
sudo mv mkcert /usr/local/bin/

# Gerar certificado para o IP
cd ~/visitor-pass-master
mkcert -install
mkcert $(hostname -I | awk '{print $1}')

# Mover certificados
mkdir -p docker/certs
mv *.pem docker/certs/
mv *-key.pem docker/certs/key.pem
mv docker/certs/*.pem docker/certs/cert.pem 2>/dev/null || true
```

### Opção B: Domínio Público (Let's Encrypt)

Para servidores com domínio público:

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx -y

# Gerar certificado
sudo certbot --nginx -d seu-dominio.com.br

# Testar renovação
sudo certbot renew --dry-run
```

### Atualizar Nginx para HTTPS

Edite `docker/nginx.conf`:

```bash
nano docker/nginx.conf
```

Adicione no início (após as diretivas existentes):

```nginx
# Redirecionar HTTP para HTTPS
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}
```

E modifique o bloco principal para:

```nginx
server {
    listen 443 ssl http2;
    server_name _;
    
    ssl_certificate /etc/nginx/certs/cert.pem;
    ssl_certificate_key /etc/nginx/certs/key.pem;
    
    # ... resto das configurações ...
}
```

Atualizar `docker-compose.yml` para montar certificados:

```yaml
  app:
    # ... outras configs ...
    volumes:
      - ./docker/certs:/etc/nginx/certs:ro
    ports:
      - "80:80"
      - "443:443"
```

Reiniciar:

```bash
docker compose down
docker compose up -d --build
```

---

## 💾 PARTE 6: Backup e Recuperação

### 6.1 Configurar Backup Automático

```bash
# Criar diretório
sudo mkdir -p /var/backups/guarda-operacional
sudo chown $USER:$USER /var/backups/guarda-operacional
chmod 700 /var/backups/guarda-operacional
```

### 6.2 Script de Backup

O projeto já inclui `backup.sh`. Torne-o executável:

```bash
chmod +x ~/visitor-pass-master/backup.sh
```

### 6.3 Agendar Backup Diário

```bash
crontab -e
```

Adicione:

```cron
# Backup diário às 2h da manhã
0 2 * * * /home/SEU_USUARIO/visitor-pass-master/backup.sh >> /var/log/guarda-backup.log 2>&1

# Limpeza de backups > 30 dias
5 2 * * * find /var/backups/guarda-operacional -name "*.sql.gz" -mtime +30 -delete
```

### 6.4 Testar Backup

```bash
~/visitor-pass-master/backup.sh
ls -la /var/backups/guarda-operacional/
```

### 6.5 Restaurar Backup

```bash
# ATENÇÃO: Isso sobrescreve todos os dados!
gunzip -c /var/backups/guarda-operacional/ARQUIVO_BACKUP.sql.gz | \
  docker compose exec -T guarda-db psql -U postgres guarda_operacional
```

---

## 🖥️ PARTE 7: Modo Kiosk na Guarita

### 7.1 Instalar Chromium

```bash
sudo apt install chromium -y
```

### 7.2 Criar Script de Auto-Start

```bash
nano ~/start-kiosk.sh
```

Cole:

```bash
#!/bin/bash
# ============================================
# Guarda Operacional - Modo Kiosk
# ============================================

# Esperar rede e sistema
sleep 10

# Desabilitar screensaver
xset s off
xset -dpms
xset s noblank

# Iniciar Chromium em modo kiosk
chromium \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-restore-session-state \
  --no-first-run \
  --start-fullscreen \
  "http://localhost/scan/kiosk"
```

Tornar executável:

```bash
chmod +x ~/start-kiosk.sh
```

### 7.3 Configurar Auto-Start no Boot

Para LXDE/Raspberry Pi:

```bash
mkdir -p ~/.config/autostart
nano ~/.config/autostart/kiosk.desktop
```

Cole:

```ini
[Desktop Entry]
Type=Application
Name=Guarda Kiosk
Exec=/home/SEU_USUARIO/start-kiosk.sh
X-GNOME-Autostart-enabled=true
```

Para systemd (servidores headless com display):

```bash
sudo nano /etc/systemd/system/guarda-kiosk.service
```

Cole:

```ini
[Unit]
Description=Guarda Operacional Kiosk
After=graphical.target

[Service]
Type=simple
User=SEU_USUARIO
Environment=DISPLAY=:0
ExecStart=/home/SEU_USUARIO/start-kiosk.sh
Restart=always
RestartSec=10

[Install]
WantedBy=graphical.target
```

Ativar:

```bash
sudo systemctl daemon-reload
sudo systemctl enable guarda-kiosk
```

### 7.4 Operação do Kiosk

| Ação | Como fazer |
|------|------------|
| **Sair do Kiosk** | Clique 3x rápido no logo |
| **Tela cheia** | Automático ao iniciar |
| **Scan** | Basta apontar QR no leitor USB |
| **Reset** | Tela volta sozinha após 3 segundos |

---

## ✅ PARTE 8: Validação de Segurança

### 8.1 Executar Script de Validação

O projeto inclui um script de validação corporativa:

```bash
chmod +x ~/visitor-pass-master/validate-security.sh
~/visitor-pass-master/validate-security.sh --full
```

### 8.2 Saída Esperada

```
============================================
 GUARDA OPERACIONAL - SECURITY VALIDATION
============================================
Timestamp: 2026-02-05T14:30:00-03:00
Hostname: servidor-guarita

[PASS] Porta 5432 não exposta
[PASS] Porta 3000 não exposta
[PASS] Porta 9999 não exposta
[PASS] Porta 8000 não exposta
[PASS] Container guarda-db sem portas publicadas
[PASS] NAT/DNAT sem bypass indevido
[PASS] Header X-Content-Type-Options presente
[PASS] .env tem permissão 600
[PASS] Backup recente encontrado
[PASS] Restore testado com sucesso

SUMMARY
Pass: 15 | Warn: 1 | Fail: 0 | Critical: 0

✅ VALIDATION PASSED
```

### 8.3 Gerar Evidência para Auditoria

```bash
~/visitor-pass-master/validate-security.sh --json > /var/log/guarda/validation-$(date +%Y%m%d).json
```

---

## 🛠️ PARTE 9: Manutenção e Operação

### Comandos do Dia a Dia

```bash
cd ~/visitor-pass-master

# Ver status
docker compose ps

# Ver logs
docker compose logs -f

# Reiniciar sistema
docker compose restart

# Parar sistema
docker compose down

# Iniciar sistema
docker compose up -d

# Atualizar para nova versão
git pull
docker compose up -d --build
```

### Monitoramento

```bash
# Uso de recursos
docker stats

# Espaço em disco
df -h

# Logs de auditoria (no sistema)
# Acesse: Configurações → Logs de Auditoria
```

### Atualização Controlada

```bash
# 1. Backup primeiro
./backup.sh

# 2. Pull do código
git pull origin main

# 3. Rebuild
docker compose up -d --build

# 4. Verificar
docker compose ps
curl -s http://localhost/health

# 5. Se falhar, rollback
git checkout HEAD~1
docker compose up -d --build
```

---

## ❓ Solução de Problemas

### "Container não inicia"

```bash
docker compose logs NOME_DO_CONTAINER
```

### "Erro de conexão com banco"

1. Verifique `DB_PASSWORD` no `.env`
2. Aguarde 30s após `docker compose up`
3. Recrie o banco (ATENÇÃO: perde dados):

```bash
docker compose down -v
docker compose up -d --build
```

### "Página não carrega"

```bash
# Verificar IP
hostname -I

# Verificar firewall
sudo ufw status

# Verificar porta 80
sudo ss -tulpn | grep :80
```

### "Câmera não funciona no celular"

- A câmera requer HTTPS
- Siga a **PARTE 5** para configurar SSL

### "QR não é lido"

1. Verifique se o leitor USB está conectado
2. Teste com `cat` e escaneie - deve imprimir texto
3. Verifique se o formato é `VP-XXXXXXXX` ou `EC-XXXXXXXX`

### "Login não funciona"

```bash
# Verificar logs do auth
docker compose logs guarda-auth

# Recriar usuário admin
docker compose exec guarda-db psql -U postgres guarda_operacional -c "
  UPDATE auth.users SET encrypted_password = crypt('NovaSenha123!', gen_salt('bf'))
  WHERE email = 'admin@sistema.local';
"
```

---

## 📊 Arquitetura Final

```
                    INTERNET/LAN
                         │
                    ┌────▼────┐
                    │   UFW   │ (22, 80, 443)
                    └────┬────┘
                         │
                 ┌───────▼───────┐
                 │  Nginx/App    │ :80/:443
                 │ (Frontend)    │
                 └───────┬───────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   ┌────▼────┐     ┌─────▼─────┐    ┌─────▼─────┐
   │  Kong   │     │ PostgREST │    │  GoTrue   │
   │ Gateway │     │   (API)   │    │  (Auth)   │
   └────┬────┘     └─────┬─────┘    └─────┬─────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
                  ┌──────▼──────┐
                  │ PostgreSQL  │
                  │   (Dados)   │
                  └─────────────┘
                  
        [Todos internos - sem portas expostas]
```

---

## ✅ Checklist Final de Produção

- [ ] Docker instalado e funcionando
- [ ] Sistema acessível via navegador
- [ ] Login admin funcionando
- [ ] Senha admin alterada
- [ ] Usuário de guarita criado
- [ ] Firewall UFW configurado
- [ ] HTTPS configurado (se necessário câmera)
- [ ] Backup automático configurado
- [ ] Backup testado (restore funciona)
- [ ] Validação de segurança passou
- [ ] Modo kiosk configurado (se aplicável)

---

## 📞 Suporte

- **Repositório:** https://github.com/ocaiobarros/visitor-pass-master
- **Issues:** https://github.com/ocaiobarros/visitor-pass-master/issues
- **Documentação:** Ver pasta `docs/`

---

*Guarda Operacional v2.0 - Sistema de Controle de Acesso*
*Deploy self-hosted para ambientes corporativos*

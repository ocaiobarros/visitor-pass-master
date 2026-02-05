# 🚀 Tutorial Completo: Instalação do Guarda Operacional no Debian

## 📋 O que você vai precisar

- Um servidor rodando **Debian 11 ou 12** (pode ser uma VM, VPS ou máquina física)
- Acesso ao terminal (SSH ou direto)
- Conexão com a internet
- Aproximadamente **30 minutos** do seu tempo

---

## 📦 PARTE 1: Preparando o Servidor

### 1.1 Conectar ao Servidor

Se você está acessando remotamente, abra o terminal e conecte via SSH:

```bash
ssh seu_usuario@IP_DO_SERVIDOR
```

Exemplo:
```bash
ssh admin@192.168.1.100
```

### 1.2 Atualizar o Sistema

Primeiro, vamos garantir que o sistema está atualizado:

```bash
sudo apt update
sudo apt upgrade -y
```

> 💡 **O que isso faz?** Atualiza a lista de pacotes e instala as versões mais recentes.

---

## 🐳 PARTE 2: Instalando o Docker

### 2.1 Instalar Dependências

```bash
sudo apt install apt-transport-https ca-certificates curl gnupg lsb-release -y
```

### 2.2 Adicionar Chave GPG do Docker

```bash
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
```

### 2.3 Adicionar Repositório do Docker

```bash
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

### 2.4 Instalar Docker e Docker Compose

```bash
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-compose-plugin -y
```

### 2.5 Verificar Instalação

```bash
docker --version
docker compose version
```

Você deve ver algo como:
```
Docker version 24.x.x
Docker Compose version v2.x.x
```

### 2.6 (Opcional) Usar Docker sem sudo

Para não precisar digitar `sudo` antes de cada comando Docker:

```bash
sudo usermod -aG docker $USER
```

> ⚠️ **IMPORTANTE:** Após este comando, você precisa **sair e entrar novamente** no terminal para a mudança ter efeito.

```bash
exit
# Conecte novamente via SSH
ssh seu_usuario@IP_DO_SERVIDOR
```

---

## 📥 PARTE 3: Baixando o Projeto

### 3.1 Instalar Git (se necessário)

```bash
sudo apt install git -y
```

### 3.2 Clonar o Repositório

```bash
cd ~
git clone https://github.com/ocaiobarros/visitor-pass-master.git
```

### 3.3 Entrar na Pasta do Projeto

```bash
cd visitor-pass-master
```

### 3.4 Verificar Arquivos

```bash
ls -la
```

Você deve ver arquivos como: `Dockerfile`, `docker-compose.yml`, `.env.example`, etc.

---

## ⚙️ PARTE 4: Configurando o Sistema

### 4.1 Criar Arquivo de Configuração

```bash
cp .env.example .env
```

### 4.2 Gerar Chave JWT Segura

Execute este comando para gerar uma chave segura automaticamente:

```bash
JWT_SECRET=$(openssl rand -base64 32)
echo "Sua chave JWT: $JWT_SECRET"
```

> 📝 **Anote esta chave!** Você vai precisar dela no próximo passo.

### 4.3 Descobrir o IP do Servidor

```bash
hostname -I | awk '{print $1}'
```

> 📝 **Anote o IP!** Exemplo: `192.168.1.100`

### 4.4 Editar Configurações

Abra o editor:

```bash
nano .env
```

**Agora edite as seguintes linhas:**

```env
# OBRIGATÓRIO: Coloque uma senha forte para o banco de dados
DB_PASSWORD=MinhaSenhaForte123!

# OBRIGATÓRIO: Cole a chave JWT que você gerou no passo 4.2
JWT_SECRET=COLE_A_CHAVE_AQUI

# OBRIGATÓRIO: Coloque o IP do seu servidor (do passo 4.3)
HOST_IP=192.168.1.100

# OBRIGATÓRIO: Atualize a URL do site com o IP
SITE_URL=http://192.168.1.100

# OPCIONAL: Mude a senha do administrador
ADMIN_PASSWORD=Admin@123
```

**Para salvar e sair do nano:**
1. Pressione `Ctrl + O` (letra O)
2. Pressione `Enter` para confirmar
3. Pressione `Ctrl + X` para sair

### 4.5 Verificar Configuração

```bash
cat .env | grep -E "DB_PASSWORD|JWT_SECRET|HOST_IP|SITE_URL"
```

Verifique se os valores estão corretos.

---

## 🚀 PARTE 5: Iniciando o Sistema

### 5.1 Construir e Iniciar os Containers

```bash
docker compose up -d --build
```

> ⏳ **Aguarde!** Este comando pode demorar de 3 a 10 minutos na primeira vez.

Você verá mensagens como:
```
[+] Building 120.5s (12/12) FINISHED
[+] Running 5/5
 ✔ Container guarda-db       Started
 ✔ Container guarda-api      Started
 ✔ Container guarda-auth     Started
 ✔ Container guarda-gateway  Started
 ✔ Container guarda-app      Started
```

### 5.2 Verificar se Tudo Está Rodando

```bash
docker compose ps
```

Você deve ver todos os containers com status `Up`:

```
NAME              STATUS
guarda-db         Up (healthy)
guarda-api        Up
guarda-auth       Up
guarda-gateway    Up
guarda-app        Up
```

### 5.3 Verificar Logs (se algo der errado)

```bash
docker compose logs -f
```

Pressione `Ctrl + C` para sair dos logs.

---

## 🌐 PARTE 6: Acessando o Sistema

### 6.1 Liberar Porta no Firewall (se necessário)

```bash
sudo ufw allow 80/tcp
sudo ufw allow 22/tcp  # SSH
# NÃO exponha 8000 - Kong é interno ao Docker
```

### 6.2 Acessar pelo Navegador

Abra o navegador no seu computador e acesse:

```
http://IP_DO_SERVIDOR
```

Exemplo:
```
http://192.168.1.100
```

### 6.3 Fazer Login

Use as credenciais padrão:

| Campo | Valor |
|-------|-------|
| **Email** | `admin@sistema.local` |
| **Senha** | `Admin@123` (ou a que você definiu em ADMIN_PASSWORD) |

---

## ✅ PARTE 7: Verificação Final

### 7.1 Testar Funcionalidades

1. ✅ Acessou a tela de login?
2. ✅ Conseguiu fazer login como admin?
3. ✅ Vê o dashboard?
4. ✅ Consegue registrar um visitante?
5. ✅ O scanner QR funciona?

### 7.2 Testar de Outro Dispositivo

Abra o navegador do seu celular e acesse o mesmo IP:

```
http://192.168.1.100
```

---

## 🔒 PARTE 8: Configurar HTTPS (Opcional, mas Recomendado)

> ⚠️ **IMPORTANTE:** A câmera do celular só funciona com HTTPS!

### 8.1 Instalar mkcert

```bash
sudo apt install libnss3-tools wget -y

wget -O mkcert https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64
chmod +x mkcert
sudo mv mkcert /usr/local/bin/
```

### 8.2 Gerar Certificado

Substitua `192.168.1.100` pelo IP do seu servidor:

```bash
cd ~/visitor-pass-master
mkcert -install
mkcert 192.168.1.100
```

### 8.3 Mover Certificados

```bash
mkdir -p docker/certs
mv 192.168.1.100.pem docker/certs/cert.pem
mv 192.168.1.100-key.pem docker/certs/key.pem
```

### 8.4 Atualizar Nginx para HTTPS

```bash
nano docker/nginx.conf
```

Substitua todo o conteúdo por:

```nginx
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name _;
    
    ssl_certificate /etc/nginx/certs/cert.pem;
    ssl_certificate_key /etc/nginx/certs/key.pem;
    
    root /usr/share/nginx/html;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 8.5 Atualizar docker-compose para Montar Certificados

```bash
nano docker-compose.yml
```

Encontre a seção `app:` e adicione o volume de certificados:

```yaml
  app:
    # ... outras configurações ...
    volumes:
      - ./docker/certs:/etc/nginx/certs:ro
    ports:
      - "80:80"
      - "443:443"
```

### 8.6 Reiniciar

```bash
docker compose down
docker compose up -d --build
```

### 8.7 Acessar com HTTPS

```
https://192.168.1.100
```

> ⚠️ O navegador pode mostrar um aviso de certificado. Clique em "Avançado" → "Continuar".

---

## 🛠️ Comandos Úteis do Dia a Dia

### Parar o Sistema
```bash
cd ~/visitor-pass-master
docker compose down
```

### Iniciar o Sistema
```bash
cd ~/visitor-pass-master
docker compose up -d
```

### Reiniciar Tudo
```bash
cd ~/visitor-pass-master
docker compose restart
```

### Ver Logs em Tempo Real
```bash
docker compose logs -f
```

### Ver Logs de um Serviço Específico
```bash
docker compose logs -f guarda-app
docker compose logs -f guarda-db
```

### Fazer Backup do Banco de Dados (Manual)
```bash
mkdir -p ~/backups
docker compose exec guarda-db pg_dump -U postgres guarda_operacional > ~/backups/backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restaurar Backup
```bash
docker compose exec -T guarda-db psql -U postgres guarda_operacional < ~/backups/backup_20240115.sql
```

### Atualizar para Nova Versão
```bash
cd ~/visitor-pass-master
git pull
docker compose up -d --build
```

---

## 🔄 PARTE 9: Backup Automático (Recomendado)

Configure backup automático diário para não perder dados.

### 9.1 Criar Diretório de Backups

```bash
sudo mkdir -p /var/backups/guarda-operacional
sudo chown $USER:$USER /var/backups/guarda-operacional
```

### 9.2 Criar Script de Backup

```bash
nano ~/visitor-pass-master/backup.sh
```

Cole o seguinte conteúdo:

```bash
#!/bin/bash
# ============================================
# Guarda Operacional - Backup Automático
# ============================================

BACKUP_DIR="/var/backups/guarda-operacional"
PROJECT_DIR="$HOME/visitor-pass-master"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Criar backup
cd $PROJECT_DIR
docker compose exec -T guarda-db pg_dump -U postgres guarda_operacional > "$BACKUP_DIR/backup_$DATE.sql"

# Comprimir
gzip "$BACKUP_DIR/backup_$DATE.sql"

# Remover backups antigos (manter últimos 30 dias)
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup concluído: backup_$DATE.sql.gz"
```

### 9.3 Tornar Executável

```bash
chmod +x ~/visitor-pass-master/backup.sh
```

### 9.4 Agendar Backup Diário (2h da manhã)

```bash
crontab -e
```

Adicione a linha no final:

```
0 2 * * * /home/SEU_USUARIO/visitor-pass-master/backup.sh >> /var/log/guarda-backup.log 2>&1
```

> ⚠️ Substitua `SEU_USUARIO` pelo seu nome de usuário real.

### 9.5 Testar Backup

```bash
~/visitor-pass-master/backup.sh
ls -la /var/backups/guarda-operacional/
```

---

## 🔒 PARTE 10: Hardening de Segurança (Produção)

### 10.1 Firewall Correto

**IMPORTANTE:** Não exponha portas internas desnecessariamente.

```bash
# Permitir apenas HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp  # SSH

# BLOQUEAR portas internas (Kong, PostgREST, Auth, DB)
sudo ufw deny 8000/tcp
sudo ufw deny 3000/tcp
sudo ufw deny 9999/tcp
sudo ufw deny 5432/tcp

# Ativar firewall
sudo ufw enable
sudo ufw status
```

### 10.2 Senha do Banco Ultra-Forte

Gere uma senha aleatória de 32 caracteres:

```bash
DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
echo "Sua senha do banco: $DB_PASSWORD"
```

Atualize no `.env`:

```bash
nano .env
# Cole a senha gerada em DB_PASSWORD=
```

### 10.3 Limitar Acesso ao Docker

```bash
# Garantir que apenas root e grupo docker acessem
sudo chmod 660 /var/run/docker.sock
```

### 10.4 Logs de Auditoria

O sistema já possui tabela `audit_logs` que registra:
- ✅ Logins/Logouts
- ✅ Criação de visitantes
- ✅ Alterações de usuários
- ✅ Scans de acesso

Acesse em: **Configurações → Logs de Auditoria**

---

## 🌐 PARTE 11: HTTPS com Let's Encrypt (Domínio Público)

Se você tem um domínio público apontando para o servidor:

### 11.1 Instalar Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 11.2 Gerar Certificado

```bash
sudo certbot --nginx -d seu-dominio.com.br
```

### 11.3 Renovação Automática

O Certbot já configura renovação automática. Teste com:

```bash
sudo certbot renew --dry-run
```

> 💡 Para rede interna sem domínio, use mkcert conforme PARTE 8.

---

## ❓ Problemas Comuns

### "Não consigo acessar pelo navegador"

1. Verifique se o container está rodando:
   ```bash
   docker compose ps
   ```

2. Verifique o IP correto:
   ```bash
   hostname -I
   ```

3. Libere o firewall:
   ```bash
   sudo ufw allow 80
   ```

### "Erro ao fazer login"

1. Verifique os logs do auth:
   ```bash
   docker compose logs guarda-auth
   ```

2. Verifique se o banco inicializou corretamente:
   ```bash
   docker compose logs guarda-db
   ```

### "Container não inicia"

1. Veja os logs detalhados:
   ```bash
   docker compose logs
   ```

2. Reconstrua do zero:
   ```bash
   docker compose down -v
   docker compose up -d --build
   ```

### "Câmera não funciona no celular"

A câmera requer HTTPS. Siga a **PARTE 8** deste tutorial.

---

## 🎉 Parabéns!

Se você chegou até aqui, o sistema **Guarda Operacional** está instalado e funcionando no seu servidor Debian!

**Resumo do que foi instalado:**
- 📦 Docker e Docker Compose
- 🗄️ PostgreSQL (banco de dados)
- 🔐 GoTrue (autenticação)
- 🔌 PostgREST (API REST)
- 🚪 Kong (API Gateway)
- 🌐 Nginx (servidor web)

**Próximos passos sugeridos:**
1. Criar usuários adicionais (perfil security para guarita)
2. Cadastrar departamentos
3. Testar o fluxo completo de visitantes
4. Configurar backup automático

---

*Tutorial criado para o projeto Guarda Operacional*
*Versão: 1.0 | Data: 2024*

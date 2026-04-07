# 🚀 Guia de Deploy - Guarda Operacional

Este guia explica como instalar e rodar o sistema Guarda Operacional em um servidor Debian usando Docker.

## 📋 Pré-requisitos

- Servidor Debian 11/12 (VM ou físico)
- Acesso SSH com usuário sudo
- Mínimo 2GB RAM, 10GB disco

## 🔧 Passo 1: Instalar Docker

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependências
sudo apt install apt-transport-https ca-certificates curl gnupg lsb-release -y

# Adicionar repositório Docker
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker e Compose
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-compose-plugin -y

# Adicionar usuário ao grupo docker (opcional)
sudo usermod -aG docker $USER
# Faça logout e login novamente
```

## 📥 Passo 2: Baixar o Projeto

```bash
# Clonar repositório
git clone https://github.com/ocaiobarros/visitor-pass-master.git
cd visitor-pass-master
```

## ⚙️ Passo 3: Configurar Ambiente

```bash
# Copiar template de variáveis
cp .env.example .env

# Editar configurações
nano .env
```

### Configurações Obrigatórias no `.env`:

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `DB_PASSWORD` | Senha do PostgreSQL | `SenhaForte123!` |
| `JWT_SECRET` | Chave para tokens | `openssl rand -base64 32` |
| `HOST_IP` | IP do servidor | `192.168.1.100` |
| `ADMIN_PASSWORD` | Senha do admin | `Admin@123` |

```bash
# Gerar JWT_SECRET automaticamente
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
```

## 🚀 Passo 4: Iniciar o Sistema

```bash
# Construir e iniciar todos os containers
docker compose up -d --build

# Verificar status
docker compose ps

# Ver logs (opcional)
docker compose logs -f
```

## ✅ Passo 5: Acessar o Sistema

1. Abra no navegador: `http://IP_DO_SERVIDOR`
2. Faça login com:
   - **Email:** `admin@sistema.local`
   - **Senha:** (definida em `ADMIN_PASSWORD` no `.env`)

## 📊 Arquitetura dos Containers

```
┌─────────────────────────────────────────────────────────┐
│                    GUARDA OPERACIONAL                   │
├─────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌───────────┐  │
│  │   App   │  │  Kong   │  │  Auth   │  │ PostgREST │  │
│  │ (Nginx) │→ │ Gateway │→ │(GoTrue) │  │   (API)   │  │
│  │  :80    │  │  :8000  │  │  :9999  │  │   :3000   │  │
│  └─────────┘  └─────────┘  └────┬────┘  └─────┬─────┘  │
│                                 │              │        │
│                          ┌──────┴──────────────┴──┐     │
│                          │      PostgreSQL        │     │
│                          │        :5432           │     │
│                          └────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

## 🛠️ Comandos Úteis

```bash
# Parar todos os containers
docker compose down

# Reiniciar um serviço específico
docker compose restart app

# Ver logs de um serviço
docker compose logs -f postgres

# Acessar shell do PostgreSQL
docker compose exec postgres psql -U postgres -d guarda_operacional

# Backup do banco de dados
docker compose exec postgres pg_dump -U postgres guarda_operacional > backup.sql

# Restaurar backup
docker compose exec -T postgres psql -U postgres guarda_operacional < backup.sql

# Atualizar para nova versão
git pull
docker compose down
docker compose up -d --build
# ⚠️ O serviço 'migrate' aplica automaticamente migrations pendentes no startup.
# Não é necessário executar SQL manualmente.
```

### ⚙️ Como funciona a atualização de banco

O projeto usa **migrations versionadas automáticas**:

1. Arquivos SQL em `docker/migrations/` são nomeados com prefixo numérico (ex: `001_report_rpcs.sql`)
2. No `docker compose up`, o serviço `migrate` roda antes do PostgREST
3. Cada migration é aplicada **uma única vez** (rastreada na tabela `schema_migrations`)
4. Após aplicar, o PostgREST recebe `NOTIFY pgrst, 'reload schema'` automaticamente

**Para adicionar novas migrations**: crie um arquivo `docker/migrations/NNN_descricao.sql` com o próximo número sequencial.

**Para verificar migrations aplicadas**:
```bash
docker compose exec postgres psql -U postgres -d guarda_operacional \
  -c "SELECT version, applied_at FROM schema_migrations ORDER BY version;"
```

## 🔒 Configuração HTTPS (Produção)

Para habilitar HTTPS (necessário para câmera do celular):

### Opção 1: Certificado Auto-assinado (Rede Interna)

```bash
# Instalar mkcert
sudo apt install libnss3-tools -y
curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
chmod +x mkcert-v*-linux-amd64
sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert

# Gerar certificado
mkcert -install
mkcert SEU_IP_DO_SERVIDOR

# Configurar nginx para HTTPS
# Edite docker/nginx.conf para adicionar o bloco SSL
```

### Opção 2: Let's Encrypt (Domínio Público)

```bash
# Adicionar Certbot ao docker-compose ou usar proxy reverso com Traefik
```

## ❓ Solução de Problemas

### Container não inicia
```bash
docker compose logs NOME_DO_SERVICO
```

### Erro de conexão com banco
- Verifique se `DB_PASSWORD` está correto no `.env`
- Aguarde 30 segundos após `docker compose up` para o banco inicializar

### Página não carrega
- Verifique se a porta 80 está liberada: `sudo ufw allow 80`
- Confirme o IP correto: `hostname -I`

### Câmera não funciona no celular
- A câmera requer HTTPS. Configure conforme seção de HTTPS acima.

## 📞 Suporte

- **Repositório:** https://github.com/ocaiobarros/visitor-pass-master
- **Issues:** https://github.com/ocaiobarros/visitor-pass-master/issues

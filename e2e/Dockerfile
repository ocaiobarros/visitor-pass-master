# ============================================
# Guarda Operacional - Playwright E2E Tests
# ============================================
FROM mcr.microsoft.com/playwright:v1.52.0-jammy

WORKDIR /e2e

# Copiar package.json e instalar dependências
COPY package.json tsconfig.json ./
RUN npm install

# Copiar código de testes e scripts
COPY . .

# Criar diretório para scripts externos (montado via volume)
RUN mkdir -p /e2e/scripts /e2e-artifacts

# Comando padrão
CMD ["npx", "playwright", "test"]

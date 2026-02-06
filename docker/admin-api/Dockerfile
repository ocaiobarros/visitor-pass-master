# ============================================
# GUARDA OPERACIONAL - Admin API Dockerfile
# ============================================

FROM node:20-alpine

WORKDIR /app

# Copiar arquivos de dependência
COPY package.json ./

# Instalar dependências
RUN npm install --production

# Copiar código
COPY index.js ./

# Porta
EXPOSE 3001

# Usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

# Start
CMD ["node", "index.js"]

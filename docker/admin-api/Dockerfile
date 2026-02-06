# ============================================
# GUARDA OPERACIONAL - Admin API Dockerfile
# ============================================

FROM node:20-alpine

WORKDIR /app

# Instalar wget para healthcheck
RUN apk add --no-cache wget

# Copiar arquivos de dependência
COPY package.json ./

# Instalar dependências
RUN npm install --production

# Copiar código
COPY index.js logger.js ./

# Porta
EXPOSE 3001

# Usuário não-root (mas com acesso a /var/log/visitor-pass)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p /var/log/visitor-pass && \
    chown -R nodejs:nodejs /var/log/visitor-pass

USER nodejs

# Start
CMD ["node", "index.js"]

# ============================================
# Guarda Operacional - Dockerfile
# Build e serve do frontend React/Vite
# ============================================

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package files
COPY package.json package-lock.json* bun.lockb* ./

# Instalar dependências
RUN npm ci --legacy-peer-deps

# Copiar código fonte
COPY . .

# Argumentos de build para variáveis de ambiente
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SYSTEM_NAME="GUARDA OPERACIONAL"
ARG VITE_ADMIN_API_URL

# Definir variáveis de ambiente para o build
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SYSTEM_NAME=$VITE_SYSTEM_NAME
ENV VITE_ADMIN_API_URL=$VITE_ADMIN_API_URL

# Build da aplicação
RUN npm run build

# Stage 2: Serve com Nginx
FROM nginx:alpine

# Copiar configuração personalizada do nginx
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copiar arquivos buildados
COPY --from=builder /app/dist /usr/share/nginx/html

# Expor porta
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

FROM mcr.microsoft.com/playwright:v1.47.0-jammy

WORKDIR /app

# Dependências
COPY package*.json ./
RUN npm ci

# Código
COPY . .

# Build (se não existir 'build', não quebra)
RUN npm run build || echo "no build step"

# Garantir permissão de execução do entrypoint dentro do container
RUN chmod +x /app/entrypoint.sh || true

# Ambiente padrão para cloud/local
ENV NODE_ENV=production \
    TZ=America/Sao_Paulo \
    CHROME_NO_SANDBOX=1 \
    CHROME_DEVSHM_FIX=1 \
    HEADLESS=true

# Pastas persistentes
VOLUME ["/data", "/app/sessions", "/app/assets"]

# Usuário não-root seguro (vem na imagem)
USER pwuser

# Entrypoint: decodifica secrets (se houver) e chama sua CLI
ENTRYPOINT ["/bin/bash","/app/entrypoint.sh"]
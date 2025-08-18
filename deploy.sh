#!/bin/bash

# Script de Deploy para VPS Hostinger
# Vendaboost Puppeteer - Facebook Marketplace Automation

set -e

echo "🚀 Iniciando deploy do Vendaboost Puppeteer..."

# Configurações
APP_NAME="vendaboost-marketplace"
APP_DIR="/home/$(whoami)/vendaboost"
REPO_URL="https://github.com/seu_usuario/vendaboost-puppeteer.git"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${GREEN}📋 $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Verificar se está rodando como root
if [ "$EUID" -eq 0 ]; then
    print_error "Não execute este script como root!"
    exit 1
fi

# 1. Preparar ambiente
print_step "Preparando ambiente..."
mkdir -p $APP_DIR
cd $APP_DIR

# 2. Instalar dependências do sistema (se necessário)
print_step "Verificando dependências do sistema..."
if ! command -v node &> /dev/null; then
    print_warning "Node.js não encontrado. Instale primeiro:"
    echo "curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
    echo "sudo apt-get install -y nodejs"
    exit 1
fi

if ! command -v pm2 &> /dev/null; then
    print_warning "PM2 não encontrado. Instalando..."
    sudo npm install -g pm2
fi

# 3. Clonar/atualizar código
print_step "Baixando código..."
if [ -d ".git" ]; then
    git pull origin main
else
    print_warning "Clone manualmente o repositório para $APP_DIR"
    echo "git clone $REPO_URL ."
    exit 1
fi

# 4. Instalar dependências Node.js
print_step "Instalando dependências..."
npm install --production

# 5. Instalar dependências do Puppeteer/Chromium
print_step "Verificando dependências do Chromium..."
CHROMIUM_DEPS=(
    "libnss3" "libnspr4" "libdbus-1-3" "libatk1.0-0" 
    "libatk-bridge2.0-0" "libcups2" "libdrm2" "libgtk-3-0" 
    "libgtk-4-1" "libasound2" "libxss1" "libgconf-2-4" 
    "libxrandr2" "libpangocairo-1.0-0" "libcairo-gobject2" 
    "libgdk-pixbuf2.0-0" "libxcomposite1" "libxcursor1" 
    "libxdamage1" "libxext6" "libxfixes3" "libxi6" 
    "libxinerama1" "libxrender1" "libxtst6" "ca-certificates" 
    "fonts-liberation" "libappindicator1" "lsb-release" 
    "xdg-utils" "wget" "libgbm1"
)

for dep in "${CHROMIUM_DEPS[@]}"; do
    if ! dpkg -l | grep -q "^ii  $dep "; then
        print_warning "Dependência faltando: $dep"
        echo "Execute: sudo apt-get install -y ${CHROMIUM_DEPS[*]}"
        exit 1
    fi
done

# 6. Configurar variáveis de ambiente
print_step "Configurando variáveis de ambiente..."
cat > .env << EOF
# Configuração de Produção - Vendaboost Puppeteer
PORT=3000
NODE_ENV=production
HEADLESS=true
USER_DATA_DIR=$APP_DIR/user-data

# Otimizações para servidor
MAX_OLD_SPACE_SIZE=1024
UV_THREADPOOL_SIZE=4
EOF

# 7. Criar diretório para dados do usuário
mkdir -p user-data

# 8. Configurar PM2
print_step "Configurando PM2..."
if pm2 describe $APP_NAME > /dev/null 2>&1; then
    print_step "Atualizando aplicação existente..."
    pm2 reload $APP_NAME
else
    print_step "Criando nova aplicação..."
    pm2 start server.js --name $APP_NAME --max-memory-restart 512M
fi

# 9. Salvar configuração PM2
pm2 save

# 10. Configurar auto-start
if ! sudo systemctl is-enabled pm2-$(whoami) > /dev/null 2>&1; then
    print_step "Configurando auto-start..."
    pm2 startup | sudo -E bash -
fi

# 11. Verificar status
print_step "Verificando status da aplicação..."
sleep 5
if pm2 describe $APP_NAME | grep -q "online"; then
    print_step "✅ Deploy concluído com sucesso!"
    echo ""
    echo "🌐 Aplicação rodando em: http://localhost:3000"
    echo "📊 Monitor: pm2 monit"
    echo "📋 Logs: pm2 logs $APP_NAME"
    echo "🔄 Reiniciar: pm2 restart $APP_NAME"
    echo ""
    print_warning "IMPORTANTE: Execute o primeiro login manualmente!"
    echo "1. pm2 stop $APP_NAME"
    echo "2. HEADLESS=false npm start"
    echo "3. Faça login no Facebook via navegador"
    echo "4. pm2 start $APP_NAME"
else
    print_error "Deploy falhou! Verifique os logs:"
    pm2 logs $APP_NAME --lines 20
    exit 1
fi

print_step "🎉 Deploy finalizado!"
#!/bin/bash

echo "🔧 Corrigindo problema de 'Continuar como...' na VPS"

# 1. Parar serviços
echo "⏹️ Parando serviços..."
pm2 stop all 2>/dev/null || true

# 2. Limpar dados de perfil do navegador
echo "🧹 Limpando dados de perfil do navegador..."
rm -rf .user-profiles/
rm -rf data/user/
rm -rf /tmp/playwright-*
rm -rf ~/.cache/ms-playwright/

# 3. Criar diretório limpo
echo "📁 Criando estrutura limpa..."
mkdir -p .user-profiles/default

# 4. Configurar variável de ambiente para usar contexto incognito
echo "⚙️ Configurando variáveis de ambiente..."
export BROWSER_CLEAN_START=true

# 5. Reinstalar dependências do Playwright se necessário
echo "📦 Verificando Playwright..."
npx playwright install chromium
npx playwright install-deps

# 6. Reiniciar serviços
echo "🚀 Reiniciando serviços..."
pm2 start api-bridge

echo "✅ Correção aplicada!"
echo ""
echo "📝 Notas importantes:"
echo "- Os dados de sessão anteriores foram limpos"
echo "- O navegador iniciará limpo a cada execução"
echo "- A sessão será carregada apenas via cookies da extensão"
echo ""
echo "🔄 Por favor, teste novamente a automação pelo painel!"
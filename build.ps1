# Script para build da extensao VendaBoost com Sistema de Login
Write-Host "🚀 Iniciando build da extensao VendaBoost Pro..." -ForegroundColor Green

# Verifica se node_modules existe
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Instalando dependencias da extensao..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erro ao instalar dependencias!" -ForegroundColor Red
        exit 1
    }
}

# Verifica e configura o sistema de login
Write-Host "`n🔐 Verificando sistema de login..." -ForegroundColor Yellow
if (-not (Test-Path "login-system/node_modules")) {
    Write-Host "📦 Instalando dependencias do sistema de login..." -ForegroundColor Yellow
    cd login-system
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erro ao instalar dependencias do login!" -ForegroundColor Red
        cd ..
        exit 1
    }
    cd ..
}

# Verifica se o banco de dados existe
if (-not (Test-Path "login-system/users.db")) {
    Write-Host "🗄️ Inicializando banco de dados de usuarios..." -ForegroundColor Yellow
    cd login-system
    npm run init-db
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erro ao inicializar banco de dados!" -ForegroundColor Red
        cd ..
        exit 1
    }
    cd ..
    Write-Host "✅ Banco criado com usuario admin padrão (admin/admin123)" -ForegroundColor Green
}

# Executa o build da extensão
Write-Host "`n🔨 Executando build da extensao..." -ForegroundColor Yellow
npm run build:extension

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n🎉 Build concluido com sucesso!" -ForegroundColor Green
    Write-Host "📁 Arquivos da extensao estao em: dist/" -ForegroundColor Cyan
    Write-Host "`n📝 Para usar a extensao:" -ForegroundColor Cyan
    Write-Host "   1. Instalar no Chrome:" -ForegroundColor White
    Write-Host "      • Abra chrome://extensions/" -ForegroundColor Gray
    Write-Host "      • Ative o 'Modo de desenvolvedor'" -ForegroundColor Gray
    Write-Host "      • Clique em 'Carregar extensao expandida'" -ForegroundColor Gray
    Write-Host "      • Selecione a pasta 'dist'" -ForegroundColor Gray
    Write-Host "`n   2. Para usar com autenticacao completa:" -ForegroundColor White
    Write-Host "      • Execute: npm run start:auth" -ForegroundColor Gray
    Write-Host "      • Login padrao: admin / admin123" -ForegroundColor Gray
    Write-Host "`n🔗 Mais informações: BUILD_GUIDE.md" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ Erro durante o build!" -ForegroundColor Red
    exit 1
}

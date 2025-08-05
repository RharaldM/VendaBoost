# Script para build da extensao VendaBoost
Write-Host "Iniciando build da extensao VendaBoost..." -ForegroundColor Green

# Verifica se node_modules existe
if (-not (Test-Path "node_modules")) {
    Write-Host "Instalando dependencias..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Erro ao instalar dependencias!" -ForegroundColor Red
        exit 1
    }
}

# Executa o build
Write-Host "Executando build..." -ForegroundColor Yellow
npm run build:extension

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build concluido com sucesso!" -ForegroundColor Green
    Write-Host "Arquivos da extensao estao em: dist/" -ForegroundColor Cyan
    Write-Host "Para instalar no Chrome:" -ForegroundColor Cyan
    Write-Host "   1. Abra chrome://extensions/" -ForegroundColor White
    Write-Host "   2. Ative o 'Modo de desenvolvedor'" -ForegroundColor White
    Write-Host "   3. Clique em 'Carregar extensao expandida'" -ForegroundColor White
    Write-Host "   4. Selecione a pasta 'dist'" -ForegroundColor White
} else {
    Write-Host "Erro durante o build!" -ForegroundColor Red
    exit 1
}

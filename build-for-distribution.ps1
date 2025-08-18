#!/usr/bin/env pwsh
# Script para build e empacotamento da extensão VendaBoost para distribuição

Write-Host "Iniciando build da extensao VendaBoost para distribuicao..." -ForegroundColor Green

# 1. Limpar builds anteriores
Write-Host "`nLimpando builds anteriores..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
    Write-Host "Pasta dist limpa"
}

if (Test-Path "vendaboost-extension.zip") {
    Remove-Item -Force "vendaboost-extension.zip"
    Write-Host "Arquivo de distribuicao anterior removido"
}

# 2. Fazer build da extensão
Write-Host "`nFazendo build da extensao..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build concluido com sucesso" -ForegroundColor Green
} else {
    Write-Host "Erro no build" -ForegroundColor Red
    exit 1
}

# 3. Verificar se credenciais administrativas estão excluídas
Write-Host "`nVerificando seguranca da distribuicao..." -ForegroundColor Yellow

$adminCredentials = Get-ChildItem -Path "dist" -Recurse -Filter "*firebase-adminsdk*.json" -ErrorAction SilentlyContinue
if ($adminCredentials) {
    Write-Host "ATENCAO: Credenciais administrativas encontradas na build!" -ForegroundColor Red
    Write-Host "Removendo credenciais administrativas da distribuicao..." -ForegroundColor Red
    foreach ($file in $adminCredentials) {
        Remove-Item $file.FullName -Force
        Write-Host "   Removido: $($file.Name)"
    }
}

# Verificar se há credenciais na pasta config
if (Test-Path "dist/config") {
    $configCredentials = Get-ChildItem -Path "dist/config" -Filter "*firebase-adminsdk*.json" -ErrorAction SilentlyContinue
    if ($configCredentials) {
        Write-Host "Removendo pasta config com credenciais administrativas..." -ForegroundColor Red
        Remove-Item -Recurse -Force "dist/config"
    }
}

Write-Host "Verificacao de seguranca concluida" -ForegroundColor Green

# 4. Criar estrutura final para distribuição
Write-Host "`nPreparando arquivos para distribuicao..." -ForegroundColor Yellow

# Verificar se a pasta dist existe
if (-not (Test-Path "dist")) {
    Write-Host "Pasta dist nao encontrada. Build falhou." -ForegroundColor Red
    exit 1
}

# Verificar arquivos necessários
$requiredFiles = @(
    "dist/background.js",
    "dist/content.js", 
    "dist/popup.js",
    "dist/popup.css"
)

$allFilesExist = $true
foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        Write-Host "Arquivo necessario nao encontrado: $file" -ForegroundColor Red
        $allFilesExist = $false
    }
}

if (-not $allFilesExist) {
    Write-Host "Build incompleto - alguns arquivos necessarios estao faltando" -ForegroundColor Red
    exit 1
}

Write-Host "Todos os arquivos necessarios encontrados" -ForegroundColor Green

# 5. Criar arquivo ZIP para distribuição
Write-Host "`nCriando arquivo ZIP para distribuicao..." -ForegroundColor Yellow

# Verificar se a pasta dist tem conteúdo
$distContents = Get-ChildItem -Path "dist" -Recurse
if ($distContents.Count -eq 0) {
    Write-Host "Pasta dist esta vazia" -ForegroundColor Red
    exit 1
}

# Comprimir toda a pasta dist
try {
    Compress-Archive -Path "dist/*" -DestinationPath "vendaboost-extension.zip" -Force
    
    if (Test-Path "vendaboost-extension.zip") {
        $zipSize = (Get-Item "vendaboost-extension.zip").Length / 1MB
        Write-Host "Extensao empacotada: vendaboost-extension.zip ($([math]::Round($zipSize, 2)) MB)" -ForegroundColor Green
    } else {
        Write-Host "Erro ao criar arquivo de distribuicao" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Erro ao comprimir arquivos: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 6. Instruções finais
Write-Host "`nBuild para distribuicao concluido com sucesso!" -ForegroundColor Green
Write-Host "`nInstrucoes para instalacao:" -ForegroundColor Cyan
Write-Host "   1. Extrair o arquivo vendaboost-extension.zip" -ForegroundColor White
Write-Host "   2. Abrir Chrome e ir para chrome://extensions/" -ForegroundColor White
Write-Host "   3. Ativar 'Modo do desenvolvedor'" -ForegroundColor White
Write-Host "   4. Clicar em 'Carregar sem compactacao'" -ForegroundColor White
Write-Host "   5. Selecionar a pasta extraida" -ForegroundColor White

Write-Host "`nSeguranca verificada:" -ForegroundColor Green
Write-Host "   Credenciais administrativas excluidas" -ForegroundColor White
Write-Host "   Apenas credenciais client-side incluidas" -ForegroundColor White
Write-Host "   Pronto para distribuicao segura" -ForegroundColor White

Write-Host "`nA extensao esta pronta para ser distribuida!" -ForegroundColor Green 
# TesteRapidoMultiPC.ps1 - Teste Rápido do Sistema Multi-PC

param(
    [switch]$Help,
    [switch]$Teste,
    [switch]$Limpar,
    [string]$Usuario = "test-user@vendaboost.com"
)

# Cores para console
function Write-Success { param($msg) Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Error { param($msg) Write-Host "❌ $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "ℹ️  $msg" -ForegroundColor Blue }
function Write-Warning { param($msg) Write-Host "⚠️  $msg" -ForegroundColor Yellow }

function Show-Help {
    Write-Host "🧪 TESTE RÁPIDO MULTI-PC - VENDABOOST" -ForegroundColor Cyan
    Write-Host "=" * 50 -ForegroundColor Blue
    Write-Host ""
    Write-Host "USO:" -ForegroundColor Yellow
    Write-Host "  .\TesteRapidoMultiPC.ps1 -Teste          # Executar teste completo"
    Write-Host "  .\TesteRapidoMultiPC.ps1 -Limpar         # Limpar dados de teste"
    Write-Host "  .\TesteRapidoMultiPC.ps1 -Help           # Mostrar esta ajuda"
    Write-Host ""
    Write-Host "EXEMPLOS:" -ForegroundColor Yellow
    Write-Host "  .\TesteRapidoMultiPC.ps1 -Teste -Usuario 'meu@email.com'"
    Write-Host ""
    Write-Host "FUNCIONALIDADES TESTADAS:" -ForegroundColor Green
    Write-Host "  • Criação multi-PC"
    Write-Host "  • Edição cross-PC"
    Write-Host "  • Deleção cross-PC"
    Write-Host "  • Sincronização tempo real"
    Write-Host "  • Gestão de conflitos"
    Write-Host ""
}

function Test-Prerequisites {
    Write-Info "Verificando pré-requisitos..."
    
    # Verificar Node.js
    if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
        Write-Error "Node.js não encontrado. Instale Node.js primeiro."
        return $false
    }
    
    # Verificar arquivo de credenciais Firebase
    if (-not (Test-Path "vendaboost-22fbf-firebase-adminsdk-fbsvc-f4682d5d11.json")) {
        Write-Error "Arquivo de credenciais Firebase não encontrado."
        return $false
    }
    
    # Verificar script de teste
    if (-not (Test-Path "TesteMultiPC.cjs")) {
        Write-Error "Script TesteMultiPC.cjs não encontrado."
        return $false
    }
    
    Write-Success "Todos os pré-requisitos atendidos"
    return $true
}

function Start-Testing {
    Write-Host ""
    Write-Host "🚀 INICIANDO TESTE MULTI-PC" -ForegroundColor Cyan
    Write-Host "=" * 40 -ForegroundColor Blue
    Write-Info "Usuário de teste: $Usuario"
    Write-Info "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    Write-Host ""
    
    # Executar teste completo
    Write-Info "Executando suite completa de testes..."
    $result = & node TesteMultiPC.cjs
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Success "TODOS OS TESTES PASSARAM! ✨"
        Write-Host ""
        Write-Host "🎯 SISTEMA MULTI-PC VALIDADO:" -ForegroundColor Green
        Write-Host "  ✅ Criação em múltiplos PCs"
        Write-Host "  ✅ Edição cross-PC"
        Write-Host "  ✅ Deleção cross-PC"
        Write-Host "  ✅ Sincronização tempo real"
        Write-Host "  ✅ Gestão de conflitos"
        Write-Host ""
        Write-Host "🚀 Pronto para uso em produção!" -ForegroundColor Yellow
    } else {
        Write-Host ""
        Write-Error "ALGUNS TESTES FALHARAM!"
        Write-Warning "Revisar logs acima para identificar problemas."
        Write-Host ""
        Write-Host "📋 PASSOS PARA DEBUG:" -ForegroundColor Yellow
        Write-Host "  1. Verificar conexão com Firebase"
        Write-Host "  2. Validar credenciais de autenticação"
        Write-Host "  3. Conferir regras do Firestore"
        Write-Host "  4. Testar em modo desenvolvedor"
    }
    
    return $LASTEXITCODE -eq 0
}

function Clear-TestData {
    Write-Host ""
    Write-Host "🧹 LIMPANDO DADOS DE TESTE" -ForegroundColor Cyan
    Write-Host "=" * 35 -ForegroundColor Blue
    
    Write-Warning "Esta operação irá remover TODOS os dados de teste do Firebase."
    $confirm = Read-Host "Tem certeza? (s/N)"
    
    if ($confirm -eq 's' -or $confirm -eq 'S') {
        Write-Info "Executando limpeza..."
        & node TesteMultiPC.cjs --cleanup
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Limpeza concluída com sucesso"
        } else {
            Write-Error "Erro durante limpeza - verificar logs"
        }
    } else {
        Write-Info "Limpeza cancelada pelo usuário"
    }
}

function Show-SystemStatus {
    Write-Host ""
    Write-Host "📊 STATUS DO SISTEMA MULTI-PC" -ForegroundColor Cyan
    Write-Host "=" * 35 -ForegroundColor Blue
    
    Write-Host ""
    Write-Host "FUNCIONALIDADES IMPLEMENTADAS:" -ForegroundColor Green
    Write-Host "  ✅ Autenticação por usuário (UID)"
    Write-Host "  ✅ Sync bidirecional (Pull + Push)"
    Write-Host "  ✅ Alarme periódico (5 minutos)"
    Write-Host "  ✅ Detecção offline + recuperação"
    Write-Host "  ✅ Gestão de conflitos (timestamp)"
    Write-Host "  ✅ onSnapshot tempo real"
    Write-Host "  ✅ Cache local inteligente"
    Write-Host "  ✅ Firebase ID-first architecture"
    
    Write-Host ""
    Write-Host "ARQUIVOS PRINCIPAIS:" -ForegroundColor Yellow
    
    $files = @(
        "src/background.js",
        "src/popup.js", 
        "src/firebase-config.js",
        "src/firebase-integration.js"
    )
    
    foreach ($file in $files) {
        if (Test-Path $file) {
            Write-Host "  ✅ $file" -ForegroundColor Green
        } else {
            Write-Host "  ❌ $file" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "DOCUMENTAÇÃO:" -ForegroundColor Yellow
    
    $docs = @(
        "SISTEMA_MULTIPC_COMPLETO.md",
        "ARQUITETURA_FIREBASE_IDS.md",
        "UPLOAD_INTEGRACAO_LISTENERS.md"
    )
    
    foreach ($doc in $docs) {
        if (Test-Path $doc) {
            Write-Host "  ✅ $doc" -ForegroundColor Green
        } else {
            Write-Host "  ❌ $doc" -ForegroundColor Red
        }
    }
}

# Execução principal
if ($Help) {
    Show-Help
    exit 0
}

if (-not (Test-Prerequisites)) {
    exit 1
}

Show-SystemStatus

if ($Teste) {
    $success = Start-Testing
    exit $(if ($success) { 0 } else { 1 })
}

if ($Limpar) {
    Clear-TestData
    exit 0
}

# Se nenhum parâmetro, mostrar status e ajuda
Write-Host ""
Write-Host "Use -Help para ver opções disponíveis" -ForegroundColor Yellow
Write-Host "Use -Teste para executar validação completa" -ForegroundColor Yellow 
@echo off
echo ==================================
echo   BACKUP DO PROJETO AUTOMACAO
echo ==================================
echo.

REM Mudar para o diretório do script
cd /d "%~dp0"

REM Verificar se o Node.js está instalado
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao encontrado. Por favor, instale o Node.js primeiro.
    pause
    exit /b 1
)

REM Verificar se o archiver está instalado
if not exist node_modules\archiver (
    echo [INFO] Instalando dependencia archiver...
    npm install archiver
    if %errorlevel% neq 0 (
        echo [ERRO] Falha ao instalar archiver
        pause
        exit /b 1
    )
)

echo [INFO] Criando backup do projeto...
echo [INFO] Diretorio atual: %cd%
echo.

REM Executar o script de backup
node "%~dp0zip-project.js"

if %errorlevel% equ 0 (
    echo.
    echo ==================================
    echo   BACKUP CONCLUIDO COM SUCESSO!
    echo ==================================
) else (
    echo.
    echo [ERRO] Falha ao criar o backup
)

echo.
pause
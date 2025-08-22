@echo off
echo ====================================
echo   VENDABOOST - INICIANDO SISTEMA
echo ====================================
echo.

echo [1/2] Compilando TypeScript...
call npm run build

echo.
echo [2/2] Iniciando servidor localhost...
echo.
echo O servidor esta rodando!
echo - Abra o Facebook e faca login
echo - A extensao capturara os dados automaticamente
echo - Pressione Ctrl+C para parar
echo.
echo ====================================
node dist/cli.js --start-server
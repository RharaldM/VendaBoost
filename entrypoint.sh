#!/usr/bin/env bash
set -euo pipefail

mkdir -p /app/sessions /data/user

# Se vierem arquivos via ENV (base64), decodifica:
if [[ -n "${EXTENSION_SESSION_B64:-}" ]]; then
  echo "$EXTENSION_SESSION_B64" | base64 -d > /app/sessions/extension-session.json
fi
if [[ -n "${FLOW_B64:-}" ]]; then
  echo "$FLOW_B64" | base64 -d > /app/flow.json
fi
if [[ -n "${GROUPS_B64:-}" ]]; then
  echo "$GROUPS_B64" | base64 -d > /app/grupos.txt
fi

# Flags seguras do Chromium quando em container
export CHROME_ARGS=""
if [[ "${CHROME_NO_SANDBOX:-1}" == "1" ]]; then
  CHROME_ARGS+=" --no-sandbox --disable-setuid-sandbox"
fi
if [[ "${CHROME_DEVSHM_FIX:-1}" == "1" ]]; then
  CHROME_ARGS+=" --disable-dev-shm-usage"
fi
export CHROME_ARGS

# Executa sua CLI (ajuste os caminhos se necessário)
if [[ -f "dist/cli.js" ]]; then
  node dist/cli.js \
    --flow /app/flow.json \
    --groups /app/grupos.txt \
    --headless "${HEADLESS:-true}" \
    --extension-session /app/sessions/extension-session.json
elif [[ -f "package.json" ]]; then
  npm start
else
  echo "Nenhuma entry encontrada (dist/cli.js ou npm start)."
  exit 1
fi
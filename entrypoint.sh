#!/usr/bin/env bash
set -euo pipefail

mkdir -p /app/sessions /data/user

# --- sessão da extensão (nome customizado) ---
EXT_NAME="${EXTENSION_SESSION_NAME:-vendaboost-session-2025-08-18T17-27-36.json}"
if [[ -n "${EXTENSION_SESSION_B64:-}" ]]; then
  echo "$EXTENSION_SESSION_B64" | base64 -d > "/app/sessions/$EXT_NAME"
fi

# --- storage state (Playwright) ---
if [[ -n "${STORAGE_STATE_B64:-}" ]]; then
  echo "$STORAGE_STATE_B64" | base64 -d > /app/sessions/storage-state.json
fi

# --- outros arquivos ---
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

# --- argumentos extras ---
EXTRA_ARGS=()
if [[ -f "/app/sessions/storage-state.json" ]]; then
  EXTRA_ARGS+=(--storage-state "/app/sessions/storage-state.json")
fi
if [[ -f "/app/sessions/$EXT_NAME" ]]; then
  EXTRA_ARGS+=(--extension-session "/app/sessions/$EXT_NAME")
fi

# Executa sua CLI (ajuste os caminhos se necessário)
if [[ -f "dist/cli.js" ]]; then
  node dist/cli.js \
    --flow /app/flow.json \
    --headless "${HEADLESS:-true}" \
    "${EXTRA_ARGS[@]}"
    # --groups /app/grupos.txt \
elif [[ -f "package.json" ]]; then
  npm start
else
  echo "Nenhuma entry encontrada (dist/cli.js ou npm start)."
  exit 1
fi
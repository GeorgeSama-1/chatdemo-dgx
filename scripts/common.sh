#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_DIR="$ROOT_DIR/backend"
BACKEND_ENV="$BACKEND_DIR/.env"
FRONTEND_ENV="$FRONTEND_DIR/.env.local"
RUNTIME_DIR="$ROOT_DIR/.runtime"
BACKEND_PORT="${CHATDEMO_BACKEND_PORT:-}"
FRONTEND_PORT="${CHATDEMO_FRONTEND_PORT:-}"
MODEL_START_ENABLED="${CHATDEMO_MODEL_START_ENABLED:-}"
MODEL_CONDA_SH="${CHATDEMO_MODEL_CONDA_SH:-}"
MODEL_CONDA_ENV="${CHATDEMO_MODEL_CONDA_ENV:-}"
MODEL_START_COMMAND="${CHATDEMO_MODEL_START_COMMAND:-}"
MODEL_HEALTH_URL="${CHATDEMO_MODEL_HEALTH_URL:-}"
NODE_BIN="${CHATDEMO_NODE_BIN:-}"
NPM_BIN="${CHATDEMO_NPM_BIN:-}"

load_user_shell_env() {
  local candidate
  for candidate in "$HOME/.profile" "$HOME/.bash_profile" "$HOME/.bashrc" "$HOME/.zprofile" "$HOME/.zshrc"; do
    if [[ -f "$candidate" ]]; then
      # shellcheck disable=SC1090
      source "$candidate" >/dev/null 2>&1 || true
    fi
  done
}

detect_node_bin() {
  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi

  local candidate
  for candidate in \
    "$HOME/.nvm/versions/node"/*/bin/node \
    "$HOME/.local/bin/node" \
    "/usr/local/bin/node" \
    "/usr/bin/node"; do
    if [[ -x "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done
}

detect_npm_bin() {
  if command -v npm >/dev/null 2>&1; then
    command -v npm
    return 0
  fi

  local candidate
  for candidate in \
    "$HOME/.nvm/versions/node"/*/bin/npm \
    "$HOME/.local/bin/npm" \
    "/usr/local/bin/npm" \
    "/usr/bin/npm"; do
    if [[ -x "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done
}

ensure_node_runtime() {
  load_user_shell_env

  if [[ -z "$NODE_BIN" ]]; then
    NODE_BIN="$(detect_node_bin || true)"
  fi

  if [[ -z "$NPM_BIN" ]]; then
    NPM_BIN="$(detect_npm_bin || true)"
  fi

  if [[ -z "$NODE_BIN" || -z "$NPM_BIN" ]]; then
    echo "[error] Unable to find node/npm. Please ensure Node.js is installed and available in your shell profile." >&2
    echo "[error] You can also set CHATDEMO_NODE_BIN and CHATDEMO_NPM_BIN explicitly." >&2
    return 1
  fi
}

ensure_env_files() {
  if [[ ! -f "$BACKEND_ENV" ]]; then
    cp "$ROOT_DIR/.env.example" "$BACKEND_ENV"
    echo "[setup] Created backend/.env from .env.example"
  fi

  if [[ ! -f "$FRONTEND_ENV" ]]; then
    cp "$ROOT_DIR/.env.example" "$FRONTEND_ENV"
    echo "[setup] Created frontend/.env.local from .env.example"
  fi
}

ensure_frontend_deps() {
  if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    echo "[setup] Installing frontend dependencies..."
    (cd "$FRONTEND_DIR" && "$NPM_BIN" install --no-audit --no-fund --progress=false)
  fi
}

python_has_backend_deps() {
  "$1" - <<'PY'
import fastapi
import httpx
import pydantic_settings
import uvicorn
PY
}

ensure_backend_deps() {
  local backend_python=""

  if [[ -x "$BACKEND_DIR/.venv/bin/python" ]] && python_has_backend_deps "$BACKEND_DIR/.venv/bin/python" >/dev/null 2>&1; then
    backend_python="$BACKEND_DIR/.venv/bin/python"
  elif python_has_backend_deps "python3" >/dev/null 2>&1; then
    backend_python="python3"
  else
    echo "[setup] Installing backend dependencies..."
    if python3 -m venv "$BACKEND_DIR/.venv" >/dev/null 2>&1 && [[ -x "$BACKEND_DIR/.venv/bin/pip" ]]; then
      "$BACKEND_DIR/.venv/bin/pip" install -r "$BACKEND_DIR/requirements-dev.txt"
      backend_python="$BACKEND_DIR/.venv/bin/python"
    else
      python3 -m pip install --break-system-packages -r "$BACKEND_DIR/requirements-dev.txt"
      backend_python="python3"
    fi
  fi

  echo "$backend_python" > "$BACKEND_DIR/.backend-python"
}

load_backend_runtime() {
  if [[ -f "$BACKEND_DIR/.backend-python" ]]; then
    BACKEND_PYTHON="$(cat "$BACKEND_DIR/.backend-python")"
  elif [[ -x "$BACKEND_DIR/.venv/bin/python" ]]; then
    BACKEND_PYTHON="$BACKEND_DIR/.venv/bin/python"
  else
    BACKEND_PYTHON="python3"
  fi

  export BACKEND_PYTHON
}

ensure_runtime_dir() {
  mkdir -p "$RUNTIME_DIR"
}

read_env_value() {
  local env_file="$1"
  local key="$2"

  if [[ ! -f "$env_file" ]]; then
    return 0
  fi

  grep -E "^${key}=" "$env_file" | tail -n 1 | cut -d'=' -f2- || true
}

detect_conda_sh() {
  if [[ -f "$HOME/miniforge3/etc/profile.d/conda.sh" ]]; then
    echo "$HOME/miniforge3/etc/profile.d/conda.sh"
    return 0
  fi

  if [[ -f "$HOME/miniconda3/etc/profile.d/conda.sh" ]]; then
    echo "$HOME/miniconda3/etc/profile.d/conda.sh"
    return 0
  fi

  if [[ -f "$HOME/anaconda3/etc/profile.d/conda.sh" ]]; then
    echo "$HOME/anaconda3/etc/profile.d/conda.sh"
    return 0
  fi

  if command -v conda >/dev/null 2>&1; then
    local conda_bin
    conda_bin="$(command -v conda)"
    local candidate
    candidate="$(cd "$(dirname "$conda_bin")/.." && pwd)/etc/profile.d/conda.sh"
    if [[ -f "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  fi
}

resolve_runtime_settings() {
  if [[ -z "$BACKEND_PORT" ]]; then
    BACKEND_PORT="$(read_env_value "$BACKEND_ENV" "BACKEND_PORT")"
  fi
  BACKEND_PORT="${BACKEND_PORT:-8000}"

  FRONTEND_PORT="${FRONTEND_PORT:-12322}"

  if [[ -z "$MODEL_START_ENABLED" ]]; then
    MODEL_START_ENABLED="$(read_env_value "$BACKEND_ENV" "MODEL_START_ENABLED")"
  fi
  MODEL_START_ENABLED="${MODEL_START_ENABLED:-false}"

  if [[ -z "$MODEL_CONDA_SH" ]]; then
    MODEL_CONDA_SH="$(read_env_value "$BACKEND_ENV" "MODEL_CONDA_SH")"
  fi
  MODEL_CONDA_SH="${MODEL_CONDA_SH:-$(detect_conda_sh || true)}"

  if [[ -z "$MODEL_CONDA_ENV" ]]; then
    MODEL_CONDA_ENV="$(read_env_value "$BACKEND_ENV" "MODEL_CONDA_ENV")"
  fi
  MODEL_CONDA_ENV="${MODEL_CONDA_ENV:-vllm}"

  if [[ -z "$MODEL_START_COMMAND" ]]; then
    MODEL_START_COMMAND="$(read_env_value "$BACKEND_ENV" "MODEL_START_COMMAND")"
  fi

  if [[ -z "$MODEL_HEALTH_URL" ]]; then
    MODEL_HEALTH_URL="$(read_env_value "$BACKEND_ENV" "MODEL_HEALTH_URL")"
  fi

  if [[ -z "$MODEL_HEALTH_URL" ]]; then
    local model_base_url
    model_base_url="$(read_env_value "$BACKEND_ENV" "MODEL_BASE_URL")"
    if [[ -n "$model_base_url" ]]; then
      MODEL_HEALTH_URL="${model_base_url%/}/models"
    fi
  fi
}

ensure_prerequisites() {
  ensure_node_runtime
  ensure_env_files
  ensure_frontend_deps
  ensure_backend_deps
  load_backend_runtime
  ensure_runtime_dir
  resolve_runtime_settings
}

is_pid_running() {
  local pid_file="$1"

  if [[ ! -f "$pid_file" ]]; then
    return 1
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [[ -z "$pid" ]]; then
    return 1
  fi

  kill -0 "$pid" >/dev/null 2>&1
}

cleanup_stale_pid() {
  local pid_file="$1"

  if ! is_pid_running "$pid_file"; then
    rm -f "$pid_file"
  fi
}

wait_for_url() {
  local url="$1"
  local retries="${2:-30}"
  local label="${3:-service}"

  for _ in $(seq 1 "$retries"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "[error] Timed out waiting for $label at $url" >&2
  return 1
}

get_frontend_product_name() {
  if [[ -f "$FRONTEND_ENV" ]]; then
    local configured_name
    configured_name="$(grep -E '^NEXT_PUBLIC_PRODUCT_NAME=' "$FRONTEND_ENV" | tail -n 1 | cut -d'=' -f2- || true)"
    if [[ -n "$configured_name" ]]; then
      echo "$configured_name"
      return 0
    fi
  fi

  echo "博微 智能助手"
}

backend_is_ready() {
  local response
  response="$(curl -fsS "http://127.0.0.1:${BACKEND_PORT}/api/health" 2>/dev/null || true)"
  [[ "$response" == *'"service":"chatdemo-dgx-backend"'* ]]
}

frontend_is_ready() {
  local product_name
  local response

  product_name="$(get_frontend_product_name)"
  response="$(curl -fsS "http://127.0.0.1:${FRONTEND_PORT}" 2>/dev/null || true)"
  [[ -n "$response" && "$response" == *"$product_name"* ]]
}

frontend_port_in_use() {
  curl -fsS "http://127.0.0.1:${FRONTEND_PORT}" >/dev/null 2>&1
}

model_start_is_enabled() {
  [[ "${MODEL_START_ENABLED,,}" == "true" ]]
}

model_is_ready() {
  [[ -n "$MODEL_HEALTH_URL" ]] && curl -fsS "$MODEL_HEALTH_URL" >/dev/null 2>&1
}

#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

MODEL_PID_FILE="$RUNTIME_DIR/model.pid"
BACKEND_PID_FILE="$RUNTIME_DIR/backend.pid"
FRONTEND_PID_FILE="$RUNTIME_DIR/frontend.pid"
MODEL_LOG="$RUNTIME_DIR/model.log"
BACKEND_LOG="$RUNTIME_DIR/backend.log"
FRONTEND_LOG="$RUNTIME_DIR/frontend.log"

start_model() {
  if ! model_start_is_enabled; then
    return 0
  fi

  cleanup_stale_pid "$MODEL_PID_FILE"

  if model_is_ready; then
    echo "[info] Model endpoint is already available."
    return 0
  fi

  if [[ -z "$MODEL_CONDA_SH" || -z "$MODEL_START_COMMAND" || -z "$MODEL_HEALTH_URL" ]]; then
    echo "[error] Model auto-start is enabled but model startup settings are incomplete." >&2
    return 1
  fi

  if is_pid_running "$MODEL_PID_FILE"; then
    echo "[info] Model launcher is already running."
    return 0
  fi

  echo "[run] Starting model service in background..."
  (
    cd "$ROOT_DIR"
    exec bash -lc "source \"$MODEL_CONDA_SH\" && conda activate \"$MODEL_CONDA_ENV\" && $MODEL_START_COMMAND"
  ) >"$MODEL_LOG" 2>&1 &
  echo $! > "$MODEL_PID_FILE"

  if ! wait_for_url "$MODEL_HEALTH_URL" 180 "model service"; then
    rm -f "$MODEL_PID_FILE"
    return 1
  fi
}

start_backend() {
  cleanup_stale_pid "$BACKEND_PID_FILE"

  if backend_is_ready; then
    echo "[info] Backend endpoint is already available on port ${BACKEND_PORT}."
    return 0
  fi

  if is_pid_running "$BACKEND_PID_FILE"; then
    echo "[info] Backend is already running."
    return 0
  fi

  echo "[run] Starting backend in background..."
  (
    cd "$BACKEND_DIR"
    exec "$BACKEND_PYTHON" -m uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT"
  ) >"$BACKEND_LOG" 2>&1 &
  echo $! > "$BACKEND_PID_FILE"

  if ! wait_for_url "http://127.0.0.1:${BACKEND_PORT}/api/health" 30 "backend"; then
    rm -f "$BACKEND_PID_FILE"
    return 1
  fi
}

start_frontend() {
  cleanup_stale_pid "$FRONTEND_PID_FILE"

  if frontend_is_ready; then
    echo "[info] Frontend endpoint is already available on port ${FRONTEND_PORT}."
    return 0
  fi

  if frontend_port_in_use; then
    echo "[error] Port ${FRONTEND_PORT} is already in use by another web service." >&2
    echo "[error] Stop that service or rerun with CHATDEMO_FRONTEND_PORT=<new-port>." >&2
    return 1
  fi

  if is_pid_running "$FRONTEND_PID_FILE"; then
    echo "[info] Frontend is already running."
    return 0
  fi

  echo "[run] Starting frontend in background..."
  (
    cd "$FRONTEND_DIR"
    exec node ./node_modules/next/dist/bin/next dev --hostname 0.0.0.0 --port "$FRONTEND_PORT"
  ) >"$FRONTEND_LOG" 2>&1 &
  echo $! > "$FRONTEND_PID_FILE"

  if ! wait_for_url "http://127.0.0.1:${FRONTEND_PORT}" 60 "frontend"; then
    rm -f "$FRONTEND_PID_FILE"
    return 1
  fi
}

main() {
  ensure_prerequisites
  start_model
  start_backend
  start_frontend

  echo "[ready] Chat demo is available at http://127.0.0.1:${FRONTEND_PORT}"
  xdg-open "http://127.0.0.1:${FRONTEND_PORT}" >/dev/null 2>&1 || true
}

main "$@"

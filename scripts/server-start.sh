#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

BACKEND_PID_FILE="$RUNTIME_DIR/backend.pid"
FRONTEND_PID_FILE="$RUNTIME_DIR/frontend.pid"
BACKEND_LOG="$RUNTIME_DIR/backend.log"
FRONTEND_LOG="$RUNTIME_DIR/frontend.log"

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

ensure_frontend_build() {
  if [[ ! -f "$FRONTEND_DIR/.next/BUILD_ID" ]]; then
    echo "[run] Building frontend..."
    (
      cd "$FRONTEND_DIR"
      "$NPM_BIN" run build
    )
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

  ensure_frontend_build

  echo "[run] Starting frontend in background..."
  (
    cd "$FRONTEND_DIR"
    exec "$NPM_BIN" run start
  ) >"$FRONTEND_LOG" 2>&1 &
  echo $! > "$FRONTEND_PID_FILE"

  if ! wait_for_url "http://127.0.0.1:${FRONTEND_PORT}" 60 "frontend"; then
    rm -f "$FRONTEND_PID_FILE"
    return 1
  fi
}

main() {
  ensure_prerequisites
  start_backend
  start_frontend

  echo "[ready] Backend:  http://172.20.0.160:${BACKEND_PORT}"
  echo "[ready] Frontend: http://172.20.0.160:${FRONTEND_PORT}"
  echo "[ready] Logs: $RUNTIME_DIR/backend.log $RUNTIME_DIR/frontend.log"
}

main "$@"

#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

BACKEND_PID_FILE="$RUNTIME_DIR/backend.pid"
FRONTEND_PID_FILE="$RUNTIME_DIR/frontend.pid"
BACKEND_LOG="$RUNTIME_DIR/backend.log"
FRONTEND_LOG="$RUNTIME_DIR/frontend.log"
INDICATOR_PID=""
STATUS_FILE=""
STARTUP_ERROR=0

launch_indicator() {
  if [[ -z "${DISPLAY:-}" ]]; then
    return 0
  fi

  if ! python3 -c "import tkinter" >/dev/null 2>&1; then
    return 0
  fi

  STATUS_FILE="$RUNTIME_DIR/startup-status.txt"
  echo "正在检查环境" > "$STATUS_FILE"

  python3 "$ROOT_DIR/scripts/startup_indicator.py" "$STATUS_FILE" "博微 智能助手" >/dev/null 2>&1 &
  INDICATOR_PID=$!
}

update_indicator() {
  local message="$1"
  if [[ -n "$STATUS_FILE" ]]; then
    printf "%s\n" "$message" > "$STATUS_FILE"
  fi
}

mark_indicator_done() {
  if [[ -n "$STATUS_FILE" ]]; then
    printf "DONE\n" > "$STATUS_FILE"
  fi
}

mark_indicator_error() {
  local message="$1"
  STARTUP_ERROR=1
  if [[ -n "$STATUS_FILE" ]]; then
    printf "ERROR: %s\n" "$message" > "$STATUS_FILE"
  fi
}

cleanup_indicator() {
  if [[ "$STARTUP_ERROR" -eq 0 && -n "$INDICATOR_PID" ]]; then
    kill "$INDICATOR_PID" >/dev/null 2>&1 || true
  fi

  if [[ "$STARTUP_ERROR" -eq 0 && -n "$STATUS_FILE" ]]; then
    rm -f "$STATUS_FILE"
  fi
}

handle_error() {
  mark_indicator_error "启动失败，请查看 ~/.runtime 中的日志，或直接在终端执行 make desktop-start 排查。"
}

start_backend() {
  update_indicator "正在启动后端"
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
  update_indicator "正在启动前端"
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
  trap handle_error ERR
  trap cleanup_indicator EXIT

  launch_indicator
  update_indicator "正在检查环境"
  ensure_prerequisites
  start_backend
  start_frontend

  update_indicator "正在打开界面"
  mark_indicator_done
  echo "[ready] Chat demo is available at http://127.0.0.1:${FRONTEND_PORT}"
  xdg-open "http://127.0.0.1:${FRONTEND_PORT}" >/dev/null 2>&1 || true
}

main "$@"

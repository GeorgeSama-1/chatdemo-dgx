#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

BACKEND_PID_FILE="$RUNTIME_DIR/backend.pid"
FRONTEND_PID_FILE="$RUNTIME_DIR/frontend.pid"

stop_service() {
  local name="$1"
  local pid_file="$2"

  cleanup_stale_pid "$pid_file"
  if ! [[ -f "$pid_file" ]]; then
    echo "[info] $name is not running."
    return 0
  fi

  local pid
  pid="$(cat "$pid_file")"
  echo "[run] Stopping $name (pid: $pid)..."
  pkill -TERM -P "$pid" >/dev/null 2>&1 || true
  kill "$pid" >/dev/null 2>&1 || true
  rm -f "$pid_file"
}

main() {
  ensure_runtime_dir
  stop_service "frontend" "$FRONTEND_PID_FILE"
  stop_service "backend" "$BACKEND_PID_FILE"
}

main "$@"

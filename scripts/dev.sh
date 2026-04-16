#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"
MODE="${1:-run}"

cleanup() {
  local exit_code=$?
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]]; then
    kill "$FRONTEND_PID" >/dev/null 2>&1 || true
  fi
  wait >/dev/null 2>&1 || true
  exit "$exit_code"
}

run_servers() {
  load_backend_runtime

  echo "[run] Starting backend on http://localhost:8000"
  (
    cd "$BACKEND_DIR"
    "$BACKEND_PYTHON" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
  ) &
  BACKEND_PID=$!

  echo "[run] Starting frontend on http://localhost:3000"
  (
    cd "$FRONTEND_DIR"
    npm run dev
  ) &
  FRONTEND_PID=$!

  echo "[ready] Press Ctrl+C to stop both services."
  wait
}

main() {
  ensure_prerequisites

  if [[ "$MODE" == "--install-only" ]]; then
    echo "[ok] One-click startup prerequisites are ready."
    echo "[ok] Backend Python: $BACKEND_PYTHON"
    exit 0
  fi

  trap cleanup INT TERM EXIT
  run_servers
}

main "$@"

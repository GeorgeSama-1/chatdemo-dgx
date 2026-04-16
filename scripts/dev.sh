#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"
MODE="${1:-run}"
MODEL_PID_FILE="$RUNTIME_DIR/model.pid"

start_model() {
  if ! model_start_is_enabled; then
    return 0
  fi

  cleanup_stale_pid "$MODEL_PID_FILE"

  if model_is_ready; then
    echo "[info] Model endpoint is already available."
    return 0
  fi

  if [[ -z "$MODEL_CONDA_SH" || -z "$MODEL_START_COMMAND" ]]; then
    echo "[error] MODEL_START_ENABLED=true but MODEL_CONDA_SH or MODEL_START_COMMAND is not configured." >&2
    return 1
  fi

  echo "[run] Starting model service..."
  (
    cd "$ROOT_DIR"
    exec bash -lc "source \"$MODEL_CONDA_SH\" && conda activate \"$MODEL_CONDA_ENV\" && $MODEL_START_COMMAND"
  ) &
  MODEL_PID=$!
  echo "$MODEL_PID" > "$MODEL_PID_FILE"

  if ! wait_for_url "$MODEL_HEALTH_URL" 120 "model service"; then
    rm -f "$MODEL_PID_FILE"
    return 1
  fi
}

cleanup() {
  local exit_code=$?
  if [[ -n "${MODEL_PID:-}" ]]; then
    pkill -TERM -P "$MODEL_PID" >/dev/null 2>&1 || true
    kill "$MODEL_PID" >/dev/null 2>&1 || true
  fi
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
  start_model
  run_servers
}

main "$@"

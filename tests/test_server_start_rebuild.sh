#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

TMP_SCRIPT="$TMP_DIR/server-start-functions.sh"
sed '$d' "$REPO_ROOT/scripts/server-start.sh" > "$TMP_SCRIPT"
cp "$REPO_ROOT/scripts/common.sh" "$TMP_DIR/common.sh"

FAKE_FRONTEND="$TMP_DIR/frontend"
mkdir -p "$FAKE_FRONTEND/.next"
touch "$FAKE_FRONTEND/.next/BUILD_ID"

BUILD_LOG="$TMP_DIR/build.log"
FAKE_NPM="$TMP_DIR/npm"
cat >"$FAKE_NPM" <<EOF
#!/usr/bin/env bash
echo "\$*" >> "$BUILD_LOG"
EOF
chmod +x "$FAKE_NPM"

output="$(
  (
    source "$TMP_SCRIPT"
    FRONTEND_DIR="$FAKE_FRONTEND"
    NPM_BIN="$FAKE_NPM"
    ensure_frontend_build
    test -f "$BUILD_LOG" && cat "$BUILD_LOG"
  )
)"

if [[ "$output" != $'[run] Building frontend...\nrun build' ]]; then
  echo "expected ensure_frontend_build to rebuild even with existing BUILD_ID" >&2
  printf 'actual output:\n%s\n' "$output" >&2
  exit 1
fi

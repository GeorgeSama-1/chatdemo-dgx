#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

FAKE_HOME="$TMP_DIR/home"
FAKE_NODE_DIR="$FAKE_HOME/.nvm/versions/node/v20.0.0/bin"
mkdir -p "$FAKE_NODE_DIR"

cat >"$FAKE_NODE_DIR/node" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF

cat >"$FAKE_NODE_DIR/npm" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF

chmod +x "$FAKE_NODE_DIR/node" "$FAKE_NODE_DIR/npm"

cat >"$FAKE_HOME/.bash_profile" <<'EOF'
exit 0
EOF

output="$(
  (
    export HOME="$FAKE_HOME"
    unset CHATDEMO_NODE_BIN CHATDEMO_NPM_BIN
    source "$REPO_ROOT/scripts/common.sh"
    export PATH="/nonexistent"
    ensure_node_runtime
    printf 'READY\n%s\n%s\n' "$NODE_BIN" "$NPM_BIN"
  )
)"

expected_node="$FAKE_NODE_DIR/node"
expected_npm="$FAKE_NODE_DIR/npm"

if [[ "$output" != "READY"$'\n'"$expected_node"$'\n'"$expected_npm" ]]; then
  echo "expected ensure_node_runtime to finish with detected nvm binaries" >&2
  echo "actual output:" >&2
  printf '%s\n' "$output" >&2
  exit 1
fi

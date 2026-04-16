#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

APPLICATIONS_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
DESKTOP_DIR="$HOME/Desktop"
STARTER_DESKTOP_FILE="$APPLICATIONS_DIR/chatdemo-dgx.desktop"
STOPPER_DESKTOP_FILE="$APPLICATIONS_DIR/chatdemo-dgx-stop.desktop"

write_desktop_file() {
  local target_file="$1"
  local name="$2"
  local exec_path="$3"
  local icon_name="$4"
  local comment="$5"

  cat > "$target_file" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=$name
Comment=$comment
Exec=$exec_path
Icon=$icon_name
Terminal=false
Categories=Development;
EOF
  chmod +x "$target_file"
}

main() {
  mkdir -p "$APPLICATIONS_DIR"

  chmod +x "$ROOT_DIR/scripts/dev.sh" \
    "$ROOT_DIR/scripts/desktop-start.sh" \
    "$ROOT_DIR/scripts/desktop-stop.sh" \
    "$ROOT_DIR/scripts/install-desktop-entry.sh"

  write_desktop_file \
    "$STARTER_DESKTOP_FILE" \
    "ChatDemo DGX" \
    "$ROOT_DIR/scripts/desktop-start.sh" \
    "applications-internet" \
    "Start the branded AI chat demo"

  write_desktop_file \
    "$STOPPER_DESKTOP_FILE" \
    "ChatDemo DGX Stop" \
    "$ROOT_DIR/scripts/desktop-stop.sh" \
    "process-stop" \
    "Stop the branded AI chat demo"

  if [[ -d "$DESKTOP_DIR" ]]; then
    cp "$STARTER_DESKTOP_FILE" "$DESKTOP_DIR/ChatDemo DGX.desktop"
    cp "$STOPPER_DESKTOP_FILE" "$DESKTOP_DIR/ChatDemo DGX Stop.desktop"
    chmod +x "$DESKTOP_DIR/ChatDemo DGX.desktop" "$DESKTOP_DIR/ChatDemo DGX Stop.desktop"
  fi

  echo "[ok] Desktop launchers installed."
  echo "[ok] Start launcher: $STARTER_DESKTOP_FILE"
  echo "[ok] Stop launcher: $STOPPER_DESKTOP_FILE"
}

main "$@"

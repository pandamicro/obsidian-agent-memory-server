#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"
SOURCE_HOOKS="$REPO_ROOT/.codex/hooks.json"
TARGET_DIR="$HOME/.codex"
TARGET_HOOKS="$TARGET_DIR/hooks.json"

if [ ! -f "$SOURCE_HOOKS" ]; then
  echo "install-hooks: missing source hooks registry at $SOURCE_HOOKS" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"
cp "$SOURCE_HOOKS" "$TARGET_HOOKS"

echo "Installed Codex hooks registry: $TARGET_HOOKS"

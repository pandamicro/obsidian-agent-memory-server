#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"
SOURCE_HOOKS="$REPO_ROOT/.codex/hooks.json"
TARGET_DIR="$HOME/.codex"
TARGET_HOOKS="$TARGET_DIR/hooks.json"
WORKSPACE_ROOT=""
FORCE=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --workspace)
      if [ "$#" -lt 2 ]; then
        echo "install-hooks: --workspace requires a path argument" >&2
        exit 1
      fi
      WORKSPACE_ROOT="$2"
      shift 2
      ;;
    --force)
      FORCE=1
      shift
      ;;
    *)
      echo "install-hooks: unknown argument: $1" >&2
      echo "usage: scripts/codex-hooks/install-hooks.sh [--workspace <path>] [--force]" >&2
      exit 1
      ;;
  esac
done

if [ ! -f "$SOURCE_HOOKS" ]; then
  echo "install-hooks: missing source hooks registry at $SOURCE_HOOKS" >&2
  exit 1
fi

if [ -n "$WORKSPACE_ROOT" ]; then
  WORKSPACE_HOOKS="$WORKSPACE_ROOT/.codex/hooks.json"
  if [ -f "$WORKSPACE_HOOKS" ] && [ "$FORCE" -ne 1 ]; then
    echo "install-hooks: detected repo-local hooks at $WORKSPACE_HOOKS" >&2
    echo "install-hooks: this may create dual-active hook registries (global + repo-local)." >&2
    echo "install-hooks: resolve or migrate repo-local hooks first, or rerun with --force." >&2
    exit 2
  fi
fi

mkdir -p "$TARGET_DIR"
cp "$SOURCE_HOOKS" "$TARGET_HOOKS"

echo "Installed Codex hooks registry: $TARGET_HOOKS"
if [ -n "$WORKSPACE_ROOT" ] && [ -f "$WORKSPACE_ROOT/.codex/hooks.json" ]; then
  echo "Warning: repo-local hooks still exist at $WORKSPACE_ROOT/.codex/hooks.json"
  echo "Warning: machine-level registry installed with --force."
fi

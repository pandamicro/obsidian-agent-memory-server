#!/bin/sh
set -eu

APPLY=0
REPO_ROOT=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --apply)
      APPLY=1
      shift
      ;;
    --repo-root)
      if [ "$#" -lt 2 ]; then
        echo "cleanup-runtime-artifacts: missing value for --repo-root" >&2
        exit 1
      fi
      REPO_ROOT="$2"
      shift 2
      ;;
    *)
      echo "cleanup-runtime-artifacts: unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [ -z "$REPO_ROOT" ]; then
  SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
  REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
fi

if [ ! -d "$REPO_ROOT/.git" ]; then
  echo "cleanup-runtime-artifacts: repo root is not a git repository: $REPO_ROOT" >&2
  exit 1
fi

UNTRACKED_PATHS="$(git -C "$REPO_ROOT" ls-files --others --exclude-standard -- \
  'agents/*/memory/short-term/*' \
  'agents/*/memory/long-term/*' \
  'agents/*/runs/*')"

FILTERED_PATHS=""
if [ -n "$UNTRACKED_PATHS" ]; then
  OLD_IFS=$IFS
  IFS='
'
  for REL_PATH in $UNTRACKED_PATHS; do
    case "$REL_PATH" in
      agents/*/memory/short-term/*|agents/*/memory/long-term/*|agents/*/runs/*)
        ABS_PATH="$REPO_ROOT/$REL_PATH"
        if [ -f "$ABS_PATH" ]; then
          FILTERED_PATHS="${FILTERED_PATHS}${REL_PATH}
"
        fi
        ;;
    esac
  done
  IFS=$OLD_IFS
fi

COUNT=0
if [ -n "$FILTERED_PATHS" ]; then
  OLD_IFS=$IFS
  IFS='
'
  for _REL_PATH in $FILTERED_PATHS; do
    COUNT=$((COUNT + 1))
  done
  IFS=$OLD_IFS
fi

if [ "$COUNT" -eq 0 ]; then
  echo "No untracked runtime artifacts found under agents/*/memory or agents/*/runs."
  exit 0
fi

if [ "$APPLY" -eq 0 ]; then
  echo "Dry run: found $COUNT untracked runtime artifact(s)."
  printf '%s' "$FILTERED_PATHS"
  exit 0
fi

OLD_IFS=$IFS
IFS='
'
for REL_PATH in $FILTERED_PATHS; do
  rm -f -- "$REPO_ROOT/$REL_PATH"
done
IFS=$OLD_IFS

echo "Removed $COUNT runtime artifact(s)."
printf '%s' "$FILTERED_PATHS"

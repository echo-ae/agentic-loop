#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Install the agentic-reviewer-loop Codex skill on macOS.

Usage:
  ./scripts/install-macos.sh [--copy|--symlink] [--force] [--codex-home PATH]

Options:
  --copy             Copy the skill directory. Default.
  --symlink          Symlink the skill directory for local development.
  --force            Replace an existing installed skill.
  --codex-home PATH  Override CODEX_HOME. Defaults to $CODEX_HOME or ~/.codex.
  -h, --help         Show this help.

After install, restart Codex App.
EOF
}

MODE="copy"
FORCE="0"
CODEX_HOME_DIR="${CODEX_HOME:-$HOME/.codex}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --copy)
      MODE="copy"
      shift
      ;;
    --symlink)
      MODE="symlink"
      shift
      ;;
    --force)
      FORCE="1"
      shift
      ;;
    --codex-home)
      CODEX_HOME_DIR="${2:?missing path after --codex-home}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Warning: this installer is intended for macOS, continuing anyway." >&2
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
SOURCE_DIR="$REPO_ROOT/skills/agentic-reviewer-loop"
DEST_PARENT="$CODEX_HOME_DIR/skills"
DEST_DIR="$DEST_PARENT/agentic-reviewer-loop"

if [[ ! -f "$SOURCE_DIR/SKILL.md" ]]; then
  echo "Skill source not found at $SOURCE_DIR" >&2
  exit 1
fi

mkdir -p "$DEST_PARENT"

if [[ -e "$DEST_DIR" || -L "$DEST_DIR" ]]; then
  if [[ "$FORCE" != "1" ]]; then
    echo "Destination already exists: $DEST_DIR" >&2
    echo "Re-run with --force to replace it." >&2
    exit 1
  fi
  rm -rf "$DEST_DIR"
fi

if [[ "$MODE" == "symlink" ]]; then
  ln -s "$SOURCE_DIR" "$DEST_DIR"
else
  mkdir -p "$DEST_DIR"
  (cd "$SOURCE_DIR" && tar -cf - .) | (cd "$DEST_DIR" && tar -xf -)
fi

echo "Installed agentic-reviewer-loop skill:"
echo "  $DEST_DIR"
echo
echo "Restart Codex App to pick up the skill."

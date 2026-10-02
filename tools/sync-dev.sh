#!/bin/bash
# Copy the mods into this session's hot-reload folder as real files (the watcher misses edits made through symlinks).
# Usage: tools/sync-dev.sh            (uses the newest ~/.claude/dev-mods/<session-id>)
#        tools/sync-dev.sh <session-id>
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="$HOME/.claude/dev-mods"
DEST="$BASE/${1:-$(ls -t "$BASE" | head -1)}"
for mod in Pokepal Pokeball; do
  name="$(echo "$mod" | tr '[:upper:]' '[:lower:]')"
  # only mods already present in the session folder are kept in sync (so a disabled one stays off)
  if [ -e "$DEST/$name" ] || [ "$mod" = "Pokepal" ]; then
    mkdir -p "$DEST/$name"
    rsync -a --delete --exclude '.claude-plugin/types' "$ROOT/$mod/" "$DEST/$name/"
    echo "synced $mod -> $DEST/$name"
  fi
done

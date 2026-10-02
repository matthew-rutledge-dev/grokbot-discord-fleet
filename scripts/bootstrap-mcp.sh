#!/usr/bin/env bash
# Install MCP package deps for first-time clone / local plugin install.
# Required before discord-fleet-status / discord-fleet-manage can start.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
for pkg in status manage; do
  dir="$ROOT/mcp/$pkg"
  if [[ ! -f "$dir/package.json" ]]; then
    echo "bootstrap-mcp: missing $dir/package.json" >&2
    exit 1
  fi
  echo "bootstrap-mcp: npm ci in mcp/$pkg"
  (cd "$dir" && npm ci)
done
echo "bootstrap-mcp: done"

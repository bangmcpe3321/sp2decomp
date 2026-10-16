#!/usr/bin/env bash
# Probe whether REA can run on this Linux side, and what it still needs.
set -uo pipefail

export PATH="$HOME/tools/node/bin:$PATH"

echo "== node/npm =="
node --version
npm --version

echo
echo "== rea-agents in the local npm cache? =="
if [ -x "$HOME/tools/node/bin/npx" ]; then
  echo "npx present"
else
  echo "npx MISSING"
fi

echo
echo "== installing rea-agents globally on the Linux side (no root) =="
# npm prefix under $HOME so no sudo is needed
export NPM_CONFIG_PREFIX="$HOME/.npm-global"
mkdir -p "$NPM_CONFIG_PREFIX"
timeout 600 npm install -g rea-agents@6.5.0 2>&1 | tail -6

echo
echo "== rea version =="
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
command -v rea && rea --version || echo "rea not on PATH"

echo
echo "== rea doctor (will show what providers are missing) =="
timeout 300 rea doctor --json 2>&1 | head -c 3000
echo

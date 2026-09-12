#!/usr/bin/env bash
# Fast sidecar-only build for `tauri dev` (skips the Vite production build —
# dev serves the UI from the Vite dev server instead).
set -euo pipefail
export PATH="$HOME/.cargo/bin:$HOME/.local/share/pnpm/bin:$HOME/.local/bin:$PATH"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BINARIES="$ROOT/apps/desktop/src-tauri/binaries"
mkdir -p "$BINARIES"

TRIPLE="$(rustc --print host-tuple)"
VERSION="$(node -p "require('$ROOT/packages/cli/package.json').version")"

bun build --compile "$ROOT/packages/cli/src/cli.ts" \
  --target bun-linux-x64 \
  --define "process.env.FH_VERSION=\"$VERSION\"" \
  --outfile "$BINARIES/fh-$TRIPLE"

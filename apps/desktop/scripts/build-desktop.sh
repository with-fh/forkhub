#!/usr/bin/env bash
# Build everything the ForkHub desktop bundle needs:
#   1. the desktop-ui static frontend (Vite)
#   2. the `fh` CLI compiled to a standalone binary, renamed with the Rust
#      target triple so Tauri picks it up as the `binaries/fh` sidecar.
set -euo pipefail
export PATH="$HOME/.cargo/bin:$HOME/.local/share/pnpm/bin:$HOME/.local/bin:$PATH"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
DESKTOP="$ROOT/apps/desktop"
BINARIES="$DESKTOP/src-tauri/binaries"
mkdir -p "$BINARIES"

TRIPLE="$(rustc --print host-tuple)"
VERSION="$(node -p "require('$ROOT/packages/cli/package.json').version")"

pnpm --filter @forkhub/desktop-ui build

bun build --compile "$ROOT/packages/cli/src/cli.ts" \
  --target bun-linux-x64 \
  --define "process.env.FH_VERSION=\"$VERSION\"" \
  --outfile "$BINARIES/fh-$TRIPLE"

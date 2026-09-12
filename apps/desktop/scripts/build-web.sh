#!/usr/bin/env bash
# Build the Next.js web UI as a static export for the Tauri bundle.
#
# Why the rpc dance below: `apps/web/src/app/rpc` is a dynamic Node route
# handler (force-dynamic). Static export (`output: "export"`) cannot include
# route handlers, so we move it aside for the duration of the export build and
# restore it afterwards. The Docker web deploy is unaffected (it never sets
# TAURI_BUILD, so it keeps `output: "standalone"` with the rpc route intact).
#
# Runtime note (v1): the bundled desktop UI is offline — API-backed widgets
# (API status dot, todos) fail gracefully until pointed at a running server.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WEB="$ROOT/apps/web"
RPC_DIR="$WEB/src/app/rpc"

BACKUP_BASE="$(mktemp -d)"
trap 'if [ -d "$BACKUP_BASE/rpc" ]; then mv "$BACKUP_BASE/rpc" "$RPC_DIR"; fi' EXIT

if [ -d "$RPC_DIR" ]; then
  mv "$RPC_DIR" "$BACKUP_BASE/rpc"
fi

# Dummy server env: nothing server-side runs during a static export, but shared
# modules still evaluate env schemas at build time.
TAURI_BUILD=1 NEXT_PUBLIC_SERVER_URL=http://localhost:3000 \
  DATABASE_URL=postgresql://localhost:5432/forkhub \
  CORS_ORIGIN=http://localhost:3001 \
  pnpm --filter web build

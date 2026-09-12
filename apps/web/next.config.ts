import "@forkhub/env/web";
import type { NextConfig } from "next";

// TAURI_BUILD=1 switches to a static export for the Tauri desktop bundle
// (see apps/desktop/scripts/build-web.sh). Default stays `standalone` so the
// Docker web deploy is unaffected.
const isTauriExport = process.env.TAURI_BUILD === "1";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  ...(isTauriExport
    ? { output: "export" as const, images: { unoptimized: true } }
    : { output: "standalone" as const }),
};

export default nextConfig;

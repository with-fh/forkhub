import "@forkhub/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  // Cloudflare Workers (opennext) can't use standalone output and can't
  // bundle node-postgres; the worker serves the Postgres-free router
  // subset (see rpc route), so `pg` stays external and is never loaded.
  // Docker flow keeps standalone output. Set OPENNEXT=1 for Workers.
  ...(process.env.OPENNEXT ? { serverExternalPackages: ["pg"] } : { output: "standalone" }),
  // /oss was renamed to /download; keep permanent redirects for
  // bookmarks and the previously deployed build.
  async redirects() {
    return [
      { source: "/oss", destination: "/download", permanent: true },
      { source: "/oss/:slug", destination: "/download/:slug", permanent: true },
    ];
  },
};

export default nextConfig;

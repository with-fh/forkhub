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
};

export default nextConfig;

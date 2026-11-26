import { getCloudflareContext } from "@opennextjs/cloudflare";

import { collectDeepSeekUsage, type UsageDatabase } from "@/lib/deepseek-usage";

export async function POST(request: Request): Promise<Response> {
  let database: UsageDatabase | undefined;
  try {
    database = getCloudflareContext().env.DEEPSEEK_USAGE_DB;
  } catch {
    // A standalone Next.js server has no Cloudflare bindings.
  }
  return collectDeepSeekUsage(request, database);
}

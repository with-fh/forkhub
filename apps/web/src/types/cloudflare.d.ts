import type { UsageDatabase } from "@/lib/deepseek-usage";
import type { UsageTotalsDatabase } from "@/lib/deepseek-usage-dashboard";

declare global {
  interface CloudflareEnv {
    DEEPSEEK_USAGE_DB?: UsageDatabase & UsageTotalsDatabase;
  }
}

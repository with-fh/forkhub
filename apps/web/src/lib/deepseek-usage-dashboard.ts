import { z } from "zod";

const dailyTotals = z.array(z.object({ day: z.iso.date(), installations: z.int().nonnegative() }));
type DailyUsage = z.infer<typeof dailyTotals>[number];

export interface UsageTotalsDatabase {
  prepare(sql: string): {
    bind(...values: string[]): {
      all(): Promise<{ success: boolean; results: unknown }>;
    };
  };
}

type UsageDashboard =
  | { kind: "unavailable" }
  | { kind: "empty" }
  | { kind: "ready"; days: DailyUsage[]; today: string };

export async function readDeepSeekDailyUsage(
  database: UsageTotalsDatabase | undefined,
  now = new Date(),
): Promise<UsageDashboard> {
  if (!database) return { kind: "unavailable" };

  const today = now.toISOString().slice(0, 10);
  const day = new Date(now);
  day.setUTCDate(day.getUTCDate() - 29);
  const start = day.toISOString().slice(0, 10);

  try {
    const result = await database
      .prepare(
        `SELECT day, SUM(installations) AS installations
         FROM deepseek_usage_daily_totals
         WHERE day BETWEEN ? AND ?
         GROUP BY day
         ORDER BY day`,
      )
      .bind(start, today)
      .all();
    if (!result.success) return { kind: "unavailable" };

    const rows = dailyTotals.parse(result.results);
    if (rows.length === 0) return { kind: "empty" };

    const totals = new Map(rows.map(({ day, installations }) => [day, installations]));
    const days = Array.from({ length: 30 }, () => {
      const date = day.toISOString().slice(0, 10);
      day.setUTCDate(day.getUTCDate() + 1);
      return { day: date, installations: totals.get(date) ?? 0 };
    });

    return { kind: "ready", days, today };
  } catch {
    return { kind: "unavailable" };
  }
}

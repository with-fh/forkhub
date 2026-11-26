import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import Link from "next/link";

import { readDeepSeekDailyUsage, type UsageTotalsDatabase } from "@/lib/deepseek-usage-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Usage dashboard | ForkHub",
  description: "Daily active installations of ForkHub’s DeepSeek Harness community Linux build.",
};

const utcDate = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const count = new Intl.NumberFormat("en");

function getDatabase(): UsageTotalsDatabase | undefined {
  try {
    return getCloudflareContext().env.DEEPSEEK_USAGE_DB;
  } catch {
    return undefined;
  }
}

export default async function DashboardPage() {
  const usage = await readDeepSeekDailyUsage(getDatabase());
  const peak =
    usage.kind === "ready" ? Math.max(1, ...usage.days.map((day) => day.installations)) : 1;

  return (
    <div className="fh-container fh-dashboard">
      <header className="fh-section-head">
        <span className="fh-eyebrow">Usage dashboard</span>
        <h1 className="fh-display">DeepSeek Harness on Linux</h1>
        <p>
          Each installation of the ForkHub community build that reports foreground use counts once
          per UTC day. <Link href="/privacy-policy">About usage reporting</Link>
        </p>
      </header>

      <section className="fh-dashboard-panel" aria-labelledby="usage-heading">
        <h2 id="usage-heading">Daily active installations</h2>
        <p className="fh-dashboard-note">Last 30 days · UTC</p>
        {usage.kind === "unavailable" ? (
          <p className="fh-dashboard-status">
            Usage data is temporarily unavailable. Try again later.
          </p>
        ) : usage.kind === "empty" ? (
          <p className="fh-dashboard-status">No usage reports in the last 30 UTC days.</p>
        ) : (
          <>
            <p className="fh-dashboard-note">Today (UTC) is partial.</p>
            <div className="fh-usage-chart" aria-hidden="true">
              <div className="fh-usage-scale">
                <span>{count.format(peak)}</span>
                <span>0</span>
              </div>
              <div className="fh-usage-bars">
                {usage.days.map(({ day, installations }) => (
                  <span
                    key={day}
                    className="fh-usage-bar"
                    data-partial={day === usage.today ? "true" : undefined}
                    style={{ height: `${(installations / peak) * 100}%` }}
                  />
                ))}
              </div>
              <div className="fh-usage-dates">
                <span>{utcDate.format(new Date(usage.days[0]?.day ?? usage.today))}</span>
                <span>{utcDate.format(new Date(usage.today))}</span>
              </div>
            </div>
            <details className="fh-usage-values">
              <summary>Daily counts</summary>
              <table>
                <caption className="sr-only">Active installations by UTC date</caption>
                <thead>
                  <tr>
                    <th scope="col">Date (UTC)</th>
                    <th scope="col">Installations</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.days.toReversed().map(({ day, installations }) => (
                    <tr key={day}>
                      <th scope="row">
                        <time dateTime={day}>{day}</time>
                        {day === usage.today ? " (partial)" : null}
                      </th>
                      <td>{count.format(installations)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        )}
      </section>
    </div>
  );
}

import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPlatformProxy, unstable_splitSqlQuery } from "wrangler";

import { collectDeepSeekUsage } from "./deepseek-usage";

interface LocalStatement {
  bind(...values: string[]): LocalStatement;
  run(): Promise<{ success: boolean }>;
  all<Row>(): Promise<{ results: Row[] }>;
}

interface LocalD1 {
  prepare(sql: string): LocalStatement;
  batch(statements: LocalStatement[]): Promise<unknown>;
}

const installationId = "ab".repeat(32);
const version = "0.2.2-rc.3.with-fh.20261116.1";
const otherVersion = "0.2.2-rc.4.with-fh.20261117.1";
const event = { installationId, version };

function usageRequest(payload: unknown) {
  return new Request("https://example.com/api/usage/deepseek-harness", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
}

test("a Worker without a D1 binding leaves reporting disabled", async () => {
  const response = await collectDeepSeekUsage(usageRequest(event), undefined);
  expect(response.status).toBe(503);
});

test("the local D1 collector validates reports, deduplicates, and preserves aggregates", async () => {
  const directory = await mkdtemp(join(tmpdir(), "forkhub-deepseek-usage-"));
  try {
    const configPath = join(directory, "wrangler.json");
    await writeFile(
      configPath,
      JSON.stringify({
        name: "forkhub-deepseek-usage-test",
        compatibility_date: "2026-09-01",
        d1_databases: [
          {
            binding: "DB",
            database_name: "deepseek-usage-test",
            database_id: "00000000-0000-4000-8000-000000000000",
          },
        ],
      }),
    );
    const platform = await getPlatformProxy<{ DB: LocalD1 }>({
      configPath,
      envFiles: [],
      persist: false,
      remoteBindings: false,
    });
    try {
      const database = platform.env.DB;
      const migration = await readFile(
        new URL("../../migrations/0001_deepseek_usage.sql", import.meta.url),
        "utf8",
      );
      await database.batch(unstable_splitSqlQuery(migration).map((sql) => database.prepare(sql)));

      const receive = (payload: unknown, at = "2026-11-26T23:59:59Z") =>
        collectDeepSeekUsage(usageRequest(payload), database, new Date(at));
      const keys = () =>
        database
          .prepare(
            "SELECT day, installation_hash FROM deepseek_usage_daily_keys ORDER BY day, installation_hash",
          )
          .all<{ day: string; installation_hash: string }>();
      const totals = () =>
        database
          .prepare("SELECT * FROM deepseek_usage_daily_totals ORDER BY day, version")
          .all<{ day: string; version: string; installations: number }>();

      for (const invalidVersion of [
        `v${version}`,
        `${version}\n`,
        "00.2.2-rc.3.with-fh.20261116.1",
        "0.2.2-rc.03.with-fh.20261116.1",
        "0.2.2-rc.3.with-fh.20260229.1",
        "0.2.2-rc.3.with-fh.20261116.01",
        "0.2.2-rc.3.with-fh.20261116.1+other",
        "0.2.2-rc.3",
      ]) {
        expect((await receive({ ...event, version: invalidVersion })).status).toBe(400);
      }
      for (const invalidPayload of [
        { ...event, installationId: installationId.toUpperCase() },
        { ...event, installationId: installationId.slice(1) },
        { ...event, prompt: "unexpected field" },
        { installationId },
        [event],
        null,
      ]) {
        expect((await receive(invalidPayload)).status).toBe(400);
      }

      const sendBody = (body: string, headers: HeadersInit) =>
        collectDeepSeekUsage(
          new Request("https://example.com", { method: "POST", body, headers }),
          database,
        );
      expect((await sendBody(JSON.stringify(event), { "content-type": "text/plain" })).status).toBe(
        415,
      );
      expect((await sendBody("{", { "content-type": "application/json" })).status).toBe(400);
      expect(
        (
          await sendBody(" ".repeat(1025), {
            "content-type": "application/json",
            "content-length": "1",
          })
        ).status,
      ).toBe(413);
      expect(
        (
          await sendBody(JSON.stringify(event), {
            "content-type": "application/json",
            "content-length": "1025",
          })
        ).status,
      ).toBe(413);
      expect((await keys()).results).toEqual([]);
      expect((await totals()).results).toEqual([]);

      const responses = await Promise.all(Array.from({ length: 12 }, () => receive(event)));
      expect(responses.map((response) => response.status)).toEqual(Array(12).fill(204));
      expect(await responses[0].text()).toBe("");
      expect((await receive({ ...event, version: otherVersion })).status).toBe(204);
      expect((await receive({ ...event, installationId: "cd".repeat(32) })).status).toBe(204);
      expect(
        (await receive({ ...event, version: otherVersion }, "2026-11-27T00:00:00Z")).status,
      ).toBe(204);
      const storedKeys = (await keys()).results;
      expect(storedKeys).toHaveLength(3);
      expect(new Set(storedKeys.map((key) => key.installation_hash)).size).toBe(3);
      expect(storedKeys.some((key) => key.installation_hash === installationId)).toBe(false);
      expect((await totals()).results).toEqual([
        { day: "2026-11-26", version, installations: 2 },
        { day: "2026-11-27", version: otherVersion, installations: 1 },
      ]);

      await database
        .prepare(
          `WITH RECURSIVE ids(n) AS (
             SELECT 1 UNION ALL SELECT n + 1 FROM ids WHERE n < 129
           )
           INSERT INTO deepseek_usage_daily_keys
           SELECT '2026-11-26', printf('%064x', n), ? FROM ids`,
        )
        .bind(version)
        .run();
      expect((await receive(event, "2026-11-28T00:00:00Z")).status).toBe(204);
      expect((await keys()).results.map((key) => key.day)).toEqual([
        "2026-11-26",
        "2026-11-26",
        "2026-11-26",
        "2026-11-27",
        "2026-11-28",
      ]);
      expect(
        (await receive({ ...event, installationId: "cd".repeat(32) }, "2026-11-28T00:00:01Z"))
          .status,
      ).toBe(204);
      expect((await keys()).results.map((key) => key.day)).toEqual([
        "2026-11-27",
        "2026-11-28",
        "2026-11-28",
      ]);
      expect((await totals()).results).toEqual([
        { day: "2026-11-26", version, installations: 131 },
        { day: "2026-11-27", version: otherVersion, installations: 1 },
        { day: "2026-11-28", version, installations: 2 },
      ]);

      await database
        .prepare(
          `CREATE TRIGGER reject_usage_total BEFORE INSERT ON deepseek_usage_daily_totals
           BEGIN SELECT RAISE(ABORT, 'test aggregate failure'); END;`,
        )
        .run();
      expect((await receive(event, "2026-11-29T00:00:00Z")).status).toBe(503);
      expect((await keys()).results.map((key) => key.day)).toEqual([
        "2026-11-27",
        "2026-11-28",
        "2026-11-28",
      ]);
      await database.prepare("DROP TRIGGER reject_usage_total").run();
      expect((await receive(event, "2026-11-29T00:00:00Z")).status).toBe(204);
      expect((await totals()).results.at(-1)).toEqual({
        day: "2026-11-29",
        version,
        installations: 1,
      });
    } finally {
      await platform.dispose();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

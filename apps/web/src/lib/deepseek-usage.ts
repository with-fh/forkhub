import { z } from "zod";

const maxBodyBytes = 1024;
const buildVersion =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)\.with-fh\.(\d{4})(\d{2})(\d{2})\.(?:0|[1-9]\d*)(?![\s\S])/;

const usageEvent = z.strictObject({
  installationId: z
    .string()
    .length(64)
    .regex(/^[0-9a-f]+$/),
  version: z
    .string()
    .max(128)
    .refine((version) => {
      const match = buildVersion.exec(version);
      if (!match) return false;

      const [, prerelease, year, month, day] = match;
      return (
        !prerelease.split(".").some((identifier) => /^0\d+$/.test(identifier)) &&
        z.iso.date().safeParse(`${year}-${month}-${day}`).success
      );
    }),
});

export interface UsageDatabase {
  prepare(sql: string): {
    bind(...values: string[]): {
      run(): Promise<{ success: boolean }>;
    };
  };
}

async function readBody(request: Request) {
  if (Number(request.headers.get("content-length")) > maxBodyBytes) return null;
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const buffer = new Uint8Array(maxBodyBytes);
  let length = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return buffer.subarray(0, length);
      if (length + value.byteLength > maxBodyBytes) {
        void reader.cancel().catch(() => {});
        return null;
      }
      buffer.set(value, length);
      length += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function collectDeepSeekUsage(
  request: Request,
  database: UsageDatabase | undefined,
  receivedAt = new Date(),
): Promise<Response> {
  if (!database) return new Response(null, { status: 503 });

  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") return new Response(null, { status: 415 });

  let payload: unknown;
  try {
    const body = await readBody(request);
    if (!body) return new Response(null, { status: 413 });
    payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    return new Response(null, { status: 400 });
  }

  const event = usageEvent.safeParse(payload);
  if (!event.success) return new Response(null, { status: 400 });

  const day = receivedAt.toISOString().slice(0, 10);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${day}:${event.data.installationId}`),
  );
  const installationHash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  try {
    const result = await database
      .prepare(
        `INSERT INTO deepseek_usage_daily_keys (day, installation_hash, version)
         VALUES (?, ?, ?)
         ON CONFLICT (day, installation_hash) DO NOTHING`,
      )
      .bind(day, installationHash, event.data.version)
      .run();
    return new Response(null, { status: result.success ? 204 : 503 });
  } catch {
    return new Response(null, { status: 503 });
  }
}

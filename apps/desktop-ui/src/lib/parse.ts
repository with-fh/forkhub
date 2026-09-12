/** Extract `Key:  value` from fh text output. */
export function kv(stdout: string, key: string): string | null {
  const match = stdout.match(new RegExp(`^${key}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim() ?? null;
}

export type DriftPatch = {
  patchId: string;
  title?: string | null;
  status: "current" | "drifted" | "unknown" | "upstreamed";
  lastRealizedSha: string;
  targetArea: string[];
  upstreamChanged: boolean;
  targetAreaChanged: boolean;
  filesChangedInTargetArea: string[];
};

export type DriftResult = {
  upstreamSha: string;
  lastKnownSha: string;
  upstreamAdvanced: boolean;
  patches: DriftPatch[];
  summary: { total: number; current: number; drifted: number; wouldSkip: number };
};

export function parseDriftJson(stdout: string): DriftResult | null {
  try {
    const parsed = JSON.parse(stdout) as Partial<DriftResult>;
    if (!parsed || !Array.isArray(parsed.patches) || !parsed.summary) return null;
    return parsed as DriftResult;
  } catch {
    return null;
  }
}

export type SearchRow = {
  patchId: string;
  title: string;
  author: string;
  target: string | null;
  stars: string;
  url: string | null;
};

/** Parse `fh search` / `fh popular` text output into rows. */
export function parseSearch(stdout: string): SearchRow[] {
  const rows: SearchRow[] = [];
  const blocks = stdout.split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim());
    const idLine = lines.find((l) => l && !l.includes(":") && !l.startsWith("Found"));
    if (!idLine) continue;
    const field = (name: string): string | null => {
      const line = lines.find((l) => l.startsWith(`${name}:`));
      return line ? line.slice(name.length + 1).trim() : null;
    };
    const importLine = field("import") ?? "";
    const urlMatch = importLine.match(/https?:\/\/\S+/);
    rows.push({
      patchId: idLine,
      title: field("title") ?? "unknown",
      author: field("author") ?? "unknown",
      target: field("target"),
      stars: field("stars") ?? "?",
      url: urlMatch?.[0] ?? null,
    });
  }
  return rows;
}

/** Parse `fh status` text output. */
export function parseStatus(stdout: string): {
  current: string | null;
  latest: string | null;
  behind: boolean;
} {
  const current = stdout.match(/^Current:\s*(.+)$/im)?.[1]?.trim() ?? null;
  const latest = stdout.match(/^Latest:\s*(.+)$/im)?.[1]?.trim() ?? null;
  const behind = /run `?fh update`?/i.test(stdout);
  return { current, latest, behind };
}

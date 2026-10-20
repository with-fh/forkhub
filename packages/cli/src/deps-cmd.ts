import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { isGitRepo } from "./git";
import {
  validateManifest,
  parseDepList,
  parseDepSpec,
  formatDepList,
  resolveDepId,
  getDependents,
  isEnabled,
  type Manifest,
} from "./deps";

export type DepsOptions = {
  forkhubDir?: string;
  targetRepo?: string;
  json?: boolean;
  fixOrder?: boolean;
  enable?: string | boolean;
  disable?: string | boolean;
  dependsOn?: string;
  optionalDependsOn?: string;
  conflictsWith?: string;
  patchId?: string;
};

export type DepsResult = {
  targetRepo: string;
  valid: boolean;
  order: string[];
  fixedOrder: string[];
  orderFixed: boolean;
  errors: string[];
  warnings: string[];
  patches: Array<{
    id: string;
    version: number;
    enabled: boolean;
    status?: string;
    dependsOn: string[];
    optionalDependsOn: string[];
    conflictsWith: string[];
    dependents: string[];
  }>;
};

function findTargetRepo(forkhubDir: string): string {
  const reposDir = join(forkhubDir, "repos");
  if (!existsSync(reposDir))
    throw new Error("No repos found in .forkhub. Run `forkhub init` first.");
  for (const host of readdirSync(reposDir)) {
    for (const owner of readdirSync(join(reposDir, host))) {
      for (const repo of readdirSync(join(reposDir, host, owner))) {
        const targetRepo = `${host}/${owner}/${repo}`;
        if (existsSync(join(reposDir, targetRepo, "manifest.json"))) return targetRepo;
      }
    }
  }
  throw new Error("Could not determine target repo. Run `forkhub init` first.");
}

function splitListOpt(raw: string | undefined): string[] | null {
  if (raw == null) return null;
  // Accept the same conventions as INTENT.md frontmatter (`[]`, `a, b@>=2`).
  return parseDepList(raw);
}

function upsertIntentFrontmatter(intentPath: string, field: string, values: string[]): void {
  if (!existsSync(intentPath)) return;
  let content = readFileSync(intentPath, "utf-8");
  const line = `${field}: ${formatDepList(values)}`;
  if (new RegExp(`^${field}:\\s*(.+)$`, "m").test(content)) {
    content = content.replace(new RegExp(`^${field}:\\s*(.+)$`, "m"), line);
  } else if (content.startsWith("---\n")) {
    content = content.replace(/^---\n/, `---\n${line}\n`);
  } else {
    content = `${line}\n${content}`;
  }
  writeFileSync(intentPath, content);
}

export async function runDeps(options: DepsOptions = {}): Promise<DepsResult> {
  if (!(await isGitRepo())) {
    throw new Error("Not a git repository. Run from inside your fork's checkout.");
  }
  const forkhubDir = options.forkhubDir ?? join(process.cwd(), "..", ".forkhub");
  if (!existsSync(forkhubDir)) {
    throw new Error(".forkhub repo not found. Run `forkhub init` first.");
  }
  const targetRepo = options.targetRepo ?? findTargetRepo(forkhubDir);
  const manifestPath = join(forkhubDir, "repos", targetRepo, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`Manifest not found at ${manifestPath}. Run \`forkhub init\` first.`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as Manifest;
  manifest.patches ??= {};
  manifest.apply_order ??= [];
  manifest.slug_aliases ??= {};

  const flagTarget = (v: string | boolean | undefined): string | null => {
    if (typeof v === "string" && v) return v;
    if (v === true && options.patchId) return options.patchId;
    return null;
  };

  let mutated = false;

  // --disable <id> / --enable <id> (or `fh deps <id> --disable`).
  const disableTarget = flagTarget(options.disable);
  const enableTarget = flagTarget(options.enable);
  if (disableTarget) {
    const id = resolveDepId(manifest, disableTarget) ?? disableTarget;
    const entry = manifest.patches[id];
    if (!entry) throw new Error(`Patch '${disableTarget}' not found in manifest.`);
    entry.enabled = false;
    mutated = true;
  }
  if (enableTarget) {
    const id = resolveDepId(manifest, enableTarget) ?? enableTarget;
    const entry = manifest.patches[id];
    if (!entry) throw new Error(`Patch '${enableTarget}' not found in manifest.`);
    entry.enabled = true;
    if (entry.status === "disabled") entry.status = "applied";
    mutated = true;
  }

  // `fh deps <patch-id> --depends-on a,b --conflicts-with c` — replace dep lists.
  if (options.patchId) {
    const id = resolveDepId(manifest, options.patchId) ?? options.patchId;
    const entry = manifest.patches[id];
    if (
      options.dependsOn != null ||
      options.optionalDependsOn != null ||
      options.conflictsWith != null
    ) {
      if (!entry) throw new Error(`Patch '${options.patchId}' not found in manifest.`);
      const nextDeps = splitListOpt(options.dependsOn);
      const nextOpt = splitListOpt(options.optionalDependsOn);
      const nextConf = splitListOpt(options.conflictsWith);
      for (const spec of [...(nextDeps ?? []), ...(nextOpt ?? []), ...(nextConf ?? [])]) {
        parseDepSpec(spec); // fail fast on malformed specs
      }
      if (nextDeps) entry.depends_on = nextDeps;
      if (nextOpt) entry.optional_depends_on = nextOpt;
      if (nextConf) entry.conflicts_with = nextConf;
      const repoDir = join(forkhubDir, "repos", targetRepo);
      upsertIntentFrontmatter(
        join(repoDir, "patches", id, "INTENT.md"),
        "depends_on",
        parseDepList(entry.depends_on ?? []),
      );
      upsertIntentFrontmatter(
        join(repoDir, "patches", id, "INTENT.md"),
        "optional_depends_on",
        parseDepList(entry.optional_depends_on ?? []),
      );
      upsertIntentFrontmatter(
        join(repoDir, "patches", id, "INTENT.md"),
        "conflicts_with",
        parseDepList(entry.conflicts_with ?? []),
      );
      mutated = true;
    }
  }

  // Validate before fix-order so cycles surface even when order is repaired.
  let check = validateManifest(manifest);
  if (options.fixOrder && !check.orderOk) {
    manifest.apply_order = check.fixedOrder;
    mutated = true;
    check = validateManifest(manifest);
  }

  if (mutated) {
    // Persist even when the graph is currently broken (npm allows a
    // package.json that references not-yet-installed deps): callers see
    // valid=false and `fh deps` exits 1. Only malformed specs throw above.
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  }

  const patches = Object.entries(manifest.patches).map(([id, e]) => ({
    id,
    version:
      typeof e.version === "number" ? e.version : parseInt(String(e.version ?? "1"), 10) || 1,
    enabled: isEnabled(e),
    status: e.status,
    dependsOn: parseDepList(e.depends_on ?? []),
    optionalDependsOn: parseDepList(e.optional_depends_on ?? []),
    conflictsWith: parseDepList(e.conflicts_with ?? []),
    dependents: getDependents(manifest, id),
  }));

  return {
    targetRepo,
    valid: check.valid,
    order: check.order,
    fixedOrder: check.fixedOrder,
    orderFixed: mutated && !!options.fixOrder,
    errors: check.errors.map((e) => `[${e.kind}] ${e.message}`),
    warnings: check.warnings.map((w) => `[${w.kind}] ${w.message}`),
    patches,
  };
}

export function formatDepsResult(result: DepsResult): string {
  const lines: string[] = [];
  lines.push(`Target: ${result.targetRepo}`);
  lines.push(`Install order: ${result.order.join(" → ") || "(no enabled patches)"}`);
  lines.push("");
  for (const p of result.patches) {
    const state = p.enabled ? (p.status ?? "unknown") : "disabled";
    const deps = p.dependsOn.length > 0 ? ` needs [${p.dependsOn.join(", ")}]` : "";
    const opt =
      p.optionalDependsOn.length > 0 ? ` optional [${p.optionalDependsOn.join(", ")}]` : "";
    const conf = p.conflictsWith.length > 0 ? ` conflicts [${p.conflictsWith.join(", ")}]` : "";
    const usedBy = p.dependents.length > 0 ? ` ← used by ${p.dependents.join(", ")}` : "";
    lines.push(`  • ${p.id} (v${p.version}, ${state})${deps}${opt}${conf}${usedBy}`);
  }
  lines.push("");
  if (result.errors.length > 0) {
    lines.push(`Errors (${result.errors.length}):`);
    for (const e of result.errors) lines.push(`  ✗ ${e}`);
    lines.push("");
  }
  if (result.warnings.length > 0) {
    lines.push(`Warnings (${result.warnings.length}):`);
    for (const w of result.warnings) lines.push(`  ⚠ ${w}`);
    lines.push("");
  }
  if (result.valid && result.warnings.length === 0) {
    lines.push("Dependencies OK.");
  } else if (!result.valid) {
    lines.push(
      "Fix with: fh deps <patch-id> --depends-on ... / --conflicts-with ... / --fix-order",
    );
  }
  return lines.join("\n");
}

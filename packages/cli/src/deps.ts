/**
 * Intent-patch dependency management — npm/cargo parity for forkhub patches.
 *
 * Package-manager equivalents:
 * - `depends_on`            ↔ `dependencies` (required)
 * - `optional_depends_on`   ↔ `optionalDependencies` (best-effort, never blocks)
 * - `conflicts_with`        ↔ `conflicts` (opam/cargo-style incompatible)
 * - `version` + req `@>=2`  ↔ semver requirements (`^`, `~`, `>=`, exact, `*`)
 * - `manifest.apply_order`  ↔ install order (must be topological; `fh deps --fix-order` repairs)
 * - `enabled: false`        ↔ uninstalled/disabled package (excluded from resolution)
 * - transitive closure      ↔ `npm install` pulls deps of deps automatically
 *
 * Better-than-npm extras (intent-aware):
 * - target_area overlap warnings (two patches touching the same files usually
 *   need an explicit depends_on/conflicts_with relationship).
 * - drift-aware blocking: a patch whose deps drifted is reported as `blocked`,
 *   so `fh watch` re-derives deps first (topological).
 */

export type DepConstraint =
  | { kind: "any" }
  | { kind: "exact"; version: number }
  | { kind: "gte"; version: number }
  | { kind: "caret"; version: number }
  | { kind: "tilde"; version: number }
  | { kind: "range"; gte: number; lt: number };

export type ParsedDep = {
  /** Raw spec as written, e.g. `fix-foo-a1b2c3d4@>=2`. */
  raw: string;
  /** Patch id (or slug alias) the spec refers to. */
  id: string;
  constraint: DepConstraint;
  /** True when the dep was marked optional inline (`id?`). Prefer the
   * `optional_depends_on` field; inline `?` is accepted for ergonomics. */
  optional: boolean;
};

export type ManifestPatchEntry = {
  status?: string;
  version?: number;
  author?: string;
  last_modified_by?: string;
  branch?: string;
  last_realized_against_commit?: string | null;
  depends_on?: string[];
  optional_depends_on?: string[];
  conflicts_with?: string[];
  enabled?: boolean;
  private?: boolean;
  [k: string]: unknown;
};

export type Manifest = {
  target_repo?: string;
  upstream_main_branch?: string;
  upstream_remote?: string;
  patches?: Record<string, ManifestPatchEntry>;
  apply_order?: string[];
  slug_aliases?: Record<string, string>;
  [k: string]: unknown;
};

export type DepProblem = {
  kind:
    | "missing"
    | "disabled"
    | "version-mismatch"
    | "cycle"
    | "conflict"
    | "order-violation"
    | "unknown-target";
  patchId: string;
  dep?: string;
  message: string;
};

export type ValidateResult = {
  valid: boolean;
  errors: DepProblem[];
  warnings: DepProblem[];
  /** Topological order of enabled patches (deps first). Empty on cycle. */
  order: string[];
  /** apply_order rewritten to topological order (stable). */
  fixedOrder: string[];
  /** True when current apply_order already matches fixedOrder. */
  orderOk: boolean;
  cycles: string[][];
};

/** Split a frontmatter/yaml-ish list value into specs. Accepts `[a, b@2]`, `a, b@2`, `[a]`, empty. */
export function parseDepList(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw))
    return raw
      .map(String)
      .map((s) => s.trim())
      .filter(Boolean);
  const s = String(raw).trim();
  if (!s || s === "[]" || s.toLowerCase() === "null" || s.toLowerCase() === "none") return [];
  const inner = s.startsWith("[") && s.endsWith("]") ? s.slice(1, -1) : s;
  return inner
    .split(",")
    .map((p) => p.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

export function formatDepList(deps: string[]): string {
  if (deps.length === 0) return "[]";
  return `[${deps.join(", ")}]`;
}

function parseConstraint(req: string): DepConstraint {
  const r = req.trim();
  if (!r || r === "*") return { kind: "any" };
  let m = r.match(/^>=\s*(\d+)\s*<\s*(\d+)$/);
  if (m?.[1] && m[2]) return { kind: "range", gte: parseInt(m[1], 10), lt: parseInt(m[2], 10) };
  m = r.match(/^>=\s*(\d+)$/);
  if (m?.[1]) return { kind: "gte", version: parseInt(m[1], 10) };
  m = r.match(/^\^\s*(\d+)$/);
  if (m?.[1]) {
    const v = parseInt(m[1], 10);
    return { kind: "caret", version: v };
  }
  m = r.match(/^~\s*(\d+)$/);
  if (m?.[1]) return { kind: "tilde", version: parseInt(m[1], 10) };
  m = r.match(/^=\s*(\d+)$/);
  if (m?.[1]) return { kind: "exact", version: parseInt(m[1], 10) };
  m = r.match(/^(\d+)$/);
  if (m?.[1]) return { kind: "exact", version: parseInt(m[1], 10) };
  throw new Error(
    `Invalid version requirement: "${req}". Use "*", "2", ">=2", "^2", "~2", or ">=1 <3".`,
  );
}

/** Parse `patch-id[@req][?]` — e.g. `fix-x-a1b2c3d4`, `fix-x-a1b2c3d4@>=2`, `fix-x-a1b2c3d4?`. */
export function parseDepSpec(spec: string): ParsedDep {
  const raw = spec.trim();
  if (!raw) throw new Error("Empty dependency spec.");
  let optional = false;
  let s = raw;
  if (s.endsWith("?")) {
    optional = true;
    s = s.slice(0, -1).trim();
  }
  const at = s.lastIndexOf("@");
  // `@` only splits id/req when the tail parses as a requirement; patch ids
  // themselves never contain `@`, so a failed parse means the whole string is the id.
  if (at > 0) {
    const id = s.slice(0, at).trim();
    const req = s.slice(at + 1).trim();
    try {
      const constraint = parseConstraint(req);
      if (!id) throw new Error(`Invalid dependency spec: "${raw}".`);
      return { raw, id, constraint, optional };
    } catch {
      // fall through → treat whole string as id (will re-throw if truly invalid)
      if (req.includes("<") || req.includes(">") || req.includes("^") || req.includes("~")) {
        throw new Error(
          `Invalid version requirement in "${raw}". Use "*", "2", ">=2", "^2", "~2", or ">=1 <3".`,
        );
      }
    }
  }
  if (!s) throw new Error(`Invalid dependency spec: "${raw}".`);
  return { raw, id: s, constraint: { kind: "any" }, optional };
}

export function satisfies(version: number, c: DepConstraint): boolean {
  switch (c.kind) {
    case "any":
      return true;
    case "exact":
    case "tilde":
      return version === c.version;
    case "gte":
      return version >= c.version;
    case "caret":
      return version >= c.version && version < c.version + 1;
    case "range":
      return version >= c.gte && version < c.lt;
  }
}

export function constraintToString(c: DepConstraint): string {
  switch (c.kind) {
    case "any":
      return "*";
    case "exact":
    case "tilde":
      return `${c.kind === "tilde" ? "~" : ""}${c.version}`;
    case "gte":
      return `>=${c.version}`;
    case "caret":
      return `^${c.version}`;
    case "range":
      return `>=${c.gte} <${c.lt}`;
  }
}

export function isEnabled(entry: ManifestPatchEntry | undefined): boolean {
  if (!entry) return false;
  if (entry.enabled === false) return false;
  if (entry.status === "disabled") return false;
  return true;
}

function patchVersion(entry: ManifestPatchEntry | undefined): number {
  const v = entry?.version;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = parseInt(String(v ?? "1"), 10);
  return Number.isNaN(n) ? 1 : n;
}

/** Resolve a dep id through slug_aliases + exact match. Returns manifest key or null. */
export function resolveDepId(manifest: Manifest, depId: string): string | null {
  const patches = manifest.patches ?? {};
  if (patches[depId]) return depId;
  const alias = manifest.slug_aliases?.[depId];
  if (alias && patches[alias]) return alias;
  // Allow short slug-prefix match (patch ids are `${slug}-${ulid8}`): unique prefix wins.
  const candidates = Object.keys(patches).filter((id) => id.startsWith(depId));
  if (candidates.length === 1) return candidates[0]!;
  return null;
}

function requiredDeps(entry: ManifestPatchEntry): string[] {
  return parseDepList(entry.depends_on);
}

function optionalDeps(entry: ManifestPatchEntry): string[] {
  return parseDepList(entry.optional_depends_on);
}

/**
 * Topological order (deps first, stable w.r.t. apply_order).
 * Unknown/disabled/missing deps are ignored here — use validateManifest() for errors.
 */
export function topoSort(manifest: Manifest): { order: string[]; cycles: string[][] } {
  const patches = manifest.patches ?? {};
  const enabledIds = Object.keys(patches).filter((id) => isEnabled(patches[id]));
  const enabled = new Set(enabledIds);
  const edges = new Map<string, Set<string>>(); // id -> resolved required dep ids (enabled only)
  for (const id of enabledIds) {
    const deps = new Set<string>();
    for (const spec of requiredDeps(patches[id]!)) {
      let parsed: ParsedDep;
      try {
        parsed = parseDepSpec(spec);
      } catch {
        continue;
      }
      if (parsed.optional) continue;
      const resolved = resolveDepId(manifest, parsed.id);
      if (resolved && enabled.has(resolved)) deps.add(resolved);
    }
    edges.set(id, deps);
  }

  // Kahn's, stable: prefer apply_order position, then lexicographic.
  const rank = new Map<string, number>();
  (manifest.apply_order ?? []).forEach((id, i) => rank.set(id, i));
  const indegree = new Map<string, number>();
  const dependents = new Map<string, Set<string>>();
  for (const id of enabledIds) {
    indegree.set(id, edges.get(id)?.size ?? 0);
    dependents.set(id, new Set());
  }
  for (const [id, deps] of edges) {
    for (const d of deps) dependents.get(d)?.add(id);
  }
  const byRank = (a: string, b: string) =>
    (rank.get(a) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b) ?? Number.MAX_SAFE_INTEGER) ||
    (a < b ? -1 : a > b ? 1 : 0);
  let ready = enabledIds.filter((id) => (indegree.get(id) ?? 0) === 0).sort(byRank);
  const order: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift()!;
    order.push(id);
    for (const dep of [...(dependents.get(id) ?? [])].sort(byRank)) {
      indegree.set(dep, (indegree.get(dep) ?? 1) - 1);
      if (indegree.get(dep) === 0) {
        ready.push(dep);
        ready.sort(byRank);
      }
    }
  }
  const cycles: string[][] = [];
  if (order.length !== enabledIds.length) {
    const left = enabledIds.filter((id) => !order.includes(id)).sort();
    // Report each strongly-connected remainder as one cycle (simple DFS chunks).
    const visited = new Set<string>();
    for (const start of left) {
      if (visited.has(start)) continue;
      const stack = [start];
      const comp: string[] = [];
      while (stack.length > 0) {
        const cur = stack.pop()!;
        if (visited.has(cur)) continue;
        visited.add(cur);
        comp.push(cur);
        for (const d of edges.get(cur) ?? []) {
          if (!order.includes(d) && !visited.has(d)) stack.push(d);
        }
      }
      if (comp.length > 0) cycles.push(comp.sort());
    }
  }
  return { order, cycles };
}

export function validateManifest(manifest: Manifest): ValidateResult {
  const patches = manifest.patches ?? {};
  const errors: DepProblem[] = [];
  const warnings: DepProblem[] = [];
  const { order, cycles } = topoSort(manifest);

  for (const [id, entry] of Object.entries(patches)) {
    if (!isEnabled(entry)) continue;
    for (const spec of requiredDeps(entry)) {
      let parsed: ParsedDep;
      try {
        parsed = parseDepSpec(spec);
      } catch (err) {
        errors.push({
          kind: "unknown-target",
          patchId: id,
          dep: spec,
          message: `${id}: bad dep spec "${spec}" (${err instanceof Error ? err.message : err})`,
        });
        continue;
      }
      const targetKey = parsed.optional ? null : resolveDepId(manifest, parsed.id);
      // Inline-optional required deps that don't resolve are warnings, not errors.
      if (parsed.optional && !targetKey) {
        warnings.push({
          kind: "missing",
          patchId: id,
          dep: spec,
          message: `${id}: optional dep "${parsed.id}" not present — skipping.`,
        });
        continue;
      }
      if (!targetKey) {
        errors.push({
          kind: "missing",
          patchId: id,
          dep: spec,
          message: `${id}: depends on unknown patch "${parsed.id}" (not in manifest). Import it or drop the dep.`,
        });
        continue;
      }
      if (targetKey === id) {
        errors.push({
          kind: "cycle",
          patchId: id,
          dep: spec,
          message: `${id}: depends on itself.`,
        });
        continue;
      }
      const target = patches[targetKey]!;
      if (!isEnabled(target)) {
        errors.push({
          kind: "disabled",
          patchId: id,
          dep: spec,
          message: `${id}: depends on "${targetKey}" which is disabled. Enable it (fh deps --enable ${targetKey}) or drop the dep.`,
        });
        continue;
      }
      const v = patchVersion(target);
      if (!satisfies(v, parsed.constraint)) {
        errors.push({
          kind: "version-mismatch",
          patchId: id,
          dep: spec,
          message: `${id}: needs ${targetKey}@${constraintToString(parsed.constraint)} but manifest has v${v}.`,
        });
      }
    }
    for (const spec of optionalDeps(entry)) {
      let parsed: ParsedDep;
      try {
        parsed = parseDepSpec(spec);
      } catch (err) {
        warnings.push({
          kind: "unknown-target",
          patchId: id,
          dep: spec,
          message: `${id}: bad optional dep "${spec}" (${err instanceof Error ? err.message : err})`,
        });
        continue;
      }
      const targetKey = resolveDepId(manifest, parsed.id);
      if (!targetKey) continue; // absent optional dep is fine
      const target = patches[targetKey]!;
      if (!isEnabled(target)) continue;
      if (!satisfies(patchVersion(target), parsed.constraint)) {
        warnings.push({
          kind: "version-mismatch",
          patchId: id,
          dep: spec,
          message: `${id}: optional dep ${targetKey}@${constraintToString(parsed.constraint)} unsatisfied (has v${patchVersion(target)}). Continuing without it.`,
        });
      }
    }
    for (const spec of parseDepList(entry.conflicts_with)) {
      let parsed: ParsedDep;
      try {
        parsed = parseDepSpec(spec);
      } catch (err) {
        errors.push({
          kind: "unknown-target",
          patchId: id,
          dep: spec,
          message: `${id}: bad conflicts_with "${spec}" (${err instanceof Error ? err.message : err})`,
        });
        continue;
      }
      const targetKey = resolveDepId(manifest, parsed.id);
      if (!targetKey || !isEnabled(patches[targetKey])) continue;
      if (satisfies(patchVersion(patches[targetKey]), parsed.constraint)) {
        errors.push({
          kind: "conflict",
          patchId: id,
          dep: spec,
          message: `${id}: conflicts with enabled patch "${targetKey}" (v${patchVersion(patches[targetKey])}). Disable one of them.`,
        });
      }
    }
  }

  for (const c of cycles) {
    errors.push({
      kind: "cycle",
      patchId: c[0]!,
      message: `Dependency cycle: ${c.join(" → ")} → ${c[0]}. Break the cycle before applying.`,
    });
  }

  // apply_order must contain every enabled patch and be topological.
  const applyOrder = manifest.apply_order ?? [];
  const enabledIds = Object.keys(patches).filter((id) => isEnabled(patches[id]));
  const pos = new Map(order.map((id, i) => [id, i] as const));
  for (const id of enabledIds) {
    if (!applyOrder.includes(id)) {
      warnings.push({
        kind: "order-violation",
        patchId: id,
        message: `${id}: enabled but missing from apply_order. Run fh deps --fix-order.`,
      });
    }
  }
  for (let i = 0; i < applyOrder.length; i++) {
    for (let j = i + 1; j < applyOrder.length; j++) {
      const a = applyOrder[i]!;
      const b = applyOrder[j]!;
      if (pos.has(a) && pos.has(b) && (pos.get(a) ?? 0) > (pos.get(b) ?? 0)) {
        // Only report when b is a (transitive) dep of a — otherwise it's just
        // a stable-order difference, not a violation.
        if (isTransitiveDep(manifest, a, b)) {
          errors.push({
            kind: "order-violation",
            patchId: a,
            dep: b,
            message: `${a}: appears before its dependency ${b} in apply_order. Run fh deps --fix-order.`,
          });
        }
        break;
      }
    }
  }

  // fixedOrder = topo order + any unknown/disabled leftovers in original positions.
  const fixedOrder = [...order];
  for (const id of applyOrder) {
    if (!fixedOrder.includes(id)) fixedOrder.push(id);
  }
  const orderOk =
    errors.filter((e) => e.kind === "order-violation" || e.kind === "cycle").length === 0 &&
    warnings.filter((w) => w.kind === "order-violation").length === 0 &&
    enabledIds.every((id) => applyOrder.includes(id));

  return { valid: errors.length === 0, errors, warnings, order, fixedOrder, orderOk, cycles };
}

/** True when `dep` is a transitive required dep of `id` (enabled graph only). */
export function isTransitiveDep(manifest: Manifest, id: string, dep: string): boolean {
  const patches = manifest.patches ?? {};
  const seen = new Set<string>();
  const stack = [...requiredDeps(patches[id] ?? {})]
    .map((s) => {
      try {
        return parseDepSpec(s);
      } catch {
        return null;
      }
    })
    .filter((p): p is ParsedDep => !!p && !p.optional)
    .map((p) => resolveDepId(manifest, p.id))
    .filter((r): r is string => !!r);
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (cur === dep) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const s of requiredDeps(patches[cur] ?? {})) {
      try {
        const p = parseDepSpec(s);
        if (p.optional) continue;
        const r = resolveDepId(manifest, p.id);
        if (r && !seen.has(r)) stack.push(r);
      } catch {
        continue;
      }
    }
  }
  return false;
}

/** Transitive closure of required deps for `targets` (includes targets, topo-ordered). */
export function resolveClosure(manifest: Manifest, targets: string[]): string[] {
  const patches = manifest.patches ?? {};
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id)) return;
    const resolved = resolveDepId(manifest, id) ?? id;
    if (seen.has(resolved)) return;
    seen.add(resolved);
    for (const s of requiredDeps(patches[resolved] ?? {})) {
      try {
        const p = parseDepSpec(s);
        if (p.optional) continue;
        const r = resolveDepId(manifest, p.id);
        if (r) visit(r);
      } catch {
        continue;
      }
    }
  };
  for (const t of targets) visit(t);
  const { order } = topoSort(manifest);
  const rank = new Map(order.map((id, i) => [id, i] as const));
  return [...seen].sort(
    (a, b) => (rank.get(a) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b) ?? Number.MAX_SAFE_INTEGER),
  );
}

/** Reverse deps: which enabled patches (transitively) need `id`. */
export function getDependents(manifest: Manifest, id: string): string[] {
  const patches = manifest.patches ?? {};
  return Object.keys(patches).filter(
    (other) => other !== id && isEnabled(patches[other]) && isTransitiveDep(manifest, other, id),
  );
}

const LIST_FIELD_RE = /^(depends_on|optional_depends_on|conflicts_with):\s*(.+)$/m;

/** Read dep lists from INTENT.md frontmatter (tolerates missing file/fields). */
export function readIntentDeps(intentContent: string): {
  depends_on: string[];
  optional_depends_on: string[];
  conflicts_with: string[];
} {
  const get = (field: string): string[] => {
    const m = intentContent.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
    return parseDepList(m?.[1] ?? "[]");
  };
  return {
    depends_on: get("depends_on"),
    optional_depends_on: get("optional_depends_on"),
    conflicts_with: get("conflicts_with"),
  };
}

export function formatValidation(result: ValidateResult): string {
  const lines: string[] = [];
  if (result.valid && result.warnings.length === 0) {
    lines.push(
      `Dependencies OK — ${result.order.length} patch(es), order: ${result.order.join(" → ") || "(none)"}`,
    );
    return lines.join("\n");
  }
  if (result.errors.length > 0) {
    lines.push(`Errors (${result.errors.length}):`);
    for (const e of result.errors) lines.push(`  ✗ [${e.kind}] ${e.message}`);
  }
  if (result.warnings.length > 0) {
    lines.push(`Warnings (${result.warnings.length}):`);
    for (const w of result.warnings) lines.push(`  ⚠ [${w.kind}] ${w.message}`);
  }
  if (result.order.length > 0) lines.push(`Suggested order: ${result.order.join(" → ")}`);
  return lines.join("\n");
}

// Re-export for tree-shaken CLI use without importing internals.
export { LIST_FIELD_RE };

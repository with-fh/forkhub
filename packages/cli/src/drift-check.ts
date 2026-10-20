import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isGitRepo, gitOrThrow, gitExec, shortSha } from "./git";

export type DriftCheckOptions = {
  forkhubDir?: string;
};

export type PatchDriftStatus = {
  patchId: string;
  title?: string | null;
  status: "current" | "drifted" | "unknown" | "upstreamed" | "disabled";
  lastRealizedSha: string;
  targetArea: string[];
  upstreamChanged: boolean;
  targetAreaChanged: boolean;
  filesChangedInTargetArea: string[];
  /** Required deps that are themselves drifted/unknown/broken — re-derive these first. */
  blockedBy: string[];
  dependsOn: string[];
  appliedUpstreamPr?: {
    number: number;
    url: string;
    state: "open" | "merged" | "closed";
    mergeCommit?: string;
    /** false when the PR merged somewhere other than the tracked upstream branch */
    mergeOnTrackedBranch?: boolean;
  } | null;
};

export type DriftCheckResult = {
  upstreamSha: string;
  lastKnownSha: string;
  upstreamAdvanced: boolean;
  patches: PatchDriftStatus[];
  depErrors: string[];
  depWarnings: string[];
  /** Topological install order (deps first). */
  depOrder: string[];
  summary: {
    total: number;
    current: number;
    drifted: number;
    wouldSkip: number;
    blocked: number;
    disabled: number;
  };
};

function readManifest(repoDir: string): any {
  const manifestPath = join(repoDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error("manifest.json not found. Run `forkhub init` first.");
  }
  return JSON.parse(readFileSync(manifestPath, "utf-8"));
}

function readUpstreamConfig(repoDir: string): any {
  const upstreamJsonPath = join(repoDir, "upstream.json");
  if (!existsSync(upstreamJsonPath)) {
    throw new Error("upstream.json not found. Run `forkhub init` first.");
  }
  return JSON.parse(readFileSync(upstreamJsonPath, "utf-8"));
}

function readIntentMeta(
  repoDir: string,
  patchId: string,
): { title: string | null; targetArea: string[] } {
  const intentPath = join(repoDir, "patches", patchId, "INTENT.md");
  if (!existsSync(intentPath)) return { title: null, targetArea: [] };
  const content = readFileSync(intentPath, "utf-8");
  const titleMatch = content.match(/^title:\s*(.+)$/m);
  const areaMatch = content.match(/^target_area:\s*\[(.+?)\]/m);
  const targetArea = areaMatch?.[1]
    ? areaMatch[1]
        .split(",")
        .map((s) => s.trim().replace(/["']/g, ""))
        .filter(Boolean)
    : [];
  return { title: titleMatch?.[1]?.trim().replace(/["']/g, "") ?? null, targetArea };
}

function overlapWarnings(patches: PatchDriftStatus[], manifest: any): string[] {
  const warnings: string[] = [];
  const enabled = patches.filter((p) => p.status !== "disabled" && p.status !== "upstreamed");
  for (let i = 0; i < enabled.length; i++) {
    for (let j = i + 1; j < enabled.length; j++) {
      const a = enabled[i]!;
      const b = enabled[j]!;
      const shared = a.targetArea.filter((f) => b.targetArea.includes(f));
      if (shared.length === 0) continue;
      const aDeps: string[] = manifest.patches?.[a.patchId]?.depends_on ?? [];
      const bDeps: string[] = manifest.patches?.[b.patchId]?.depends_on ?? [];
      const related =
        aDeps.some((d) => String(d).startsWith(b.patchId)) ||
        bDeps.some((d) => String(d).startsWith(a.patchId));
      if (!related) {
        warnings.push(
          `${a.patchId} ↔ ${b.patchId} share target_area [${shared.join(", ")}] with no depends_on relationship — declare one with fh deps (or conflicts_with if incompatible).`,
        );
      }
    }
  }
  return warnings;
}

async function findTargetRepo(forkhubDir: string, forkCwd: string): Promise<string> {
  const { getRemoteUrl, listRemotes } = await import("./git");
  for (const remote of await listRemotes(forkCwd)) {
    const url = await getRemoteUrl(remote, forkCwd);
    if (!url) continue;
    let match = url.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
    if (match) {
      const targetRepo = `${match[1]}/${match[2]}`;
      if (existsSync(join(forkhubDir, "repos", targetRepo, "manifest.json"))) return targetRepo;
    }
    match = url.match(/^https?:\/\/([^/]+)\/(.+?)(?:\.git)?$/);
    if (match) {
      const targetRepo = `${match[1]}/${match[2]}`;
      if (existsSync(join(forkhubDir, "repos", targetRepo, "manifest.json"))) return targetRepo;
    }
  }
  const { readdirSync } = await import("node:fs");
  const reposDir = join(forkhubDir, "repos");
  if (!existsSync(reposDir)) {
    throw new Error("No repos found in .forkhub. Run `forkhub init` first.");
  }
  for (const host of readdirSync(reposDir)) {
    for (const owner of readdirSync(join(reposDir, host))) {
      for (const repo of readdirSync(join(reposDir, host, owner))) {
        const targetRepo = `${host}/${owner}/${repo}`;
        if (existsSync(join(reposDir, targetRepo, "manifest.json"))) {
          return targetRepo;
        }
      }
    }
  }
  throw new Error("Could not determine target repo from .forkhub.");
}

/**
 * Check the state of an upstream PR via `gh pr view`.
 * Returns the PR state (open/merged/closed) and merge commit SHA if merged.
 * On failure (gh not installed, no auth, network), returns null — callers
 * should not block drift-check just because PR tracking is unavailable.
 */
async function checkUpstreamPrState(
  targetRepo: string,
  prNumber: number,
): Promise<{ state: "open" | "merged" | "closed"; mergeCommit?: string } | null> {
  // Use gh CLI (not git) to query PR state
  const proc = Bun.spawn(
    ["gh", "pr", "view", String(prNumber), "--repo", targetRepo, "--json", "state,mergeCommit"],
    {
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [stdout] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    // gh not installed, no auth, or PR not found — don't block
    return null;
  }
  try {
    const data = JSON.parse(stdout.trim());
    const rawState = data.state?.toUpperCase();
    if (rawState === "MERGED") {
      return { state: "merged", mergeCommit: data.mergeCommit?.oid };
    }
    if (rawState === "CLOSED") {
      return { state: "closed" };
    }
    return { state: "open" };
  } catch {
    return null;
  }
}

export async function runDriftCheck(options: DriftCheckOptions = {}): Promise<DriftCheckResult> {
  if (!(await isGitRepo())) {
    throw new Error("Not a git repository. Run from inside your fork's checkout.");
  }

  const forkhubDir = options.forkhubDir ?? join(process.cwd(), "..", ".forkhub");
  if (!existsSync(forkhubDir)) {
    throw new Error(".forkhub repo not found. Run `forkhub init` first.");
  }

  const targetRepo = await findTargetRepo(forkhubDir, process.cwd());
  const repoDir = join(forkhubDir, "repos", targetRepo);
  const manifest = readManifest(repoDir);
  const upstreamConfig = readUpstreamConfig(repoDir);

  const upstreamRemote = upstreamConfig.upstream_remote ?? "upstream";
  const upstreamBranch = `${upstreamRemote}/${manifest.upstream_main_branch ?? "main"}`;

  const fetchResult = await gitExec(["fetch", upstreamRemote, "--quiet"]);
  if (fetchResult.exitCode !== 0) {
    throw new Error(`Could not fetch from ${upstreamRemote}: ${fetchResult.stderr}`);
  }

  const upstreamSha = await gitOrThrow(["rev-parse", upstreamBranch]);
  const lastKnownSha = upstreamConfig.last_known_upstream_sha ?? upstreamSha;
  const upstreamAdvanced = shortSha(upstreamSha) !== shortSha(lastKnownSha);

  const patchIds = Object.keys(manifest.patches || {});
  const patchStatuses: PatchDriftStatus[] = [];
  let manifestDirty = false;

  const { validateManifest, parseDepList, resolveDepId, isEnabled } = await import("./deps");
  const depCheck = validateManifest(manifest);
  const depOrder = depCheck.order;
  const orderRank = new Map(depOrder.map((id, i) => [id, i] as const));
  const orderedPatchIds = [...patchIds].sort(
    (a, b) =>
      (orderRank.get(a) ?? Number.MAX_SAFE_INTEGER) -
        (orderRank.get(b) ?? Number.MAX_SAFE_INTEGER) || (a < b ? -1 : 1),
  );

  for (const patchId of orderedPatchIds) {
    const patchInfo = manifest.patches[patchId];
    if (!isEnabled(patchInfo)) {
      const intentMetaDisabled = readIntentMeta(repoDir, patchId);
      patchStatuses.push({
        patchId,
        title: intentMetaDisabled.title,
        status: "disabled",
        lastRealizedSha: patchInfo.last_realized_against_commit ?? "",
        targetArea: intentMetaDisabled.targetArea,
        upstreamChanged: false,
        targetAreaChanged: false,
        filesChangedInTargetArea: [],
        blockedBy: [],
        dependsOn: parseDepList(patchInfo.depends_on ?? []),
        appliedUpstreamPr: null,
      });
      continue;
    }
    const lastRealizedSha = patchInfo.last_realized_against_commit;
    const intentMeta = readIntentMeta(repoDir, patchId);
    const targetArea = intentMeta.targetArea;
    const appliedPr = patchInfo.applied_upstream_pr;

    let status: PatchDriftStatus["status"] = "unknown";
    let upstreamChanged = false;
    let targetAreaChanged = false;
    let filesChangedInTargetArea: string[] = [];
    let prInfo: PatchDriftStatus["appliedUpstreamPr"] = null;

    // Check upstream PR state if tracked. If merged → UPSTREAMED.
    // If closed (not merged) → NEEDS_HUMAN (surface to user).
    if (appliedPr?.number) {
      const prState = await checkUpstreamPrState(targetRepo, appliedPr.number);
      if (prState) {
        prInfo = {
          number: appliedPr.number,
          url: appliedPr.url ?? `https://github.com/${targetRepo}/pull/${appliedPr.number}`,
          state: prState.state,
          mergeCommit: prState.mergeCommit,
        };
        if (prState.state === "merged") {
          // Only trust the merge commit when it actually landed on the
          // tracked upstream branch — `fh pr --base` allows merging a PR
          // elsewhere, and advancing last_realized to such a commit would
          // silently corrupt drift tracking.
          const mergeOnTracked =
            !!prState.mergeCommit &&
            (await gitExec(["merge-base", "--is-ancestor", prState.mergeCommit, upstreamSha]))
              .exitCode === 0;
          if (mergeOnTracked) {
            status = "upstreamed";
            // Advance last_realized to the merge commit so the next drift
            // cycle starts from the post-merge state.
            patchInfo.last_realized_against_commit = shortSha(prState.mergeCommit!);
            manifestDirty = true;
          } else {
            prInfo.mergeOnTrackedBranch = false;
          }
        }
      }
    }

    if (status !== "upstreamed") {
      if (!lastRealizedSha) {
        status = "drifted";
        upstreamChanged = true;
        targetAreaChanged = true;
        filesChangedInTargetArea = ["(imported — needs first realization)"];
      } else if (shortSha(lastRealizedSha) === shortSha(upstreamSha)) {
        status = "current";
      } else {
        upstreamChanged = true;
        if (targetArea.length > 0) {
          const areaArgs = targetArea.flatMap((a) => ["--", a]);
          const diffResult = await gitExec([
            "diff",
            "--name-only",
            `${lastRealizedSha}..${upstreamSha}`,
            ...areaArgs,
          ]);
          filesChangedInTargetArea = diffResult.stdout
            ? diffResult.stdout.split("\n").filter(Boolean)
            : [];

          if (filesChangedInTargetArea.length > 0) {
            status = "drifted";
            targetAreaChanged = true;
          } else {
            status = "current";
          }
        } else {
          status = "drifted";
          targetAreaChanged = true;
        }
      }
    }

    patchStatuses.push({
      patchId,
      title: intentMeta.title,
      status,
      lastRealizedSha,
      targetArea,
      upstreamChanged,
      targetAreaChanged,
      filesChangedInTargetArea,
      blockedBy: [],
      dependsOn: parseDepList(patchInfo.depends_on ?? []),
      appliedUpstreamPr: prInfo,
    });
  }

  // Second pass: blocked-by-dependencies (npm-style — re-derive deps first).
  // A patch is blocked when any required dep is drifted/unknown, disabled,
  // missing, or version-mismatched.
  {
    const byId = new Map(patchStatuses.map((p) => [p.patchId, p] as const));
    const { parseDepSpec } = await import("./deps");
    for (const p of patchStatuses) {
      if (p.status === "disabled" || p.status === "upstreamed") continue;
      const info = manifest.patches?.[p.patchId];
      if (!info) continue;
      for (const spec of parseDepList(info.depends_on ?? [])) {
        let depId = spec;
        try {
          depId = resolveDepId(manifest, parseDepSpec(spec).id) ?? parseDepSpec(spec).id;
        } catch {
          p.blockedBy.push(spec);
          continue;
        }
        const depStatus = byId.get(depId);
        if (!depStatus || depStatus.status === "disabled") {
          if (!p.blockedBy.includes(depId)) p.blockedBy.push(depId);
        } else if (depStatus.status === "drifted" || depStatus.status === "unknown") {
          if (!p.blockedBy.includes(depId)) p.blockedBy.push(depId);
        }
      }
      // Surface hard dep errors (missing/version/conflict/cycle) as blockers too.
      for (const e of depCheck.errors) {
        if (e.patchId === p.patchId && e.dep && !p.blockedBy.includes(e.dep)) {
          const resolved = resolveDepId(manifest, e.dep) ?? e.dep;
          if (!p.blockedBy.includes(resolved)) p.blockedBy.push(resolved);
        }
      }
    }
  }

  // Persist manifest updates (e.g. advanced last_realized on UPSTREAMED)
  if (manifestDirty) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(join(repoDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  }

  const depErrors = depCheck.errors.map((e) => `[${e.kind}] ${e.message}`);
  const depWarnings = [
    ...depCheck.warnings.map((w) => `[${w.kind}] ${w.message}`),
    ...overlapWarnings(patchStatuses, manifest),
  ];

  const summary = {
    total: patchStatuses.length,
    current: patchStatuses.filter((p) => p.status === "current").length,
    drifted: patchStatuses.filter((p) => p.status === "drifted").length,
    wouldSkip: patchStatuses.filter((p) => p.status === "current" && p.upstreamChanged).length,
    blocked: patchStatuses.filter((p) => p.blockedBy.length > 0).length,
    disabled: patchStatuses.filter((p) => p.status === "disabled").length,
  };

  return {
    upstreamSha,
    lastKnownSha,
    upstreamAdvanced,
    patches: patchStatuses,
    depErrors,
    depWarnings,
    depOrder,
    summary,
  };
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

/** Strip C0/C1 control characters (incl. ESC) — INTENT.md fields are untrusted input. */
function sanitize(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
}

function summarizeFiles(files: string[], max = 3): string {
  if (files.length === 0) return "";
  const shown = files.slice(0, max).join(", ");
  const rest = files.length - Math.min(files.length, max);
  return rest > 0 ? `${shown} (+${rest} more)` : shown;
}

export function formatDriftCheckResult(result: DriftCheckResult): string {
  const lines: string[] = [];

  const drifted = result.patches.filter((p) => p.status === "drifted");
  const upstreamed = result.patches.filter((p) => p.status === "upstreamed");
  const unknown = result.patches.filter((p) => p.status === "unknown");
  const currentCount = result.summary.current;
  const blockedCount = result.summary.blocked ?? 0;
  const disabledCount = result.summary.disabled ?? 0;

  const labelOf = (p: PatchDriftStatus): string => {
    if (p.title) return `“${truncate(sanitize(p.title), 80)}”`;
    return truncate(sanitize(p.patchId), 60);
  };
  const pidOf = (p: PatchDriftStatus): string => sanitize(p.patchId);

  lines.push(
    `Upstream: ${shortSha(result.upstreamSha)} ${
      result.upstreamAdvanced
        ? `(advanced from ${shortSha(result.lastKnownSha)})`
        : "(unchanged since last check)"
    }`,
  );

  if (result.patches.length === 0) {
    lines.push("");
    lines.push("No intent patches tracked. Nothing to maintain.");
    return lines.join("\n");
  }

  lines.push(
    `${result.summary.total} intent ${result.summary.total === 1 ? "patch" : "patches"}: ${drifted.length} need re-derivation · ${upstreamed.length} upstreamed · ${unknown.length} unclear · ${currentCount} current${blockedCount > 0 ? ` · ${blockedCount} blocked by deps` : ""}${disabledCount > 0 ? ` · ${disabledCount} disabled` : ""}`,
  );
  if (result.depOrder.length > 0) {
    lines.push(`Install order: ${result.depOrder.join(" → ")}`);
  }
  lines.push("");

  if (result.depErrors.length > 0) {
    lines.push("Dependency errors — fix before re-deriving:");
    for (const e of result.depErrors) lines.push(`  ✗ ${sanitize(e)}`);
    lines.push("");
  }

  if (drifted.length > 0) {
    lines.push("Needs re-derivation — upstream changed files these patches cover:");
    lines.push("");
    for (const [i, patch] of drifted.entries()) {
      lines.push(`  ${i + 1}. ${labelOf(patch)}`);
      lines.push(`      patch:    ${pidOf(patch)}`);
      if (patch.dependsOn.length > 0) {
        lines.push(`      needs:    ${patch.dependsOn.map((d) => sanitize(d)).join(", ")}`);
      }
      if (patch.blockedBy.length > 0) {
        lines.push(
          `      blocked:  re-derive ${patch.blockedBy.map((d) => sanitize(d)).join(", ")} first`,
        );
      }
      if (!patch.lastRealizedSha) {
        lines.push("      reason:   imported but never realized against upstream yet");
      } else if (patch.filesChangedInTargetArea.length > 0) {
        lines.push(
          `      reason:   ${patch.filesChangedInTargetArea.length} covered file(s) changed upstream since ${shortSha(patch.lastRealizedSha)}`,
        );
        lines.push(`                ${summarizeFiles(patch.filesChangedInTargetArea)}`);
      } else {
        lines.push(
          "      reason:   target_area not declared — cannot prove it's still safe, treat as drifted",
        );
      }
      if (patch.appliedUpstreamPr?.state === "open") {
        lines.push(
          `      upstream: PR #${patch.appliedUpstreamPr.number} still open — once merged, this patch becomes obsolete`,
        );
      } else if (patch.appliedUpstreamPr?.state === "closed") {
        lines.push(
          `      upstream: PR #${patch.appliedUpstreamPr.number} was closed without merging`,
        );
      } else if (
        patch.appliedUpstreamPr?.state === "merged" &&
        patch.appliedUpstreamPr.mergeOnTrackedBranch === false
      ) {
        lines.push(
          `      upstream: PR #${patch.appliedUpstreamPr.number} merged, but NOT on the tracked upstream branch — ignoring it`,
        );
      }
      lines.push(`      fix:      fh re-derive ${pidOf(patch)}`);
      lines.push("");
    }
  }

  if (upstreamed.length > 0) {
    lines.push("Safe to drop — upstream now includes these patches:");
    for (const patch of upstreamed) {
      const merged = patch.appliedUpstreamPr?.mergeCommit
        ? ` (merged as ${shortSha(patch.appliedUpstreamPr.mergeCommit)})`
        : "";
      const pr = patch.appliedUpstreamPr ? ` — #${patch.appliedUpstreamPr.number}${merged}` : "";
      lines.push(`  • ${labelOf(patch)}${pr}`);
      lines.push(`      patch: ${pidOf(patch)}`);
    }
    lines.push("");
  }

  if (unknown.length > 0) {
    lines.push("Unclear state — needs a human look:");
    for (const patch of unknown) {
      lines.push(`  • ${labelOf(patch)}`);
      lines.push(`      patch: ${pidOf(patch)}`);
    }
    lines.push("");
  }

  if (result.depWarnings.length > 0) {
    lines.push("Dependency warnings:");
    for (const w of result.depWarnings.slice(0, 10)) lines.push(`  ⚠ ${sanitize(w)}`);
    if (result.depWarnings.length > 10) {
      lines.push(`  … +${result.depWarnings.length - 10} more (fh deps --json)`);
    }
    lines.push("");
  }

  if (drifted.length > 0) {
    if (result.depErrors.length > 0) {
      lines.push(
        "⚠ Fix the dependency errors above before re-deriving — blocked patches will fail apply.",
      );
    }
    lines.push("What to do next:");
    lines.push(
      "  1. fh re-derive <patch-id>          regenerate the context bundle for each drifted patch (deps first — see blocked: above)",
    );
    lines.push("  2. point your AI agent at prompt.md in the bundle and let it fill");
    lines.push("     REALIZATION/realization.diff (fh watch --agent can automate this)");
    lines.push("  3. fh apply <bundle-path>           apply + tag when tests pass");
  } else if (unknown.length > 0) {
    lines.push("Everything else is current; only the unclear entries above need attention.");
  } else if (result.depErrors.length > 0) {
    lines.push(
      "Patches are current but the dependency graph is broken — fix the errors above first:",
    );
    lines.push("  fh deps --fix-order   (repairs install order; cannot fix cycles/conflicts)");
    lines.push(
      "  fh deps <patch-id> --depends-on ... / --conflicts-with ...   (edit relationships)",
    );
  } else if (upstreamed.length > 0) {
    lines.push("All covered. Consider removing the upstreamed patches from .forkhub.");
  } else {
    lines.push("All patches current. Nothing to do.");
  }

  return lines.join("\n");
}

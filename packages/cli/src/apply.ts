import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isGitRepo, gitOrThrow, gitExec, currentSha, shortSha, checkout } from "./git";

export type ApplyOptions = {
  forkhubDir?: string;
  skipTests?: boolean;
  skipTag?: boolean;
};

export type ApplyResult = {
  bundlePath: string;
  patchId: string;
  diffApplied: boolean;
  testsPass: boolean;
  tag: string | null;
  errors: string[];
  warnings: string[];
};

function readFrontmatterField(content: string, field: string): string | null {
  const match = content.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim().replace(/["']/g, "") ?? null;
}

function extractPatchIdFromBundle(bundlePath: string): string | null {
  const segments = bundlePath.split("/");
  const deriveIdx = segments.lastIndexOf("derive");
  if (deriveIdx === -1 || deriveIdx === segments.length - 1) return null;
  return segments[deriveIdx + 1] ?? null;
}

async function runVerificationCommand(command: string, cwd: string): Promise<boolean> {
  const proc = Bun.spawn(["sh", "-c", command], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const exitCode = await proc.exited;
  return exitCode === 0;
}

export async function runApply(
  bundlePath: string,
  options: ApplyOptions = {},
): Promise<ApplyResult> {
  if (!(await isGitRepo())) {
    throw new Error("Not a git repository. Run from inside your fork's checkout.");
  }

  const realizationDiffPath = join(bundlePath, "REALIZATION", "realization.diff");
  if (!existsSync(realizationDiffPath)) {
    throw new Error(
      `No realization found at ${realizationDiffPath}.\n` +
        `The AI should write its diff to REALIZATION/realization.diff in the bundle.`,
    );
  }

  const realizationDiff = readFileSync(realizationDiffPath, "utf-8");
  if (!realizationDiff.trim()) {
    throw new Error("REALIZATION/realization.diff is empty.");
  }

  const patchId = extractPatchIdFromBundle(bundlePath);
  if (!patchId) {
    throw new Error("Could not extract patch ID from bundle path.");
  }

  const intentPath = join(bundlePath, "INTENT.md");
  const verifyCommand = existsSync(intentPath)
    ? readFrontmatterField(readFileSync(intentPath, "utf-8"), "verifies_with")
    : null;

  const errors: string[] = [];
  const warnings: string[] = [];
  let diffApplied = false;
  let testsPass = false;
  let tag: string | null = null;

  const earlyReturn = () => ({
    bundlePath,
    patchId,
    diffApplied,
    testsPass,
    tag,
    errors,
    warnings,
  });

  const fhMainExists = await gitExec(["rev-parse", "--verify", "forkhub/main"]);
  if (fhMainExists.exitCode !== 0) {
    errors.push("forkhub/main branch does not exist. Run `forkhub satisfied` at least once first.");
    return earlyReturn();
  }

  // npm-style dependency gate: deps must be enabled + applied + version-satisfied,
  // and no enabled conflicting patch may be present.
  // Drift-stale deps (realized against an older upstream) are a non-blocking
  // warning — the realization may already account for them.
  {
    const forkhubDirProbe = options.forkhubDir ?? join(process.cwd(), "..", ".forkhub");
    const { readdirSync: rd, statSync: st } = await import("node:fs");
    const findManifest = (dir: string): string | null => {
      if (!existsSync(dir)) return null;
      for (const e of rd(dir)) {
        const full = join(dir, e);
        if (!st(full).isDirectory()) continue;
        if (e === patchId) return join(full, "..", "..", "manifest.json");
        const sub = findManifest(full);
        if (sub) return sub;
      }
      return null;
    };
    const manifestPathProbe = findManifest(join(forkhubDirProbe, "repos"));
    if (manifestPathProbe && existsSync(manifestPathProbe)) {
      const { validateManifest, resolveDepId, parseDepSpec, parseDepList, isEnabled } =
        await import("./deps");
      const manifestProbe = JSON.parse(readFileSync(manifestPathProbe, "utf-8"));
      const entry = manifestProbe.patches?.[patchId];
      if (entry && isEnabled(entry)) {
        const depErrors: string[] = [];
        const depIds: string[] = [];
        for (const spec of parseDepList(entry.depends_on ?? [])) {
          try {
            const parsed = parseDepSpec(spec);
            const targetKey = resolveDepId(manifestProbe, parsed.id);
            if (!targetKey) {
              depErrors.push(`missing dependency "${spec}" — import it first`);
              continue;
            }
            depIds.push(targetKey);
            const target = manifestProbe.patches[targetKey];
            if (!isEnabled(target)) {
              depErrors.push(
                `dependency "${targetKey}" is disabled — enable it (fh deps --enable ${targetKey})`,
              );
              continue;
            }
            if (target.status !== "applied") {
              depErrors.push(
                `dependency "${targetKey}" is "${target.status ?? "unknown"}" — apply it before ${patchId}`,
              );
            }
          } catch (err) {
            depErrors.push(`bad dep spec "${spec}" (${err instanceof Error ? err.message : err})`);
          }
        }
        const manifestCheck = validateManifest(manifestProbe);
        for (const e of manifestCheck.errors) {
          if (
            e.patchId === patchId &&
            (e.kind === "conflict" || e.kind === "version-mismatch" || e.kind === "cycle")
          ) {
            depErrors.push(`[${e.kind}] ${e.message}`);
          }
        }
        if (depErrors.length > 0) {
          errors.push(`Unsatisfied dependencies for ${patchId}:\n  - ${depErrors.join("\n  - ")}`);
          return earlyReturn();
        }
        // Staleness warning: dep realized against an older upstream than HEAD.
        // Best-effort (no fetch here); drift-check/watch own the fresh signal.
        try {
          const upstreamRemote =
            typeof manifestProbe.upstream_remote === "string"
              ? manifestProbe.upstream_remote
              : "upstream";
          const upstreamBranch =
            typeof manifestProbe.upstream_main_branch === "string"
              ? manifestProbe.upstream_main_branch
              : "main";
          const headRef = await gitExec(["rev-parse", `${upstreamRemote}/${upstreamBranch}`]);
          if (headRef.exitCode === 0) {
            const headShort = shortSha(headRef.stdout);
            for (const depId of depIds) {
              const realized = manifestProbe.patches?.[depId]?.last_realized_against_commit;
              if (realized && shortSha(String(realized)) !== headShort) {
                warnings.push(
                  `dependency "${depId}" was realized against ${shortSha(String(realized))} but upstream is at ${headShort} — consider re-deriving ${depId} first (fh drift-check).`,
                );
              }
            }
          }
        } catch {
          // never block apply on staleness probing
        }
      }
    }
  }

  const previousBranch = await gitOrThrow(["rev-parse", "--abbrev-ref", "HEAD"]);
  await checkout("forkhub/main");

  try {
    const checkResult = await gitExec(["apply", "--check", realizationDiffPath]);
    if (checkResult.exitCode !== 0) {
      errors.push(`Diff does not apply: ${checkResult.stderr || checkResult.stdout}`);
      return earlyReturn();
    }

    const applyResult = await gitExec(["apply", realizationDiffPath]);
    if (applyResult.exitCode !== 0) {
      errors.push(`Failed to apply: ${applyResult.stderr || applyResult.stdout}`);
      return earlyReturn();
    }
    diffApplied = true;

    if (!options.skipTests) {
      const forkhubDir = options.forkhubDir ?? join(process.cwd(), "..", ".forkhub");
      let patchDir: string | null = null;
      const { existsSync: exists, readdirSync, statSync } = await import("node:fs");
      function findPatch(dir: string, targetId: string): string | null {
        if (!exists(dir)) return null;
        for (const entry of readdirSync(dir)) {
          const full = join(dir, entry);
          if (statSync(full).isDirectory()) {
            if (entry === targetId) return full;
            const sub = findPatch(full, targetId);
            if (sub) return sub;
          }
        }
        return null;
      }
      patchDir = findPatch(join(forkhubDir, "repos"), patchId);

      if (patchDir) {
        const { runVerify } = await import("./verify");
        const verifyResult = await runVerify(patchDir, process.cwd());
        testsPass = verifyResult.passed;
        if (!testsPass) {
          errors.push(`Verification failed:\n${verifyResult.output}`);
          await gitExec(["apply", "-R", realizationDiffPath]);
          return { bundlePath, patchId, diffApplied: false, testsPass, tag, errors, warnings };
        }
      } else if (verifyCommand) {
        testsPass = await runVerificationCommand(verifyCommand, process.cwd());
        if (!testsPass) {
          errors.push(`Verification command failed: ${verifyCommand}`);
          await gitExec(["apply", "-R", realizationDiffPath]);
          return { bundlePath, patchId, diffApplied: false, testsPass, tag, errors, warnings };
        }
      } else {
        testsPass = true;
      }
    } else {
      testsPass = true;
    }

    if (!options.skipTag) {
      const upstreamTagResult = await gitExec(["describe", "--tags", "--abbrev=0", "forkhub/main"]);
      const upstreamTag = upstreamTagResult.exitCode === 0 ? upstreamTagResult.stdout : "v0.0.0";
      const fhTagsResult = await gitExec(["tag", "--list", `${upstreamTag}-fh*`]);
      const fhCount = fhTagsResult.stdout
        ? fhTagsResult.stdout.split("\n").filter(Boolean).length
        : 0;
      tag = `${upstreamTag}-fh${fhCount + 1}`;
      await gitOrThrow(["tag", "-m", tag, tag]);
    }
  } finally {
    await checkout(previousBranch);
  }

  const forkhubDir = options.forkhubDir ?? join(process.cwd(), "..", ".forkhub");
  if (existsSync(forkhubDir)) {
    const reposDir = join(forkhubDir, "repos");
    const { readdirSync, statSync } = await import("node:fs");
    function findPatchDir(dir: string, targetPatchId: string): string | null {
      if (!existsSync(dir)) return null;
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        if (statSync(fullPath).isDirectory()) {
          if (entry === targetPatchId) return fullPath;
          const sub = findPatchDir(fullPath, targetPatchId);
          if (sub) return sub;
        }
      }
      return null;
    }
    const patchDir = findPatchDir(reposDir, patchId);
    if (patchDir) {
      const newRefDiffPath = join(patchDir, "reference.diff");
      await Bun.write(newRefDiffPath, realizationDiff);

      const newSha = shortSha(await currentSha());

      const manifestPath = join(patchDir, "..", "..", "manifest.json");
      if (existsSync(manifestPath)) {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
        if (manifest.patches?.[patchId]) {
          manifest.patches[patchId].last_realized_against_commit = newSha;
          manifest.patches[patchId].status = "applied";
          await Bun.write(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
        }
      }

      const attemptsPath = join(patchDir, "attempts.jsonl");
      if (existsSync(attemptsPath)) {
        const attempts = readFileSync(attemptsPath, "utf-8");
        const newEntry = JSON.stringify({
          n: attempts.split("\n").filter(Boolean).length + 1,
          phase: "re-deriving",
          timestamp: new Date().toISOString(),
          upstream_sha: newSha,
          approach: "(from bundle — see REALIZATION/report.md)",
          result: testsPass ? "passed" : "failed",
          tokens: 0,
          model: "human-orchestrated",
          bundle: bundlePath,
        });
        await Bun.write(
          attemptsPath,
          attempts + (attempts.endsWith("\n") ? "" : "\n") + newEntry + "\n",
        );
      }
    }
  }

  return earlyReturn();
}

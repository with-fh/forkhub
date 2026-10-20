import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  isGitRepo,
  gitOrThrow,
  gitExec,
  currentBranch,
  diff,
  diffNameOnly,
  shortSha,
  checkout,
  cherryPick,
} from "./git";
import { generateULID8 } from "./patch-id";

export type SatisfiedOptions = {
  forkhubDir?: string;
  targetRepo?: string;
  skipPort?: boolean;
  dependsOn?: string[];
  optionalDependsOn?: string[];
  conflictsWith?: string[];
};

export type SatisfiedResult = {
  patchId: string;
  branch: string;
  filesChanged: string[];
  forkhubMainUpdated: boolean;
  tag: string | null;
};

const DRAFT_FILE = ".forkhub-draft.md";

function parseDraft(content: string): {
  slug: string;
  intent: string;
  baseSha: string;
  dependsOn: string[];
  optionalDependsOn: string[];
  conflictsWith: string[];
} {
  const slugMatch = content.match(/^slug:\s*(.+)$/m);
  const intentMatch = content.match(/^intent:\s*(.+)$/m);
  const baseShaMatch = content.match(/^base_sha:\s*(.+)$/m);

  const slugStr = slugMatch?.[1];
  const intentStr = intentMatch?.[1];
  if (!slugStr || !intentStr) {
    throw new Error("Invalid draft file. Missing slug or intent in frontmatter.");
  }

  const listOf = (field: string): string[] => {
    const m = content.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
    if (!m?.[1]) return [];
    const raw = m[1].trim();
    if (!raw || raw === "[]" || raw.toLowerCase() === "null") return [];
    const inner = raw.startsWith("[") && raw.endsWith("]") ? raw.slice(1, -1) : raw;
    return inner
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  };

  return {
    slug: slugStr.trim(),
    intent: intentStr.trim(),
    baseSha: baseShaMatch?.[1]?.trim() ?? "",
    dependsOn: listOf("depends_on"),
    optionalDependsOn: listOf("optional_depends_on"),
    conflictsWith: listOf("conflicts_with"),
  };
}

async function findTargetRepo(forkhubDir: string, forkCwd: string): Promise<string> {
  if (existsSync(join(forkhubDir, "repos"))) {
    const reposDir = join(forkhubDir, "repos");
    // Try to match by upstream remote URL
    const { getRemoteUrl, listRemotes } = await import("./git");
    for (const remote of await listRemotes(forkCwd)) {
      const url = await getRemoteUrl(remote, forkCwd);
      if (!url) continue;
      // Parse URL to path
      let match = url.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
      if (match) {
        const targetRepo = `${match[1]}/${match[2]}`;
        if (existsSync(join(reposDir, targetRepo))) return targetRepo;
      }
      match = url.match(/^https?:\/\/([^/]+)\/(.+?)(?:\.git)?$/);
      if (match) {
        const targetRepo = `${match[1]}/${match[2]}`;
        if (existsSync(join(reposDir, targetRepo))) return targetRepo;
      }
    }
    // Fallback: use the first repo found
    const { readdirSync } = await import("node:fs");
    const hosts = readdirSync(reposDir);
    for (const host of hosts) {
      const owners = readdirSync(join(reposDir, host));
      for (const owner of owners) {
        const repos = readdirSync(join(reposDir, host, owner));
        for (const repo of repos) {
          const targetRepo = `${host}/${owner}/${repo}`;
          if (existsSync(join(reposDir, targetRepo, "manifest.json"))) {
            return targetRepo;
          }
        }
      }
    }
  }
  throw new Error("Could not determine target repo. Run `forkhub init` first.");
}

export async function runSatisfied(options: SatisfiedOptions = {}): Promise<SatisfiedResult> {
  if (!(await isGitRepo())) {
    throw new Error("Not a git repository. Run from inside your fork's checkout.");
  }

  const forkhubDir = options.forkhubDir ?? join(process.cwd(), "..", ".forkhub");
  if (!existsSync(forkhubDir)) {
    throw new Error(".forkhub repo not found. Run `forkhub init` first.");
  }

  const draftPath = join(process.cwd(), DRAFT_FILE);
  if (!existsSync(draftPath)) {
    throw new Error('No draft file found. Run `forkhub draft "<intent>"` first.');
  }

  const branch = await currentBranch();
  if (branch === "main" || branch === "master" || branch === "forkhub/main") {
    throw new Error(`On branch '${branch}'. Switch to your draft branch first.`);
  }

  const draftContent = await Bun.file(draftPath).text();
  const {
    slug,
    intent,
    dependsOn: draftDeps,
    optionalDependsOn: draftOptDeps,
    conflictsWith: draftConflicts,
  } = parseDraft(draftContent);
  const patchId = `${slug}-${generateULID8()}`;

  const { parseDepSpec, formatDepList, validateManifest } = await import("./deps");
  const uniq = (xs: string[]) => [...new Set(xs.map((s) => s.trim()).filter(Boolean))];
  const dependsOn = uniq([...draftDeps, ...(options.dependsOn ?? [])]);
  const optionalDependsOn = uniq([...draftOptDeps, ...(options.optionalDependsOn ?? [])]);
  const conflictsWith = uniq([...draftConflicts, ...(options.conflictsWith ?? [])]);
  // Fail fast on malformed specs (npm-style: `id[@req][?]`).
  for (const spec of [...dependsOn, ...optionalDependsOn, ...conflictsWith]) parseDepSpec(spec);

  const targetRepo = options.targetRepo ?? (await findTargetRepo(forkhubDir, process.cwd()));
  const repoDir = join(forkhubDir, "repos", targetRepo);
  if (!existsSync(repoDir)) {
    throw new Error(`Target repo directory not found: ${repoDir}. Run \`forkhub init\` first.`);
  }

  const manifestPath = join(repoDir, "manifest.json");
  const manifest = JSON.parse(await Bun.file(manifestPath).text());
  // Pre-validate on a prospective copy BEFORE writing anything: a failed
  // satisfied must not leave an orphan patch dir behind (npm validates the
  // dep tree before installing).
  {
    const prospective = JSON.parse(JSON.stringify(manifest));
    prospective.patches ??= {};
    prospective.apply_order ??= [];
    prospective.patches[patchId] = {
      status: "applied",
      version: 1,
      depends_on: dependsOn,
      optional_depends_on: optionalDependsOn,
      conflicts_with: conflictsWith,
      enabled: true,
    };
    if (!prospective.apply_order.includes(patchId)) prospective.apply_order.push(patchId);
    const pre = validateManifest(prospective);
    const blocking = pre.errors.filter((e) => e.kind !== "order-violation");
    if (blocking.length > 0) {
      throw new Error(
        `Unsatisfied patch dependencies:\n` +
          blocking.map((e) => `  - [${e.kind}] ${e.message}`).join("\n") +
          `\nFix with --depends-on/--conflicts-with, or import the missing patch first.`,
      );
    }
  }

  const patchDir = join(repoDir, "patches", patchId);
  const { mkdirSync } = await import("node:fs");
  mkdirSync(patchDir, { recursive: true });
  const upstreamRemote =
    typeof manifest.upstream_remote === "string" ? manifest.upstream_remote : "upstream";
  const upstreamBranch =
    typeof manifest.upstream_main_branch === "string" ? manifest.upstream_main_branch : "main";
  const upstreamCandidates = [
    `${upstreamRemote}/${upstreamBranch}`,
    `origin/${upstreamBranch}`,
    upstreamBranch,
  ];
  let upstreamSha: string | null = null;
  for (const ref of upstreamCandidates) {
    try {
      upstreamSha = await gitOrThrow(["rev-parse", ref]);
      break;
    } catch {}
  }
  upstreamSha ??= await gitOrThrow(["rev-parse", "HEAD"]);
  const filesChanged = await diffNameOnly(upstreamSha, "HEAD");
  const realizationDiff = await diff(
    upstreamSha,
    "HEAD",
    process.cwd(),
    ":(exclude).gitignore",
    ":(exclude).forkhub-draft.md",
  );

  const username = await gitOrThrow(["config", "user.name"]).catch(() => "unknown");
  const now = new Date().toISOString();

  await Bun.write(
    join(patchDir, "INTENT.md"),
    `---
id: ${patchId}
title: ${intent}
target_repo: ${targetRepo}
target_area: [${filesChanged.join(", ")}]
depends_on: ${formatDepList(dependsOn)}
optional_depends_on: ${formatDepList(optionalDependsOn)}
conflicts_with: ${formatDepList(conflictsWith)}
status: applied
applied_upstream_pr: none
version: 1
license: MIT
author: ${username}
last_modified_by: ${username}
owners: [${username}]
source_url: null
imported_at: null
created: ${now.split("T")[0]}
last_realized_against_commit: ${shortSha(upstreamSha)}
verifies_with: bun test
---

## Intent

${intent}

## Why

(Filled by user)

## Non-negotiables

(Filled by user)

## Implementation notes

(Filled by user — describe what was done)
`,
  );

  await Bun.write(join(patchDir, "reference.diff"), realizationDiff + "\n");

  await Bun.write(
    join(patchDir, "attempts.jsonl"),
    JSON.stringify({
      n: 1,
      phase: "drafting",
      timestamp: now,
      upstream_sha: shortSha(upstreamSha),
      approach: intent,
      result: "passed",
      tokens: 0,
      model: "manual",
    }) + "\n",
  );

  await Bun.write(
    join(patchDir, "ACCEPTANCE.md"),
    `# Acceptance Criteria — ${patchId}

## Must pass for promotion to APPLIED

1. **Default behavior unchanged**: running the code without any patch-specific flags
   produces identical output to upstream.

2. **Patch works**: the feature/fix described in INTENT.md functions correctly.

3. **Existing tests pass**: \`bun test\` exits 0.

4. **No unintended file changes**: only the files listed in target_area are modified.

## How to verify

\`\`\`bash
bun test
\`\`\`
`,
  );

  const { generateVerifySh } = await import("./verify");
  await Bun.write(join(patchDir, "verify.sh"), generateVerifySh("bun test", patchId));

  manifest.patches[patchId] = {
    status: "applied",
    version: 1,
    author: username,
    last_modified_by: username,
    branch,
    last_realized_against_commit: shortSha(upstreamSha),
    depends_on: dependsOn,
    optional_depends_on: optionalDependsOn,
    conflicts_with: conflictsWith,
    enabled: true,
  };
  if (!manifest.apply_order.includes(patchId)) manifest.apply_order.push(patchId);
  // Keep install order topological (npm-style). Blocking dep errors were
  // already rejected pre-write; only order repair remains here.
  {
    const check = validateManifest(manifest);
    if (!check.orderOk) manifest.apply_order = check.fixedOrder;
  }
  await Bun.write(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  let forkhubMainUpdated = false;
  let tag: string | null = null;

  if (!options.skipPort) {
    const fhBranchResult = await gitExec(["rev-parse", "--verify", "forkhub/main"]);
    if (fhBranchResult.exitCode !== 0) {
      await gitOrThrow(["branch", "forkhub/main", upstreamSha]);
    }
    await checkout("forkhub/main");
    try {
      await cherryPick(branch);
      forkhubMainUpdated = true;

      const upstreamTagResult = await gitExec(["describe", "--tags", "--abbrev=0", upstreamSha]);
      const upstreamTag = upstreamTagResult.exitCode === 0 ? upstreamTagResult.stdout : "v0.0.0";

      const fhTagsResult = await gitExec(["tag", "--list", `${upstreamTag}-fh*`]);
      const fhCount = fhTagsResult.stdout ? fhTagsResult.stdout.split("\n").length : 0;
      tag = `${upstreamTag}-fh${fhCount + 1}`;
      // -m keeps this working when users set tag.gpgsign=true (signed tags
      // require a message; lightweight tags would otherwise open $EDITOR).
      await gitOrThrow(["tag", "-m", tag, tag]);
    } catch (err) {
      await gitExec(["cherry-pick", "--abort"]);
      throw new Error(
        `Cherry-pick failed (sibling conflict?). Patch saved to .forkhub but NOT ported to forkhub/main. Use --skip-port to save without porting. Error: ${err instanceof Error ? err.message : err}`,
      );
    }

    await checkout(branch);
  }

  rmSync(draftPath);

  return {
    patchId,
    branch,
    filesChanged,
    forkhubMainUpdated,
    tag,
  };
}

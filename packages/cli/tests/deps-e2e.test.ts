import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../src/init";
import { runDraft } from "../src/draft";
import { runSatisfied } from "../src/satisfied";
import { runDeps } from "../src/deps-cmd";
import { validateManifest } from "../src/deps";

let dir: string;
let upstream: string;
let fork: string;
let prevCwd: string;

async function sh(args: string[], cwd: string): Promise<string> {
  const proc = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  if (code !== 0) throw new Error(`git ${args.join(" ")} failed: ${err || out}`);
  return out.trim();
}

function manifest() {
  return JSON.parse(
    readFileSync(
      join(dir, ".forkhub", "repos", "github.com/test/dep-game", "manifest.json"),
      "utf-8",
    ),
  );
}

beforeEach(async () => {
  prevCwd = process.cwd();
  dir = mkdtempSync(join(tmpdir(), "fh-deps-e2e-"));
  upstream = join(dir, "upstream");
  fork = join(dir, "fork");
  mkdirSync(upstream, { recursive: true });
  await sh(["init", "-q", "-b", "main"], upstream);
  await sh(["config", "user.email", "test@forkhub"], upstream);
  await sh(["config", "user.name", "forkhub test"], upstream);
  await Bun.write(join(upstream, "game.ts"), "export const x = 1;\n");
  await sh(["add", "-A"], upstream);
  await sh(["commit", "-qm", "v1"], upstream);
  await sh(["clone", "-q", upstream, fork], dir);
  await sh(["config", "user.email", "test@forkhub"], fork);
  await sh(["config", "user.name", "forkhub test"], fork);
  await sh(["remote", "rename", "origin", "upstream"], fork);
  process.chdir(fork);
});

afterEach(() => {
  process.chdir(prevCwd);
  rmSync(dir, { recursive: true, force: true });
});

test("draft --depends-on stacks on forkhub/main and satisfied records deps", async () => {
  await runInit({ target: "github.com/test/dep-game" });
  await runDraft("base feature");
  await Bun.write(join(fork, "game.ts"), "export const x = 2;\n");
  await sh(["add", "-A"], fork);
  await sh(["commit", "-qm", "base"], fork);
  const a = await runSatisfied({ skipPort: false });
  expect(a.forkhubMainUpdated).toBe(true);

  await sh(["checkout", "-q", "main"], fork);
  await runDraft("dependent feature", { dependsOn: [a.patchId] });
  const branch = await sh(["rev-parse", "--abbrev-ref", "HEAD"], fork);
  expect(branch).toBe("dependent-feature");
  // Stacked base contains the dep's change (x = 2 from forkhub/main).
  expect(readFileSync(join(fork, "game.ts"), "utf-8")).toContain("x = 2");

  await Bun.write(join(fork, "game.ts"), "export const x = 3;\n");
  await sh(["add", "-A"], fork);
  await sh(["commit", "-qm", "dependent"], fork);
  const b = await runSatisfied({ skipPort: false });
  const m = manifest();
  expect(m.patches[b.patchId].depends_on).toEqual([a.patchId]);
  expect(m.apply_order.indexOf(a.patchId) < m.apply_order.indexOf(b.patchId)).toBe(true);
  const intent = readFileSync(
    join(dir, ".forkhub", "repos", "github.com/test/dep-game", "patches", b.patchId, "INTENT.md"),
    "utf-8",
  );
  expect(intent).toMatch(/depends_on:/);
  expect(validateManifest(m).valid).toBe(true);
});

test("satisfied blocks on missing dep and conflicting patch", async () => {
  await runInit({ target: "github.com/test/dep-game" });
  await runDraft("lonely feature");
  await Bun.write(join(fork, "game.ts"), "export const x = 2;\n");
  await sh(["add", "-A"], fork);
  await sh(["commit", "-qm", "lonely"], fork);
  let threw = "";
  try {
    await runSatisfied({ skipPort: true, dependsOn: ["ghost-patch-12345678"] });
  } catch (err) {
    threw = (err as Error).message;
  }
  expect(threw).toMatch(/depends on unknown patch|Unsatisfied/);
  // Failed satisfied must not leave an orphan patch dir (pre-validated).
  expect(existsSync(join(dir, ".forkhub", "repos", "github.com/test/dep-game", "patches"))).toBe(
    true,
  );
  {
    const { readdirSync } = await import("node:fs");
    const patchDir = join(dir, ".forkhub", "repos", "github.com/test/dep-game", "patches");
    const leftovers = existsSync(patchDir)
      ? readdirSync(patchDir).filter((d) => d.startsWith("lonely-feature-"))
      : [];
    expect(leftovers).toEqual([]);
  }

  // Cleanup draft branch left behind by the failed satisfied (draft file kept for retry).
  await sh(["checkout", "-q", "main"], fork);
  try {
    await sh(["branch", "-D", "lonely-feature"], fork);
  } catch {}
  const { rmSync: rm } = await import("node:fs");
  try {
    rm(join(fork, ".forkhub-draft.md"), { force: true });
  } catch {}
  const m0 = manifest();
  for (const pid of Object.keys(m0.patches)) {
    if (String(pid).startsWith("lonely-feature-")) delete m0.patches[pid];
  }
  m0.apply_order = m0.apply_order.filter((id: string) => !String(id).startsWith("lonely-feature-"));
  writeFileSync(
    join(dir, ".forkhub", "repos", "github.com/test/dep-game", "manifest.json"),
    JSON.stringify(m0, null, 2) + "\n",
  );

  // Two real patches, second declares conflict with first.
  await runDraft("base feature");
  await Bun.write(join(fork, "game.ts"), "export const x = 2;\n");
  await sh(["add", "-A"], fork);
  await sh(["commit", "-qm", "base"], fork);
  const a = await runSatisfied({ skipPort: true });
  await sh(["checkout", "-q", "main"], fork);
  await runDraft("rival feature");
  await Bun.write(join(fork, "other.ts"), "export const y = 1;\n");
  await sh(["add", "-A"], fork);
  await sh(["commit", "-qm", "rival"], fork);
  let conflictErr = "";
  try {
    await runSatisfied({ skipPort: true, conflictsWith: [a.patchId] });
  } catch (err) {
    conflictErr = (err as Error).message;
  }
  expect(conflictErr).toMatch(/conflicts with/);
});

test("fh deps enable/disable/fix-order round-trip", async () => {
  await runInit({ target: "github.com/test/dep-game" });
  await runDraft("base feature");
  await Bun.write(join(fork, "game.ts"), "export const x = 2;\n");
  await sh(["add", "-A"], fork);
  await sh(["commit", "-qm", "base"], fork);
  const a = await runSatisfied({ skipPort: true });
  await sh(["checkout", "-q", "main"], fork);
  await runDraft("dependent feature");
  await Bun.write(join(fork, "other.ts"), "export const y = 1;\n");
  await sh(["add", "-A"], fork);
  await sh(["commit", "-qm", "dep"], fork);
  const b = await runSatisfied({ skipPort: true, dependsOn: [a.patchId] });

  // Scramble order → validate fails → fix-order repairs.
  const m = manifest();
  m.apply_order = [b.patchId, a.patchId];
  writeFileSync(
    join(dir, ".forkhub", "repos", "github.com/test/dep-game", "manifest.json"),
    JSON.stringify(m, null, 2) + "\n",
  );
  expect(validateManifest(m).errors.some((e) => e.kind === "order-violation")).toBe(true);
  const fixed = await runDeps({ fixOrder: true });
  expect(fixed.order).toEqual([a.patchId, b.patchId]);
  expect(manifest().apply_order).toEqual([a.patchId, b.patchId]);

  // Disable dep → dependent becomes invalid (disabled dep).
  await runDeps({ disable: a.patchId });
  expect(manifest().patches[a.patchId].enabled).toBe(false);
  const afterDisable = validateManifest(manifest());
  expect(afterDisable.errors.some((e) => e.kind === "disabled")).toBe(true);
  await runDeps({ enable: a.patchId });
  expect(validateManifest(manifest()).valid).toBe(true);

  // Set deps via fh deps patch-id flags.
  await runDeps({ patchId: b.patchId, dependsOn: `${a.patchId}@>=1` });
  expect(manifest().patches[b.patchId].depends_on).toEqual([`${a.patchId}@>=1`]);
  expect(validateManifest(manifest()).valid).toBe(true);
  expect(existsSync(join(fork, ".forkhub-draft.md"))).toBe(false);
});

test("import preserves upstream depends_on/conflicts_with/version", async () => {
  const { runImport } = await import("../src/import");
  await runInit({ target: "github.com/test/dep-game" });

  const originalFetch = globalThis.fetch;
  const upstreamIntent = `---
id: shared-fix-abcdef12
title: Shared fix
target_repo: github.com/test/dep-game
target_area: [game.ts]
depends_on: [base-feat-12345678@>=2]
optional_depends_on: []
conflicts_with: [rival-feat-87654321]
status: applied
version: 3
license: MIT
author: alice
source_url: null
imported_at: null
---

## Intent

Shared fix
`;
  globalThis.fetch = (async (url: any) => {
    const u = String(url);
    if (u.endsWith("/patches/shared-fix-abcdef12/INTENT.md"))
      return new Response(upstreamIntent, { status: 200 });
    return new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;
  try {
    const imported = await runImport(
      "https://github.com/alice/.forkhub/blob/main/repos/github.com/test/dep-game/patches/shared-fix-abcdef12/INTENT.md",
    );
    expect(imported.patchId).toBe("shared-fix-abcdef12");
    const m = manifest();
    expect(m.patches["shared-fix-abcdef12"].version).toBe(3);
    expect(m.patches["shared-fix-abcdef12"].depends_on).toEqual(["base-feat-12345678@>=2"]);
    expect(m.patches["shared-fix-abcdef12"].conflicts_with).toEqual(["rival-feat-87654321"]);
    expect(m.patches["shared-fix-abcdef12"].status).toBe("imported");
    // Missing transitive dep is recorded, not fatal at import (npm installs later).
    const check = validateManifest(m);
    expect(check.valid).toBe(false);
    expect(check.errors.some((e) => e.kind === "missing")).toBe(true);
    const intent = readFileSync(
      join(
        dir,
        ".forkhub",
        "repos",
        "github.com/test/dep-game",
        "patches",
        "shared-fix-abcdef12",
        "INTENT.md",
      ),
      "utf-8",
    );
    expect(intent).toMatch(/depends_on: \[base-feat-12345678@>=2\]/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

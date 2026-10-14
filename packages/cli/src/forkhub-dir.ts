import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

function isForkhubStore(dir: string): boolean {
  try {
    if (existsSync(join(dir, ".git"))) return true;
    if (existsSync(join(dir, "repos"))) return true;
    if (existsSync(join(dir, "global.json"))) return true;
    return false;
  } catch {
    return false;
  }
}

/** Canonical location for new stores: ~/.forkhub (override with $FORKHUB_DIR). */
export function defaultForkhubDir(): string {
  const env = process.env.FORKHUB_DIR?.trim();
  if (env) return resolve(env);
  return join(homedir(), ".forkhub");
}

/**
 * Find a legacy/existing store by walking up from cwd:
 * - <ancestor>/.forkhub (nested)
 * - <parent-of-ancestor>/.forkhub (sibling of checkout, the pre-0.4 layout)
 * Returns the nearest match, or null.
 */
export function findLegacyForkhubDir(cwd: string = process.cwd()): string | null {
  let cur = resolve(cwd);
  for (let i = 0; i < 12; i++) {
    const nested = join(cur, ".forkhub");
    if (isForkhubStore(nested)) return nested;
    const sibling = join(dirname(cur), ".forkhub");
    // Avoid self-match when cur itself is a .forkhub dir.
    if (sibling !== nested && isForkhubStore(sibling)) return sibling;
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return null;
}

/** Existing store if any: legacy first (back-compat), then canonical home. */
export function findExistingForkhubDir(cwd: string = process.cwd()): string | null {
  const legacy = findLegacyForkhubDir(cwd);
  if (legacy) return legacy;
  const home = defaultForkhubDir();
  if (isForkhubStore(home)) return home;
  return null;
}

/**
 * Resolve which store to use.
 * Priority: explicit arg > $FORKHUB_DIR > nearest legacy store > ~/.forkhub.
 * When nothing exists yet this returns ~/.forkhub (creation target for `init`).
 */
export function resolveForkhubDir(explicit?: string, cwd: string = process.cwd()): string {
  if (explicit?.trim()) return resolve(explicit.trim());
  const env = process.env.FORKHUB_DIR?.trim();
  if (env) return resolve(env);
  const legacy = findLegacyForkhubDir(cwd);
  if (legacy) return legacy;
  return join(homedir(), ".forkhub");
}

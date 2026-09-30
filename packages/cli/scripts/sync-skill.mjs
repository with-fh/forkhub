// Copies the canonical skill (repo-root skills/forkhub/SKILL.md) into the
// published package at .agents/skills/forkhub/SKILL.md — the preferred
// discovery path for `npx skills experimental_sync`, which scans
// node_modules for .agents/skills/*/SKILL.md. Run in prepack so the
// tarball always ships the current skill without a checked-in duplicate.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "..", "..", "skills", "forkhub", "SKILL.md");
const dest = join(here, "..", ".agents", "skills", "forkhub", "SKILL.md");

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log(`bundled skill: ${dest}`);

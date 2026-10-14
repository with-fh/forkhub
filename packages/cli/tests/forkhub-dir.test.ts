import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import { defaultForkhubDir, findLegacyForkhubDir, resolveForkhubDir } from "../src/forkhub-dir";

test("explicit path wins over everything", () => {
  process.env.FORKHUB_DIR = "/tmp/should-be-ignored";
  expect(resolveForkhubDir("/tmp/explicit")).toBe("/tmp/explicit");
  delete process.env.FORKHUB_DIR;
});

test("env override is honored", () => {
  process.env.FORKHUB_DIR = "/tmp/from-env";
  expect(resolveForkhubDir(undefined, "/tmp")).toBe("/tmp/from-env");
  expect(defaultForkhubDir()).toBe("/tmp/from-env");
  delete process.env.FORKHUB_DIR;
});

test("legacy sibling ../.forkhub is auto-detected", () => {
  delete process.env.FORKHUB_DIR;
  const dir = mkdtempSync(join(tmpdir(), "fh-dir-"));
  try {
    const fork = join(dir, "fork");
    mkdirSync(fork, { recursive: true });
    const sib = join(dir, ".forkhub");
    mkdirSync(join(sib, "repos"), { recursive: true });
    Bun.spawnSync(["git", "init", "-q"], { cwd: sib });
    expect(findLegacyForkhubDir(fork)).toBe(sib);
    expect(resolveForkhubDir(undefined, fork)).toBe(sib);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("new default is ~/.forkhub when no legacy store exists", () => {
  delete process.env.FORKHUB_DIR;
  const dir = mkdtempSync(join(tmpdir(), "fh-dir-"));
  try {
    expect(findLegacyForkhubDir(dir)).toBeNull();
    expect(resolveForkhubDir(undefined, dir)).toBe(join(homedir(), ".forkhub"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

import { test, expect } from "bun:test";

import {
  compareSemver,
  fillAssetTemplate,
  findChecksum,
  pickReleaseTag,
  resolveCacheDir,
} from "../src/run";

test("compareSemver orders nightly trains by date then build", () => {
  expect(compareSemver("0.0.42", "0.0.43-nightly.20260926.2318")).toBe(-1);
  expect(compareSemver("0.0.43-nightly.20260926.2318", "0.0.43-nightly.20260927.2331")).toBe(-1);
  expect(
    compareSemver(
      "0.0.43-nightly.20260927.2331.fh.imbios.1",
      "0.0.43-nightly.20260927.2331.fh.imbios.2",
    ),
  ).toBe(-1);
  expect(compareSemver("0.0.42-fh.imbios.1", "0.0.42")).toBe(-1);
  expect(compareSemver("1.0.0", "1.0.0")).toBe(0);
  expect(compareSemver("v1.0.0", "1.0.0")).toBe(0);
});

test("fillAssetTemplate substitutes owner and version", () => {
  expect(fillAssetTemplate("{owner}-fh-t3-{version}.tgz", { owner: "ImBIOS", version: "1.0.0" })).toBe(
    "imbios-fh-t3-1.0.0.tgz",
  );
});

test("pickReleaseTag takes the newest channel tag by semver", () => {
  const releases = [
    { tag_name: "v0.0.42", draft: false },
    { tag_name: "v0.0.43-nightly.20260926.2318.fh.imbios.1", draft: false },
    { tag_name: "v0.0.43-nightly.20260927.2331.fh.imbios.1", draft: false },
    { tag_name: "pingdotgg-t3code--v0.0.42-fh1", draft: false },
    { tag_name: "v9.9.9-draft", draft: true },
  ];
  expect(
    pickReleaseTag(releases, { channel: "nightly", tagMatch: "-nightly\\.[0-9]{8}\\." }),
  ).toBe("v0.0.43-nightly.20260927.2331.fh.imbios.1");
});

test("pickReleaseTag resolves exact versions with or without v", () => {
  const releases = [{ tag_name: "v0.0.42", draft: false }];
  expect(
    pickReleaseTag(releases, { channel: "stable", tagMatch: "^v", version: "0.0.42" }),
  ).toBe("v0.0.42");
  expect(() =>
    pickReleaseTag(releases, { channel: "stable", tagMatch: "^v", version: "9.9.9" }),
  ).toThrow("No stable release found for version '9.9.9'.");
});

test("pickReleaseTag skips drafts and fails loudly when empty", () => {
  expect(() => pickReleaseTag([{ tag_name: "v1.0.0", draft: true }], { channel: "x", tagMatch: ".*" })).toThrow(
    "No published releases found on channel 'x'.",
  );
});

test("findChecksum parses sha256sum lines", () => {
  const digest = `deadbeef${"0123456789abcdef".repeat(3)}01234567`;
  expect(digest).toHaveLength(64);
  const text = `abc123  other.tgz\n${digest}  a.tgz\n`;
  expect(findChecksum(text, "a.tgz")).toBe(digest);
  expect(findChecksum(text, "missing.tgz")).toBeNull();
});

test("resolveCacheDir nests owner, package, version", () => {
  const dir = resolveCacheDir("ImBIOS", "t3", "1.0.0");
  expect(dir.endsWith("forkhub/run/ImBIOS/t3/1.0.0")).toBe(true);
});

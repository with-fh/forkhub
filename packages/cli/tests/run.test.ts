import { test, expect } from "bun:test";

import {
  assetTemplateForPlatform,
  compareSemver,
  fillAssetTemplate,
  findChecksum,
  pickReleaseTags,
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
  expect(
    fillAssetTemplate("{owner}-fh-t3-{version}.tgz", { owner: "ImBIOS", version: "1.0.0" }),
  ).toBe("imbios-fh-t3-1.0.0.tgz");
});

test("pickReleaseTags takes the newest channel tag by semver", () => {
  const releases = [
    { tag_name: "v0.0.42", draft: false },
    { tag_name: "v0.0.43-nightly.20260926.2318.fh.imbios.1", draft: false },
    { tag_name: "v0.0.43-nightly.20260927.2331.fh.imbios.1", draft: false },
    { tag_name: "pingdotgg-t3code--v0.0.42-fh1", draft: false },
    { tag_name: "v9.9.9-draft", draft: true },
  ];
  expect(
    pickReleaseTags(releases, { channel: "nightly", tagMatch: "-nightly\\.[0-9]{8}\\." }),
  ).toEqual([
    "v0.0.43-nightly.20260927.2331.fh.imbios.1",
    "v0.0.43-nightly.20260926.2318.fh.imbios.1",
  ]);
});

test("pickReleaseTags resolves exact versions with or without v", () => {
  const releases = [{ tag_name: "v0.0.42", draft: false }];
  expect(
    pickReleaseTags(releases, { channel: "stable", tagMatch: "^v", version: "0.0.42" }),
  ).toEqual(["v0.0.42"]);
  expect(() =>
    pickReleaseTags(releases, { channel: "stable", tagMatch: "^v", version: "9.9.9" }),
  ).toThrow("No stable release found for version '9.9.9'.");
});

test("pickReleaseTags skips drafts and fails loudly when empty", () => {
  expect(() =>
    pickReleaseTags([{ tag_name: "v1.0.0", draft: true }], { channel: "x", tagMatch: ".*" }),
  ).toThrow("No published releases found on channel 'x'.");
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

test("fillAssetTemplate substitutes platform/os/arch for Electron artifacts", () => {
  // Natively unified updater layout: platform-specific names per OS.
  expect(
    fillAssetTemplate("Natively-{version}.AppImage", {
      owner: "with-fh",
      version: "3.1.0-fh.with-fh.1",
      platform: "linux-x64",
    }),
  ).toBe("Natively-3.1.0-fh.with-fh.1.AppImage");
  expect(
    fillAssetTemplate("Natively-Setup-{version}.exe", {
      owner: "with-fh",
      version: "3.1.0-fh.with-fh.1",
      platform: "win32-x64",
    }),
  ).toBe("Natively-Setup-3.1.0-fh.with-fh.1.exe");
  // Legacy templates without platform placeholders are untouched.
  expect(
    fillAssetTemplate("{owner}-fh-t3-{version}.tgz", { owner: "ImBIOS", version: "1.0.0" }),
  ).toBe("imbios-fh-t3-1.0.0.tgz");
});

test("assetTemplateForPlatform prefers the per-platform override", () => {
  const entry = {
    bin: "natively",
    defaultChannel: "stable",
    asset: "Natively-{version}.AppImage",
    assets: {
      "win32-x64": "Natively-Setup-{version}.exe",
    },
    channels: { stable: { tagMatch: "^v" } },
  };
  expect(assetTemplateForPlatform(entry, "win32-x64")).toBe("Natively-Setup-{version}.exe");
  expect(assetTemplateForPlatform(entry, "linux-x64")).toBe("Natively-{version}.AppImage");
});

test("pickReleaseTags matches with-fh unified updater tags, skips namespaced bundles", () => {
  // Live with-fh/.forkhub tag shapes: unified `v<base>-fh.<owner>.<n>` (the
  // updater feed) vs namespaced `<target>--v<base>-fh<N>` bundles (not semver).
  const releases = [
    { tag_name: "natively-ai-assistant-natively-cluely-ai-assistant--v3.1.0-fh7", draft: false },
    { tag_name: "v3.1.0-fh.with-fh.1", draft: false },
    { tag_name: "v3.0.0-fh.with-fh.3", draft: false },
    { tag_name: "pingdotgg-t3code--v0.1.6-fh14", draft: false },
  ];
  expect(
    pickReleaseTags(releases, { channel: "stable", tagMatch: "^v[0-9]+\\.[0-9]+\\.[0-9]+-fh\\." }),
  ).toEqual(["v3.1.0-fh.with-fh.1", "v3.0.0-fh.with-fh.3"]);
});

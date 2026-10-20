import { describe, expect, test } from "bun:test";

import {
  channelHistory,
  channelOf,
  classifyAsset,
  formatBytes,
  isMetaAsset,
  mergePlatformBuilds,
  newestShaUrl,
  type GhRelease,
} from "./releases";
import { fetchCatalogReleases } from "./live";

const asset = (name: string, size = 1024) => ({
  name,
  browser_download_url: `https://github.com/dl/${name}`,
  size,
});

// Shapes copied from the live with-fh/.forkhub releases API (Oct 2026).
const T3_NIGHTLY_SPLIT: GhRelease = {
  tag_name: "pingdotgg-t3code--v0.1.1-nightly.20261019.3373-fh1",
  name: "pingdotgg-t3code--v0.1.1-nightly.20261019.3373-fh1",
  html_url: "https://github.com/r/1",
  published_at: "2026-10-20T01:02:58Z",
  assets: [
    asset("builder-debug.yml"),
    asset("BUILD_LOG.md"),
    asset("latest-linux.yml"),
    asset("SHA256SUMS"),
    asset("T3-Code-0.1.1-nightly.20261019.3373.fh.with-fh.1-amd64.deb", 80_000_000),
    asset("T3-Code-0.1.1-nightly.20261019.3373.fh.with-fh.1-x86_64.AppImage", 120_000_000),
    asset("with-fh-fh-t3-0.1.1-nightly.20261019.3373.fh.with-fh.1.tgz"),
  ],
};

const NAT_LINUX_SPLIT: GhRelease = {
  tag_name: "natively-ai-assistant-natively-cluely-ai-assistant--v2.9.2-fh19",
  name: "natively-ai-assistant-natively-cluely-ai-assistant--v2.9.2-fh19",
  html_url: "https://github.com/r/2",
  published_at: "2026-10-16T05:18:34Z",
  assets: [
    asset("BUILD_LOG.md"),
    asset("Natively-2.9.2-fh.with-fh.4.AppImage", 150_000_000),
    asset("natively_2.9.2-fh.with-fh.4_amd64.deb", 90_000_000),
    asset("SHA256SUMS"),
  ],
};

const NAT_MAC_SPLIT: GhRelease = {
  tag_name: "natively-ai-assistant-natively-cluely-ai-assistant--v2.9.2-fh22",
  name: "natively-ai-assistant-natively-cluely-ai-assistant--v2.9.2-fh22",
  html_url: "https://github.com/r/3",
  published_at: "2026-10-16T05:30:14Z",
  assets: [
    asset("corespeechd-2.9.2-fh.with-fh.4-arm64.dmg", 110_000_000),
    asset("corespeechd-2.9.2-fh.with-fh.4-x64.dmg", 115_000_000),
    asset("Natively-2.9.2-fh.with-fh.4-arm64.zip", 108_000_000),
    asset("Natively-2.9.2-fh.with-fh.4-x64.zip", 112_000_000),
    asset("SHA256SUMS-mac"),
  ],
};

const NAT_WIN_SPLIT: GhRelease = {
  tag_name: "natively-ai-assistant-natively-cluely-ai-assistant--v2.9.2-fh21",
  name: "natively-ai-assistant-natively-cluely-ai-assistant--v2.9.2-fh21",
  html_url: "https://github.com/r/4",
  published_at: "2026-10-16T05:22:00Z",
  assets: [
    asset("corespeechd-Setup-2.9.2-fh.with-fh.4.exe", 95_000_000),
    asset("corespeechd.2.9.2-fh.with-fh.4.exe", 96_000_000),
    asset("SHA256SUMS-win"),
  ],
};

describe("channelOf", () => {
  test("nightly tags vs stable tags", () => {
    expect(channelOf("v0.1.1-nightly.20261019.3373.fh.with-fh.1")).toBe("nightly");
    expect(channelOf("v2.9.2-fh.with-fh.4")).toBe("stable");
    expect(channelOf("v2.9.2-fh.imbios.1")).toBe("stable");
  });
});

describe("classifyAsset", () => {
  test("excludes metadata", () => {
    for (const n of [
      "latest-linux.yml",
      "nightly-linux.yml",
      "SHA256SUMS",
      "SHA256SUMS-mac",
      "BUILD_LOG.md",
      "builder-debug.yml",
      "x-arm64.dmg.blockmap",
      "fh.yml",
    ]) {
      expect(isMetaAsset(n)).toBe(true);
      expect(classifyAsset(asset(n))).toBeNull();
    }
  });

  test("maps desktop formats to platforms", () => {
    expect(classifyAsset(asset("T3-Code-x86_64.AppImage"))).toMatchObject({
      platform: "linux",
      arch: "x64",
      kind: "portable",
      format: "AppImage",
    });
    expect(classifyAsset(asset("natively_2.9.2_amd64.deb"))).toMatchObject({
      platform: "linux",
      arch: "x64",
      kind: "installer",
      format: ".deb",
    });
    expect(classifyAsset(asset("corespeechd-2.9.2-arm64.dmg"))).toMatchObject({
      platform: "mac",
      arch: "arm64",
      kind: "installer",
      format: ".dmg",
    });
    expect(classifyAsset(asset("corespeechd-2.9.2-x64.dmg"))).toMatchObject({
      platform: "mac",
      arch: "x64",
    });
    expect(classifyAsset(asset("corespeechd-Setup-2.9.2.exe"))).toMatchObject({
      platform: "windows",
      kind: "installer",
      format: "Setup .exe",
    });
    expect(classifyAsset(asset("Natively-2.9.2-arm64.zip"))).toMatchObject({
      platform: "mac",
      arch: "arm64",
      format: ".zip",
    });
    // Managed fh-run tarball is not a desktop download card.
    expect(classifyAsset(asset("with-fh-fh-t3-0.1.1.tgz"))?.kind).toBe("package");
    // Patched-source tarballs get their own Source code section.
    expect(
      classifyAsset(
        asset("natively-ai-assistant-natively-cluely-ai-assistant-patched-source.tar.gz"),
      ),
    ).toMatchObject({ platform: "source", kind: "archive", format: ".tar.gz" });
  });
});

describe("channelHistory + mergePlatformBuilds", () => {
  const all = [T3_NIGHTLY_SPLIT, NAT_LINUX_SPLIT, NAT_MAC_SPLIT, NAT_WIN_SPLIT];
  const nativelyOnly = (r: GhRelease) => /natively/i.test(r.tag_name);

  test("splits channels newest-first with a cap", () => {
    const { stable, nightly } = channelHistory(all, nativelyOnly, 2);
    expect(nightly).toEqual([]);
    expect(stable.map((r) => r.version)).toEqual([NAT_MAC_SPLIT.tag_name, NAT_WIN_SPLIT.tag_name]);
  });

  test("merges split per-platform releases into full coverage", () => {
    const { stable } = channelHistory(all, nativelyOnly, 10);
    const builds = mergePlatformBuilds(stable);
    const keys = builds.map((b) => `${b.platform}/${b.arch}/${b.format}`);
    expect(keys).toContain("linux/x64/AppImage");
    expect(keys).toContain("linux/x64/.deb");
    expect(keys).toContain("mac/arm64/.dmg");
    expect(keys).toContain("mac/x64/.dmg");
    expect(keys).toContain("mac/arm64/.zip");
    expect(keys).toContain("windows/x64/Setup .exe");
    // Newest provider wins per card.
    expect(builds.find((b) => b.format === ".dmg" && b.arch === "arm64")?.fromVersion).toBe(
      NAT_MAC_SPLIT.tag_name,
    );
  });

  test("newestShaUrl walks newest-first", () => {
    const { stable } = channelHistory(all, nativelyOnly, 10);
    expect(newestShaUrl(stable)).toBe("https://github.com/dl/SHA256SUMS-mac");
  });

  test("t3 nightly single release maps deb + appimage", () => {
    const { nightly } = channelHistory(all, (r) => /t3code/i.test(r.tag_name), 10);
    expect(nightly).toHaveLength(1);
    expect(nightly[0]?.assets.map((a) => a.format).sort()).toEqual([".deb", "AppImage"]);
    expect(newestShaUrl(nightly)).toBe("https://github.com/dl/SHA256SUMS");
  });
});

describe("formatBytes", () => {
  test("human sizes", () => {
    expect(formatBytes(null)).toBeNull();
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(120_000_000)).toBe("114 MB");
    expect(formatBytes(90_000_000)).toBe("85.8 MB");
  });
});

describe("fetchCatalogReleases", () => {
  const rel = (tag: string): GhRelease => ({
    tag_name: tag,
    name: tag,
    html_url: "https://github.com/r/x",
    published_at: "2026-10-20T00:00:00Z",
    assets: [],
  });

  const stubPages = (pages: GhRelease[][], seen: { urls: string[]; auth: (string | null)[] }) => {
    return (async (url: string, init?: { headers?: Record<string, string> }) => {
      seen.urls.push(url);
      seen.auth.push(init?.headers?.Authorization ?? null);
      const page = Number(new URL(url).searchParams.get("page") ?? "1");
      const batch = pages[page - 1] ?? [];
      return new Response(JSON.stringify(batch), { status: 200 });
    }) as unknown as Parameters<typeof fetchCatalogReleases>[0];
  };

  test("paginates full pages and stops on short page", async () => {
    const seen = { urls: [] as string[], auth: [] as (string | null)[] };
    const full = (n: number) => Array.from({ length: n }, (_, i) => rel(`misc-release-${i}`));
    const pages = [full(100), [rel("v0.8-fh1-t3code")]];
    const out = await fetchCatalogReleases(stubPages(pages, seen));
    expect(seen.urls).toHaveLength(2);
    expect(seen.urls[1]).toContain("page=2");
    expect(out).toHaveLength(101);
  });

  test("stops after 3 pages max", async () => {
    const seen = { urls: [] as string[], auth: [] as (string | null)[] };
    const full = (n: number) => Array.from({ length: n }, (_, i) => rel(`misc-release-${i}`));
    const pages = [full(100), full(100), full(100), full(100)];
    await fetchCatalogReleases(stubPages(pages, seen));
    expect(seen.urls).toHaveLength(3);
  });

  test("sends GITHUB_TOKEN when set", async () => {
    const prev = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "test-token-123";
    try {
      const seen = { urls: [] as string[], auth: [] as (string | null)[] };
      await fetchCatalogReleases(stubPages([[]], seen));
      expect(seen.auth[0]).toBe("Bearer test-token-123");
    } finally {
      if (prev == null) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = prev;
    }
  });
});

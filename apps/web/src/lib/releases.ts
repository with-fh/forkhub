/**
 * Pure release→download mapping for the /download pages.
 *
 * Catalog releases (with-fh/.forkhub) come in two shapes:
 * - single releases carrying every platform asset, and
 * - split per-platform releases (one tag per OS, e.g. natively fh16–fh23).
 * This module merges both into per-platform "latest build" cards plus a
 * per-version history, so users never open the GitHub releases page.
 *
 * No I/O here — fetching + caching lives in live.ts. Fully unit-tested.
 */

export type GhAsset = {
  name: string;
  browser_download_url: string;
  /** Bytes, when the API provides it. */
  size?: number;
};

export type GhRelease = {
  tag_name: string;
  name: string;
  html_url: string;
  published_at: string;
  assets: GhAsset[];
  /** Release notes body (used for try-build detection); optional in tests. */
  body?: string | null;
};

export type Platform = "linux" | "mac" | "windows" | "source";
export type Arch = "x64" | "arm64";
export type AssetKind = "portable" | "installer" | "archive" | "package";

export type DownloadAsset = {
  name: string;
  url: string;
  size: number | null;
  platform: Platform;
  arch: Arch;
  kind: AssetKind;
  /** Human label, e.g. "AppImage", ".deb", ".dmg", "Setup .exe", ".zip". */
  format: string;
};

export type ChannelRelease = {
  version: string;
  name: string;
  publishedAt: string;
  releaseUrl: string;
  assets: DownloadAsset[];
  /** Direct URL of a SHA256SUMS file in this release, when present. */
  shaUrl: string | null;
  /** PR try-build ("not for general use"): never the default Latest. */
  tryBuild: boolean;
};

export type PlatformBuild = DownloadAsset & {
  /** Tag of the release this asset was taken from (split releases differ). */
  fromVersion: string;
  fromReleaseUrl: string;
};

const META_PATTERNS = [
  /\.blockmap$/i,
  /\.yml$/i,
  /\.yaml$/i,
  /^sha256sums/i,
  /^builder-debug/i,
  /^build_log\.md$/i,
  /\.sig$/i,
  /\.pem$/i,
];

export function isMetaAsset(name: string): boolean {
  return META_PATTERNS.some((re) => re.test(name));
}

function archOf(name: string): Arch | null {
  const n = name.toLowerCase();
  if (/(aarch64|arm64|apple-silicon)/.test(n)) return "arm64";
  if (/(x86_64|x64|amd64)/.test(n)) return "x64";
  return null;
}

/**
 * Classify a release asset into a user-facing download. Returns null for
 * metadata (checksums manifests, blockmaps, build logs) which are linked
 * separately, not shown as download cards.
 */
export function classifyAsset(a: GhAsset): DownloadAsset | null {
  if (isMetaAsset(a.name)) return null;
  const n = a.name;
  const lower = n.toLowerCase();
  const size = typeof a.size === "number" ? a.size : null;

  // Managed `fh run` package tarball — installable, not a desktop download.
  if (lower.endsWith(".tgz") && /with-fh-fh-t3/i.test(n)) {
    return {
      name: n,
      url: a.browser_download_url,
      size,
      platform: "linux",
      arch: archOf(n) ?? "x64",
      kind: "package",
      format: ".tgz package",
    };
  }
  if (lower.endsWith(".appimage")) {
    return {
      name: n,
      url: a.browser_download_url,
      size,
      platform: "linux",
      arch: archOf(n) ?? "x64",
      kind: "portable",
      format: "AppImage",
    };
  }
  if (lower.endsWith(".deb")) {
    return {
      name: n,
      url: a.browser_download_url,
      size,
      platform: "linux",
      arch: archOf(n) ?? "x64",
      kind: "installer",
      format: ".deb",
    };
  }
  if (lower.endsWith(".dmg")) {
    const m = /-(arm64|x64)\.dmg$/i.exec(n);
    const arch: Arch = m?.[1]?.toLowerCase() === "arm64" ? "arm64" : (archOf(n) ?? "x64");
    return {
      name: n,
      url: a.browser_download_url,
      size,
      platform: "mac",
      arch,
      kind: "installer",
      format: ".dmg",
    };
  }
  if (/setup.*\.exe$/i.test(n) || /\.exe$/i.test(n)) {
    return {
      name: n,
      url: a.browser_download_url,
      size,
      platform: "windows",
      arch: archOf(n) ?? "x64",
      kind: /setup/i.test(n) ? "installer" : "portable",
      format: /setup/i.test(n) ? "Setup .exe" : ".exe",
    };
  }
  if (lower.endsWith(".zip")) {
    // Natively ships mac builds as zips; arch is embedded in the name.
    const arch = archOf(n);
    if (!arch) return null;
    return {
      name: n,
      url: a.browser_download_url,
      size,
      platform: "mac",
      arch,
      kind: "portable",
      format: ".zip",
    };
  }
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) {
    // Patched-source tarballs are source code, not a platform build.
    if (/source|patched|src/i.test(n)) {
      return {
        name: n,
        url: a.browser_download_url,
        size,
        platform: "source",
        arch: "x64",
        kind: "archive",
        format: lower.endsWith(".tar.gz") ? ".tar.gz" : ".tgz",
      };
    }
    return {
      name: n,
      url: a.browser_download_url,
      size,
      platform: "linux",
      arch: archOf(n) ?? "x64",
      kind: "archive",
      format: lower.endsWith(".tar.gz") ? ".tar.gz" : ".tgz",
    };
  }
  return null;
}

export function channelOf(tag: string): "stable" | "nightly" {
  return /nightly/i.test(tag) ? "nightly" : "stable";
}

function shaOf(r: GhRelease): string | null {
  const hit = r.assets.find((a) => /^sha256sums/i.test(a.name));
  return hit?.browser_download_url ?? null;
}

/**
 * PR try-builds ship on normal-looking tags (e.g. v2.9.2-fh.imbios.1) but
 * their notes say so explicitly ("Try-build ... Not for general use"). The
 * same `*-pr.*` marker that publish.sh refuses to ship is honored here, so
 * `v2.9.2-fh.with-fh.6-pr661` style tags are try-builds by construction.
 * They must never become the default Latest download.
 */
export function isTryBuild(name: string, body?: string | null): boolean {
  return /try.build|not for general use|do not use|-pr\.\d+/i.test(`${name}\n${body ?? ""}`);
}

/**
 * Unified catalog releases look like v<upstream>-fh.<owner>.<build>
 * (e.g. v2.9.2-fh.with-fh.5); legacy per-platform splits carry a `--`
 * publisher prefix (e.g. ...--v2.9.2-fh23) and only hold one OS.
 */
export function isUnifiedRelease(tag: string): boolean {
  return !tag.includes("--") && /[-.]fh\.[a-z0-9-]+\.\d+$/i.test(tag);
}

/**
 * What "Latest" means: newest unified, non-try-build release; falling back
 * to newest non-try-build, then to newest overall. Never a try-build when
 * a real release exists — newest-published_at alone would happily crown a
 * PR try-build or a single-platform split as the default download.
 */
export function pickLatest(list: ChannelRelease[]): ChannelRelease | null {
  if (list.length === 0) return null;
  const byDate = [...list].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return (
    byDate.find((r) => !r.tryBuild && isUnifiedRelease(r.version)) ??
    byDate.find((r) => !r.tryBuild) ??
    byDate[0] ??
    null
  );
}

export function toChannelRelease(r: GhRelease): ChannelRelease {
  const assets: DownloadAsset[] = [];
  for (const a of r.assets) {
    const c = classifyAsset(a);
    if (c && c.kind !== "package") assets.push(c);
  }
  return {
    version: r.tag_name,
    name: r.name,
    publishedAt: r.published_at,
    releaseUrl: r.html_url,
    assets,
    shaUrl: shaOf(r),
    tryBuild: isTryBuild(r.name, r.body),
  };
}

/**
 * Newest-first channel history, capped per channel. The releases API returns
 * newest first; re-sort defensively by published date.
 */
export function channelHistory(
  releases: GhRelease[],
  isOurs: (r: GhRelease) => boolean,
  limitPerChannel = 10,
): { stable: ChannelRelease[]; nightly: ChannelRelease[] } {
  const sorted = [...releases].sort((a, b) => b.published_at.localeCompare(a.published_at));
  const stable: ChannelRelease[] = [];
  const nightly: ChannelRelease[] = [];
  for (const r of sorted) {
    if (!isOurs(r)) continue;
    const list = channelOf(r.tag_name) === "nightly" ? nightly : stable;
    if (list.length >= limitPerChannel) continue;
    list.push(toChannelRelease(r));
  }
  return { stable, nightly };
}

/**
 * Merge a channel's history into one card per (platform, arch, format):
 * newest release wins, so split per-platform releases compose into a full
 * set. Preference within a platform: installer > portable > archive.
 */
export function mergePlatformBuilds(history: ChannelRelease[]): PlatformBuild[] {
  const KIND_RANK: Record<AssetKind, number> = {
    installer: 0,
    portable: 1,
    archive: 2,
    package: 3,
  };
  const best = new Map<string, { build: PlatformBuild; rank: number; date: string }>();
  for (const rel of history) {
    for (const a of rel.assets) {
      const key = `${a.platform}:${a.arch}:${a.format}`;
      const cur = best.get(key);
      if (!cur) {
        best.set(key, {
          build: { ...a, fromVersion: rel.version, fromReleaseUrl: rel.releaseUrl },
          rank: KIND_RANK[a.kind],
          date: rel.publishedAt,
        });
      }
    }
  }
  const builds = [...best.values()].map((v) => v.build);
  const PLATFORM_ORDER: Platform[] = ["linux", "mac", "windows", "source"];
  return builds.sort(
    (a, b) =>
      PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform) ||
      a.arch.localeCompare(b.arch) ||
      a.format.localeCompare(b.format),
  );
}

/** First checksum URL found walking newest→oldest (split releases share one). */
export function newestShaUrl(history: ChannelRelease[]): string | null {
  for (const rel of history) {
    if (rel.shaUrl) return rel.shaUrl;
  }
  return null;
}

export function formatBytes(bytes: number | null): string | null {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[u]}`;
}

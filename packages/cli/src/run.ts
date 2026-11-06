import { chmodSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { fetchWithRetry } from "./search";

export type RunOptions = {
  package: string;
  owner: string;
  channel?: string;
  version?: string;
  args?: string[];
  requireChecksum?: boolean;
};

export type RegistryPlatformKey = string;

export type RegistryChannelDef = {
  tagMatch: string;
};

export type RegistryPackage = {
  target?: string;
  description?: string;
  bin: string;
  binPath?: string;
  /** Per-platform install path. "{asset}" = the downloaded file itself (AppImage / portable exe). */
  binPaths?: Record<RegistryPlatformKey, string>;
  defaultChannel: string;
  /** Legacy single-asset template. `{owner}`/`{version}` always; `{platform}`/`{os}`/`{arch}` optional. */
  asset: string;
  /** Per-platform asset override. Keys are `<os>-<arch>` (see currentPlatformKey). */
  assets?: Record<RegistryPlatformKey, string>;
  /** Direct-execute install: skip tar extraction, chmod +x the downloaded asset (AppImage / portable exe). */
  extract?: "tar" | "none";
  platforms?: string[];
  channels: Record<string, RegistryChannelDef>;
};

export type ResolvedPackage = {
  package: string;
  owner: string;
  channel: string;
  version: string;
  tag: string;
  assetName: string;
  assetUrl: string;
  binPath: string;
  cacheDir: string;
  extract: "tar" | "none";
  requireChecksum: boolean;
};

/** This machine as an `<os>-<arch>` key, matching release platform naming. */
export function currentPlatformKey(): string {
  const os = process.platform === "win32" ? "win32" : process.platform;
  const arch = process.arch === "x64" ? "x64" : process.arch === "arm64" ? "arm64" : process.arch;
  return `${os}-${arch}`;
}

function splitSemver(version: string): { core: number[]; pre: (string | number)[] } {
  const clean = version.replace(/^v/, "");
  const [corePart = "", ...preParts] = clean.split("-");
  const core = corePart.split(".").map((n) => {
    const parsed = parseInt(n, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  });
  const pre: (string | number)[] = [];
  for (const ident of preParts.join("-").split(".")) {
    if (ident === "") continue;
    if (/^[0-9]+$/.test(ident)) pre.push(parseInt(ident, 10));
    else pre.push(ident);
  }
  return { core, pre };
}

/** Ascending semver order. A version without prerelease outranks one with. */
export function compareSemver(a: string, b: string): number {
  const pa = splitSemver(a);
  const pb = splitSemver(b);
  for (let i = 0; i < Math.max(pa.core.length, pb.core.length); i++) {
    const diff = (pa.core[i] ?? 0) - (pb.core[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  if (pa.pre.length === 0 && pb.pre.length === 0) return 0;
  if (pa.pre.length === 0) return 1;
  if (pb.pre.length === 0) return -1;
  for (let i = 0; i < Math.max(pa.pre.length, pb.pre.length); i++) {
    const ia = pa.pre[i];
    const ib = pb.pre[i];
    if (ia === undefined) return -1;
    if (ib === undefined) return 1;
    if (typeof ia === "number" && typeof ib === "number") {
      if (ia !== ib) return ia < ib ? -1 : 1;
    } else if (typeof ia === "number") {
      return -1;
    } else if (typeof ib === "number") {
      return 1;
    } else if (ia !== ib) {
      return ia < ib ? -1 : 1;
    }
  }
  return 0;
}

/** Platform part of a `<os>-<arch>` key (linux-x64 -> linux). */
export function platformOs(key: string): string {
  return key.split("-")[0] ?? key;
}

/** Arch part of a `<os>-<arch>` key (linux-x64 -> x64). */
export function platformArch(key: string): string {
  const parts = key.split("-");
  return parts.slice(1).join("-") || key;
}

export function fillAssetTemplate(
  template: string,
  input: { owner: string; version: string; platform?: string },
): string {
  // Release asset filenames use the lowercased owner (build.sh normalizes
  // it; tags and URLs stay case-preserving).
  const platform = input.platform ?? currentPlatformKey();
  return template
    .replaceAll("{owner}", input.owner.toLowerCase())
    .replaceAll("{version}", input.version)
    .replaceAll("{platform}", platform)
    .replaceAll("{os}", platformOs(platform))
    .replaceAll("{arch}", platformArch(platform));
}

/** Asset template for this platform: per-platform override wins, else the shared template. */
export function assetTemplateForPlatform(entry: RegistryPackage, platform?: string): string {
  const key = platform ?? currentPlatformKey();
  return entry.assets?.[key] ?? entry.asset;
}

type ReleaseRow = {
  tag_name?: unknown;
  draft?: unknown;
  assets?: Array<{ name?: unknown; browser_download_url?: unknown }> | unknown;
};

/** Fail-fast entry validation (runs before any network): bad tagMatch regexes,
 * unknown extract modes, and non-exact `{asset}` placeholders throw here
 * instead of mid-resolve. Pure — unit-testable without fetch. */
export function validateRegistryEntry(
  pkg: string,
  entry: RegistryPackage,
  platform?: string,
): void {
  for (const [channel, def] of Object.entries(entry.channels)) {
    try {
      // biome-ignore lint: intentional — validate the catalog regex compiles
      new RegExp(def.tagMatch);
    } catch {
      throw new Error(
        `Invalid tagMatch for '${pkg}' channel '${channel}': '${def.tagMatch}' is not a valid regex.`,
      );
    }
  }
  if (entry.extract !== undefined && entry.extract !== "tar" && entry.extract !== "none") {
    throw new Error(
      `Invalid extract mode for '${pkg}': '${entry.extract}' (expected 'tar' or 'none').`,
    );
  }
  const key = platform ?? currentPlatformKey();
  const rawBinPath =
    entry.binPaths?.[key] ?? entry.binPath ?? (entry.extract === "none" ? "{asset}" : undefined);
  if (rawBinPath !== undefined && rawBinPath.includes("{asset}") && rawBinPath !== "{asset}") {
    throw new Error(
      `Invalid binPaths for '${pkg}' platform '${key}': '{asset}' must be the whole value (got '${rawBinPath}').`,
    );
  }
}

async function listCatalogReleases(owner: string): Promise<ReleaseRow[]> {
  let url: string | null = `/repos/${owner}/.forkhub/releases?per_page=100`;
  const out: ReleaseRow[] = [];
  for (let page = 0; page < 10 && url; page++) {
    const response = await githubApiRaw(url);
    out.push(...((await response.json()) as ReleaseRow[]));
    url = nextPageUrl(response.headers.get("link"));
  }
  return out;
}

function nextPageUrl(link: string | null): string | null {
  if (!link) return null;
  for (const part of link.split(",")) {
    const m = /<([^>]+)>;\s*rel="next"/.exec(part);
    if (m?.[1]) {
      const u = new URL(m[1]);
      return `${u.pathname}${u.search}`;
    }
  }
  return null;
}

async function githubApiRaw(path: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "forkhub-cli",
  };
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetchWithRetry(`https://api.github.com${path}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API error ${response.status} for ${path}.`);
  }
  return response;
}

/**
 * Candidate release tags, newest semver first: the exact version when
 * pinned, else every channel-matching tag. Callers walk the list because a
 * shared catalog can hold other targets' releases, which won't carry this
 * package's asset.
 */
export function pickReleaseTags(
  releases: ReleaseRow[],
  input: { channel: string; tagMatch: string; version?: string },
): string[] {
  const usable = releases.filter(
    (row) => typeof row.tag_name === "string" && row.draft !== true,
  ) as Array<{ tag_name: string }>;
  if (input.version) {
    const wanted = [input.version, `v${input.version}`];
    const hit = usable.find((row) => wanted.includes(row.tag_name));
    if (!hit) {
      throw new Error(`No ${input.channel} release found for version '${input.version}'.`);
    }
    return [hit.tag_name];
  }
  const pattern = new RegExp(input.tagMatch);
  const matching = usable.map((row) => row.tag_name).filter((tag) => pattern.test(tag));
  if (matching.length === 0) {
    throw new Error(`No published releases found on channel '${input.channel}'.`);
  }
  return matching.sort(compareSemver).reverse();
}

export function resolveCacheDir(owner: string, pkg: string, version: string): string {
  const base = process.env.XDG_CACHE_HOME ?? join(process.env.HOME ?? tmpdir(), ".cache");
  return join(base, "forkhub", "run", owner, pkg, version);
}

export async function fetchRegistry(owner: string): Promise<Record<string, RegistryPackage>> {
  const url = `https://raw.githubusercontent.com/${owner}/.forkhub/main/registry.json`;
  const response = await fetchWithRetry(url);
  if (response.status === 404) {
    throw new Error(`${owner}/.forkhub has no registry.json on main yet — nothing to run.`);
  }
  if (!response.ok) {
    throw new Error(`Could not read the ${owner}/.forkhub registry (HTTP ${response.status}).`);
  }
  const data = (await response.json()) as unknown;
  if (typeof data !== "object" || data === null || !("packages" in data)) {
    throw new Error(`The ${owner}/.forkhub registry has no packages map.`);
  }
  return (data as { packages: Record<string, RegistryPackage> }).packages;
}

type ReleaseAsset = { name: string; url: string };

async function githubApi(path: string): Promise<any> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "forkhub-cli",
  };
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetchWithRetry(`https://api.github.com${path}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API error ${response.status} for ${path}.`);
  }
  return await response.json();
}

export async function resolvePackage(
  options: RunOptions,
): Promise<ResolvedPackage & { downloadUrl: string }> {
  const packages = await fetchRegistry(options.owner);
  const entry = packages[options.package];
  if (!entry) {
    const known = Object.keys(packages);
    throw new Error(
      `Package '${options.package}' is not published by ${options.owner}/.forkhub.` +
        (known.length > 0 ? ` Known: ${known.join(", ")}.` : ""),
    );
  }
  const platform = currentPlatformKey();
  if (entry.platforms && !entry.platforms.includes(platform)) {
    throw new Error(
      `'${options.package}' has no build for ${platform} (published: ${entry.platforms.join(", ")}).`,
    );
  }
  const channel = options.channel ?? entry.defaultChannel;
  const channelDef = entry.channels[channel];
  if (!channelDef) {
    throw new Error(
      `Channel '${channel}' is not published for '${options.package}'. Known: ${Object.keys(entry.channels).join(", ")}.`,
    );
  }
  validateRegistryEntry(options.package, entry, platform);
  const releases = await listCatalogReleases(options.owner);
  const candidates = pickReleaseTags(releases, {
    channel,
    tagMatch: channelDef.tagMatch,
    version: options.version,
  });
  let tag: string | undefined;
  let assetUrl: string | undefined;
  let version = "";
  let assetName = "";
  for (const candidate of candidates) {
    const release = releases.find((row) => row.tag_name === candidate) as
      | { assets?: Array<{ name?: unknown; browser_download_url?: unknown }> }
      | undefined;
    version = candidate.replace(/^v/, "");
    assetName = fillAssetTemplate(assetTemplateForPlatform(entry, platform), {
      owner: options.owner,
      version,
      platform,
    });
    const asset = (Array.isArray(release?.assets) ? release?.assets : []).find(
      (row) => row?.name === assetName,
    );
    if (asset && typeof asset.browser_download_url === "string") {
      tag = candidate;
      assetUrl = asset.browser_download_url;
      break;
    }
  }
  if (!tag || !assetUrl) {
    throw new Error(
      `No ${channel} release of '${options.package}' carries ${fillAssetTemplate(assetTemplateForPlatform(entry, platform), { owner: options.owner, version: "<version>", platform })} for ${platform}.`,
    );
  }
  const rawBinPath =
    entry.binPaths?.[platform] ??
    entry.binPath ??
    (entry.extract === "none" ? "{asset}" : `package/${entry.bin}`);
  // "{asset}" is exact-match only: the downloaded file IS the binary
  // (AppImage / portable exe). Anything else is a template with
  // {owner}/{version}/{platform}/{os}/{arch} (+ {bin} in binPaths).
  if (rawBinPath.includes("{asset}") && rawBinPath !== "{asset}") {
    throw new Error(
      `Invalid binPaths for platform '${platform}': '{asset}' must be the whole value (got '${rawBinPath}').`,
    );
  }
  const binPath =
    rawBinPath === "{asset}"
      ? assetName
      : fillAssetTemplate(rawBinPath, { owner: options.owner, version, platform }).replaceAll(
          "{bin}",
          entry.bin,
        );
  return {
    package: options.package,
    owner: options.owner,
    channel,
    version,
    tag,
    assetName,
    assetUrl,
    binPath,
    cacheDir: resolveCacheDir(options.owner, options.package, version),
    downloadUrl: assetUrl,
    extract: entry.extract ?? "tar",
    requireChecksum: options.requireChecksum ?? false,
  };
}

async function sha256File(path: string): Promise<string> {
  const bytes = await Bun.file(path).arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function downloadAsset(url: string, dest: string): Promise<void> {
  const response = await fetchWithRetry(url);
  if (!response.ok) {
    throw new Error(`Download failed (HTTP ${response.status}): ${url}`);
  }
  await Bun.write(dest, response);
}

/** Parse a `sha256sum`-style checksums file for one filename. */
export function findChecksum(checksumsText: string, fileName: string): string | null {
  for (const line of checksumsText.split(/\r?\n/)) {
    const match = /^([0-9a-fA-F]{64})\s+\*?(\S.*)$/.exec(line.trim());
    if (match?.[2] === fileName) return match[1]!.toLowerCase();
  }
  return null;
}

async function runTar(args: string[], cwd: string): Promise<void> {
  const proc = Bun.spawn(["tar", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`tar ${args.join(" ")} failed: ${stderr.slice(0, 300)}`);
  }
}

export async function runRun(options: RunOptions): Promise<void> {
  const resolved = await resolvePackage(options);
  const binPath = join(resolved.cacheDir, resolved.binPath);
  const markerPath = join(resolved.cacheDir, ".forkhub-ready");

  if (!existsSync(markerPath)) {
    console.error(
      `Resolving ${resolved.package} ${resolved.version} from ${resolved.owner}/.forkhub…`,
    );
    // Best-effort SHA check against the release SHA256SUMS (same trust
    // domain as the asset; guards transport corruption, not supply chain).
    // Unified updater releases may not publish SHA256SUMS at all — say so
    // loudly instead of installing silently unverified.
    let expected: string | null = null;
    try {
      const sumsUrl = `https://github.com/${resolved.owner}/.forkhub/releases/download/${resolved.tag}/SHA256SUMS`;
      const sumsResponse = await fetchWithRetry(sumsUrl);
      if (sumsResponse.ok) {
        expected = findChecksum(await sumsResponse.text(), resolved.assetName);
        if (!expected) {
          console.error(
            `warning: release ${resolved.tag} publishes SHA256SUMS but it has no entry for ${resolved.assetName} — installing unverified.`,
          );
        }
      } else {
        console.error(
          `warning: release ${resolved.tag} publishes no SHA256SUMS — installing ${resolved.assetName} unverified.`,
        );
      }
    } catch {
      console.error(
        `warning: could not fetch SHA256SUMS for ${resolved.tag} — installing ${resolved.assetName} unverified.`,
      );
      expected = null;
    }
    if (!expected && resolved.requireChecksum) {
      throw new Error(
        `Refusing to install ${resolved.assetName}: no verified SHA256SUMS entry (release ${resolved.tag}). Re-run without --require-checksum to accept a best-effort install.`,
      );
    }
    const tmpPath = join(
      process.env.XDG_CACHE_HOME ?? join(process.env.HOME ?? tmpdir(), ".cache"),
      "forkhub",
      `download-${Date.now()}.tgz`,
    );
    mkdirSync(resolved.cacheDir, { recursive: true });
    await downloadAsset(resolved.downloadUrl, tmpPath);
    if (expected) {
      const actual = await sha256File(tmpPath);
      if (actual !== expected) {
        throw new Error(
          `Checksum mismatch for ${resolved.assetName} (release SHA256SUMS says ${expected.slice(0, 12)}…).`,
        );
      }
    }
    if (resolved.extract === "none") {
      // Direct-execute artifact (AppImage / portable exe): the asset IS
      // the binary. Move it to binPath and mark executable.
      const dest = join(resolved.cacheDir, resolved.binPath);
      mkdirSync(
        join(resolved.cacheDir, resolved.binPath.split("/").slice(0, -1).join("/") || "."),
        {
          recursive: true,
        },
      );
      await Bun.write(dest, Bun.file(tmpPath));
      rmSync(tmpPath, { force: true });
      chmodSync(dest, 0o755);
    } else {
      await runTar(["-xzf", tmpPath, "-C", resolved.cacheDir], resolved.cacheDir);
      rmSync(tmpPath, { force: true });
    }
    if (!existsSync(binPath)) {
      throw new Error(`Installed tree has no executable at ${resolved.binPath}.`);
    }
    await Bun.write(markerPath, `${resolved.tag}\n`);
  }

  const child = Bun.spawn([binPath, ...(options.args ?? [])], {
    stdio: ["inherit", "inherit", "inherit"],
  });
  const exitCode = await child.exited;
  process.exit(exitCode ?? 1);
}

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { fetchWithRetry } from "./search";

export type RunOptions = {
  package: string;
  owner: string;
  channel?: string;
  version?: string;
  args?: string[];
};

export type RegistryPackage = {
  target?: string;
  description?: string;
  bin: string;
  binPath?: string;
  defaultChannel: string;
  asset: string;
  platforms?: string[];
  channels: Record<string, { tagMatch: string }>;
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

export function fillAssetTemplate(
  template: string,
  input: { owner: string; version: string },
): string {
  // Release asset filenames use the lowercased owner (build.sh normalizes
  // it; tags and URLs stay case-preserving).
  return template
    .replaceAll("{owner}", input.owner.toLowerCase())
    .replaceAll("{version}", input.version);
}

type ReleaseRow = {
  tag_name?: unknown;
  draft?: unknown;
  assets?: Array<{ name?: unknown; browser_download_url?: unknown }> | unknown;
};

/** Newest release (by semver tag) on a channel, or an exact version. */
export function pickReleaseTag(
  releases: ReleaseRow[],
  input: { channel: string; tagMatch: string; version?: string },
): string {
  const usable = releases.filter(
    (row) => typeof row.tag_name === "string" && row.draft !== true,
  ) as Array<{ tag_name: string }>;
  if (input.version) {
    const wanted = [input.version, `v${input.version}`];
    const hit = usable.find((row) => wanted.includes(row.tag_name));
    if (!hit) {
      throw new Error(
        `No ${input.channel} release found for version '${input.version}'.`,
      );
    }
    return hit.tag_name;
  }
  const pattern = new RegExp(input.tagMatch);
  const matching = usable.map((row) => row.tag_name).filter((tag) => pattern.test(tag));
  if (matching.length === 0) {
    throw new Error(`No published releases found on channel '${input.channel}'.`);
  }
  return matching.sort(compareSemver).at(-1) as string;
}

export function resolveCacheDir(owner: string, pkg: string, version: string): string {
  const base = process.env.XDG_CACHE_HOME ?? join(process.env.HOME ?? tmpdir(), ".cache");
  return join(base, "forkhub", "run", owner, pkg, version);
}

export async function fetchRegistry(owner: string): Promise<Record<string, RegistryPackage>> {
  const url = `https://raw.githubusercontent.com/${owner}/.forkhub/main/registry.json`;
  const response = await fetchWithRetry(url);
  if (response.status === 404) {
    throw new Error(
      `${owner}/.forkhub has no registry.json on main yet — nothing to run.`,
    );
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
  const releases = (await githubApi(
    `/repos/${options.owner}/.forkhub/releases?per_page=100`,
  )) as ReleaseRow[];
  const tag = pickReleaseTag(releases, {
    channel,
    tagMatch: channelDef.tagMatch,
    version: options.version,
  });
  const release = releases.find((row) => row.tag_name === tag) as
    | { assets?: Array<{ name?: unknown; browser_download_url?: unknown }> }
    | undefined;
  const version = tag.replace(/^v/, "");
  const assetName = fillAssetTemplate(entry.asset, { owner: options.owner, version });
  const asset = (Array.isArray(release?.assets) ? release?.assets : []).find(
    (row) => row?.name === assetName,
  );
  if (!asset || typeof asset.browser_download_url !== "string") {
    throw new Error(`Release ${tag} has no asset named ${assetName}.`);
  }
  const binPath = (entry.binPath ?? `package/${entry.bin}`).replaceAll("{bin}", entry.bin);
  return {
    package: options.package,
    owner: options.owner,
    channel,
    version,
    tag,
    assetName,
    assetUrl: asset.browser_download_url,
    binPath,
    cacheDir: resolveCacheDir(options.owner, options.package, version),
    downloadUrl: asset.browser_download_url,
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
    console.error(`Resolving ${resolved.package} ${resolved.version} from ${resolved.owner}/.forkhub…`);
    // Best-effort SHA check against the release SHA256SUMS (same trust
    // domain as the asset; guards transport corruption, not supply chain).
    let expected: string | null = null;
    try {
      const sumsUrl = `https://github.com/${resolved.owner}/.forkhub/releases/download/${resolved.tag}/SHA256SUMS`;
      const sumsResponse = await fetchWithRetry(sumsUrl);
      if (sumsResponse.ok) {
        expected = findChecksum(await sumsResponse.text(), resolved.assetName);
      }
    } catch {
      expected = null;
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
    await runTar(["-xzf", tmpPath, "-C", resolved.cacheDir], resolved.cacheDir);
    rmSync(tmpPath, { force: true });
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

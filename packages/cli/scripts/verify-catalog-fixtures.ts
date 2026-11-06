import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  assetTemplateForPlatform,
  fillAssetTemplate,
  pickReleaseTags,
  validateRegistryEntry,
} from "../src/run";

/**
 * Fixture check: registry entries proposed for the catalog PRs resolve
 * against recorded live release shapes (no network). Run from the CLI
 * package dir: `bun run scripts/verify-catalog-fixtures.ts`.
 *
 * Recorded 2026-11-06 via gh api:
 * - with-fh unified updater v3.1.0-fh.with-fh.1 assets
 * - with-fh namespaced bundle natively-...--v3.1.0-fh7 assets
 * - ImBIOS v3.1.0-fh.imbios.1 assets
 * - with-fh t3 updater v0.1.1-nightly.20261019.3373.fh.with-fh.1 assets
 */

type Asset = { name: string; browser_download_url: string };
type Release = { tag_name: string; draft: boolean; assets: Asset[] };
const url = (n: string) => `https://github.com/x/y/releases/download/t/${n}`;

const WITH_FH_RELEASES: Release[] = [
  {
    tag_name: "v3.1.0-fh.with-fh.1",
    draft: false,
    assets: [
      "fh-linux.yml",
      "fh.yml",
      "latest-linux.yml",
      "latest.yml",
      "Natively-3.1.0-fh.with-fh.1.AppImage",
      "Natively-Setup-3.1.0-fh.with-fh.1.exe",
      "Natively-Setup-3.1.0-fh.with-fh.1.exe.blockmap",
      "Natively.3.1.0-fh.with-fh.1.exe",
    ].map((name) => ({ name, browser_download_url: url(name) })),
  },
  {
    tag_name: "v3.0.0-fh.with-fh.3",
    draft: false,
    assets: ["fh-linux.yml", "latest-linux.yml", "Natively-3.0.0-fh.with-fh.3.AppImage"].map(
      (name) => ({ name, browser_download_url: url(name) }),
    ),
  },
  {
    tag_name: "natively-ai-assistant-natively-cluely-ai-assistant--v3.1.0-fh7",
    draft: false,
    assets: ["BUILD_LOG.md", "SHA256SUMS", "SHA256SUMS-mac"].map((name) => ({
      name,
      browser_download_url: url(name),
    })),
  },
  {
    tag_name: "pingdotgg-t3code--v0.1.6-fh14",
    draft: false,
    assets: ["BUILD_LOG.md", "SHA256SUMS"].map((name) => ({
      name,
      browser_download_url: url(name),
    })),
  },
];

const IMBIOS_RELEASES: Release[] = [
  {
    tag_name: "v3.1.0-fh.imbios.1",
    draft: false,
    assets: ["latest-linux.yml", "Natively-3.1.0-fh.imbios.1.AppImage", "SHA256SUMS"].map(
      (name) => ({ name, browser_download_url: url(name) }),
    ),
  },
];

type Entry = {
  file: string;
  pkg: string;
  owner: string;
  json: {
    target?: string;
    bin: string;
    description?: string;
    asset: string;
    assets?: Record<string, string>;
    binPaths?: Record<string, string>;
    binPath?: string;
    extract?: "tar" | "none";
    platforms?: string[];
    channels: Record<string, { tagMatch: string }>;
    defaultChannel: string;
  };
};

async function loadEntries(): Promise<Entry[]> {
  // Default (CI): vendored entry fixtures under tests/fixtures, recorded
  // 2026-11-06. Pass WITH_FH_DIR / IMBIOS_DIR to check live catalog
  // checkouts instead (e.g. the with-fh + ImBIOS catalog PRs).
  const withFh = process.env.WITH_FH_DIR;
  const imbios = process.env.IMBIOS_DIR;
  const files: Array<{ file: string; owner: string; pkgs: string[] }> = withFh
    ? [
        { file: join(withFh, "registry.json"), owner: "with-fh", pkgs: ["natively"] },
        {
          file: join(imbios ?? "/tmp/opencode/catalogs/imbios", "registry.json"),
          owner: "ImBIOS",
          pkgs: ["natively-linux"],
        },
      ]
    : ((["with-fh-natively", "imbios-natively-linux"] as const).map((name) => ({
        file: new URL(`../tests/fixtures/${name}.json`, import.meta.url).pathname,
        owner: name.startsWith("with-fh") ? "with-fh" : "ImBIOS",
        pkgs: [name === "with-fh-natively" ? "natively" : "natively-linux"],
        single: true,
      })) as Array<{ file: string; owner: string; pkgs: string[] }>);
  const out: Entry[] = [];
  for (const { file, owner, pkgs } of files) {
    if (!existsSync(file)) {
      throw new Error(`missing fixture input (PR not checked out?): ${file}`);
    }
    const raw = JSON.parse(await Bun.file(file).text()) as
      | { packages: Record<string, Entry["json"]> }
      | Entry["json"];
    const data =
      "packages" in raw ? (raw as { packages: Record<string, Entry["json"]> }).packages : null;
    for (const pkg of pkgs) {
      const json = data ? data[pkg] : (raw as Entry["json"]);
      if (!json) throw new Error(`${owner} registry.json has no '${pkg}' entry`);
      out.push({ file, pkg, owner, json });
    }
  }
  return out;
}

const STARS: Record<string, number> = {
  "github.com/Natively-AI-assistant/natively-cluely-ai-assistant": 3193,
  "github.com/deepseek-ai/deepseek-harness": 274506,
  "github.com/pingdotgg/t3code": 48947,
};

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error(`FAIL: ${msg}`);
};

async function main(): Promise<void> {
  for (const { pkg, owner, json } of await loadEntries()) {
    const releases = owner === "with-fh" ? WITH_FH_RELEASES : IMBIOS_RELEASES;
    // Same fail-fast path as production resolvePackage (bad regex /
    // extract / {asset} throws before any tag walk).
    for (const platform of json.platforms ?? []) {
      try {
        validateRegistryEntry(pkg, json, platform);
      } catch (err) {
        fail(`${owner}/${pkg} [${platform}]: ${err instanceof Error ? err.message : err}`);
      }
    }
    if (!json.channels[json.defaultChannel]) {
      fail(`${owner}/${pkg}: defaultChannel '${json.defaultChannel}' not in channels`);
      continue;
    }
    const channel = json.defaultChannel;
    const tagMatch = json.channels[channel]?.tagMatch;
    if (!tagMatch) {
      fail(`${owner}/${pkg}: defaultChannel '${channel}' has no tagMatch`);
      continue;
    }
    let candidates: string[];
    try {
      candidates = pickReleaseTags(releases, { channel, tagMatch });
    } catch (err) {
      fail(`${owner}/${pkg}: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    for (const platform of json.platforms ?? []) {
      const template = assetTemplateForPlatform(json, platform);
      let hit: string | null = null;
      for (const tag of candidates) {
        const rel = releases.find((r) => r.tag_name === tag)!;
        const version = tag.replace(/^v/, "");
        const name = fillAssetTemplate(template, { owner, version, platform });
        if (rel.assets.some((a) => a.name === name)) {
          hit = `${tag} :: ${name}`;
          break;
        }
      }
      if (!hit) {
        fail(
          `${owner}/${pkg} [${platform}]: no ${channel} release carries '${fillAssetTemplate(template, { owner, version: "<version>", platform })}' (tags tried: ${candidates.join(", ")})`,
        );
      } else {
        console.log(`ok ${owner}/${pkg} [${platform}]: ${hit}`);
        // Regression guard: the win32 entry must be the portable exe, not
        // the NSIS Setup installer (installer wizards don't spawn as the app).
        if (platform === "win32-x64" && hit.includes("Setup")) {
          fail(
            `${owner}/${pkg} [${platform}]: resolved installer '${hit}' — must be the portable exe`,
          );
        }
      }
    }
  }
  // binPaths {asset} entries are exempt (the downloaded file is the binary)

  // 2k-star gate audit (upstream counts recorded during research)
  for (const [target, stars] of Object.entries(STARS)) {
    if (stars < 2000) fail(`star gate: ${target} has ${stars} < 2000`);
    else console.log(`ok star gate: ${target} = ${stars}`);
  }

  if (failures > 0) {
    console.error(`\n${failures} fixture check(s) failed`);
    process.exit(1);
  }
  console.log("\nall catalog fixtures resolve");
}

await main();

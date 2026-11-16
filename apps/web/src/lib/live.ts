import { OSS_CATALOG } from "@forkhub/api/oss/data";

import {
  channelHistory,
  type ChannelRelease,
  type DownloadAsset,
  type GhRelease,
} from "./releases";

const CATALOG_RELEASES_URL = "https://api.github.com/repos/with-fh/.forkhub/releases?per_page=100";

/** Number of recent releases kept per channel for the version picker. */
export const CHANNEL_HISTORY_LIMIT = 10;

export type ChannelInfo = {
  /** Full release tag, e.g. v2.8.8-fh.with-fh.3 */
  version: string;
  publishedAt: string;
  releaseUrl: string;
  appImageUrl: string | null;
  tgzUrl: string | null;
};

export type LiveChannels = {
  stable: ChannelInfo | null;
  nightly: ChannelInfo | null;
};

export type LiveChannelHistory = {
  stable: ChannelRelease[];
  nightly: ChannelRelease[];
};

// Upstream star counts, cached for a day. Null per-entry on failure so
// callers fall back to the static counts in the catalog data.
export async function getStarsMap(): Promise<Record<string, number | null>> {
  const out: Record<string, number | null> = {};
  await Promise.all(
    OSS_CATALOG.map(async (e) => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 12_000);
        let res: Response;
        try {
          res = await fetch(`https://api.github.com/repos/${e.upstreamRepo}`, {
            next: { revalidate: 86400 },
            headers: githubHeaders(),
            signal: ctrl.signal,
          });
        } finally {
          clearTimeout(timer);
        }
        if (!res.ok) {
          out[e.slug] = null;
          return;
        }
        const data = (await res.json()) as { stargazers_count?: number };
        out[e.slug] = typeof data.stargazers_count === "number" ? data.stargazers_count : null;
      } catch {
        out[e.slug] = null;
      }
    }),
  );
  return out;
}

function ownerOf(r: GhRelease): "t3" | "natively" | "dsh" | "opendia" | null {
  // Proposed scheme embeds the upstream repo as a trailing slug —
  // v<upstream>.fh.<owner>.<n>.<repo> — so parse that first. Legacy
  // families (v2.8.8-fh.with-fh.3, pingdotgg-t3code--…-fh4,
  // deepseek-ai-deepseek-harness--dsh-v0.2.2-rc.1-fh14) carry no
  // slug and fall through to release-name matching below.
  const slugHit = /\.([a-z0-9]+(?:-[a-z0-9]+)+)\s*$/i.exec(r.tag_name)?.[1] ?? "";
  if (/t3code/i.test(slugHit)) return "t3";
  if (/natively/i.test(slugHit)) return "natively";
  if (/deepseek/i.test(slugHit)) return "dsh";
  if (/opendia/i.test(slugHit)) return "opendia";
  if (/^t3 code/i.test(r.name) || /t3code/i.test(r.tag_name)) return "t3";
  if (/^natively/i.test(r.name) || /natively/i.test(r.tag_name)) return "natively";
  if (/deepseek/i.test(r.name) || /deepseek/i.test(r.tag_name)) return "dsh";
  if (/opendia/i.test(r.name) || /opendia/i.test(r.tag_name)) return "opendia";
  return null;
}

type GhApiAsset = { name: string; browser_download_url: string; size?: number };

type GhApiRelease = Omit<GhRelease, "assets"> & { assets: GhApiAsset[] };

export type UpstreamRelease = {
  tag: string;
  name: string;
  url: string;
  /** Tag URL (tree link), commit URL, author profile URL — all upstream. */
  tagUrl: string;
  commitUrl: string;
  authorUrl: string;
  publishedAt: string;
  authorLogin: string;
  authorAvatar: string;
  commitSha: string;
  body: string;
  assets: DownloadAsset[];
  shaUrl: string | null;
  prerelease: boolean;
  latest: boolean;
};

function upstreamUrl(
  repo: string,
  kind: "releases" | "tree" | "commit" | "user",
  ref: string,
): string {
  if (kind === "releases") return `https://github.com/${repo}/releases`;
  if (kind === "tree") return `https://github.com/${repo}/tree/${ref}`;
  if (kind === "commit") return `https://github.com/${repo}/commit/${ref}`;
  return `https://github.com/${ref}`;
}

const UPSTREAM_LIMIT = 10;

async function fetchUpstreamReleases(
  upstreamRepo: string,
): Promise<{ releases: UpstreamRelease[]; apiOk: boolean }> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    let res: Response;
    try {
      res = await fetch(
        `https://api.github.com/repos/${upstreamRepo}/releases?per_page=${UPSTREAM_LIMIT}`,
        {
          next: { revalidate: 3600 },
          headers: githubHeaders(),
          signal: ctrl.signal,
        },
      );
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return { releases: [], apiOk: false };
    const batch = (await res.json()) as Array<{
      tag_name?: string;
      name?: string | null;
      html_url?: string;
      published_at?: string;
      prerelease?: boolean;
      body?: string | null;
      author?: { login?: string; avatar_url?: string; html_url?: string };
      target_commitish?: string;
      assets?: GhApiAsset[];
    }>;
    const { toChannelRelease } = await import("./releases");
    const releases: UpstreamRelease[] = [];
    for (const r of batch) {
      if (typeof r.tag_name !== "string") continue;
      const conv = toChannelRelease({
        tag_name: r.tag_name,
        name: typeof r.name === "string" && r.name ? r.name : r.tag_name,
        html_url: typeof r.html_url === "string" ? r.html_url : "",
        published_at: typeof r.published_at === "string" ? r.published_at : "",
        assets: Array.isArray(r.assets) ? r.assets : [],
        body: typeof r.body === "string" ? r.body : null,
      });
      const login =
        r.author && typeof r.author.login === "string"
          ? r.author.login
          : (upstreamRepo.split("/")[0] ?? "");
      const avatar = r.author && typeof r.author.avatar_url === "string" ? r.author.avatar_url : "";
      const authorHtml = r.author && typeof r.author.html_url === "string" ? r.author.html_url : "";
      const target = typeof r.target_commitish === "string" ? r.target_commitish : "";
      const sha = /^[0-9a-f]{4,40}$/i.test(target) ? target : "";
      const tagName = typeof r.tag_name === "string" ? r.tag_name : conv.version;
      releases.push({
        tag: conv.version,
        name: conv.name,
        url: conv.releaseUrl,
        tagUrl: upstreamUrl(upstreamRepo, "tree", tagName),
        commitUrl: sha ? upstreamUrl(upstreamRepo, "commit", sha) : conv.releaseUrl,
        authorUrl: authorHtml ? authorHtml : upstreamUrl(upstreamRepo, "user", login),
        publishedAt: conv.publishedAt,
        authorLogin: login,
        authorAvatar: avatar,
        commitSha: sha,
        body: typeof r.body === "string" ? r.body : "",
        assets: conv.assets,
        shaUrl: conv.shaUrl,
        prerelease: r.prerelease === true,
        latest: false,
      });
    }
    if (releases.length > 0) releases[0]!.latest = true;
    return { releases, apiOk: true };
  } catch {
    return { releases: [], apiOk: false };
  }
}

export async function getUpstreamReleases(
  slug: string,
): Promise<{ releases: UpstreamRelease[]; apiOk: boolean }> {
  const entry = OSS_CATALOG.find((e) => e.slug === slug);
  if (!entry) return { releases: [], apiOk: false };
  return fetchUpstreamReleases(entry.upstreamRepo);
}

type PageFetcher = (
  url: string,
  init?: RequestInit & { next?: { revalidate?: number } },
) => Promise<Response>;

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    // GitHub requires a UA; Workers fetch sends none by default, and
    // datacenter egress without one is treated as abusive (HTTP 403).
    "User-Agent": "forkhub-web (+https://forkhub.imbios.dev)",
  };
  // Authenticated requests get 5,000/hr instead of 60 — set GITHUB_TOKEN
  // (server-only; never NEXT_PUBLIC_) so shared egress IPs don't starve.
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** Exported for unit tests (stub the fetcher to avoid network). */
export async function fetchCatalogReleases(
  fetchImpl: PageFetcher = fetch as PageFetcher,
): Promise<{ releases: GhRelease[]; apiOk: boolean; apiStatus: number | null }> {
  // Paginate (up to 3 pages): nightlies publish daily, so a single page can
  // push older stable releases out of view. Cached 1h per page URL, so this
  // costs ~3 calls/hour — well within even the unauthenticated quota.
  // Pages fetch CONCURRENTLY with a per-page timeout: sequential fetches
  // would stack worst-case hangs (3 × timeout), hanging the whole page.
  const out: GhRelease[] = [];
  let apiOk = false;
  let apiStatus: number | null = null;
  type PageResult = { page: number; ok: boolean; status: number | null; batch: GhApiRelease[] };
  const settled: PageResult[] = await Promise.all(
    [1, 2, 3].map(async (page): Promise<PageResult> => {
      try {
        // Bound the wait: a hung upstream fetch must degrade to the
        // "not published yet" empty state, never hang the page.
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 12_000);
        try {
          const res: Response = await fetchImpl(`${CATALOG_RELEASES_URL}&page=${page}`, {
            next: { revalidate: 3600 },
            headers: githubHeaders(),
            signal: ctrl.signal,
          });
          if (!res.ok) {
            let detail = "";
            try {
              detail = ` — ${(await res.text()).slice(0, 160)}`;
            } catch {
              // ignore body read failures
            }
            console.warn(`[download] catalog API HTTP ${res.status} (page ${page})${detail}`);
            return { page, ok: false, status: res.status, batch: [] };
          }
          const batch = (await res.json()) as GhApiRelease[];
          return { page, ok: true, status: res.status, batch };
        } finally {
          clearTimeout(timer);
        }
      } catch (err) {
        console.warn(
          `[download] catalog fetch failed (page ${page}): ${err instanceof Error ? err.message : err}`,
        );
        return { page, ok: false, status: null, batch: [] };
      }
    }),
  );
  // In page order: stop at the first short/failed page so pagination stays
  // a prefix (page 2+ only matter when page 1 was full).
  for (const { batch, ok, status } of settled.sort((a, b) => a.page - b.page)) {
    if (!ok) {
      apiStatus = status;
      break;
    }
    apiStatus = status;
    if (batch.length === 0) break;
    apiOk = true;
    out.push(
      ...batch.map((r) => ({
        ...r,
        assets: (r.assets ?? []).map((a) => ({
          name: a.name,
          browser_download_url: a.browser_download_url,
          size: typeof a.size === "number" ? a.size : undefined,
        })),
      })),
    );
    if (batch.length < 100) break;
  }
  return { releases: out, apiOk, apiStatus };
}

const SLUG_OWNER: Record<string, "t3" | "natively" | "dsh" | "opendia"> = {
  t3code: "t3",
  natively: "natively",
  "deepseek-harness": "dsh",
  opendia: "opendia",
};

// Current stable/nightly builds per OSS entry, derived from the catalog's
// GitHub releases (newest first). Cached for an hour — nightlies publish
// daily, so a day-long cache would serve yesterday's build as "current".
export async function getChannelsFor(slug: string): Promise<LiveChannels> {
  const history = await getChannelReleases(slug, 1);
  const first = (list: ChannelRelease[]): ChannelInfo | null => {
    const rel = list[0];
    if (!rel) return null;
    const appImage = rel.assets.find((a) => a.format === "AppImage") ?? null;
    return {
      version: rel.version,
      publishedAt: rel.publishedAt,
      releaseUrl: rel.releaseUrl,
      appImageUrl: appImage?.url ?? null,
      tgzUrl: null,
    };
  };
  return { stable: first(history.stable), nightly: first(history.nightly) };
}

/**
 * Recent releases per channel (newest first) for the version picker and
 * per-platform asset cards. Empty lists render the "not published yet"
 * states — never throws, so pages degrade to static content offline.
 */
export async function getChannelReleases(
  slug: string,
  limitPerChannel = CHANNEL_HISTORY_LIMIT,
): Promise<LiveChannelHistory & { apiOk: boolean; apiStatus: number | null }> {
  const out: LiveChannelHistory & { apiOk: boolean; apiStatus: number | null } = {
    stable: [],
    nightly: [],
    apiOk: false,
    apiStatus: null,
  };
  const owner = SLUG_OWNER[slug];
  if (!owner) return out;
  try {
    const { releases, apiOk, apiStatus } = await fetchCatalogReleases(fetch as PageFetcher);
    out.apiOk = apiOk;
    out.apiStatus = apiStatus;
    const { stable, nightly } = channelHistory(
      releases,
      (r) => ownerOf(r) === owner,
      limitPerChannel,
    );
    out.stable = stable;
    out.nightly = nightly;
  } catch {
    // fall through with empties; pages render "not published yet" states
  }
  return out;
}

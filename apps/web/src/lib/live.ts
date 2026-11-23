import { OSS_CATALOG } from "@forkhub/api/oss/data";

import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

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

/**
 * Contributors block data, mirrored from github.com's own release page markup
 * (the REST API exposes no per-release contributor list, and the "New
 * Contributors" section in generated notes is a different, smaller set).
 * Avatar srcs carry the numeric user id, which is impossible to derive.
 */
export type Contributor = {
  login: string;
  /** Upstream avatar URL, byte-identical to the one github.com renders. */
  avatarSrc: string;
};

export type ReleaseContributors = {
  avatars: Contributor[];
  /** Upstream's own footer line ("a, b, and 18 other contributors"). */
  caption: string;
};

export type UpstreamRelease = {
  tag: string;
  name: string;
  url: string;
  /** Tag URL (tree link), commit URL, author profile URL — all upstream. */
  tagUrl: string;
  commitUrl: string;
  compareUrl: string | null;
  authorUrl: string;
  publishedAt: string;
  authorLogin: string;
  authorAvatar: string;
  commitSha: string;
  body: string;
  /** Server-rendered sanitized HTML of the markdown body (upstream parity). */
  bodyHtml: string;
  assets: DownloadAsset[];
  shaUrl: string | null;
  prerelease: boolean;
  latest: boolean;
  /** Upstream Box-footer Contributors block; null when the release has none. */
  contributors: ReleaseContributors | null;
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

/** Render markdown exactly like upstream: marked (gfm) then sanitize-html allowlist. */
function renderBodyHtml(md: string, repo: string): string {
  const raw = marked.parse(md, { breaks: true, gfm: true }) as string;
  const clean = sanitizeHtml(raw, {
    allowedTags: [
      "a",
      "b",
      "blockquote",
      "br",
      "code",
      "del",
      "details",
      "div",
      "em",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "hr",
      "i",
      "img",
      "input",
      "ins",
      "kbd",
      "li",
      "ol",
      "p",
      "pre",
      "s",
      "span",
      "strike",
      "strong",
      "sub",
      "summary",
      "sup",
      "table",
      "tbody",
      "td",
      "tfoot",
      "th",
      "thead",
      "tr",
      "tt",
      "u",
      "ul",
    ],
    allowedAttributes: {
      a: [
        "href",
        "title",
        "class",
        "data-hovercard-type",
        "data-hovercard-url",
        "data-octo-click",
        "data-octo-dimensions",
        "aria-keyshortcuts",
      ],
      img: ["src", "alt", "width", "height"],
      input: ["type", "checked", "disabled"],
      "*": ["id", "class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
  });
  // <details>/<summary> stay in place: github.com renders release notes with
  // the generated changelog collapsed behind "Full changelog". `open` is not
  // allowlisted, so the browser defaults to closed — same as upstream.
  return linkifyUpstream(clean, repo);
}

/** Rewrite bare @mentions/#PRs/CHANGELOG paths to upstream URLs (what github's pipeline emits). */
function linkifyUpstream(html: string, repo: string): string {
  const [owner, name] = repo.split("/");
  // already-linked stays; link bare #1234 and @users in text nodes only (cheap: skip inside <a ...>)
  return html
    .replace(/(<a\b[^>]*>.*?<\/a>)|@(\w[\w-]*)/g, (m: string, link?: string, user?: string) => {
      if (link) return link;
      return `<a class="user-mention notranslate" data-hovercard-type="user" data-hovercard-url="/users/${user}/hovercard" href="https://github.com/${user}">@${user}</a>`;
    })
    .replace(/(<a\b[^>]*>.*?<\/a>)|(?<!\w)#(\d{2,})/g, (m: string, link?: string, num?: string) => {
      if (link || !owner || !name) return m;
      return `<a class="issue-link js-issue-link" data-error-text="Failed to load title" data-url="https://github.com/${owner}/${name}/issues/${num}" data-hovercard-type="pull_request" data-hovercard-url="/${owner}/${name}/pull/${num}/hovercard" href="https://github.com/${owner}/${name}/pull/${num}">#${num}</a>`;
    });
}

/**
 * Parse the Contributors footer out of an upstream /releases page. github.com
 * renders it from data no public API exposes (per-release contributors plus
 * avatar URLs that embed the numeric user id), so mirroring the markup is the
 * only way to match it. Returns {} when a release has no contributors block
 * (hand-written notes) — same absence as upstream.
 */
export function parseUpstreamContributors(html: string): Record<string, ReleaseContributors> {
  const out: Record<string, ReleaseContributors> = {};
  const marks: { tag: string; at: number }[] = [];
  const sectionRe = /<section id="release-([^"]+)"/g;
  for (let m = sectionRe.exec(html); m; m = sectionRe.exec(html)) {
    marks.push({ tag: decodeBasicEntities(m[1]!), at: m.index });
  }
  for (let i = 0; i < marks.length; i++) {
    const { tag, at } = marks[i]!;
    const end = i + 1 < marks.length ? marks[i + 1]!.at : html.length;
    const seg = html.slice(at, end);
    const heading = seg.indexOf(">Contributors<");
    if (heading < 0) continue;
    const ul = seg.indexOf("<ul", heading);
    const ulEnd = ul < 0 ? -1 : seg.indexOf("</ul>", ul);
    if (ul < 0 || ulEnd < 0) continue;
    const avatars: Contributor[] = [];
    for (const img of seg.slice(ul, ulEnd).matchAll(/<img\b[^>]*>/g)) {
      const src = /\bsrc="([^"]+)"/.exec(img[0])?.[1];
      const alt = /\balt="@([^"]*)"/.exec(img[0])?.[1];
      if (src && alt) avatars.push({ login: alt, avatarSrc: decodeBasicEntities(src) });
    }
    if (avatars.length === 0) continue;
    const caption =
      /<div class="mt-2 color-fg-muted"[^>]*>\s*([^<]+?)\s*<\/div>/.exec(seg.slice(ulEnd))?.[1] ??
      contributorCaption(avatars.map((a) => a.login));
    out[tag] = { avatars, caption: caption.trim() };
  }
  return out;
}

/** Same wording github.com uses under the avatar row. */
export function contributorCaption(logins: string[]): string {
  if (logins.length === 0) return "";
  if (logins.length === 1) return logins[0]!;
  if (logins.length === 2) return `${logins[0]} and ${logins[1]}`;
  const others = logins.length - 2;
  return `${logins[0]}, ${logins[1]}, and ${others} other contributor${others === 1 ? "" : "s"}`;
}

function decodeBasicEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Per-isolate memo: the upstream page is ~800KB of HTML, and re-parsing it on
// every request would be wasteful. Mirrors the fetch cache window.
const contributorMemo = new Map<
  string,
  { at: number; data: Record<string, ReleaseContributors> }
>();
const CONTRIBUTOR_TTL_MS = 10 * 60 * 1000;

async function fetchUpstreamContributors(
  upstreamRepo: string,
): Promise<Record<string, ReleaseContributors>> {
  const hit = contributorMemo.get(upstreamRepo);
  if (hit && Date.now() - hit.at < CONTRIBUTOR_TTL_MS) return hit.data;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    let res: Response;
    try {
      res = await fetch(`https://github.com/${upstreamRepo}/releases`, {
        next: { revalidate: 3600 },
        headers: {
          "User-Agent": "forkhub-web (+https://forkhub.imbios.dev)",
          Accept: "text/html",
        },
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return {};
    const data = parseUpstreamContributors(await res.text());
    contributorMemo.set(upstreamRepo, { at: Date.now(), data });
    return data;
  } catch {
    // Missing avatars beat a broken page; the footer block just drops.
    return {};
  }
}

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
    const contributorsByTag = await fetchUpstreamContributors(upstreamRepo);
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
      // Display convention matches github.com server HTML: bot suffixes
      // are stripped for display (`github-actions`, alt `@github-actions`)
      // while authorUrl keeps the API-provided apps URL. Avatar URLs from
      // the API carry no size param; upstream serves `?s=40` (20px @2x).
      const displayLogin = login.replace(/\[bot\]$/i, "");
      const rawAvatar =
        r.author && typeof r.author.avatar_url === "string" ? r.author.avatar_url : "";
      const avatar =
        rawAvatar !== "" && !/[?&]s=\d+/.test(rawAvatar)
          ? `${rawAvatar}${rawAvatar.includes("?") ? "&" : "?"}s=40`
          : rawAvatar;
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
        compareUrl: null, // filled after sort (needs previous tag)
        authorUrl: authorHtml ? authorHtml : upstreamUrl(upstreamRepo, "user", login),
        publishedAt: conv.publishedAt,
        authorLogin: displayLogin,
        authorAvatar: avatar,
        commitSha: sha,
        body: typeof r.body === "string" ? r.body : "",
        bodyHtml: renderBodyHtml(typeof r.body === "string" ? r.body : "", upstreamRepo),
        assets: conv.assets,
        shaUrl: conv.shaUrl,
        prerelease: r.prerelease === true,
        latest: false,
        contributors: contributorsByTag[tagName] ?? null,
      });
    }
    const sorted = [...releases].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    for (let i = 0; i < sorted.length; i++) {
      const cur = sorted[i]!;
      const prev = sorted[i + 1];
      if (prev) {
        cur.compareUrl = `https://github.com/${upstreamRepo}/compare/${prev.tag}...${cur.tag}`;
      }
    }
    if (releases.length > 0) releases[0]!.latest = true;
    return { releases, apiOk: true };
  } catch {
    return { releases: [], apiOk: false };
  }
}

export type UpstreamRepoMeta = {
  stars: number | null;
  issues: number | null;
  pulls: number | null;
};

async function fetchUpstreamRepoMeta(upstreamRepo: string): Promise<UpstreamRepoMeta> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    let res: Response;
    try {
      res = await fetch(`https://api.github.com/repos/${upstreamRepo}`, {
        next: { revalidate: 3600 },
        headers: githubHeaders(),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return { stars: null, issues: null, pulls: null };
    const d = (await res.json()) as {
      stargazers_count?: number;
      open_issues_count?: number;
    };
    // pulls count needs search API (extra call, cached same way)
    let pulls: number | null = null;
    try {
      const pqCtrl = new AbortController();
      const pqTimer = setTimeout(() => pqCtrl.abort(), 12000);
      let q: Response;
      try {
        q = await fetch(
          `https://api.github.com/search/issues?q=repo:${upstreamRepo}+type:pr+state:open&per_page=1`,
          {
            next: { revalidate: 3600 },
            headers: githubHeaders(),
            signal: pqCtrl.signal,
          },
        );
      } finally {
        clearTimeout(pqTimer);
      }
      if (q.ok) {
        const j = (await q.json()) as { total_count?: number };
        if (typeof j.total_count === "number") pulls = j.total_count;
      }
    } catch {
      // pulls stays null -> tab renders without count, like logged-out edge cases
    }
    return {
      stars: typeof d.stargazers_count === "number" ? d.stargazers_count : null,
      // open_issues_count includes open PRs; the Issues tab shows
      // issues-only, i.e. open_issues minus open PRs (verified: 3.5k - 2.3k = 1.2k on t3code).
      issues:
        typeof d.open_issues_count === "number" && typeof pulls === "number"
          ? Math.max(d.open_issues_count - pulls, 0)
          : typeof d.open_issues_count === "number"
            ? d.open_issues_count
            : null,
      pulls,
    };
  } catch {
    return { stars: null, issues: null, pulls: null };
  }
}

export async function getUpstreamMeta(
  slug: string,
): Promise<{ meta: UpstreamRepoMeta; stars: number | null }> {
  const entry = OSS_CATALOG.find((e) => e.slug === slug);
  if (!entry) return { meta: { stars: null, issues: null, pulls: null }, stars: null };
  const [meta, starsMap] = await Promise.all([
    fetchUpstreamRepoMeta(entry.upstreamRepo),
    getStarsMap(),
  ]);
  return { meta, stars: starsMap[slug] ?? entry.stars };
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

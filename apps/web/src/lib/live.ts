import { OSS_CATALOG } from "@forkhub/api/oss/data";

import { channelHistory, type ChannelRelease, type GhRelease } from "./releases";

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
        const res = await fetch(`https://api.github.com/repos/${e.upstreamRepo}`, {
          next: { revalidate: 86400 },
          headers: { Accept: "application/vnd.github+json" },
        });
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

function ownerOf(r: GhRelease): "t3" | "natively" | null {
  // Proposed scheme embeds the upstream repo as a trailing slug —
  // v<upstream>.fh.<owner>.<n>.<repo> — so parse that first. Legacy
  // families (v2.8.8-fh.with-fh.3, pingdotgg-t3code--…-fh4) carry no
  // slug and fall through to release-name matching below.
  const slugHit = /\.([a-z0-9]+(?:-[a-z0-9]+)+)\s*$/i.exec(r.tag_name)?.[1] ?? "";
  if (/t3code/i.test(slugHit)) return "t3";
  if (/natively/i.test(slugHit)) return "natively";
  if (/^t3 code/i.test(r.name) || /t3code/i.test(r.tag_name)) return "t3";
  if (/^natively/i.test(r.name) || /natively/i.test(r.tag_name)) return "natively";
  return null;
}

type GhApiAsset = { name: string; browser_download_url: string; size?: number };

async function fetchCatalogReleases(): Promise<GhRelease[]> {
  // Paginate (up to 3 pages): nightlies publish daily, so a single page can
  // push older stable releases out of view. Cached 1h per page URL.
  const out: GhRelease[] = [];
  for (let page = 1; page <= 3; page++) {
    const res = await fetch(`${CATALOG_RELEASES_URL}&page=${page}`, {
      next: { revalidate: 3600 },
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) break;
    const batch = (await res.json()) as (GhRelease & { assets: GhApiAsset[] })[];
    if (batch.length === 0) break;
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
  return out;
}

const SLUG_OWNER: Record<string, "t3" | "natively"> = {
  t3code: "t3",
  natively: "natively",
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
): Promise<LiveChannelHistory> {
  const out: LiveChannelHistory = { stable: [], nightly: [] };
  const owner = SLUG_OWNER[slug];
  if (!owner) return out;
  try {
    const releases = await fetchCatalogReleases();
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

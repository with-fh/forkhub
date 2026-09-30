import { OSS_CATALOG } from "@forkhub/api/oss/data";

const CATALOG_RELEASES_URL =
  "https://api.github.com/repos/with-fh/.forkhub/releases?per_page=100";

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

type GhRelease = {
  tag_name: string;
  name: string;
  html_url: string;
  published_at: string;
  assets: { name: string; browser_download_url: string }[];
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
  if (/^t3 code/i.test(r.name) || /t3code/i.test(r.tag_name)) return "t3";
  if (/^natively/i.test(r.name) || /natively/i.test(r.tag_name)) return "natively";
  return null;
}

function toChannel(r: GhRelease): ChannelInfo {
  const appImage = r.assets.find((a) => a.name.endsWith(".AppImage")) ?? null;
  const tgz = r.assets.find((a) => a.name.endsWith(".tgz")) ?? null;
  return {
    version: r.tag_name,
    publishedAt: r.published_at,
    releaseUrl: r.html_url,
    appImageUrl: appImage?.browser_download_url ?? null,
    tgzUrl: tgz?.browser_download_url ?? null,
  };
}

const SLUG_OWNER: Record<string, "t3" | "natively"> = {
  t3code: "t3",
  natively: "natively",
};

// Current stable/nightly builds per OSS entry, derived from the catalog's
// GitHub releases (newest first). Cached for an hour — nightlies publish
// daily, so a day-long cache would serve yesterday's build as "current".
export async function getChannelsFor(slug: string): Promise<LiveChannels> {
  const out: LiveChannels = { stable: null, nightly: null };
  const owner = SLUG_OWNER[slug];
  if (!owner) return out;
  try {
    const res = await fetch(CATALOG_RELEASES_URL, {
      next: { revalidate: 3600 },
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return out;
    const releases = (await res.json()) as GhRelease[];
    for (const r of releases) {
      if (ownerOf(r) !== owner) continue;
      const channel = /nightly/i.test(r.tag_name) ? "nightly" : "stable";
      if (!out[channel]) out[channel] = toChannel(r);
      if (out.stable && out.nightly) break;
    }
  } catch {
    // fall through with nulls; pages render "not published yet" states
  }
  return out;
}

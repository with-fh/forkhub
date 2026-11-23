import { NextResponse } from "next/server";

import { fetchCatalogReleases } from "@/lib/live";

/**
 * Release-notes body proxy for upstream parity: the [slug] page renders the
 * same title + notes the GitHub releases page shows, without exposing a
 * token to the browser. Server-side GitHub API call (cached 1h, same as the
 * catalog fetch), client component fetches by exact version tag.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const version = (url.searchParams.get("version") ?? "").trim();
  if (!version) {
    return NextResponse.json({ body: null }, { status: 400 });
  }
  try {
    const { releases } = await fetchCatalogReleases();
    const hit = releases.find((r) => r.tag_name === version);
    const body =
      hit && typeof (hit as { body?: unknown }).body === "string"
        ? ((hit as { body: string }).body.slice(0, 8000) as string)
        : null;
    return NextResponse.json({ body }, { headers: { "cache-control": "public, max-age=3600" } });
  } catch {
    return NextResponse.json({ body: null });
  }
}

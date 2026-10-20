import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { getOss } from "@forkhub/api/oss/data";

import { getChannelReleases } from "@/lib/live";
import { mergePlatformBuilds, type Arch, type Platform } from "@/lib/releases";

/**
 * Stable always-latest download URLs — no GitHub navigation required.
 *
 *   /download/t3code/latest?channel=nightly
 *   /download/natively/latest?channel=stable&platform=mac&arch=arm64&format=dmg
 *   /download/natively/latest?channel=stable&version=v2.9.2-fh.with-fh.4
 *
 * Resolves to the release asset and 302-redirects to it. 404s (with a
 * plain-text reason, not a GitHub page) when nothing matches.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!getOss(slug)) notFound();

  const url = new URL(req.url);
  const q = (k: string) => url.searchParams.get(k)?.trim() || null;
  const channelParam = (q("channel") ?? "").toLowerCase();
  const channel: "stable" | "nightly" = channelParam === "nightly" ? "nightly" : "stable";
  const channelExplicit = channelParam === "stable" || channelParam === "nightly";
  const platformRaw = (q("platform") ?? "").toLowerCase();
  const archRaw = (q("arch") ?? "").toLowerCase();
  const format = q("format")?.toLowerCase();
  const version = q("version");

  const history = await getChannelReleases(slug);
  // Explicit channel with no builds is a 404 (don't silently serve the
  // other train). Bare /latest defaults to stable, then nightly.
  let list = history[channel];
  if (list.length === 0 && !channelExplicit) {
    list = history.stable.length > 0 ? history.stable : history.nightly;
  }
  const apiNote =
    !history.apiOk && history.apiStatus != null
      ? ` Catalog API said HTTP ${history.apiStatus} — retry shortly.`
      : "";
  if (list.length === 0) {
    return new Response(`No ${channel} builds published yet for ${slug}.${apiNote}`, {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  if (version) {
    const rel = list.find((r) => r.version === version);
    if (!rel) {
      return new Response(`Version ${version} not found in ${channel} for ${slug}.`, {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    list = [rel];
  }

  const normArch: Arch | null =
    archRaw === "arm64" || archRaw === "aarch64"
      ? "arm64"
      : archRaw === "x64" || archRaw === "x86_64" || archRaw === "amd64"
        ? "x64"
        : null;
  const normPlatform: Platform | null =
    platformRaw === "linux"
      ? "linux"
      : platformRaw === "mac" || platformRaw === "macos"
        ? "mac"
        : platformRaw === "windows" || platformRaw === "win"
          ? "windows"
          : null;
  const normFormat = format?.replace(/^\./, "") ?? null;

  const builds = mergePlatformBuilds(list).filter(
    (b) =>
      (!normPlatform || b.platform === normPlatform) &&
      (!normArch || b.arch === normArch) &&
      (!normFormat ||
        b.format.toLowerCase().replace(/^\./, "").includes(normFormat) ||
        normFormat.includes(b.format.toLowerCase().replace(/^\./, ""))),
  );
  if (builds.length === 0) {
    return new Response(
      `No matching build for ${slug} (channel=${channel}${platformRaw ? `, platform=${platformRaw}` : ""}${archRaw ? `, arch=${archRaw}` : ""}${format ? `, format=${format}` : ""}).`,
      { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }
  return NextResponse.redirect(builds[0]!.url);
}

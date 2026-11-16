import { notFound } from "next/navigation";
import { getOss } from "@forkhub/api/oss/data";

import { getStarsMap, getUpstreamReleases } from "@/lib/live";
import GhReleasesPage from "./gh-releases-page";

export function generateStaticParams() {
  return [{ slug: "t3code" }, { slug: "natively" }, { slug: "opendia" }];
}

/**
 * GitHub-releases pixel fork for catalog OSS with an upstream releases
 * page (t3code / natively / opendia). Same Primer look, DOM order, and
 * content as github.com/<owner>/<repo>/releases — global header, repo
 * header, sidebar, release cards with real titles/notes/assets — with
 * ForkHub-catalog download URLs resolving to the patched builds.
 * deepseek-harness keeps its bespoke deepseek.com clone at
 * /download/deepseek-harness (upstream has no releases page).
 */
export default async function GhReleasesForkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug === "deepseek-harness") notFound();
  const e = getOss(slug);
  if (!e) notFound();

  const [starsMap, upstream] = await Promise.all([getStarsMap(), getUpstreamReleases(slug)]);
  const stars = starsMap[slug] ?? e.stars;
  void stars;

  return (
    <GhReleasesPage
      owner={e.upstreamRepo.split("/")[0] ?? ""}
      repo={e.upstreamRepo.split("/")[1] ?? e.slug}
      upstreamReleasesUrl={`${e.upstreamUrl}/releases`}
      catalogReleasesUrl="https://github.com/with-fh/.forkhub/releases"
      releases={upstream.releases}
    />
  );
}

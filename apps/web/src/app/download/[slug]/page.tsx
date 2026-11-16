import { notFound } from "next/navigation";
import { getOss } from "@forkhub/api/oss/data";

import { getUpstreamMeta, getUpstreamReleases } from "@/lib/live";

function compact(n: number | null): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  if (n < 1000) return `${n}`;
  const v = n / 1000;
  return `${v >= 100 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}k`;
}
import GhForkChrome from "./gh-fork-chrome";
import GhForkPage from "./gh-fork-page";
import "./gh-fork.css";

export function generateStaticParams() {
  return [
    { slug: "t3code" },
    { slug: "natively" },
    { slug: "opendia" },
    { slug: "deepseek-harness" },
  ];
}

/**
 * /download/[slug]: GitHub-releases pixel fork for t3code / natively /
 * opendia (same Primer look, DOM order, and live upstream content as
 * github.com/<owner>/<repo>/releases; downloads resolve to catalog
 * builds). deepseek-harness keeps its bespoke deepseek.com chromeless
 * clone (/download/deepseek-harness route) since upstream has no
 * releases page — see apps/web/src/app/download/deepseek-harness/.
 */
export default async function DownloadSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // deepseek-harness has its own bespoke chromeless route; [slug] serves the gh forks.
  if (slug === "deepseek-harness") notFound();
  const e = getOss(slug);
  if (!e) notFound();

  const [{ meta }, upstream] = await Promise.all([
    getUpstreamMeta(slug),
    getUpstreamReleases(slug),
  ]);

  return (
    <GhForkChrome>
      <GhForkPage
        owner={e.upstreamRepo.split("/")[0] ?? ""}
        repo={e.upstreamRepo.split("/")[1] ?? e.slug}
        upstreamReleasesUrl={`${e.upstreamUrl}/releases`}
        releases={upstream.releases}
        issueCount={compact(meta.issues)}
        prCount={compact(meta.pulls)}
      />
    </GhForkChrome>
  );
}

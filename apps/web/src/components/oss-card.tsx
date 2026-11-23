import Link from "next/link";
import type { OssEntry } from "@forkhub/api/oss/data";
import { MAINTAINER_LABEL } from "@forkhub/api/oss/data";

export function formatStars(stars: number): string {
  return stars >= 1000 ? `${(stars / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${stars}`;
}

export default function OssCard({
  entry,
  liveStars,
}: {
  entry: OssEntry;
  liveStars?: number | null;
}) {
  const stars = liveStars ?? entry.stars;
  return (
    <article className="fh-tile fh-oss-card">
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={entry.mark} alt={`${entry.name} logo`} className="fh-oss-logo" loading="lazy" />
        <div>
          <h3>{entry.name}</h3>
          <p className="upstream">{entry.upstream}</p>
        </div>
      </div>
      <p className="tagline">{entry.tagline}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <span className="fh-badge fh-badge-accent">{MAINTAINER_LABEL[entry.maintainer]}</span>
        <span className="fh-badge">
          {entry.patchCount} {entry.patchCount === 1 ? "patch" : "patches"}
        </span>
        <span className="fh-badge">{entry.status}</span>
        <span className="fh-badge">★ {formatStars(stars)}</span>
      </div>
      <div style={{ marginTop: "auto" }}>
        <Link href={`/download/${entry.slug}`} className="fh-btn fh-btn-ghost fh-btn-sm">
          Download {entry.name}
        </Link>
      </div>
    </article>
  );
}

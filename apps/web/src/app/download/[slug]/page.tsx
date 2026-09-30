import Link from "next/link";
import { notFound } from "next/navigation";
import { MAINTAINER_LABEL, OSS_CATALOG, getOss } from "@forkhub/api/oss/data";

import { formatStars } from "@/components/oss-card";

export function generateStaticParams() {
  return OSS_CATALOG.map((e) => ({ slug: e.slug }));
}

export default async function OssDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = getOss(slug);
  if (!e) notFound();

  return (
    <div className="fh-container" style={{ paddingTop: 64, paddingBottom: 96 }}>
      <div style={{ maxWidth: 760 }}>
        <Link
          href="/download"
          style={{
            fontSize: 13,
            color: "var(--t3-fg-muted)",
            textDecoration: "underline",
            textUnderlineOffset: 4,
          }}
        >
          ← All downloads
        </Link>
        <h1
          className="fh-display"
          style={{ fontSize: "clamp(36px, 5vw, 60px)", margin: "16px 0 8px" }}
        >
          {e.name}
        </h1>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--t3-fg-dim)" }}>
          {e.upstream}
        </p>
        <p style={{ color: "var(--t3-fg-muted)", fontSize: 16, marginTop: 12, lineHeight: 1.6 }}>
          {e.description}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
          <span className="fh-badge fh-badge-accent">{MAINTAINER_LABEL[e.maintainer]}</span>
          <span className="fh-badge">{e.status}</span>
          <span className="fh-badge">★ {formatStars(e.stars)}</span>
          <span className="fh-badge">trains: {e.trains.join(", ")}</span>
          <span className="fh-badge">updated {e.updated}</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 20 }}>
          <a
            href={e.upstreamUrl}
            rel="noreferrer"
            target="_blank"
            className="fh-btn fh-btn-ghost fh-btn-sm"
          >
            Upstream repo
          </a>
          <a
            href={e.catalogUrl}
            rel="noreferrer"
            target="_blank"
            className="fh-btn fh-btn-ghost fh-btn-sm"
          >
            Patch catalog
          </a>
        </div>

        <div className="fh-tile" style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Use it</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {e.install.map((cmd) => (
              <pre
                key={cmd}
                className="fh-term-body"
                style={{ margin: 0, padding: "12px 14px", fontSize: 12 }}
              >
                <span className="prompt">$</span>
                {cmd}
              </pre>
            ))}
          </div>
        </div>

        <h2 className="fh-display" style={{ fontSize: 24, marginTop: 40, marginBottom: 16 }}>
          Patches ({e.patches.length})
        </h2>
        <div style={{ display: "grid", gap: 12 }}>
          {e.patches.map((p) => (
            <div key={p.id} className="fh-tile" style={{ padding: 20 }}>
              <p style={{ fontSize: 15, fontWeight: 600 }}>{p.title}</p>
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--t3-fg-dim)",
                  marginTop: 4,
                }}
              >
                {p.id}
              </p>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 12,
                  alignItems: "center",
                }}
              >
                <span className="fh-badge">{p.status}</span>
                <span className="fh-badge">v{p.version}</span>
                <a
                  href={p.intentUrl}
                  rel="noreferrer"
                  target="_blank"
                  className="fh-btn fh-btn-ghost fh-btn-sm"
                >
                  Read INTENT.md
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

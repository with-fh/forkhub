import Link from "next/link";
import { notFound } from "next/navigation";
import { MAINTAINER_LABEL, OSS_CATALOG, getOss } from "@forkhub/api/oss/data";

import { formatStars } from "@/components/oss-card";
import { getChannelReleases, getStarsMap } from "@/lib/live";
import DownloadPanel from "./download-panel";

export function generateStaticParams() {
  return OSS_CATALOG.map((e) => ({ slug: e.slug }));
}

export default async function OssDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = getOss(slug);
  if (!e) notFound();

  const [starsMap, history] = await Promise.all([getStarsMap(), getChannelReleases(slug)]);
  const stars = starsMap[slug] ?? e.stars;
  // Only entries with a registry package support managed `fh run` installs.
  const runCmds =
    slug === "t3code"
      ? (["stable", "nightly"] as const).map((channel) => ({
          channel,
          label: `fh run (${channel})`,
          command: `fh run t3 with-fh${channel === "stable" ? " -c stable" : ""} -- --version`,
        }))
      : [];
  const reuseCmd = e.install.find((c) => c.startsWith("fh reuse")) ?? null;

  return (
    <div className="fh-container" style={{ paddingTop: 64, paddingBottom: 96 }}>
      <div style={{ maxWidth: 800 }}>
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
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={e.mark}
            alt={`${e.name} logo`}
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              border: "1px solid var(--t3-border)",
            }}
          />
          <div>
            <h1 className="fh-display" style={{ fontSize: "clamp(36px, 5vw, 56px)" }}>
              {e.name}
            </h1>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--t3-fg-dim)" }}>
              {e.upstream}
            </p>
          </div>
        </div>
        <p style={{ color: "var(--t3-fg-muted)", fontSize: 16, marginTop: 12, lineHeight: 1.6 }}>
          {e.description}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
          <span className="fh-badge fh-badge-accent">{MAINTAINER_LABEL[e.maintainer]}</span>
          <span className="fh-badge">{e.status}</span>
          <span className="fh-badge">★ {formatStars(stars)} upstream</span>
          <span className="fh-badge">trains: {e.trains.join(", ")}</span>
        </div>

        <h2 className="fh-display" style={{ fontSize: 24, marginTop: 40, marginBottom: 6 }}>
          Download
        </h2>
        <p style={{ color: "var(--t3-fg-muted)", fontSize: 14, marginBottom: 16 }}>
          Pick a channel, then a version. Stable tracks tested releases, nightly tracks the latest
          upstream with patches re-derived daily. Every button downloads directly — no GitHub
          hunting.
        </p>
        <DownloadPanel slug={slug} entryName={e.name} history={history} curlCommands={runCmds} />

        <div className="fh-tile" style={{ marginTop: 16, padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>Other platforms</h3>
          <p style={{ fontSize: 13, color: "var(--t3-fg-muted)", marginTop: 8, lineHeight: 1.6 }}>
            Outside Linux, macOS, and Windows builds above, run from the{" "}
            <a
              href={e.upstreamUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                color: "var(--t3-fg)",
                textDecoration: "underline",
                textUnderlineOffset: 4,
              }}
            >
              upstream source
            </a>{" "}
            for now — then point it at the patch catalog below if you want the ForkHub track.
          </p>
        </div>

        {reuseCmd && (
          <div className="fh-tile" style={{ marginTop: 16, padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>Fork this patch instead</h3>
            <p style={{ fontSize: 13, color: "var(--t3-fg-muted)", marginTop: 8, lineHeight: 1.6 }}>
              Only reach for this if you want to modify the intent and rebuild it yourself. Just
              want the app? The downloads above are enough.
            </p>
            <pre
              className="fh-term-body"
              style={{ margin: "12px 0 0", padding: "12px 14px", fontSize: 12 }}
            >
              <span className="prompt">$</span>
              {reuseCmd}
            </pre>
          </div>
        )}

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
                <span className="fh-badge">rev {p.version}</span>
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

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 32 }}>
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
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { MAINTAINER_LABEL, OSS_CATALOG, getOss } from "@forkhub/api/oss/data";

import { formatStars } from "@/components/oss-card";
import { getChannelsFor, getStarsMap, type ChannelInfo } from "@/lib/live";

export function generateStaticParams() {
  return OSS_CATALOG.map((e) => ({ slug: e.slug }));
}

function shortDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function ChannelCard({
  channel,
  info,
  installCmd,
  entryName,
}: {
  channel: "Stable" | "Nightly";
  info: ChannelInfo | null;
  installCmd: string | null;
  entryName: string;
}) {
  if (!info) {
    return (
      <div
        className="fh-tile"
        style={{ borderStyle: "dashed", opacity: 0.75, padding: 20 }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>{channel}</h3>
        <p style={{ fontSize: 13, color: "var(--t3-fg-muted)", marginTop: 8, lineHeight: 1.6 }}>
          No {channel.toLowerCase()} build published yet for {entryName}. Watch the{" "}
          <a
            href="https://github.com/with-fh/.forkhub/releases"
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--t3-fg)", textDecoration: "underline", textUnderlineOffset: 4 }}
          >
            catalog releases
          </a>
          .
        </p>
      </div>
    );
  }
  return (
    <div className="fh-tile" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>{channel}</h3>
        <code
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--t3-accent)",
            wordBreak: "break-all",
          }}
        >
          {info.version}
        </code>
      </div>
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--t3-fg-dim)",
          marginTop: 4,
        }}
      >
        published {shortDate(info.publishedAt)}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
        {info.appImageUrl && (
          <a href={info.appImageUrl} className="fh-btn fh-btn-primary fh-btn-sm">
            Download AppImage
          </a>
        )}
        <a
          href={info.releaseUrl}
          target="_blank"
          rel="noreferrer"
          className="fh-btn fh-btn-ghost fh-btn-sm"
        >
          Release notes
        </a>
      </div>
      {installCmd && (
        <pre
          className="fh-term-body"
          style={{ margin: "14px 0 0", padding: "12px 14px", fontSize: 12 }}
        >
          <span className="prompt">$</span>
          {installCmd}
        </pre>
      )}
    </div>
  );
}

export default async function OssDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = getOss(slug);
  if (!e) notFound();

  const [starsMap, channels] = await Promise.all([getStarsMap(), getChannelsFor(slug)]);
  const stars = starsMap[slug] ?? e.stars;
  // Only entries with a registry package support managed `fh run` installs.
  const runCmd =
    slug === "t3code"
      ? (channel: "stable" | "nightly") =>
          `fh run t3 with-fh${channel === "stable" ? " -c stable" : ""} -- --version`
      : null;
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
            style={{ width: 56, height: 56, borderRadius: 14, border: "1px solid var(--t3-border)" }}
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
          Pick a channel. Stable tracks tested releases, nightly tracks the latest upstream with
          patches re-derived daily.
        </p>
        <div className="fh-grid-2">
          <ChannelCard
            channel="Stable"
            info={channels.stable}
            installCmd={runCmd?.("stable") ?? null}
            entryName={e.name}
          />
          <ChannelCard
            channel="Nightly"
            info={channels.nightly}
            installCmd={runCmd?.("nightly") ?? null}
            entryName={e.name}
          />
        </div>

        <div className="fh-tile" style={{ marginTop: 16, padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>Other platforms</h3>
          <p style={{ fontSize: 13, color: "var(--t3-fg-muted)", marginTop: 8, lineHeight: 1.6 }}>
            Published builds are Linux (x86_64 AppImage). On macOS or Windows, run from the{" "}
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
                style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, alignItems: "center" }}
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

"use client";

import { useMemo, useState } from "react";

import {
  formatBytes,
  mergePlatformBuilds,
  newestShaUrl,
  type ChannelRelease,
  type Platform,
  type PlatformBuild,
} from "@/lib/releases";

export type ChannelHistory = {
  stable: ChannelRelease[];
  nightly: ChannelRelease[];
};

const PLATFORM_LABEL: Record<Platform, string> = {
  linux: "Linux",
  mac: "macOS",
  windows: "Windows",
  source: "Source code",
};

const KIND_LABEL: Record<PlatformBuild["kind"], string> = {
  installer: "Installer",
  portable: "Portable",
  archive: "Archive",
  package: "Package",
};

function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 10);
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      className="fh-btn fh-btn-ghost fh-btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function AssetCard({ build, showFrom }: { build: PlatformBuild; showFrom: boolean }) {
  const size = formatBytes(build.size);
  return (
    <div className="fh-tile" style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14 }}>
          {build.arch === "arm64" ? "ARM64" : "x64"} {build.format}
        </strong>
        <span className="fh-badge">{KIND_LABEL[build.kind]}</span>
        {size && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--t3-fg-dim)" }}>
            {size}
          </span>
        )}
      </div>
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--t3-fg-dim)",
          marginTop: 6,
          wordBreak: "break-all",
        }}
        title={build.name}
      >
        {build.name}
      </p>
      {showFrom && build.fromVersion && (
        <p style={{ fontSize: 11, color: "var(--t3-fg-dim)", marginTop: 4 }}>
          from{" "}
          <a
            href={build.fromReleaseUrl}
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: "underline", textUnderlineOffset: 4 }}
          >
            <code style={{ fontFamily: "var(--font-mono)", color: "var(--t3-accent)" }}>
              {build.fromVersion}
            </code>
          </a>
        </p>
      )}
      <div style={{ marginTop: 12 }}>
        <a href={build.url} className="fh-btn fh-btn-primary fh-btn-sm" download>
          Download
        </a>
      </div>
    </div>
  );
}

export default function DownloadPanel({
  slug,
  entryName,
  history,
  curlCommands,
}: {
  slug: string;
  entryName: string;
  history: ChannelHistory;
  /** Per-channel one-liner, e.g. fh run … — rendered under Terminal. */
  curlCommands: { channel: "stable" | "nightly"; label: string; command: string }[];
}) {
  const channels = (["stable", "nightly"] as const).filter((c) => history[c].length > 0);
  const [channel, setChannel] = useState<"stable" | "nightly">(
    history.stable.length > 0 ? "stable" : "nightly",
  );
  const [version, setVersion] = useState<string>("latest");
  const activeChannel: "stable" | "nightly" = channels.includes(channel)
    ? channel
    : (channels[0] ?? "stable");
  const releases = history[activeChannel];

  const selected: ChannelRelease | null = useMemo(() => {
    if (version === "latest" || releases.length === 0) return null;
    return releases.find((r) => r.version === version) ?? null;
  }, [version, releases]);

  const builds: PlatformBuild[] = useMemo(() => {
    if (selected) {
      return selected.assets.map((a) => ({
        ...a,
        fromVersion: selected.version,
        fromReleaseUrl: selected.releaseUrl,
      }));
    }
    return mergePlatformBuilds(releases);
  }, [selected, releases]);

  const grouped = useMemo(() => {
    const out = new Map<Platform, PlatformBuild[]>();
    for (const b of builds) {
      const list = out.get(b.platform) ?? [];
      list.push(b);
      out.set(b.platform, list);
    }
    return (["linux", "mac", "windows", "source"] as Platform[])
      .filter((p) => out.has(p))
      .map((p) => [p, out.get(p)!] as const);
  }, [builds]);

  const shaUrl = selected?.shaUrl ?? newestShaUrl(releases);
  const latestRoute = (extra = "") => `/download/${slug}/latest?channel=${activeChannel}${extra}`;
  const shownVersion = selected?.version ?? releases[0]?.version ?? null;

  if (channels.length === 0) {
    return (
      <div className="fh-tile" style={{ borderStyle: "dashed", opacity: 0.75, padding: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>No builds published yet</h3>
        <p style={{ fontSize: 13, color: "var(--t3-fg-muted)", marginTop: 8, lineHeight: 1.6 }}>
          No stable or nightly build published yet for {entryName}. Watch the{" "}
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
    <div>
      <div
        role="tablist"
        aria-label="Release channel"
        style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
      >
        {(["stable", "nightly"] as const).map((c) =>
          history[c].length > 0 ? (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={activeChannel === c}
              onClick={() => {
                setChannel(c);
                setVersion("latest");
              }}
              className={`fh-btn fh-btn-sm ${activeChannel === c ? "fh-btn-primary" : "fh-btn-ghost"}`}
              style={{ textTransform: "capitalize" }}
            >
              {c}
            </button>
          ) : null,
        )}
        <label
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            fontSize: 13,
            color: "var(--t3-fg-muted)",
            marginLeft: 4,
          }}
        >
          Version
          <select
            aria-label="Version"
            className="fh-select"
            value={selected?.version ?? "latest"}
            onChange={(e) => setVersion(e.target.value)}
          >
            <option value="latest">Latest{releases[0] ? ` (${releases[0].version})` : ""}</option>
            {releases.map((r) => (
              <option key={r.version} value={r.version}>
                {r.version} · {shortDate(r.publishedAt)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {shownVersion && (
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--t3-fg-muted)",
            marginTop: 12,
          }}
        >
          {selected ? "Showing" : "Latest"} {activeChannel}:{" "}
          <code style={{ color: "var(--t3-accent)", wordBreak: "break-all" }}>{shownVersion}</code>{" "}
          · published {shortDate((selected ?? releases[0])!.publishedAt)} ·{" "}
          <a
            href={(selected ?? releases[0])!.releaseUrl}
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--t3-fg)", textDecoration: "underline", textUnderlineOffset: 4 }}
          >
            Release notes
          </a>
          {shaUrl && (
            <>
              {" "}
              ·{" "}
              <a
                href={shaUrl}
                style={{
                  color: "var(--t3-fg)",
                  textDecoration: "underline",
                  textUnderlineOffset: 4,
                }}
              >
                SHA256SUMS
              </a>
            </>
          )}
        </p>
      )}

      {grouped.length === 0 ? (
        <div
          className="fh-tile"
          style={{ borderStyle: "dashed", opacity: 0.75, padding: 20, marginTop: 16 }}
        >
          <p style={{ fontSize: 13, color: "var(--t3-fg-muted)", lineHeight: 1.6 }}>
            This release carries no desktop downloads
            {selected ? ` (${selected.version})` : ""}. Pick another version above, or read the{" "}
            <a
              href={(selected ?? releases[0])?.releaseUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--t3-fg)", textDecoration: "underline", textUnderlineOffset: 4 }}
            >
              release notes
            </a>
            .
          </p>
        </div>
      ) : (
        grouped.map(([platform, cards]) => (
          <section key={platform} style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
              {PLATFORM_LABEL[platform]}
            </h3>
            <div className="fh-grid-2">
              {cards.map((b) => (
                <AssetCard
                  key={`${b.platform}/${b.arch}/${b.format}/${b.name}`}
                  build={b}
                  showFrom={!selected && b.fromVersion !== releases[0]?.version}
                />
              ))}
            </div>
          </section>
        ))
      )}

      <div className="fh-tile" style={{ marginTop: 24, padding: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>Terminal</h3>
        <p style={{ fontSize: 13, color: "var(--t3-fg-muted)", marginTop: 8, lineHeight: 1.6 }}>
          Always-latest links — no GitHub hunting. Pin a version by adding{" "}
          <code style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>&version=…</code> (see the
          picker above).
        </p>
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
          >
            <code style={{ fontFamily: "var(--font-mono)", fontSize: 12, wordBreak: "break-all" }}>
              curl -fsSL https://forkhub.imbios.dev{latestRoute()} -O
            </code>
            <CopyButton
              text={`curl -fsSL https://forkhub.imbios.dev${latestRoute()} -O`}
              label="Copy latest download command"
            />
          </div>
          {curlCommands
            .filter((c) => c.channel === activeChannel)
            .map((c) => (
              <div
                key={c.command}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                }}
              >
                <code
                  style={{ fontFamily: "var(--font-mono)", fontSize: 12, wordBreak: "break-all" }}
                >
                  <span className="prompt">$</span>
                  {c.command}
                </code>
                <CopyButton text={c.command} label={`Copy ${c.label} command`} />
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

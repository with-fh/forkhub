"use client";

import { useMemo, useState } from "react";

import type { DownloadAsset } from "@/lib/releases";
import type { UpstreamRelease } from "@/lib/live";
import { formatBytes } from "@/lib/releases";
import "./gh-markdown.css";

/**
 * Upstream GitHub-releases pixel fork for /download/[slug]: same DOM order, copy, structure,
 * and behavior as github.com/<owner>/<repo>/releases — global header, repo header, repo tabs,
 * sidebar (Releases/Tags + per-release anchor list), release cards (title, Pre-release label,
 * author line, tag/commit links, full notes body, asset list). Asset downloads resolve to
 * ForkHub catalog builds (same filenames as upstream); all other links are upstream URLs.
 */

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} months ago`;
  return `${Math.floor(months / 12)} years ago`;
}

function shortTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return timeAgo(iso);
  return `${d.getDate()} ${d.toLocaleString("en-US", { month: "short" })} ${`${d.getHours()}`.padStart(2, "0")}:${`${d.getMinutes()}`.padStart(2, "0")}`;
}

function absoluteTitle(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function AssetRow({ asset }: { asset: DownloadAsset }) {
  const size = formatBytes(asset.size);
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 0",
        borderTop: "1px solid var(--gh-border-muted)",
        fontSize: 14,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/gh/file-icon.svg"
        alt=""
        aria-hidden="true"
        width={16}
        height={16}
        style={{ flex: "none", opacity: 0.7 }}
      />
      <a
        href={asset.url}
        style={{ color: "var(--gh-fg-accent)", textDecoration: "none", wordBreak: "break-all" }}
      >
        {asset.name}
      </a>
      {size && <span style={{ color: "var(--gh-fg-muted)", fontSize: 12 }}>{size}</span>}
    </li>
  );
}

function ReleaseCard({ release }: { release: UpstreamRelease }) {
  const [assetsOpen, setAssetsOpen] = useState(false);
  return (
    <section
      id={`release-${release.tag}`}
      aria-label={release.name}
      className="gh-release-card"
      style={{ scrollMarginTop: 24 }}
    >
      <h2 className="sr-only">{release.name}</h2>
      <div className="gh-box">
        <div className="gh-box-body">
          <div className="gh-release-head">
            <div className="gh-compare">
              <button
                type="button"
                className="gh-compare-btn"
                aria-haspopup="dialog"
                aria-expanded="false"
              >
                <span>Compare</span>
                <svg
                  aria-hidden="true"
                  height="16"
                  viewBox="0 0 16 16"
                  width="16"
                  fill="currentColor"
                >
                  <path d="m4.427 7.427 3.396 3.396a.25.25 0 0 1 0 .354l-3.396 3.396A.25.25 0 0 1 4.604 7H4.604a.25.25 0 0 1-.177-.427Z" />
                </svg>
              </button>
            </div>
            <div className="gh-release-titlewrap">
              <span className="gh-release-title">
                <a href={release.tagUrl} className="gh-link-primary">
                  {release.name}
                </a>
              </span>
              <span>
                {release.prerelease ? <span className="gh-label-warning">Pre-release</span> : null}
                {release.latest && !release.prerelease ? (
                  <span className="gh-label-success">Latest</span>
                ) : null}
              </span>
            </div>
          </div>
          <div className="gh-release-meta">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {release.authorAvatar ? (
              <img
                src={release.authorAvatar}
                alt={release.authorLogin}
                width={20}
                height={20}
                style={{ borderRadius: "50%" }}
              />
            ) : null}
            <a href={release.authorUrl} className="gh-link-muted gh-author-link">
              {release.authorLogin}
            </a>
            <span>
              released this{" "}
              <relative-time
                className="no-wrap"
                prefix=""
                dateTime={release.publishedAt}
                title={absoluteTitle(release.publishedAt)}
              >
                {shortTime(release.publishedAt)}
              </relative-time>
            </span>
            <a href={release.tagUrl} className="gh-link-muted gh-tag-link">
              {release.tag}
            </a>
            {release.commitSha ? (
              <a href={release.commitUrl} className="gh-link-muted">
                {release.commitSha.slice(0, 7)}
              </a>
            ) : null}
          </div>
          <div
            className="gh-release-notes markdown-body tmp-my-3"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: release.bodyHtml }}
          />
          {release.assets.length > 0 ? (
            <div className="gh-assets">
              <button
                type="button"
                className="gh-assets-toggle"
                onClick={() => setAssetsOpen((v) => !v)}
                aria-expanded={assetsOpen}
              >
                Assets ({release.assets.length})
              </button>
              {assetsOpen && (
                <ul className="gh-asset-list">
                  {release.assets.map((a) => (
                    <AssetRow key={a.url} asset={a} />
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default function GhForkPage({
  owner,
  repo,
  upstreamReleasesUrl,
  releases,
  issueCount,
  prCount,
}: {
  owner: string;
  repo: string;
  upstreamReleasesUrl: string;
  releases: UpstreamRelease[];
  issueCount: string | null;
  prCount: string | null;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return releases;
    return releases.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.tag.toLowerCase().includes(q) ||
        r.body.toLowerCase().includes(q),
    );
  }, [releases, query]);
  return (
    <div className="gh-fork gh-fork-scope">
      <header className="gh-global-header">
        <a href="https://github.com" className="gh-global-logo" aria-label="GitHub homepage">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/gh/github-mark-white.svg" alt="" width={32} height={32} />
        </a>
        <nav className="gh-global-nav" aria-label="Global">
          {["Products", "Developers", "Businesses", "Resources", "Pricing"].map((t) => (
            <a key={t} href="https://github.com" className="gh-global-link">
              {t}
            </a>
          ))}
        </nav>
        <div className="gh-global-search" role="search">
          <span>Search</span>
          <kbd>/</kbd>
        </div>
        <a href="https://github.com/login" className="gh-signin">
          Sign in
        </a>
        <a href="https://github.com/signup" className="gh-signup">
          Sign up
        </a>
      </header>

      <div className="gh-repohead">
        <nav className="gh-crumbs" aria-label="Breadcrumbs">
          <a href={`https://github.com/${owner}`}>{owner}</a>
          <span> / </span>
          <a href={`https://github.com/${owner}/${repo}`} className="gh-crumb-repo">
            {repo}
          </a>
        </nav>
        <nav className="gh-tabs" aria-label="Repository">
          {(
            [
              { label: "Code", count: null },
              { label: "Issues", count: issueCount },
              { label: "Pull requests", count: prCount },
              { label: "Discussions", count: null },
              { label: "Actions", count: null },
              { label: "Security and quality", count: null },
              { label: "Insights", count: null },
            ] as { label: string; count: string | null }[]
          ).map((t) => (
            <a key={t.label} href={`https://github.com/${owner}/${repo}`} className="gh-tab">
              {t.label}
              {t.count != null ? (
                <>
                  {" "}
                  <span className="gh-tab-count">{t.count}</span>
                </>
              ) : null}
            </a>
          ))}
        </nav>
      </div>

      <div className="gh-layout">
        <aside className="gh-sidebar">
          <nav aria-label="Releases and tags">
            <a href={upstreamReleasesUrl} className="gh-side-active">
              Releases
            </a>
            <a href={`${upstreamReleasesUrl.replace(/\/releases\/?$/, "/tags")}`}>Tags</a>
            <h2>On this page</h2>
            <ul className="gh-anchor-list">
              {filtered.map((r) => (
                <li key={r.tag}>
                  <a href={`#release-${r.tag}`} title={r.name}>
                    {r.name}
                  </a>
                </li>
              ))}
            </ul>
            <button type="button" className="gh-collapse-btn" aria-expanded="true">
              Collapse sidebar
            </button>
          </nav>
        </aside>

        <main className="gh-main">
          <div className="gh-releases-head">
            <h1>Releases</h1>
            <div className="gh-find">
              <input
                type="search"
                aria-label="Find a release"
                placeholder="Find a release"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="gh-results">
            {filtered.map((r) => (
              <ReleaseCard key={r.tag} release={r} />
            ))}
            {filtered.length === 0 ? <p>No releases match “{query}”.</p> : null}
          </div>
        </main>
      </div>
    </div>
  );
}

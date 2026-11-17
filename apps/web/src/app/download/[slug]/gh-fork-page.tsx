"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { DownloadAsset } from "@/lib/releases";
import type { UpstreamRelease } from "@/lib/live";
import { formatBytes } from "@/lib/releases";
import "./gh-markdown.css";

/**
 * Upstream GitHub-releases pixel fork for /download/[slug]: same DOM order, copy, structure,
 * and behavior as github.com/<owner>/<repo>/releases — global header, repo header, repo tabs
 * (with octicon glyphs + Code selected underline), breadcrumbs, sidebar (Releases/Tags +
 * per-release anchor list), release cards (title, Pre-release label, author line, tag/commit
 * links, full notes body, asset list). Asset downloads resolve to ForkHub catalog builds
 * (same filenames as upstream); all other links are upstream URLs.
 */

const OCTICONS: Record<string, string> = {
  code: "m11.28 3.22 4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L13.94 8l-3.72-3.72a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215Zm-6.56 0a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L2.06 8l3.72 3.72a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L.47 8.53a.75.75 0 0 1 0-1.06Z",
  issues:
    "M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z",
  pulls:
    "M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z",
  discussions:
    "M1.75 1h8.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 10.25 10H7.061l-2.574 2.573A1.458 1.458 0 0 1 2 11.543V10h-.25A1.75 1.75 0 0 1 0 8.25v-5.5C0 1.784.784 1 1.75 1ZM1.5 2.75v5.5c0 .138.112.25.25.25h1a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h3.5a.25.25 0 0 0 .25-.25v-5.5a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25Zm5.28 2.47 2.5 2.5a.75.75 0 0 1-1.06 1.06l-2.5-2.5a.75.75 0 0 1 1.06-1.06Z",
  actions:
    "M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm4.879-2.773 4.264 2.559a.25.25 0 0 1 0 .428l-4.264 2.559A.25.25 0 0 1 6 10.559V5.442a.25.25 0 0 1 .379-.215Z",
  security:
    "M7.467.133a1.748 1.748 0 0 1 1.066 0l5.25 1.68A1.75 1.75 0 0 1 15 3.48V7c0 1.566-.32 3.182-1.303 4.682-.983 1.498-2.585 2.813-5.032 3.855a1.697 1.697 0 0 1-1.33 0c-2.447-1.042-4.049-2.357-5.032-3.855C1.32 10.182 1 8.566 1 7V3.48a1.75 1.75 0 0 1 1.217-1.667Zm.61 1.429a.25.25 0 0 0-.153 0l-5.25 1.68a.25.25 0 0 0-.174.238V7c0 1.358.275 2.666 1.057 3.86.7 1.067 1.836 2.008 3.725 2.804a.25.25 0 0 0 .196 0c1.889-.796 3.025-1.737 3.725-2.804.782-1.194 1.057-2.502 1.057-3.86V3.48a.25.25 0 0 0-.174-.238l-5.25-1.68ZM8 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7ZM8 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z",
  insights:
    "M1.5 1.75V13.5h13.75a.75.75 0 0 1 0 1.5H.75a.75.75 0 0 1-.75-.75V1.75a.75.75 0 0 1 1.5 0Zm14.28 2.53-5.25 5.25a.75.75 0 0 1-1.06 0L7 7.06 4.28 9.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.25-3.25a.75.75 0 0 1 1.06 0L10 7.94l4.72-4.72a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z",
};

function Octicon({ name }: { name: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      height={16}
      viewBox="0 0 16 16"
      width={16}
      fill="currentColor"
      style={{ verticalAlign: "text-bottom" }}
    >
      <path d={OCTICONS[name]} />
    </svg>
  );
}

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
  // UTC, matching github.com server-rendered <relative-time> fallback
  // text ("16 Nov 14:05"); server-local tz would shift the visible time.
  const mon = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${d.getUTCDate()} ${mon} ${`${d.getUTCHours()}`.padStart(2, "0")}:${`${d.getUTCMinutes()}`.padStart(2, "0")}`;
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
    timeZone: "UTC",
  });
}

// Post-hydration upgrade of the server-rendered absolute timestamp to
// GitHub's live relative text ("3 hours ago", "yesterday", "on Oct 8").
// React keeps rendering the plain <time> fallback (identical tag, attrs,
// and text to github.com server HTML — hence hydration-safe); this hook
// only mutates textContent via the DOM API using GitHub's own published
// element, so there is no custom-element JSX for React to reconcile.
// A re-render (e.g. filter change) restores server text and the effect
// re-applies the upgrade. Failures keep the absolute fallback.
let relativeTimeModule: Promise<unknown> | null = null;

function useRelativeTime(iso: string) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        relativeTimeModule ??= import("@github/relative-time-element");
        await relativeTimeModule;
        if (cancelled) return;
        const node = ref.current;
        if (!node || typeof document === "undefined") return;
        const probe = document.createElement("relative-time");
        probe.setAttribute("datetime", iso);
        probe.setAttribute("threshold", "PT0S");
        document.body.appendChild(probe);
        const rendered = (probe.shadowRoot?.textContent ?? "").trim();
        probe.remove();
        if (!cancelled && rendered !== "" && node.textContent !== rendered) {
          node.textContent = rendered;
        }
      } catch {
        // keep server-rendered absolute fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [iso]);
  return ref;
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

function ContributorsBlock({ body }: { body: string }) {
  const users = useMemo(() => {
    const seen = new Map<string, string>();
    for (const m of body.matchAll(/@([A-Za-z0-9-]+)/g)) {
      if (!seen.has(m[1]!)) seen.set(m[1]!, `https://github.com/${m[1]}`);
    }
    return [...seen.entries()].slice(0, 12);
  }, [body]);
  if (users.length === 0) return null;
  return (
    <div className="gh-contributors">
      <h3>Contributors</h3>
      <ul>
        {users.map(([login, url]) => (
          <li key={login}>
            <a href={url} aria-label={login}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://avatars.githubusercontent.com/${login}?s=64&v=4`}
                alt={`@${login}`}
                width={32}
                height={32}
              />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReleaseCard({ release }: { release: UpstreamRelease }) {
  const [assetsOpen, setAssetsOpen] = useState(false);
  const timeRef = useRelativeTime(release.publishedAt);
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
              {release.compareUrl ? (
                <a href={release.compareUrl} className="gh-compare-btn" aria-haspopup="dialog">
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
                </a>
              ) : null}
            </div>
            <div className="gh-release-titlewrap">
              <span className="gh-release-title">
                <a href={release.tagUrl} className="gh-link-primary">
                  {release.name}
                </a>
              </span>
              <span>
                {release.prerelease ? <span className="gh-label-warning">Pre-release</span> : null}
              </span>
            </div>
          </div>
          <div className="gh-release-meta">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {release.authorAvatar ? (
              <img
                src={release.authorAvatar}
                alt={`@${release.authorLogin}`}
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
              <span
                ref={timeRef}
                className="no-wrap"
                data-relative-time={release.publishedAt}
                title={absoluteTitle(release.publishedAt)}
              >
                {shortTime(release.publishedAt)}
              </span>
            </span>
            <a href={release.tagUrl} className="gh-link-muted gh-tag-link">
              <svg
                aria-label="Tag"
                role="img"
                height={16}
                viewBox="0 0 16 16"
                version="1.1"
                width={16}
                fill="currentColor"
                style={{ verticalAlign: "text-bottom" }}
              >
                <path d="M1 7.775V2.75C1 1.784 1.784 1 2.75 1h5.025c.464 0 .91.184 1.238.513l6.25 6.25a1.75 1.75 0 0 1 0 2.474l-5.026 5.026a1.75 1.75 0 0 1-2.474 0l-6.25-6.25A1.752 1.752 0 0 1 1 7.775Zm1.5 0c0 .066.026.13.073.177l6.25 6.25a.25.25 0 0 0 .354 0l5.025-5.025a.25.25 0 0 0 0-.354l-6.25-6.25a.25.25 0 0 0-.177-.073H2.75a.25.25 0 0 0-.25.25ZM6 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
              </svg>
              <span style={{ marginLeft: 4 }}>{release.tag}</span>
            </a>
            {release.commitSha ? (
              <a
                href={release.commitUrl}
                className="gh-link-muted gh-commit-link"
                data-hovercard-type="commit"
              >
                <span className="gh-commit-sha">{release.commitSha.slice(0, 7)}</span>
              </a>
            ) : null}
          </div>
          <div
            className="gh-release-notes markdown-body tmp-my-3"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: release.bodyHtml }}
          />
          <ContributorsBlock body={release.body} />
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
              { label: "Code", count: null, icon: "code", selected: true },
              { label: "Issues", count: issueCount, icon: "issues", selected: false },
              { label: "Pull requests", count: prCount, icon: "pulls", selected: false },
              { label: "Discussions", count: null, icon: "discussions", selected: false },
              { label: "Actions", count: null, icon: "actions", selected: false },
              { label: "Security and quality", count: null, icon: "security", selected: false },
              { label: "Insights", count: null, icon: "insights", selected: false },
            ] as { label: string; count: string | null; icon: string; selected: boolean }[]
          ).map((t) => (
            <a
              key={t.label}
              href={`https://github.com/${owner}/${repo}`}
              className={t.selected ? "gh-tab gh-tab-selected" : "gh-tab"}
              aria-current={t.selected ? "page" : undefined}
            >
              <span className="gh-tab-icon">
                <Octicon name={t.icon} />
              </span>
              <span>{t.label}</span>
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

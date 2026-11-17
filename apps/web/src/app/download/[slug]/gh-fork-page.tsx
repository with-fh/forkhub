"use client";

import { useMemo, useState } from "react";

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
  tag: "M1 7.775V2.75C1 1.784 1.784 1 2.75 1h5.025c.464 0 .91.184 1.238.513l6.25 6.25a1.75 1.75 0 0 1 0 2.474l-5.026 5.026a1.75 1.75 0 0 1-2.474 0l-6.25-6.25A1.752 1.752 0 0 1 1 7.775Zm1.5 0c0 .066.026.13.073.177l6.25 6.25a.25.25 0 0 0 .354 0l5.025-5.025a.25.25 0 0 0 0-.354l-6.25-6.25a.25.25 0 0 0-.177-.073H2.75a.25.25 0 0 0-.25.25ZM6 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z",
  release:
    "M5 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm7.5-.75a.75.75 0 0 1 .75.75v7.19c0 .138-.112.25-.25.25H9.5a.75.75 0 0 1 0-1.5h2.75V4.75h-6.5v6.44h2.75a.75.75 0 0 1 0 1.5H5.5A1.75 1.75 0 0 1 3.75 11V4a.75.75 0 0 1 .75-.75h8ZM8.06 2.446A1.75 1.75 0 0 1 10.63.587l2.073 2.073a.75.75 0 0 1-1.061 1.061L10.13 2.209A.25.25 0 0 0 9.953 2.16h-.361a.75.75 0 0 1-.566-.26l-.967-1.048a.25.25 0 0 0-.18-.086H7.72a.75.75 0 0 1-.66-1.097l.001-.224c-.34.05-.68.08-1.02.08Z",
  verified:
    "M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM5.496 6.527a.748.748 0 0 1 .583-.219 1 1 0 0 1 .037.117l.006.015.011.026.067.156.09.165c.155.246.415.472.839.622c.109.038.227.071.348.099l.083.02.063.015.016.004c.096.024.192.048.285.076c.11.034.215.071.312.113a1.75 1.75 0 0 1 .593.524c.124.172.208.385.208.624c0 .176-.05.343-.136.486c-.086.142-.205.263-.344.359a2.653 2.653 0 0 1-.63.327c-.297.111-.62.183-.952.231l-.055.011a1.246 1.246 0 0 1-.079.013l-.004-1.923a.749.749 0 0 1-.752-.749l.002-1.173a.748.748 0 0 1 .166-.471l.002.556Zm3.74 2.695a.749.749 0 0 1 .75.749c0 .414-.336.75-.75.75h-.389c.07.125.113.27.119.421h.268a.75.75 0 0 1 .005 1.5h-.135l-.125.008c-.255.028-.51.078-.74.148a3.007 3.007 0 0 0-.203.073l-.06.025-.084.037-.043.021c-.123.064-.231.135-.323.216a1.433 1.433 0 0 0-.245.357c-.045.106-.067.219-.067.334c0 .119.025.23.066.33c.045.113.11.215.19.302c.09.099.2.185.328.256c.15.084.323.15.51.202c.131.037.268.068.409.093l.126.022v.019a.75.75 0 0 1 1.5-.004l-.002-.052c-.021-.437-.169-.829-.392-1.149a3.227 3.227 0 0 0-.759-.763c-.233-.158-.497-.289-.778-.391a5.123 5.123 0 0 1-.759-.327a1.175 1.175 0 0 1-.366-.283a.625.625 0 0 1-.129-.387c0-.078.026-.146.071-.208c.056-.077.15-.153.302-.223c.114-.051.249-.096.398-.134c.15-.038.309-.069.473-.09l.11-.014v-.004a.75.75 0 0 1 0-1.5h-.5a.75.75 0 0 1-.75-.75a.75.75 0 0 1 .014-.144c.07-.39.335-.721.69-.885c.155-.071.33-.125.522-.163c.12-.023.244-.038.37-.047l.165-.008h.004a.75.75 0 0 1 .122.003h.031Z",
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
                {release.prerelease ? (
                  <span className="gh-label-warning">Pre-release</span>
                ) : release.latest ? (
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
                <svg
                  aria-hidden="true"
                  height={16}
                  viewBox="0 0 16 16"
                  width={16}
                  fill="currentColor"
                  style={{ verticalAlign: "text-bottom" }}
                >
                  <path d="M11.93 8.5a4.91 4.91 0 0 1-1.75 3.74c-.85.7-1.97 1.07-3.17 1.07H4.06A3.06 3.06 0 0 1 1 10.25v-.39c0-.2.04-.39.11-.56.03-.1.04-.2.04-.31a1.5 1.5 0 0 1 2.98-.26c.11-.15.31-.43.31-.43a2.5 2.5 0 0 1 4.23-.87l.33.34a3.28 3.28 0 0 1 2.93-.7ZM8 1.75a3.24 3.24 0 0 1 2.62 1.34l.29.38.35-.5a1.75 1.75 0 0 1 2.84.26l.06.08c.32.45.49.97.49 1.51a3.24 3.24 0 0 1-.65 1.95l-.31.36-.31-.36a3.24 3.24 0 0 1-.65-1.95c0-.25.04-.49.11-.72l-2.08 2.08a.75.75 0 0 1-1.06 0l-2.08-2.08c.07.23.11.47.11.72a3.24 3.24 0 0 1-.65 1.95l-.31.36-.31-.36a3.24 3.24 0 0 1-.65-1.95c0-.54.17-1.06.49-1.51l.06-.08a1.75 1.75 0 0 1 2.84-.26l.35.5.29-.38A3.24 3.24 0 0 1 8 1.75Z" />
                </svg>
                <span className="gh-commit-sha">{release.commitSha.slice(0, 7)}</span>
                <svg
                  aria-label="Verified"
                  role="img"
                  height={16}
                  viewBox="0 0 16 16"
                  width={16}
                  fill="currentColor"
                  className="gh-verified"
                  style={{ verticalAlign: "text-bottom", marginLeft: 4 }}
                >
                  <path d={OCTICONS.verified} />
                </svg>
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
            <a href={upstreamReleasesUrl} className="gh-side-active" aria-current="page">
              <span className="gh-side-icon">
                <Octicon name="release" />
              </span>
              <span>Releases</span>
            </a>
            <a href={`${upstreamReleasesUrl.replace(/\/releases\/?$/, "/tags")}`}>
              <span className="gh-side-icon">
                <Octicon name="tag" />
              </span>
              <span>Tags</span>
            </a>
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
              <span className="gh-side-icon">
                <svg
                  aria-hidden="true"
                  height={16}
                  viewBox="0 0 16 16"
                  width={16}
                  fill="currentColor"
                  style={{ verticalAlign: "text-bottom" }}
                >
                  <path d="M6.823 7.823a.25.25 0 0 1 0 .354l-2.396 2.396A.25.25 0 0 1 4 10.396V5.604a.25.25 0 0 1 .427-.177Z" />
                  <path d="M1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25V1.75C0 .784.784 0 1.75 0ZM1.5 1.75v12.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25H1.75a.25.25 0 0 0-.25.25Z" />
                </svg>
              </span>
              <span>Collapse sidebar</span>
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

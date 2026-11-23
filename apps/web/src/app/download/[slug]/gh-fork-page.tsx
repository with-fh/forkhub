"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { ReleaseContributors, UpstreamRelease } from "@/lib/live";
import type { DownloadAsset } from "@/lib/releases";
import { formatBytes } from "@/lib/releases";
import "./gh-markdown.css";

/**
 * Pixel fork of github.com/<owner>/<repo>/releases for /download/[slug].
 *
 * Every measurement below comes from the live upstream DOM at 1280x800:
 * header 68px, repohead 100px (crumbs 16/32/4 + tabs 48 with `8px 16px 0`),
 * tab 32px (`6px 8px`, 8px bottom margin, 6px radius), sidebar 296px with a
 * 1px right border, main content 320..1256 (936px), h1 20/600 32.5px, find
 * input 227x32, title 32/48 600 with a 16px right margin, Compare button
 * 28px tall (`0 8px`, gap 4), meta row 14/21 with a 24px bottom rule, notes
 * 16/24, Box-footer 16px padding with `margin-top: -1px`.
 *
 * Asset downloads resolve to ForkHub catalog builds (same filenames as
 * upstream); every other link is the upstream URL.
 */

const OCTICONS: Record<string, string> = {
  code: "m11.28 3.22 4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L13.94 8l-3.72-3.72a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215Zm-6.56 0a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L2.06 8l3.72 3.72a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L.47 8.53a.75.75 0 0 1 0-1.06Z",
  issues:
    "M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z",
  pulls:
    "M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z",
  discussions:
    "M1.75 1h8.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 10.25 10H7.061l-2.574 2.573A1.458 1.458 0 0 1 2 11.543V10h-.25A1.75 1.75 0 0 1 0 8.25v-5.5C0 1.784.784 1 1.75 1ZM1.5 2.75v5.5c0 .138.112.25.25.25h1a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h3.5a.25.25 0 0 0 .25-.25v-5.5a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25Zm13 2a.25.25 0 0 0-.25-.25h-.5a.75.75 0 0 1 0-1.5h.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 14.25 12H14v1.543a1.458 1.458 0 0 1-2.487 1.03L9.22 12.28a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215l2.22 2.22v-2.19a.75.75 0 0 1 .75-.75h1a.25.25 0 0 0 .25-.25Z",
  actions:
    "M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm4.879-2.773 4.264 2.559a.25.25 0 0 1 0 .428l-4.264 2.559A.25.25 0 0 1 6 10.559V5.442a.25.25 0 0 1 .379-.215Z",
  security:
    "M7.467.133a1.748 1.748 0 0 1 1.066 0l5.25 1.68A1.75 1.75 0 0 1 15 3.48V7c0 1.566-.32 3.182-1.303 4.682-.983 1.498-2.585 2.813-5.032 3.855a1.697 1.697 0 0 1-1.33 0c-2.447-1.042-4.049-2.357-5.032-3.855C1.32 10.182 1 8.566 1 7V3.48a1.75 1.75 0 0 1 1.217-1.667Zm.61 1.429a.25.25 0 0 0-.153 0l-5.25 1.68a.25.25 0 0 0-.174.238V7c0 1.358.275 2.666 1.057 3.86.784 1.194 2.121 2.34 4.366 3.297a.196.196 0 0 0 .154 0c2.245-.956 3.582-2.104 4.366-3.298C13.225 9.666 13.5 8.36 13.5 7V3.48a.251.251 0 0 0-.174-.237l-5.25-1.68ZM8.75 4.75v3a.75.75 0 0 1-1.5 0v-3a.75.75 0 0 1 1.5 0ZM9 10.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z",
  insights:
    "M1.5 1.75V13.5h13.75a.75.75 0 0 1 0 1.5H.75a.75.75 0 0 1-.75-.75V1.75a.75.75 0 0 1 1.5 0Zm14.28 2.53-5.25 5.25a.75.75 0 0 1-1.06 0L7 7.06 4.28 9.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.25-3.25a.75.75 0 0 1 1.06 0L10 7.94l4.72-4.72a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z",
  tag: "M1 7.775V2.75C1 1.784 1.784 1 2.75 1h5.025c.464 0 .91.184 1.238.513l6.25 6.25a1.75 1.75 0 0 1 0 2.474l-5.026 5.026a1.75 1.75 0 0 1-2.474 0l-6.25-6.25A1.752 1.752 0 0 1 1 7.775Zm1.5 0c0 .066.026.13.073.177l6.25 6.25a.25.25 0 0 0 .354 0l5.025-5.025a.25.25 0 0 0 0-.354l-6.25-6.25a.25.25 0 0 0-.177-.073H2.75a.25.25 0 0 0-.25.25ZM6 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z",
  release:
    "M5 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm7.5-.75a.75.75 0 0 1 .75.75v7.19c0 .138-.112.25-.25.25H9.5a.75.75 0 0 1 0-1.5h2.75V4.75h-6.5v6.44h2.75a.75.75 0 0 1 0 1.5H5.5A1.75 1.75 0 0 1 3.75 11V4a.75.75 0 0 1 .75-.75h8ZM8.06 2.446A1.75 1.75 0 0 1 10.63.587l2.073 2.073a.75.75 0 0 1-1.061 1.061L10.13 2.209A.25.25 0 0 0 9.953 2.16h-.361a.75.75 0 0 1-.566-.26l-.967-1.048a.25.25 0 0 0-.18-.086H7.72a.75.75 0 0 1-.66-1.097l.001-.224c-.34.05-.68.08-1.02.08Z",
  verified:
    "M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm8.28-1.22a.75.75 0 0 1 0 1.06l-2.75 2.75a.75.75 0 0 1-1.06 0L4.72 9.34a.75.75 0 0 1 1.06-1.06l.75.75 2.22-2.22a.75.75 0 0 1 1.06 0Z",
  package:
    "m8.878.392 5.25 3.045c.54.314.872.89.872 1.514v6.098a1.75 1.75 0 0 1-.872 1.514l-5.25 3.045a1.75 1.75 0 0 1-1.756 0l-5.25-3.045A1.75 1.75 0 0 1 1 11.049V4.951c0-.624.332-1.201.872-1.514L7.122.392a1.75 1.75 0 0 1 1.756 0ZM7.875 1.69l-4.63 2.685L8 7.133l4.755-2.758-4.63-2.685a.248.248 0 0 0-.25 0ZM2.5 5.677v5.372c0 .09.047.171.125.216l4.625 2.683V8.432Zm6.25 8.271 4.625-2.683a.25.25 0 0 0 .125-.216V5.677L8.75 8.432Z",
  "triangle-down":
    "m4.427 7.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z",
  "triangle-right":
    "m6.427 4.427 3.396 3.396a.25.25 0 0 1 0 .354l-3.396 3.396A.25.25 0 0 1 6 11.396V4.604a.25.25 0 0 1 .427-.177Z",
  "three-bars":
    "M1 2.75A.75.75 0 0 1 1.75 2h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 2.75Zm0 5A.75.75 0 0 1 1.75 7h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 7.75ZM1.75 12h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5Z",
  search:
    "M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z",
  "list-unordered":
    "M5 3.75a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm2.5.75a.75.75 0 0 0 0 1.5h6.25a.75.75 0 0 0 0-1.5Zm0 5a.75.75 0 0 0 0 1.5h6.25a.75.75 0 0 0 0-1.5Zm0 5a.75.75 0 0 0 0 1.5h6.25a.75.75 0 0 0 0-1.5ZM5 8.75a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM4 12.75a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z",
  sliders:
    "M2 3.75A.75.75 0 0 1 2.75 3h3.5a.75.75 0 0 1 0 1.5h-3.5A.75.75 0 0 1 2 3.75Zm9.5 0A.75.75 0 0 1 12.25 3h1a.75.75 0 0 1 0 1.5h-1a.75.75 0 0 1-.75-.75ZM9.25 1.5h1.5v4.5h-1.5Zm-7.25 6.75A.75.75 0 0 1 2.75 7.5h1a.75.75 0 0 1 0 1.5h-1A.75.75 0 0 1 2 8.25Zm4.5 0a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5h-6a.75.75 0 0 1-.75-.75ZM5.75 6h1.5v4.5h-1.5ZM2 12.75a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1-.75-.75Zm9.5 0a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 0 1.5h-1a.75.75 0 0 1-.75-.75ZM9.25 10.5h1.5v4.5h-1.5Z",
  "sidebar-expand":
    "M6.823 7.823a.25.25 0 0 1 0 .354l-2.396 2.396A.25.25 0 0 1 4 10.396V5.604a.25.25 0 0 1 .427-.177ZM1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25V1.75C0 .784.784 0 1.75 0ZM1.5 1.75v12.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25H1.75a.25.25 0 0 0-.25.25Z",
};

function Octicon({ name, className }: { name: string; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      height={16}
      viewBox="0 0 16 16"
      width={16}
      fill="currentColor"
      className={className ? `gh-octicon ${className}` : "gh-octicon"}
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
  // Fallback text inside <time>, matching github.com's server-rendered
  // <relative-time> output ("17 Nov 02:59"); client JS upgrades it to
  // relative text ("1 hour ago"). React keeps rendering this plain <time>
  // (identical tag/attrs/text to upstream), so hydration stays safe — the
  // custom element is only ever created via the DOM API in the effect below.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return timeAgo(iso);
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

let relativeTimeModule: Promise<unknown> | null = null;

function useRelativeTime(iso: string) {
  const ref = useRef<HTMLTimeElement | null>(null);
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
        // No threshold attribute: in this element version threshold="PT0S"
        // caps relative display (a 2h-old stamp rendered "on Nov 17").
        document.body.appendChild(probe);
        const rendered = (probe.shadowRoot?.textContent ?? "").trim();
        const upgradedTitle = probe.getAttribute("title");
        probe.remove();
        if (cancelled) return;
        if (rendered !== "" && node.textContent !== rendered) node.textContent = rendered;
        if (upgradedTitle && node.getAttribute("title") !== upgradedTitle) {
          node.setAttribute("title", upgradedTitle);
        }
      } catch {
        // keep the server-rendered absolute fallback
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
    <li className="gh-asset-row">
      <Octicon name="package" className="gh-asset-icon" />
      <a href={asset.url} className="gh-asset-name">
        {asset.name}
      </a>
      {size ? <span className="gh-asset-size">{size}</span> : null}
    </li>
  );
}

function ContributorsFooter({ contributors }: { contributors: ReleaseContributors }) {
  return (
    <div className="gh-contributors">
      <h3>Contributors</h3>
      <ul>
        {contributors.avatars.map((c) => (
          <li key={c.login}>
            <a href={`https://github.com/${c.login}`} aria-label={c.login}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.avatarSrc} alt={`@${c.login}`} width={32} height={32} />
            </a>
          </li>
        ))}
      </ul>
      {contributors.caption ? (
        <div className="gh-contributors-caption">{contributors.caption}</div>
      ) : null}
    </div>
  );
}

function ReleaseCard({ release }: { release: UpstreamRelease }) {
  const timeRef = useRelativeTime(release.publishedAt);
  return (
    <section id={`release-${release.tag}`} aria-label={release.name} className="gh-release-card">
      <h2 className="sr-only">{release.name}</h2>
      <div className="gh-box">
        <div className="gh-box-body">
          <div className="gh-release-head">
            <div className="gh-release-titlewrap">
              <span className="gh-release-title">
                <a href={release.tagUrl} className="gh-link-primary">
                  {release.name}
                </a>
              </span>
              {release.prerelease ? (
                <span className="gh-label gh-label-warning">Pre-release</span>
              ) : release.latest ? (
                <span className="gh-label gh-label-success">Latest</span>
              ) : null}
            </div>
            {release.compareUrl ? (
              <div className="gh-compare">
                <button
                  type="button"
                  className="gh-compare-btn"
                  aria-haspopup="dialog"
                  aria-expanded="false"
                >
                  <span>Compare</span>
                  <Octicon name="triangle-down" />
                </button>
              </div>
            ) : null}
          </div>

          <div className="gh-release-metawrap">
            <div className="gh-release-meta">
              <div className="gh-meta-group">
                {release.authorAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={release.authorAvatar}
                    alt={`@${release.authorLogin}`}
                    width={20}
                    height={20}
                    className="gh-meta-avatar"
                  />
                ) : null}
                <a href={release.authorUrl} className="gh-author-link">
                  {release.authorLogin}
                </a>
                <span>
                  released this{" "}
                  <time
                    ref={timeRef}
                    className="gh-no-wrap"
                    dateTime={release.publishedAt}
                    title={absoluteTitle(release.publishedAt)}
                  >
                    {shortTime(release.publishedAt)}
                  </time>
                </span>
              </div>
              <div className="gh-meta-group gh-meta-tag">
                <a href={release.tagUrl} className="gh-tag-link" title={release.tag}>
                  {release.tag}
                </a>
              </div>
              {release.commitSha ? (
                <div className="gh-meta-group gh-meta-commit">
                  <a
                    href={release.commitUrl}
                    className="gh-commit-link"
                    data-hovercard-type="commit"
                  >
                    {release.commitSha.slice(0, 7)}
                  </a>
                  <Octicon name="verified" className="gh-verified" />
                </div>
              ) : null}
            </div>
          </div>

          <div
            className="gh-release-notes markdown-body"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: release.bodyHtml }}
          />
        </div>
        {release.contributors || release.assets.length > 0 ? (
          <div className="gh-box-footer">
            {release.contributors ? (
              <ContributorsFooter contributors={release.contributors} />
            ) : null}
            {release.assets.length > 0 ? (
              <details className="gh-assets">
                <summary>
                  <span className="gh-assets-label">Assets</span>
                  <span className="gh-counter">{release.assets.length}</span>
                </summary>
                <ul className="gh-asset-list">
                  {release.assets.map((a) => (
                    <AssetRow key={a.url} asset={a} />
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
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
        <div className="gh-global-inner">
          <a href="https://github.com" className="gh-global-logo" aria-label="GitHub homepage">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/gh/github-mark-white.svg" alt="" width={32} height={32} />
          </a>
          <nav className="gh-global-nav" aria-label="Global">
            {["Products", "Developers", "Businesses", "Resources"].map((t) => (
              <button key={t} type="button" className="gh-global-link" aria-expanded="false">
                {t}
                <Octicon name="triangle-right" className="gh-caret" />
              </button>
            ))}
            <button type="button" className="gh-global-link" aria-expanded="false">
              Pricing
            </button>
          </nav>
          <div className="gh-cta">
            <button type="button" className="gh-global-search" aria-label="Search or jump to, type / to search">
              <span className="gh-search-label">Search</span>
              <kbd>/</kbd>
            </button>
            <span className="gh-signin-wrap">
              <a href="https://github.com/login" className="gh-signin">
                <span className="gh-auth-label">Sign in</span>
              </a>
            </span>
            <a href="https://github.com/signup" className="gh-signup">
              <span className="gh-auth-label">Sign up</span>
            </a>
            <button type="button" className="gh-menu-btn" aria-label="Navigation Menu">
              <Octicon name="sliders" />
            </button>
          </div>
        </div>
      </header>

      <header className="gh-repohead">
        <nav className="gh-crumbs" aria-label="Breadcrumbs">
          <a href={`https://github.com/${owner}`}>{owner}</a>
          <span className="gh-crumb-sep">/</span>
          <a href={`https://github.com/${owner}/${repo}`}>{repo}</a>
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
              <span className="gh-tab-label" data-content={t.label}>
                {t.label}
              </span>
              {t.count != null ? (
                <span className="gh-tab-countwrap">
                  <span className="gh-tab-count">{t.count}</span>
                  <span className="sr-only"> ({t.count})</span>
                </span>
              ) : null}
            </a>
          ))}
        </nav>
      </header>

      <div className="gh-layout">
        <aside className="gh-sidebar">
          <nav aria-label="Releases and tags">
            <div className="gh-side-group">
              <a
                href={upstreamReleasesUrl}
                className="gh-side-item gh-side-active"
                aria-current="page"
              >
                <Octicon name="release" className="gh-side-icon" />
                <span>Releases</span>
              </a>
              <a
                href={upstreamReleasesUrl.replace(/\/releases\/?$/, "/tags")}
                className="gh-side-item"
              >
                <Octicon name="tag" className="gh-side-icon" />
                <span>Tags</span>
              </a>
            </div>
            <div className="gh-side-group">
              <h2 className="gh-side-heading">
                <Octicon name="list-unordered" className="gh-side-icon" />
                <span>On this page</span>
              </h2>
              <div className="gh-anchor-wrap">
                {filtered.map((r) => (
                  <div key={r.tag} className="gh-anchor-row">
                    <a href={`#release-${r.tag}`} title={r.name}>
                      <span className="gh-anchor-text">
                        {r.name}
                      </span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
            <button type="button" className="gh-collapse-btn" aria-expanded="true">
              <Octicon name="sidebar-expand" className="gh-side-icon" />
              <span>Collapse sidebar</span>
            </button>
          </nav>
        </aside>

        <main className="gh-main">
          <div className="gh-releases-head">
            <h1>Releases</h1>
            <form className="gh-find" role="search" onSubmit={(e) => e.preventDefault()}>
              <Octicon name="search" className="gh-find-icon" />
              <input
                type="search"
                aria-label="Find a release"
                placeholder="Find a release"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </form>
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

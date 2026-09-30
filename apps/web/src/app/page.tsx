import Link from "next/link";
import { FileText, Package } from "lucide-react";
import { OSS_CATALOG, listOss } from "@forkhub/api/oss/data";

import HeroFloat from "@/components/hero-float";
import OssCard from "@/components/oss-card";
import { getStarsMap } from "@/lib/live";
import { CATALOG_DIR, CATALOG_REPO_URL, FORKHUB_REPO_URL } from "@/lib/site";

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 12l5 5L20 6" />
      </svg>
      {children}
    </li>
  );
}

function MarqueeRow({ reverse, children }: { reverse?: boolean; children: React.ReactNode }) {
  return (
    <div className={`fh-marquee-row${reverse ? " is-reverse" : ""}`}>
      <div className="fh-marquee-track">
        <div className="fh-marquee-group">{children}</div>
        <div className="fh-marquee-group" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}

export default async function Home() {
  const [preview, starsMap] = [listOss({ sort: "stars" }).slice(0, 2), await getStarsMap()];
  const patches = OSS_CATALOG.flatMap((e) =>
    e.patches.map((p) => ({ ...p, ossName: e.name, slug: e.slug })),
  );

  return (
    <div>
      {/* ── Hero (t3.codes: float, display title, stacked CTAs, tilted preview) ── */}
      <section className="fh-hero">
        <div className="fh-hero-grid" aria-hidden="true" />
        <HeroFloat />
        <div className="fh-container fh-hero-inner">
          <h1 className="fh-display fh-hero-title">
            The open-source
            <br />
            control plane
            <br />
            for fork patches.
          </h1>
          <p className="fh-hero-sub">
            Declare each local change once as intent. An AI agent re-derives it against every
            upstream release — you keep your patches and upstream&apos;s features.
          </p>
          <div className="fh-hero-actions" style={{ flexDirection: "column", gap: 16 }}>
            <Link href="/download" className="fh-btn fh-btn-primary fh-btn-lg">
              Download
            </Link>
            <a
              href={FORKHUB_REPO_URL}
              rel="noreferrer"
              target="_blank"
              className="fh-hero-source-link"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 007.86 10.93c.58.1.79-.25.79-.56v-2c-3.2.69-3.88-1.37-3.88-1.37-.52-1.33-1.27-1.69-1.27-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.68 1.25 3.33.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.27-5.24-5.67 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.45.11-3.02 0 0 .96-.31 3.15 1.18a10.96 10.96 0 015.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.57.23 2.73.11 3.02.74.8 1.18 1.83 1.18 3.08 0 4.41-2.7 5.38-5.27 5.66.41.36.78 1.06.78 2.13v3.16c0 .31.21.67.8.56A11.5 11.5 0 0023.5 12C23.5 5.65 18.35.5 12 .5z" />
              </svg>
              <span>Steal our code (legally)</span>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M7 17L17 7M8 7h9v9" />
              </svg>
            </a>
            <p className="fh-hero-meta">
              Catalog publishes from <code>{CATALOG_DIR}</code>
            </p>
          </div>
          <div>
            <div className="fh-hero-preview">
              <div
                className="fh-preview-frame"
                role="img"
                aria-label="ForkHub catalog: reuse an intent-patch and run a patched build"
              >
                <div className="fh-preview-bar">
                  <span className="fh-preview-dot" />
                  <span className="fh-preview-dot" />
                  <span className="fh-preview-dot" />
                  <span className="fh-preview-title">with-fh — patch catalog</span>
                </div>
                <div className="fh-preview-body">
                  <div className="fh-term-body fh-preview-term" style={{ border: 0 }}>
                    <div>
                      <span className="prompt">$</span>fh run t3 with-fh -- --version
                    </div>
                    <div className="dim">
                      ▲ patched build <span className="accent">with-fh/t3 nightly</span>
                    </div>
                    <div>
                      <span className="prompt">$</span>fh update
                    </div>
                    <div className="dim">✓ re-derived onto upstream v2.4.1 · 1 patch applied</div>
                    <div>
                      <span className="prompt">$</span>fh reuse …/INTENT.md
                    </div>
                    <div className="dim">✓ fork it — modify the intent, rebuild</div>
                  </div>
                  <div className="fh-preview-patches">
                    {patches.slice(0, 3).map((p) => (
                      <div key={p.id} className="fh-preview-patch">
                        <strong>{p.ossName}</strong>
                        <code>
                          {p.id} · rev {p.version} · {p.status}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Patch marquee (t3 endorsement carousel) ── */}
      <section className="fh-section">
        <div className="fh-container">
          <div className="fh-section-head" style={{ textAlign: "center", marginInline: "auto" }}>
            <h2>Patches in the wild</h2>
            <p style={{ marginInline: "auto" }}>
              Intent-patches shipping in the catalog today. Fork one, reuse it, improve it.
            </p>
          </div>
        </div>
        <div className="fh-marquee" aria-label="Catalog patches">
          <MarqueeRow>
            {OSS_CATALOG.map((e) => (
              <Link key={e.slug} href={`/download/${e.slug}`} className="fh-marquee-card">
                <div className="fh-marquee-author">
                  <span className="fh-marquee-mark">
                    <Package width={15} height={15} />
                  </span>
                  <div className="fh-marquee-name">{e.name}</div>
                </div>
                <p>{e.tagline}</p>
              </Link>
            ))}
          </MarqueeRow>
          <MarqueeRow reverse>
            {patches.map((p) => (
              <a
                key={p.id}
                href={p.intentUrl}
                target="_blank"
                rel="noreferrer"
                className="fh-marquee-card"
              >
                <div className="fh-marquee-author">
                  <span className="fh-marquee-mark">
                    <FileText width={15} height={15} />
                  </span>
                  <div className="fh-marquee-name">{p.ossName}</div>
                </div>
                <p>{p.title}</p>
                <code>
                  {p.id} · rev {p.version}
                </code>
              </a>
            ))}
          </MarqueeRow>
        </div>
      </section>

      {/* ── Bring your own fork (t3 harness grid) ── */}
      <section className="fh-section">
        <div className="fh-container">
          <div className="fh-section-head">
            <h2>Bring your own fork</h2>
            <p>
              ForkHub doesn&apos;t resell patches. Declare intent with the CLI, reuse any published
              INTENT.md, ride stable or nightly trains. We re-derive them, you keep your fork.
            </p>
          </div>
          <div className="fh-harness-grid">
            <Link href="/download/t3code" className="fh-harness">
              <span className="fh-harness-mark">
                <Package width={18} height={18} />
              </span>
              <span>
                <span className="fh-harness-name">T3 Code</span>
                <div className="fh-harness-tag">fh run t3 with-fh</div>
              </span>
            </Link>
            <Link href="/download/natively" className="fh-harness">
              <span className="fh-harness-mark">
                <Package width={18} height={18} />
              </span>
              <span>
                <span className="fh-harness-name">Natively</span>
                <div className="fh-harness-tag">AppImage · stable</div>
              </span>
            </Link>
            <a href={CATALOG_REPO_URL} target="_blank" rel="noreferrer" className="fh-harness">
              <span className="fh-harness-mark">
                <FileText width={18} height={18} />
              </span>
              <span>
                <span className="fh-harness-name">Patch catalog</span>
                <div className="fh-harness-tag">with-fh/.forkhub</div>
              </span>
            </a>
            <div className="fh-harness">
              <span className="fh-harness-mark">
                <FileText width={18} height={18} />
              </span>
              <span>
                <span className="fh-harness-name">Declare intent</span>
                <div className="fh-harness-tag">fh draft</div>
              </span>
            </div>
            <div className="fh-harness">
              <span className="fh-harness-mark">
                <Package width={18} height={18} />
              </span>
              <span>
                <span className="fh-harness-name">Capture the diff</span>
                <div className="fh-harness-tag">fh satisfied</div>
              </span>
            </div>
            <div className="fh-harness">
              <span className="fh-harness-mark">
                <Package width={18} height={18} />
              </span>
              <span>
                <span className="fh-harness-name">Ride upstream</span>
                <div className="fh-harness-tag">fh update</div>
              </span>
            </div>
          </div>
          <div className="fh-harness-footer">
            <span className="fh-harness-footer-item">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 12l5 5L20 6" />
              </svg>
              No merge hell. No stale forks.
            </span>
            <span className="fh-harness-footer-item">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 12l5 5L20 6" />
              </svg>
              Switch trains mid-fork.
            </span>
            <span className="fh-harness-footer-item">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 12l5 5L20 6" />
              </svg>
              More OSS onboarding weekly.
            </span>
          </div>
        </div>
      </section>

      {/* ── Git: one command to re-derive, verify, PR (t3 git section) ── */}
      <section className="fh-section">
        <div className="fh-container">
          <div className="fh-grid-2" style={{ alignItems: "center", gap: 48 }}>
            <div>
              <div className="fh-pr-card">
                <div className="fh-pr-head">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="6" cy="6" r="2.2" />
                    <circle cx="6" cy="18" r="2.2" />
                    <circle cx="18" cy="6" r="2.2" />
                    <path d="M6 8v8M18 8v5a3 3 0 01-3 3h-3M13 13l-2 3 2 3" />
                  </svg>
                  <span>Add --cheat flag via intent-patch</span>
                  <span className="fh-pr-status">Ready</span>
                </div>
                <div className="fh-pr-meta">
                  <span>with-fh/t3-nightly → main</span>
                  <span>+142 −38</span>
                  <span>verify passing</span>
                </div>
                <div className="fh-pr-files">
                  <div>
                    <code>INTENT.md</code>
                    <span>+14 −2</span>
                  </div>
                  <div>
                    <code>ACCEPTANCE.md</code>
                    <span>+8 −0</span>
                  </div>
                  <div>
                    <code>verify.sh</code>
                    <span>+36 −0</span>
                  </div>
                </div>
                <div className="fh-pr-foot">
                  <span className="fh-btn fh-btn-ghost fh-btn-sm">View diff</span>
                  <span className="fh-btn fh-btn-primary fh-btn-sm">Open pull request</span>
                </div>
              </div>
              <div className="fh-pr-trail" aria-hidden="true">
                <div className="fh-pr-trail-dot" />
                <div className="fh-pr-trail-line" />
                <div className="fh-pr-trail-dot" />
              </div>
              <div className="fh-pr-button-shell">
                <span className="fh-pr-button">
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="6" cy="6" r="2.2" />
                    <circle cx="6" cy="18" r="2.2" />
                    <circle cx="18" cy="6" r="2.2" />
                    <path d="M6 8v8M18 8v5a3 3 0 01-3 3h-3M13 13l-2 3 2 3" />
                  </svg>
                  Re-derive &amp; push
                  <span className="fh-pr-button-kbd">fh update</span>
                </span>
              </div>
            </div>
            <div>
              <div className="fh-section-head" style={{ marginBottom: 0 }}>
                <h2>One command to re-derive, verify, and make a PR.</h2>
                <p>
                  Every intent-patch carries its acceptance criteria and verify gate. When upstream
                  ships, one command re-derives your intent, runs the gate, and opens the PR with a
                  generated title and body. No terminal dance required.
                </p>
                <ul className="fh-checklist" style={{ marginTop: 24 }}>
                  <Check>Verify gates run before anything pushes</Check>
                  <Check>Auto-generated PR titles &amp; bodies from intent</Check>
                  <Check>Draft PRs, stack PRs, amend PRs</Check>
                  <Check>Works with your existing GitHub auth</Check>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Open source (t3 open-grid) ── */}
      <section className="fh-section">
        <div className="fh-container">
          <div className="fh-section-head">
            <span className="fh-eyebrow">Open source</span>
            <h2>If you don&apos;t like a patch, fork the intent.</h2>
          </div>
          <div className="fh-grid-2">
            <div className="fh-term-body" role="img" aria-label="Reuse a ForkHub intent-patch">
              <div>
                <span className="prompt">$</span>fh reuse …/t3code-forkhub-update-track/INTENT.md
              </div>
              <div className="dim">✓ intent captured · verify gate passing</div>
              <div>
                <span className="prompt">$</span>fh run t3 with-fh -- --version
              </div>
              <div className="dim">
                ▲ patched build <span className="accent">with-fh/t3 nightly</span>
              </div>
              <div>
                <span className="prompt">$</span>fh publish
              </div>
              <div className="dim">✓ your train is live · others can reuse it</div>
            </div>
            <div className="fh-tile">
              <ul className="fh-checklist">
                <Check>
                  <span>
                    <strong style={{ color: "var(--t3-fg)" }}>Reuse any patch.</strong> One command
                    re-derives a published intent onto your checkout.
                  </span>
                </Check>
                <Check>
                  <span>
                    <strong style={{ color: "var(--t3-fg)" }}>
                      Keep upstream&apos;s features.
                    </strong>{" "}
                    Update trains re-derive your patches onto new releases.
                  </span>
                </Check>
                <Check>
                  <span>
                    <strong style={{ color: "var(--t3-fg)" }}>Ship your own train.</strong> Publish
                    a catalog and sign your own stable/nightly builds.
                  </span>
                </Check>
              </ul>
              <div style={{ marginTop: 24, display: "flex", gap: 16, alignItems: "center" }}>
                <a
                  href={FORKHUB_REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="fh-btn fh-btn-primary"
                >
                  Fork on GitHub
                </a>
                <Link href="/download" style={{ color: "var(--t3-fg-muted)", fontSize: 14 }}>
                  Browse the catalog →
                </Link>
              </div>
              <p
                style={{
                  marginTop: 18,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--t3-fg-dim)",
                }}
              >
                MIT licensed
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Supported OSS preview ── */}
      <section className="fh-section">
        <div className="fh-container">
          <div className="fh-section-head" style={{ marginBottom: 32 }}>
            <span className="fh-eyebrow">Download</span>
            <h2>Run patched builds, stay current.</h2>
            <p>ForkHub-maintained today. 3rd-party and community catalogs next.</p>
          </div>
          <div className="fh-oss-grid">
            {preview.map((e) => (
              <OssCard key={e.slug} entry={e} liveStars={starsMap[e.slug] ?? undefined} />
            ))}
          </div>
          <div style={{ marginTop: 24 }}>
            <Link href="/download" className="fh-btn fh-btn-ghost">
              View all downloads
            </Link>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="fh-cta">
        <div className="fh-container fh-cta-inner">
          <h2 className="fh-display fh-cta-title">Your forks deserve better than merge hell.</h2>
          <p className="fh-cta-sub">
            ForkHub is free and open source. Declare your patches as intent, reuse the
            community&apos;s, and stay current with upstream.
          </p>
          <div className="fh-hero-actions" style={{ marginBottom: 0 }}>
            <Link href="/download" className="fh-btn fh-btn-primary fh-btn-lg">
              Download
            </Link>
            <a
              href={FORKHUB_REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="fh-btn fh-btn-ghost fh-btn-lg"
            >
              GitHub
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

import Link from "next/link";
import { listOss } from "@forkhub/api/oss/data";

import OssCard from "@/components/oss-card";
import { CATALOG_DIR, FORKHUB_REPO_URL, FORKHUB_SITE_URL } from "@/lib/site";

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

export default function Home() {
  const preview = listOss({ sort: "stars" }).slice(0, 2);

  return (
    <div>
      {/* ── Hero (t3.codes rhythm: grid, display title, sub, CTAs, meta) ── */}
      <section className="fh-hero">
        <div className="fh-hero-grid" aria-hidden="true" />
        <div className="fh-container fh-hero-inner">
          <span className="fh-eyebrow">ForkHub — patches are intent, not diffs</span>
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
          <div className="fh-hero-actions">
            <Link href="/oss" className="fh-btn fh-btn-primary fh-btn-lg">
              Browse supported OSS
            </Link>
            <a
              href={FORKHUB_REPO_URL}
              rel="noreferrer"
              target="_blank"
              className="fh-btn fh-btn-ghost fh-btn-lg"
            >
              Steal our code (legally)
            </a>
          </div>
          <p className="fh-hero-meta">
            Served at <code>{FORKHUB_SITE_URL.replace("https://", "")}</code> · catalog publishes
            from <code>{CATALOG_DIR}</code>
          </p>
        </div>
      </section>

      {/* ── Supported OSS preview ── */}
      <section className="fh-section">
        <div className="fh-container">
          <div className="fh-section-head" style={{ marginBottom: 32 }}>
            <span className="fh-eyebrow">Supported OSS</span>
            <h2>Run patched builds, stay current.</h2>
            <p>ForkHub-maintained today. 3rd-party and community catalogs next.</p>
          </div>
          <div className="fh-oss-grid">
            {preview.map((e) => (
              <OssCard key={e.slug} entry={e} />
            ))}
          </div>
          <div style={{ marginTop: 24 }}>
            <Link href="/oss" className="fh-btn fh-btn-ghost">
              View all supported OSS
            </Link>
          </div>
        </div>
      </section>

      {/* ── Maintainer tiers (replaces t3 "Bring your own sub" harness grid) ── */}
      <section className="fh-section">
        <div className="fh-container">
          <div className="fh-section-head">
            <span className="fh-eyebrow">Maintenance model</span>
            <h2>Three tiers. One catalog format.</h2>
            <p>
              Every entry ships ForkHub intent-patches from the same{" "}
              <code style={{ fontFamily: "var(--font-mono)", fontSize: 14 }}>{CATALOG_DIR}</code>{" "}
              catalog shape — no matter who maintains it. Search, filter by maintainer, sort by what
              matters, then reuse with one command.
            </p>
          </div>
          <div className="fh-grid-3">
            <div className="fh-tile">
              <span className="fh-badge fh-badge-accent">ForkHub-maintained</span>
              <h3 style={{ margin: "14px 0 8px", fontSize: 18, fontWeight: 600 }}>Live today</h3>
              <p style={{ fontSize: 14, color: "var(--t3-fg-muted)", lineHeight: 1.6 }}>
                T3 Code and Natively. Curated intent-patches, verified re-derivation, nightly and
                stable trains.
              </p>
            </div>
            <div className="fh-tile">
              <span className="fh-badge">3rd-party-maintained</span>
              <h3 style={{ margin: "14px 0 8px", fontSize: 18, fontWeight: 600 }}>Coming next</h3>
              <p style={{ fontSize: 14, color: "var(--t3-fg-muted)", lineHeight: 1.6 }}>
                Vendors and teams publish their own patch trains in the same catalog format. Same{" "}
                <code style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>fh reuse</code> flow,
                their signing keys.
              </p>
            </div>
            <div className="fh-tile">
              <span className="fh-badge">Community-maintained</span>
              <h3 style={{ margin: "14px 0 8px", fontSize: 18, fontWeight: 600 }}>Coming next</h3>
              <p style={{ fontSize: 14, color: "var(--t3-fg-muted)", lineHeight: 1.6 }}>
                Anyone can publish an intent-patch. Fork it, improve it, share it — patches are
                intent, not diffs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Intent workflow (replaces t3 "One button to commit/push/PR") ── */}
      <section className="fh-section">
        <div className="fh-container">
          <div className="fh-grid-2" style={{ alignItems: "center", gap: 48 }}>
            <div className="fh-term-body" role="img" aria-label="ForkHub intent-patch workflow">
              <div>
                <span className="prompt">$</span>fh init # set up .forkhub in your fork
              </div>
              <div>
                <span className="prompt">$</span>fh draft &quot;add --cheat flag&quot; # declare
                intent, AI implements
              </div>
              <div>
                <span className="prompt">$</span>fh satisfied # capture diff, port to forkhub/main
              </div>
              <div>
                <span className="prompt">$</span>fh update # upstream released? re-derive + apply
              </div>
              <div className="dim">✓ patches are intent, not diffs</div>
            </div>
            <div>
              <span className="fh-eyebrow">Workflow</span>
              <h2
                className="fh-display"
                style={{ fontSize: "clamp(32px, 4vw, 48px)", marginBottom: 18 }}
              >
                Declare intent once, ride every upstream release.
              </h2>
              <p style={{ color: "var(--t3-fg-muted)", fontSize: 17, marginBottom: 24 }}>
                Every fork change is captured as an INTENT.md with acceptance criteria and a verify
                gate. When upstream ships, the agent re-derives your intent onto the new tree — no
                merge-hell rebases.
              </p>
              <ul className="fh-checklist">
                <Check>Intent-patches with verify gates, not raw diffs</Check>
                <Check>Per-publisher trains: stable and nightly side by side</Check>
                <Check>
                  One-command reuse:{" "}
                  <code style={{ fontFamily: "var(--font-mono)" }}>fh reuse</code> any published
                  INTENT.md
                </Check>
                <Check>Works with your existing GitHub auth and forks</Check>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Open source (t3 open-grid, ForkHub copy) ── */}
      <section className="fh-section">
        <div className="fh-container">
          <div className="fh-section-head">
            <span className="fh-eyebrow">Open source</span>
            <h2>If you don&apos;t like a patch, fork the intent.</h2>
          </div>
          <div className="fh-grid-2">
            <div className="fh-term-body" role="img" aria-label="Reuse a ForkHub intent-patch">
              <div>
                <span className="prompt">$</span>fh reuse https://github.com/with-fh/.forkhub/...
                /INTENT.md
              </div>
              <div className="dim">✓ intent captured · verify gate passing</div>
              <div>
                <span className="prompt">$</span>fh run t3 with-fh -- --version
              </div>
              <div className="dim">
                ▲ patched build <span className="accent">with-fh/t3 nightly</span>
              </div>
              <div>
                <span className="prompt">$</span>
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 15,
                    background: "var(--t3-accent)",
                    verticalAlign: "middle",
                    marginLeft: 8,
                  }}
                />
              </div>
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
                <Link href="/oss" style={{ color: "var(--t3-fg-muted)", fontSize: 14 }}>
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

      {/* ── Final CTA ── */}
      <section className="fh-cta">
        <div className="fh-container fh-cta-inner">
          <h2 className="fh-display fh-cta-title">Your forks deserve better than merge hell.</h2>
          <p className="fh-cta-sub">
            ForkHub is free and open source. Declare your patches as intent, reuse the
            community&apos;s, and stay current with upstream.
          </p>
          <div className="fh-hero-actions" style={{ marginBottom: 0 }}>
            <Link href="/oss" className="fh-btn fh-btn-primary fh-btn-lg">
              Browse supported OSS
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

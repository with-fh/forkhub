"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  MAINTAINER_LABEL,
  OSS_CATALOG,
  type OssMaintainer,
  type OssStatus,
} from "@forkhub/api/oss/data";

import OssCard from "@/components/oss-card";
import { CATALOG_DIR, CATALOG_REPO_URL } from "@/lib/site";

type MaintainerFilter = "all" | OssMaintainer;
type StatusFilter = "all" | OssStatus;
type Sort = "stars" | "updated" | "patches" | "name";

export default function DownloadClient({ stars }: { stars: Record<string, number | null> }) {
  const [q, setQ] = useState("");
  const [maintainer, setMaintainer] = useState<MaintainerFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<Sort>("stars");

  // Static catalog, filtered client-side: zero backend, instant, and the
  // forkhub.imbios.dev Workers deploy needs no database or RPC roundtrip.
  // Star counts arrive as a prop (fetched + cached server-side, daily).
  const entries = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = OSS_CATALOG.map((e) => ({ ...e, stars: stars[e.slug] ?? e.stars })).filter((e) => {
      if (maintainer !== "all" && e.maintainer !== maintainer) return false;
      if (status !== "all" && e.status !== status) return false;
      if (!needle) return true;
      return [e.name, e.upstream, e.tagline, e.slug].join(" ").toLowerCase().includes(needle);
    });
    return [...out].sort((a, b) => {
      switch (sort) {
        case "stars":
          return b.stars - a.stars;
        case "updated":
          return b.updated.localeCompare(a.updated);
        case "patches":
          return b.patchCount - a.patchCount;
        case "name":
          return a.name.localeCompare(b.name);
      }
    });
  }, [q, maintainer, status, sort, stars]);

  const forkhubCount = OSS_CATALOG.filter((e) => e.maintainer === "forkhub").length;

  return (
    <div>
      <section className="fh-hero">
        <div className="fh-hero-grid" aria-hidden="true" />
        <div className="fh-container" style={{ position: "relative" }}>
          <span className="fh-eyebrow">Download</span>
          <h1
            className="fh-display"
            style={{ fontSize: "clamp(36px, 5vw, 64px)", marginBottom: 16 }}
          >
            Run patched builds, stay current.
          </h1>
          <p style={{ color: "var(--t3-fg-muted)", maxWidth: 640, fontSize: 17 }}>
            {forkhubCount} ForkHub-maintained {forkhubCount === 1 ? "entry" : "entries"} today.
            Every entry ships intent-patches from the{" "}
            <a
              href={CATALOG_REPO_URL}
              rel="noreferrer"
              target="_blank"
              style={{
                color: "var(--t3-fg)",
                textDecoration: "underline",
                textUnderlineOffset: 4,
              }}
            >
              {CATALOG_DIR}
            </a>{" "}
            catalog. Search, filter by maintainer, sort by what matters — install in one
            command, or reuse the intent to fork it.
          </p>

          <div className="fh-controls" style={{ marginTop: 28 }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, upstream, tagline…"
              aria-label="Search patched builds"
              className="fh-search"
            />
            <select
              aria-label="Maintainer"
              className="fh-select"
              value={maintainer}
              onChange={(e) => setMaintainer(e.target.value as MaintainerFilter)}
            >
              <option value="all">All maintainers</option>
              <option value="forkhub">{MAINTAINER_LABEL.forkhub}</option>
              <option value="third-party">{MAINTAINER_LABEL["third-party"]}</option>
              <option value="community">{MAINTAINER_LABEL.community}</option>
            </select>
            <select
              aria-label="Status"
              className="fh-select"
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="coming-soon">Coming soon</option>
            </select>
            <select
              aria-label="Sort"
              className="fh-select"
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
            >
              <option value="stars">Sort: stars</option>
              <option value="updated">Sort: recently updated</option>
              <option value="patches">Sort: most patches</option>
              <option value="name">Sort: name</option>
            </select>
          </div>
        </div>
      </section>

      <section className="fh-section" style={{ paddingTop: 48 }}>
        <div className="fh-container">
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--t3-fg-dim)",
              marginBottom: 20,
            }}
          >
            {entries.length} {entries.length === 1 ? "result" : "results"}
            {maintainer !== "all" ? ` · ${MAINTAINER_LABEL[maintainer as OssMaintainer]}` : ""}
          </p>
          {entries.length === 0 ? (
            <div className="fh-tile">
              <p style={{ color: "var(--t3-fg-muted)", fontSize: 15 }}>
                No matches. Try clearing the search or choosing a different maintainer —{" "}
                {MAINTAINER_LABEL["third-party"]} and {MAINTAINER_LABEL.community} catalogs are
                coming next.
              </p>
            </div>
          ) : (
            <div className="fh-oss-grid">
              {entries.map((e) => (
                <OssCard key={e.slug} entry={e} liveStars={e.stars} />
              ))}
            </div>
          )}
          <div style={{ marginTop: 32 }}>
            <Link href="/" className="fh-btn fh-btn-ghost fh-btn-sm">
              ← Back home
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

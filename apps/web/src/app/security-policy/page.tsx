import Link from "next/link";

import { FORKHUB_REPO_URL } from "@/lib/site";

export const metadata = {
  title: "Security Policy — ForkHub",
  description: "How to report security issues in ForkHub.",
};

export default function SecurityPolicyPage() {
  return (
    <div className="fh-container" style={{ paddingTop: 64, paddingBottom: 96 }}>
      <div style={{ maxWidth: 720 }}>
        <span className="fh-eyebrow">Security Policy</span>
        <h1 className="fh-display" style={{ fontSize: "clamp(36px, 5vw, 60px)", marginBottom: 16 }}>
          Report it privately first.
        </h1>
        <p style={{ color: "var(--t3-fg-muted)", fontSize: 16, lineHeight: 1.7 }}>
          If you find a vulnerability in the{" "}
          <code style={{ fontFamily: "var(--font-mono)", fontSize: 14 }}>fh</code> CLI, this site,
          or a published intent-patch, please report it through a{" "}
          <a
            href={`${FORKHUB_REPO_URL}/security/advisories/new`}
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--t3-fg)", textDecoration: "underline", textUnderlineOffset: 4 }}
          >
            private security advisory
          </a>{" "}
          instead of opening a public issue. We&apos;ll acknowledge within 72 hours and fix forward
          in the open once a patch ships.
        </p>
        <h2 className="fh-display" style={{ fontSize: 24, marginTop: 40, marginBottom: 12 }}>
          Scope notes
        </h2>
        <p style={{ color: "var(--t3-fg-muted)", fontSize: 16, lineHeight: 1.7 }}>
          Intent-patches are third-party content: each patch lists its publisher and verify gate.
          Review a patch&apos;s INTENT.md and ACCEPTANCE.md before running{" "}
          <code style={{ fontFamily: "var(--font-mono)", fontSize: 14 }}>fh reuse</code> on an
          untrusted source, the same way you&apos;d review any script before piping it to a shell.
        </p>
        <div style={{ marginTop: 32 }}>
          <Link href="/" className="fh-btn fh-btn-ghost fh-btn-sm">
            ← Back home
          </Link>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — ForkHub",
  description: "Privacy practices for the ForkHub catalog, CLI, and DeepSeek Harness Linux builds.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="fh-container" style={{ paddingTop: 64, paddingBottom: 96 }}>
      <div style={{ maxWidth: 720 }}>
        <span className="fh-eyebrow">Privacy Policy</span>
        <h1 className="fh-display" style={{ fontSize: "clamp(36px, 5vw, 60px)", marginBottom: 16 }}>
          How ForkHub handles your data
        </h1>
        <p style={{ color: "var(--t3-fg-muted)", fontSize: 16, lineHeight: 1.7 }}>
          The ForkHub catalog has no accounts, cookies, or visitor analytics. Your search queries,
          filters, and sorting stay in your browser.
        </p>
        <h2 className="fh-display" style={{ fontSize: 24, marginTop: 40, marginBottom: 12 }}>
          DeepSeek Harness on Linux
        </h2>
        <p style={{ color: "var(--t3-fg-muted)", fontSize: 16, lineHeight: 1.7 }}>
          This usage reporting is available only in ForkHub&apos;s Linux builds of DeepSeek Harness
          and is on by default. When you bring the desktop app to the foreground, it can send its
          build version and a hashed installation ID to ForkHub. The report contains no prompts,
          files, or account IDs.
        </p>
        <p style={{ color: "var(--t3-fg-muted)", fontSize: 16, lineHeight: 1.7 }}>
          ForkHub hashes the ID again with the UTC date to count each installation once per day. It
          keeps daily totals and removes older deduplication records.
        </p>
        <p style={{ color: "var(--t3-fg-muted)", fontSize: 16, lineHeight: 1.7 }}>
          To turn off usage reporting, set <code>FORKHUB_TELEMETRY_ENABLED=false</code> or{" "}
          <code>DO_NOT_TRACK=1</code> in the app&apos;s environment before launching it. Reporting
          defaults to off in CI.
        </p>
        <h2 className="fh-display" style={{ fontSize: 24, marginTop: 40, marginBottom: 12 }}>
          Third parties
        </h2>
        <p style={{ color: "var(--t3-fg-muted)", fontSize: 16, lineHeight: 1.7 }}>
          Links to GitHub (repositories, patch catalogs, INTENT.md files) leave this site and are
          governed by{" "}
          <a
            href="https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement"
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--t3-fg)", textDecoration: "underline", textUnderlineOffset: 4 }}
          >
            GitHub&apos;s privacy statement
          </a>
          . The GitHub star count shown in the navigation is fetched server-side once per hour; no
          per-visitor data is sent or stored.
        </p>
        <h2 className="fh-display" style={{ fontSize: 24, marginTop: 40, marginBottom: 12 }}>
          The fh CLI
        </h2>
        <p style={{ color: "var(--t3-fg-muted)", fontSize: 16, lineHeight: 1.7 }}>
          The <code style={{ fontFamily: "var(--font-mono)", fontSize: 14 }}>fh</code> CLI runs on
          your machine and talks to GitHub&apos;s API directly when you search or reuse patches. It
          sends no usage reports to ForkHub.
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

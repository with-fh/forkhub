import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — ForkHub",
  description: "ForkHub's privacy policy: this site collects nothing.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="fh-container" style={{ paddingTop: 64, paddingBottom: 96 }}>
      <div style={{ maxWidth: 720 }}>
        <span className="fh-eyebrow">Privacy Policy</span>
        <h1 className="fh-display" style={{ fontSize: "clamp(36px, 5vw, 60px)", marginBottom: 16 }}>
          We collect nothing.
        </h1>
        <p style={{ color: "var(--t3-fg-muted)", fontSize: 16, lineHeight: 1.7 }}>
          forkhub.imbios.dev is a static catalog. There are no accounts, no cookies, no analytics,
          and no tracking. Search, filter, and sort run entirely in your browser — your queries
          never leave your device.
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
          never phones home to ForkHub infrastructure — there is none to phone.
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

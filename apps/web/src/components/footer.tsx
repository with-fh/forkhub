import { CATALOG_REPO_URL, FORKHUB_REPO_URL } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="fh-footer">
      <div className="fh-container fh-footer-inner">
        <div className="fh-footer-brand">
          <span>© {new Date().getFullYear()} ForkHub · MIT licensed</span>
        </div>
        <div className="fh-footer-links">
          <a href={FORKHUB_REPO_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href="/oss">Supported OSS</a>
          <a href={CATALOG_REPO_URL} target="_blank" rel="noreferrer">
            Patch catalog
          </a>
        </div>
      </div>
    </footer>
  );
}

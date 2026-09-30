import Link from "next/link";

import { FORKHUB_REPO_URL } from "@/lib/site";

export default function Header() {
  return (
    <nav className="fh-nav" id="fh-nav">
      <div className="fh-nav-inner">
        <Link href="/" className="fh-nav-brand" aria-label="ForkHub home">
          ForkHub <span>for OSS forks</span>
        </Link>
        <div className="fh-nav-right">
          <Link href="/oss" className="fh-nav-link">
            Supported OSS
          </Link>
          <a
            href="https://github.com/with-fh/.forkhub"
            target="_blank"
            rel="noreferrer"
            className="fh-nav-link fh-nav-link-hide-mobile"
          >
            Patch catalog
          </a>
          <a
            className="fh-nav-stars"
            href={FORKHUB_REPO_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Star ForkHub on GitHub"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2.3l2.9 5.88 6.49.94-4.7 4.58 1.11 6.47L12 17.12l-5.8 3.05 1.11-6.47-4.7-4.58 6.49-.94L12 2.3z" />
            </svg>
            <span>
              <strong>ForkHub</strong> on GitHub
            </span>
          </a>
        </div>
      </div>
      <script
        // eslint-disable-next-line @eslint-react/dom/no-dangerously-set-innerhtml
        dangerouslySetInnerHTML={{
          __html: `addEventListener('scroll',()=>{document.getElementById('fh-nav')?.classList.toggle('is-scrolled',scrollY>12)},{passive:true})`,
        }}
      />
    </nav>
  );
}

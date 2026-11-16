"use client";

import { useEffect } from "react";

/**
 * Chromeless wrapper for the GitHub-releases pixel forks: hides the
 * ForkHub site chrome (.fh-chrome) so the Primer fork renders full-bleed,
 * exactly like github.com/<owner>/<repo>/releases. Restores chrome on
 * unmount (client-side navigation back to ForkHub pages).
 */
export default function GhReleasesForkChrome({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.setAttribute("data-gh-fork", "true");
    return () => {
      document.documentElement.removeAttribute("data-gh-fork");
    };
  }, []);
  return <>{children}</>;
}

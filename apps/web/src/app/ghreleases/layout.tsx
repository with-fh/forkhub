import type { Metadata } from "next";

import GhReleasesForkChrome from "./chrome";
import "./gh-fork.css";

export const metadata: Metadata = {
  title: "Releases — ForkHub OSS",
  description: "Upstream GitHub-releases forks for ForkHub-track OSS.",
  robots: { index: false, follow: false },
};

export default function GhReleasesLayout({ children }: { children: React.ReactNode }) {
  return <GhReleasesForkChrome>{children}</GhReleasesForkChrome>;
}

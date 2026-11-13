export type OssMaintainer = "forkhub" | "third-party" | "community";
export type OssStatus = "active" | "draft" | "coming-soon";
export type OssSort = "stars" | "updated" | "patches" | "name";

export type OssPatchSummary = {
  id: string;
  title: string;
  status: "applied" | "draft";
  version: number;
  intentUrl: string;
};

export type OssEntry = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  upstream: string;
  upstreamUrl: string;
  /** "owner/repo" of the upstream, used for live star counts. */
  upstreamRepo: string;
  /** Public mark path for cards and hero floats. */
  mark: string;
  publisher: string;
  catalogUrl: string;
  maintainer: OssMaintainer;
  status: OssStatus;
  stars: number;
  patchCount: number;
  trains: ("stable" | "nightly")[];
  updated: string;
  install: string[];
  patches: OssPatchSummary[];
};

export const MAINTAINER_LABEL: Record<OssMaintainer, string> = {
  forkhub: "ForkHub-maintained",
  "third-party": "3rd-party-maintained",
  community: "Community-maintained",
};

const CATALOG = "https://github.com/with-fh/.forkhub";

/**
 * Seed catalog. Source of truth for v1 is static + curated.
 * Future: sync patch counts/status from with-fh/.forkhub via GitHub API.
 */
export const OSS_CATALOG: OssEntry[] = [
  {
    slug: "t3code",
    name: "T3 Code",
    tagline: "The open-source control plane for coding agents — with a ForkHub update track.",
    description:
      "Patched fork track for T3 Code desktop: per-publisher trains (stable/nightly) served from a .forkhub catalog, x ForkHub branding, side-by-side installs with stock, and an update-all nudge for connected servers.",
    upstream: "github.com/pingdotgg/t3code",
    upstreamUrl: "https://github.com/pingdotgg/t3code",
    upstreamRepo: "pingdotgg/t3code",
    mark: "/marks/t3code.webp",
    publisher: "with-fh",
    catalogUrl: CATALOG,
    maintainer: "forkhub",
    status: "active",
    stars: 23940,
    patchCount: 1,
    trains: ["stable", "nightly"],
    updated: "2026-09-28",
    install: [
      "fh reuse https://github.com/with-fh/.forkhub/blob/main/repos/github.com/pingdotgg/t3code/patches/t3code-forkhub-update-track-bb0ed06f/INTENT.md",
      "fh run t3 with-fh -- --version",
    ],
    patches: [
      {
        id: "t3code-forkhub-update-track-bb0ed06f",
        title: "ForkHub publisher model with per-publisher trains + side-by-side isolation",
        status: "applied",
        version: 10,
        intentUrl:
          "https://github.com/with-fh/.forkhub/blob/main/repos/github.com/pingdotgg/t3code/patches/t3code-forkhub-update-track-bb0ed06f/INTENT.md",
      },
    ],
  },
  {
    slug: "natively",
    name: "Natively",
    tagline: "AI assistant with a ForkHub catalog feed + stable hardware ID for fork builds.",
    description:
      "Fork feed repointed at the .forkhub catalog (no stock/fork cross-talk), fork-counter upgrade ordering, and a stable hardware ID so free-trial binding works without the private premium submodule.",
    upstream: "github.com/natively-ai-assistant/natively-cluely-ai-assistant",
    upstreamUrl: "https://github.com/natively-ai-assistant/natively-cluely-ai-assistant",
    upstreamRepo: "natively-ai-assistant/natively-cluely-ai-assistant",
    mark: "/marks/natively.png",
    publisher: "with-fh",
    catalogUrl: CATALOG,
    maintainer: "forkhub",
    status: "draft",
    stars: 2623,
    patchCount: 1,
    trains: ["nightly"],
    updated: "2026-09-27",
    install: [
      "fh reuse https://github.com/with-fh/.forkhub/blob/main/repos/github.com/natively-ai-assistant/natively-cluely-ai-assistant/patches/natively-forkhub-support-f276ae13/INTENT.md",
    ],
    patches: [
      {
        id: "natively-forkhub-support-f276ae13",
        title: "Natively ForkHub support (catalog update feed + publisher input + calendar + dock)",
        status: "draft",
        version: 1,
        intentUrl:
          "https://github.com/with-fh/.forkhub/blob/main/repos/github.com/natively-ai-assistant/natively-cluely-ai-assistant/patches/natively-forkhub-support-f276ae13/INTENT.md",
      },
    ],
  },
  {
    slug: "deepseek-harness",
    name: "DeepSeek Harness",
    tagline: "DeepSeek Harness desktop with a ForkHub update track — mac, Windows, and Linux.",
    description:
      "Patched fork track for DeepSeek Harness desktop: the app polls the ForkHub catalog instead of the stock feed, with a per-install publisher switch (Settings → Version), owner-stamped fork rebuilds, and a Linux build (AppImage) from the ImBIOS catalog layered on the same channel.",
    upstream: "github.com/deepseek-ai/deepseek-harness",
    upstreamUrl: "https://github.com/deepseek-ai/deepseek-harness",
    upstreamRepo: "deepseek-ai/deepseek-harness",
    // Mark vendored from the upstream MIT-licensed repo
    // (apps/desktop/resources/icon.svg); ForkHub builds carry their own
    // about-screen credit, this file is only the download-card icon.
    mark: "/marks/deepseek-harness.svg",
    publisher: "with-fh",
    catalogUrl: CATALOG,
    maintainer: "forkhub",
    status: "active",
    stars: 279830,
    patchCount: 2,
    trains: ["stable"],
    updated: "2026-11-13",
    install: [
      "fh reuse https://github.com/with-fh/.forkhub/blob/main/repos/github.com/deepseek-ai/deepseek-harness/patches/dsh-forkhub-support-0qjj6stm/INTENT.md",
      "fh run dsh with-fh -- --version",
    ],
    patches: [
      {
        id: "dsh-forkhub-support-0qjj6stm",
        title: "DeepSeek Harness Desktop ForkHub update channel: catalog feed + publisher input + fork rebuild identity",
        status: "applied",
        version: 2,
        intentUrl:
          "https://github.com/with-fh/.forkhub/blob/main/repos/github.com/deepseek-ai/deepseek-harness/patches/dsh-forkhub-support-0qjj6stm/INTENT.md",
      },
      {
        id: "dsh-linux-support-1b2e3f10",
        title: "DeepSeek Harness Desktop Linux support: linux-x64 target, AppImage, XDG autostart, per-publisher credit",
        status: "applied",
        version: 1,
        intentUrl:
          "https://github.com/ImBIOS/.forkhub/blob/main/repos/github.com/deepseek-ai/deepseek-harness/patches/dsh-linux-support-1b2e3f10/INTENT.md",
      },
    ],
  },
];

export type OssListInput = {
  q?: string;
  maintainer?: OssMaintainer | "all";
  status?: OssStatus | "all";
  sort?: OssSort;
};

export function listOss(input: OssListInput = {}): OssEntry[] {
  const q = (input.q ?? "").trim().toLowerCase();
  const maintainer = input.maintainer ?? "all";
  const status = input.status ?? "all";
  const sort: OssSort = input.sort ?? "stars";

  let out = OSS_CATALOG.filter((e) => {
    if (maintainer !== "all" && e.maintainer !== maintainer) return false;
    if (status !== "all" && e.status !== status) return false;
    if (!q) return true;
    return [e.name, e.upstream, e.tagline, e.slug].join(" ").toLowerCase().includes(q);
  });

  out = [...out].sort((a, b) => {
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

  return out;
}

export function getOss(slug: string): OssEntry | null {
  return OSS_CATALOG.find((e) => e.slug === slug) ?? null;
}

import type { Metadata } from "next";

import { getChannelReleases } from "@/lib/live";
import { mergePlatformBuilds } from "@/lib/releases";
import DshDownloadPage from "./dsh-page";
import "./dsh-upstream.css";
import "./ds-tokens.css";

export const metadata: Metadata = {
  title: "DeepSeek | Download DeepSeek Harness",
  description: "Download the DeepSeek app and DeepSeek Harness for desktop.",
  alternates: { canonical: "https://www.deepseek.com/en/download/" },
};

export default async function DeepseekHarnessDownloadPage() {
  const history = await getChannelReleases("deepseek-harness");
  const unified = [...history.stable, ...history.nightly];
  const builds = mergePlatformBuilds(unified);
  const byPlatform = (p: "linux" | "mac" | "windows") => builds.filter((b) => b.platform === p);
  const linux = byPlatform("linux");
  // Prefer the newest unified build per platform; fall back to any asset.
  const mac = byPlatform("mac");
  const win = byPlatform("windows");
  const macUrl =
    mac.find((b) => b.arch === "arm64")?.url ??
    "https://download.deepseek.com/desktop/dsh-latest-macos-arm64.dmg";
  const winForkUrl =
    win[0]?.url ?? "https://download.deepseek.com/desktop/dsh-latest-windows-x64.exe";
  const linuxUrl = linux[0]?.url ?? null;

  return <DshDownloadPage macUrl={macUrl} winForkUrl={winForkUrl} linuxUrl={linuxUrl} />;
}

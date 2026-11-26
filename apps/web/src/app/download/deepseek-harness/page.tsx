import type { Metadata } from "next";
import { headers } from "next/headers";

import { getChannelReleases } from "@/lib/live";
import { mergePlatformBuilds } from "@/lib/releases";
import DshDownloadPage, { type DesktopDownload } from "./dsh-page";
import { detectDesktopPlatform, downloadPath, selectLanguage } from "./preferences";
import "./dsh-download.css";

export const metadata: Metadata = {
  title: "Download DeepSeek Harness for desktop | ForkHub",
  description: "Download DeepSeek Harness for Linux, macOS, or Windows.",
  alternates: { canonical: `https://forkhub.imbios.dev${downloadPath}` },
};

const macFallback: DesktopDownload = {
  url: "https://download.deepseek.com/desktop/dsh-latest-macos-arm64.dmg",
  arch: "arm64",
  format: ".dmg",
};

const windowsFallback: DesktopDownload = {
  url: "https://download.deepseek.com/desktop/dsh-latest-windows-x64.exe",
  arch: "x64",
  format: ".exe",
};

export default async function DeepseekHarnessDownloadPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  const [history, requestHeaders, { lang }] = await Promise.all([
    getChannelReleases("deepseek-harness"),
    headers(),
    searchParams,
  ]);
  const builds = mergePlatformBuilds([...history.stable, ...history.nightly]);
  const mac = builds.find((build) => build.platform === "mac" && build.arch === "arm64");
  const windows = builds.find((build) => build.platform === "windows");
  const linux = builds.find((build) => build.platform === "linux");

  return (
    <DshDownloadPage
      downloads={{
        mac: mac ?? macFallback,
        windows: windows ?? windowsFallback,
        linux: linux ?? null,
      }}
      language={selectLanguage(lang, requestHeaders.get("accept-language") ?? "")}
      detectedPlatform={detectDesktopPlatform(
        requestHeaders.get("user-agent") ?? "",
        requestHeaders.get("sec-ch-ua-platform") ?? "",
      )}
    />
  );
}

"use client";

import { ArrowLeft, ArrowDownToLine } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import type { Arch, DownloadAsset } from "@/lib/releases";
import {
  detectDesktopPlatform,
  downloadPath,
  type DesktopPlatform,
  type DownloadLanguage,
} from "./preferences";

export type DesktopDownload = Pick<DownloadAsset, "url" | "arch" | "format">;

const desktopPlatforms: DesktopPlatform[] = ["linux", "mac", "windows"];
const platformNames: Record<DesktopPlatform, string> = {
  linux: "Linux",
  mac: "macOS",
  windows: "Windows",
};
const architectureNames: Record<Arch, string> = { arm64: "ARM64", x64: "x64" };

const copy = {
  en: {
    back: "ForkHub downloads",
    language: "Language",
    title: "DeepSeek Harness for desktop",
    description: "Work with local files and run long, complex tasks in the background.",
    installers: "Desktop installers",
    download: (platform: string) => `Download for ${platform}`,
    recommended: "Recommended for this device",
    macRequirement: "macOS 13 or later",
    unavailable: "A build is currently unavailable.",
    screenshot: "DeepSeek Harness desktop interface",
  },
  "zh-CN": {
    back: "ForkHub 下载",
    language: "语言",
    title: "DeepSeek Harness 桌面版",
    description: "编辑本地文件，并在后台处理耗时的复杂任务。",
    installers: "桌面安装包",
    download: (platform: string) => `下载 ${platform} 版`,
    recommended: "推荐用于此设备",
    macRequirement: "macOS 13 或更新版本",
    unavailable: "暂时没有可下载的版本。",
    screenshot: "DeepSeek Harness 桌面界面",
  },
} satisfies Record<DownloadLanguage, Record<string, unknown>>;

const languages: { code: DownloadLanguage; label: string; name: string }[] = [
  { code: "zh-CN", label: "中文", name: "简体中文" },
  { code: "en", label: "EN", name: "English" },
];

function subscribeToPlatform() {
  return () => undefined;
}

function getBrowserPlatform() {
  return detectDesktopPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
}

export default function DshDownloadPage({
  downloads,
  language,
  detectedPlatform,
}: {
  downloads: Record<DesktopPlatform, DesktopDownload | null>;
  language: DownloadLanguage;
  detectedPlatform: DesktopPlatform | null;
}) {
  const text = copy[language];
  const platform = useSyncExternalStore(
    subscribeToPlatform,
    getBrowserPlatform,
    () => detectedPlatform,
  );
  const recommended = platform && downloads[platform] ? platform : null;
  const platforms = recommended
    ? [recommended, ...desktopPlatforms.filter((item) => item !== recommended)]
    : desktopPlatforms;

  return (
    <div lang={language} className="dsh-download">
      <header className="dsh-download-header fh-container">
        <Link href="/download" className="dsh-download-back">
          <ArrowLeft aria-hidden="true" size={18} />
          {text.back}
        </Link>
        <nav className="dsh-download-languages" aria-label={text.language}>
          {languages.map(({ code, label, name }) => (
            <Link
              key={code}
              href={{ pathname: downloadPath, query: { lang: code } }}
              prefetch={false}
              lang={code}
              hrefLang={code}
              aria-label={name}
              aria-current={language === code ? "true" : undefined}
              scroll={false}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="fh-container dsh-download-content">
        <div className="dsh-download-details">
          <h1 className="fh-display">{text.title}</h1>
          <p className="dsh-download-description">{text.description}</p>
          <section aria-label={text.installers}>
            <ul className="dsh-download-installers">
              {platforms.map((item) => {
                const build = downloads[item];
                const name = platformNames[item];
                return (
                  <li key={item}>
                    {build ? (
                      <a
                        className="dsh-download-installer"
                        data-recommended={recommended === item ? "true" : undefined}
                        href={build.url}
                      >
                        <ArrowDownToLine size={19} aria-hidden="true" />
                        <span>
                          <strong>{text.download(name)}</strong>
                          <small>
                            {architectureNames[build.arch]} · {build.format}
                            {item === "mac" ? ` · ${text.macRequirement}` : null}
                            {recommended === item ? ` · ${text.recommended}` : null}
                          </small>
                        </span>
                      </a>
                    ) : (
                      <div className="dsh-download-installer">
                        <span>
                          <strong>{name}</strong>
                          <small>{text.unavailable}</small>
                        </span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="dsh-download-preview"
          src="/images/download/desktop-en-1066.webp"
          width={1066}
          height={720}
          alt={text.screenshot}
        />
      </div>
    </div>
  );
}

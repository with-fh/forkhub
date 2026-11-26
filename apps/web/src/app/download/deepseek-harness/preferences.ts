import type { Platform } from "@/lib/releases";

export type DesktopPlatform = Exclude<Platform, "source">;
export type DownloadLanguage = "en" | "zh-CN";

export const downloadPath = "/download/deepseek-harness";

export function selectLanguage(
  requested: string | string[] | undefined,
  acceptLanguage: string,
): DownloadLanguage {
  if (requested === "en" || requested === "zh-CN") return requested;

  const preferences = acceptLanguage
    .split(",")
    .map((entry) => {
      const [tag, weight] = entry
        .trim()
        .toLowerCase()
        .split(/\s*;\s*/, 2);
      return { tag, quality: weight?.startsWith("q=") ? Number(weight.slice(2)) : 1 };
    })
    .filter(({ quality }) => quality > 0 && quality <= 1)
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of preferences) {
    const language = tag?.split("-")[0];
    if (language === "zh") return "zh-CN";
    if (language === "en") return "en";
  }
  return "en";
}

export function detectDesktopPlatform(
  userAgent: string,
  platformHint = "",
  touchPoints = 0,
): DesktopPlatform | null {
  const platform = platformHint.replaceAll('"', "").trim();
  const device = `${platform} ${userAgent}`;
  if (/Android|iPhone|iPad|iPod|Mobile|CrOS|Chrome OS/i.test(device)) return null;
  // iPadOS can identify itself as a Mac when requesting desktop sites.
  if (touchPoints > 1 && /mac/i.test(platform || userAgent)) return null;

  if (/^(windows|win32|win64)$/i.test(platform)) return "windows";
  if (/^(macos|macintel|mac)$/i.test(platform)) return "mac";
  if (/^linux/i.test(platform)) return "linux";

  if (/Windows/i.test(userAgent)) return "windows";
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "mac";
  if (/Linux/i.test(userAgent)) return "linux";
  return null;
}

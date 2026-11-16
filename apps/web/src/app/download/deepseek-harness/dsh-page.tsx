"use client";

import { useEffect } from "react";

/**
 * Pixel-faithful fork of https://www.deepseek.com/en/download/ desktop section.
 * Same layout, copy, styles, and assets — only the download URLs are wired
 * to the ForkHub catalog (per-platform newest unified build), plus a Linux
 * download (stock page has no desktop Linux build) and a ForkHub-track
 * disclosure strip below the fold-equivalent content.
 */
export default function DshDownloadPage({
  macUrl,
  winForkUrl,
  linuxUrl,
  version,
}: {
  macUrl: string;
  winForkUrl: string | null;
  linuxUrl: string | null;
  version: string | null;
}) {
  useEffect(() => {
    // Same mobile-detection as upstream: sets data-download-mobile on <html>.
    const n = navigator;
    const hints = (n as Navigator & { userAgentData?: { platform?: string; mobile?: boolean } })
      .userAgentData;
    const isMobile = (e: string, t: string | undefined, touch: number, r: boolean): boolean =>
      r || /Android|iPad|iPhone|iPod|Mobi/i.test(e) || (/Mac/i.test(t ?? "") && touch > 1);
    if (
      isMobile(
        n.userAgent,
        (hints && hints.platform) || n.platform,
        n.maxTouchPoints || 0,
        !!(hints && hints.mobile),
      )
    ) {
      document.documentElement.setAttribute("data-download-mobile", "true");
    }
  }, []);

  useEffect(() => {
    const onScroll = () => {
      document
        .getElementById("dsh-download-header")
        ?.classList.toggle("is-scrolled", window.scrollY > 4);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main lang="en" className="download-page">
      <div className="download-background" aria-hidden="true">
        <canvas
          aria-hidden="true"
          className="ds-flow-field-canvas"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "transparent",
            pointerEvents: "none",
          }}
        />
      </div>
      <header className="download-header" id="dsh-download-header">
        <a aria-label="DeepSeek home" href="https://www.deepseek.com/en/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/download/deepseek-logo.svg"
            width={143}
            height={23}
            alt="DeepSeek"
            style={{ display: "block" }}
          />
        </a>
        <div className="ds-locale-toggle">
          <button type="button" className="ds-locale-toggle-item">
            中文
          </button>
          <button type="button" className="ds-locale-toggle-item is-active">
            EN
          </button>
        </div>
      </header>
      <div className="download-content">
        <section className="download-desktop" aria-label="Desktop downloads">
          <div className="download-desktop-art">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/download/desktop-en-1066.webp"
              srcSet="/images/download/desktop-en-1066.webp 2x, /images/download/desktop-en-1599.webp 3x, /images/download/desktop-en-6x.webp 6x"
              width={533}
              height={360}
              alt="DeepSeek Harness desktop interface"
            />
          </div>
          <div className="download-product-copy">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="download-product-icon"
              src="/images/download/harness-icon-176.webp"
              srcSet="/images/download/harness-icon-176.webp 2x, /images/download/harness-icon-264.webp 3x"
              width={88}
              height={88}
              alt=""
            />
            <h1>
              <span>DeepSeek Harness</span> for desktop
            </h1>
            <p className="download-description">
              DeepSeek Harness now available for desktop.
              <br />
              Work in the background, edit local files, and handle long, complex tasks with ease.
              <br />
              New features and improvements are shipped regularly.
            </p>
            <div className="download-desktop-actions">
              <div className="download-primary-action">
                <a
                  className="download-button"
                  href={macUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Download for macOS
                </a>
                <span className="download-platform-note">Apple silicon, macOS 13 or later</span>
              </div>
              <p>
                Also available for{" "}
                <a
                  className="download-text-link"
                  href={
                    winForkUrl ?? "https://download.deepseek.com/desktop/dsh-latest-windows-x64.exe"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Windows
                </a>
                {linuxUrl ? (
                  <>
                    {" · "}
                    <a
                      className="download-text-link"
                      href={linuxUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Linux
                    </a>
                  </>
                ) : null}
              </p>
              {version ? <p className="download-version-note">ForkHub track · {version}</p> : null}
            </div>
          </div>
        </section>
        <section className="download-mobile" aria-label="Mobile downloads">
          <div className="download-product-copy">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="download-product-icon"
              src="/images/download/app-icon-120.webp"
              srcSet="/images/download/app-icon-120.webp 1x, /images/download/app-icon-240.webp 2x, /images/download/app-icon-360.webp 3x"
              width={120}
              height={120}
              alt=""
            />
            <h2>
              <span>DeepSeek</span> app
            </h2>
            <p className="download-description">
              <span className="download-description-phone">
                The official AI assistant from DeepSeek. <br />
                Chat with leading AI models for free.
              </span>
              <span className="download-description-desktop">
                The official AI assistant from DeepSeek. Chat with leading AI models for free.{" "}
                <br />
                Powered by our latest flagship model, with faster answers and more powerful features
                to help you learn, create, and get things done.
              </span>
            </p>
            <div className="download-qr-list">
              <div className="download-qr-item">
                <div className="download-qr">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/download/qr-ios.png"
                    width={140}
                    height={140}
                    alt="QR code to download for iOS"
                  />
                </div>
                <a
                  className="download-button"
                  href="https://apps.apple.com/cn/app/deepseek/id6737597349"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Download for iOS
                </a>
              </div>
              <div className="download-qr-item">
                <div className="download-qr">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/download/qr-play.png"
                    width={140}
                    height={140}
                    alt="QR code to download for Android"
                  />
                </div>
                <a
                  className="download-button"
                  href="https://download.deepseek.com/apk/deepseek.apk"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Download for Android
                </a>
              </div>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="download-mobile-art"
            src="/images/download/mobile-en-606.webp"
            srcSet="/images/download/mobile-en-606.webp 606w, /images/download/mobile-en-1212.webp 1212w, /images/download/mobile-en-1818.webp 1818w"
            sizes="(max-width: 767px) calc(100vw - 48px), (max-width: 1050px) calc((100vw - 96px) / 2), 606px"
            width={606}
            height={376}
            alt="DeepSeek app chat and history screens"
            loading="lazy"
          />
        </section>
        <section className="download-forkhub-strip" aria-label="ForkHub track details">
          <p>
            ForkHub track{version ? ` · ${version}` : ""}: desktop installers above are patched
            builds that self-update from the{" "}
            <a href="https://github.com/with-fh/.forkhub" target="_blank" rel="noreferrer">
              with-fh patch catalog
            </a>{" "}
            instead of the stock feed. Prefer stock? Use the same buttons on{" "}
            <a href="https://www.deepseek.com/en/download/" target="_blank" rel="noreferrer">
              deepseek.com
            </a>
            . Linux has no stock desktop build — the ForkHub AppImage is the Linux download.
          </p>
          <p>
            <code>fh run dsh with-fh -- --version</code> installs the managed build. Patch intents:{" "}
            <a
              href="https://github.com/with-fh/.forkhub/blob/main/repos/github.com/deepseek-ai/deepseek-harness/patches/dsh-forkhub-support-0qjj6stm/INTENT.md"
              target="_blank"
              rel="noreferrer"
            >
              update channel
            </a>{" "}
            ·{" "}
            <a
              href="https://github.com/with-fh/.forkhub/blob/main/repos/github.com/deepseek-ai/deepseek-harness/patches/dsh-linux-support-1b2e3f10/INTENT.md"
              target="_blank"
              rel="noreferrer"
            >
              linux support
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";

import "../index.css";
import Footer from "@/components/footer";
import Header from "@/components/header";
import Providers from "@/components/providers";
import { FORKHUB_SITE_URL } from "@/lib/site";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(FORKHUB_SITE_URL),
  title: "ForkHub — the open-source control plane for fork patches",
  description:
    "Declare each local change once as intent. ForkHub re-derives it against every upstream release. Patches are intent, not diffs.",
  openGraph: {
    title: "ForkHub — the open-source control plane for fork patches",
    description:
      "Declare each local change once as intent. ForkHub re-derives it against every upstream release.",
    url: FORKHUB_SITE_URL,
    siteName: "ForkHub",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${dmSans.variable} ${jetbrainsMono.variable} antialiased`}>
        <Providers>
          <Header />
          <main>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}

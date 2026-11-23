import DownloadClient from "./download-client";
import { getStarsMap } from "@/lib/live";

export const metadata = {
  title: "Download — ForkHub",
  description: "Patched builds of supported OSS. Pick a channel, install in one command.",
};

export default async function DownloadPage() {
  const stars = await getStarsMap();
  return <DownloadClient stars={stars} />;
}

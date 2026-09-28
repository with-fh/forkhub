"use client";

import { buttonVariants } from "@forkhub/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@forkhub/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use } from "react";

import { orpc } from "@/utils/orpc";

export default function OssDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const entry = useQuery(orpc.oss.get.queryOptions({ input: { slug } }));

  if (entry.isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (entry.isError || !entry.data) {
    return (
      <div className="mx-auto grid w-full max-w-3xl gap-4 px-4 py-10">
        <h1 className="text-2xl font-bold">Not found</h1>
        <p className="text-sm text-muted-foreground">
          No OSS entry for <span className="font-mono">{slug}</span>.
        </p>
        <Link href="/oss" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Back to OSS
        </Link>
      </div>
    );
  }

  const e = entry.data;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      <section className="grid gap-2">
        <Link href="/oss" className="text-xs text-muted-foreground underline underline-offset-4">
          ← All supported OSS
        </Link>
        <h1 className="text-4xl font-bold tracking-tight">{e.name}</h1>
        <p className="font-mono text-xs text-muted-foreground">{e.upstream}</p>
        <p className="text-sm text-muted-foreground sm:text-base">{e.description}</p>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="rounded border px-2 py-0.5">
            {e.maintainer === "forkhub"
              ? "ForkHub-maintained"
              : e.maintainer === "third-party"
                ? "3rd-party-maintained"
                : "Community-maintained"}
          </span>
          <span className="rounded border px-2 py-0.5">{e.status}</span>
          <span className="rounded border px-2 py-0.5">trains: {e.trains.join(", ")}</span>
          <span className="rounded border px-2 py-0.5">updated {e.updated}</span>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <a
            href={e.upstreamUrl}
            rel="noreferrer"
            target="_blank"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Upstream repo
          </a>
          <a
            href={e.catalogUrl}
            rel="noreferrer"
            target="_blank"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Patch catalog
          </a>
        </div>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="mb-2 font-medium">Use it</h2>
        <div className="grid gap-2">
          {e.install.map((cmd) => (
            <pre key={cmd} className="overflow-x-auto rounded bg-muted p-3 font-mono text-xs">
              {`$ ${cmd}`}
            </pre>
          ))}
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl font-bold tracking-tight">Patches ({e.patches.length})</h2>
        {e.patches.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle className="text-sm">{p.title}</CardTitle>
              <CardDescription className="font-mono text-[11px]">{p.id}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              <span className="rounded border px-2 py-0.5 text-[11px]">{p.status}</span>
              <span className="rounded border px-2 py-0.5 text-[11px]">v{p.version}</span>
              <a
                href={p.intentUrl}
                rel="noreferrer"
                target="_blank"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Read INTENT.md
              </a>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}

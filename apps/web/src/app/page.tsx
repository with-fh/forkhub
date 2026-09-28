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

import { orpc } from "@/utils/orpc";

export default function Home() {
  const healthCheck = useQuery(orpc.healthCheck.queryOptions());
  const oss = useQuery(orpc.oss.list.queryOptions({ sort: "stars" }));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="grid gap-10">
        {/* Hero — t3.codes rhythm: eyebrow, big headline, sub, CTAs */}
        <section className="grid gap-5 py-10 text-center">
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            forkhub — patches are intent, not diffs
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-6xl">
            The open-source
            <br />
            control plane
            <br />
            for fork patches.
          </h1>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
            Declare each local change once as intent. An AI agent re-derives it against every
            upstream release — you keep your patches and upstream&apos;s features.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/oss" className={buttonVariants({ size: "lg" })}>
              Browse supported OSS
            </Link>
            <a
              href="https://github.com/ImBIOS/forkhub"
              rel="noreferrer"
              target="_blank"
              className={buttonVariants({ size: "lg", variant: "outline" })}
            >
              Steal our code (legally)
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            Served at <span className="font-mono">forkhub.imbios.dev</span> · catalog publishes from{" "}
            <span className="font-mono">with-fh/.forkhub</span>
          </p>
        </section>

        {/* Install strip */}
        <section className="rounded-lg border p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-medium">Install</h2>
            <code className="rounded bg-muted px-2 py-1 font-mono text-xs">npm i -g forkhub</code>
          </div>
          <pre className="overflow-x-auto rounded bg-muted p-3 font-mono text-xs">
            {`$ fh init                    # set up .forkhub in your fork
$ fh draft "add --cheat flag" # declare intent, AI implements
$ fh satisfied                # capture diff, port to forkhub/main
$ fh update                   # upstream releases? re-derive + apply`}
          </pre>
        </section>

        {/* Supported OSS preview */}
        <section className="grid gap-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Supported OSS</h2>
              <p className="text-sm text-muted-foreground">
                ForkHub-maintained today. 3rd-party and community catalogs next.
              </p>
            </div>
            <Link href="/oss" className={buttonVariants({ variant: "outline", size: "sm" })}>
              View all
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {oss.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading catalog…</p>
            ) : (
              oss.data?.map((e) => (
                <Card key={e.slug}>
                  <CardHeader>
                    <CardTitle>{e.name}</CardTitle>
                    <CardDescription className="font-mono text-[11px]">
                      {e.upstream}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <p className="text-xs text-muted-foreground">{e.tagline}</p>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <span className="rounded border px-2 py-0.5">ForkHub-maintained</span>
                      <span className="rounded border px-2 py-0.5">
                        {e.patchCount} {e.patchCount === 1 ? "patch" : "patches"}
                      </span>
                      <span className="rounded border px-2 py-0.5">{e.status}</span>
                    </div>
                    <Link
                      href={`/oss/${e.slug}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Open {e.name}
                    </Link>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </section>

        {/* API status */}
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-medium">API Status</h2>
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${healthCheck.data ? "bg-green-500" : "bg-red-500"}`}
            />
            <span className="text-sm text-muted-foreground">
              {healthCheck.isLoading
                ? "Checking..."
                : healthCheck.data
                  ? "Connected"
                  : "Disconnected"}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}

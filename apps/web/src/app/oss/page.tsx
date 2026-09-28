"use client";

import { buttonVariants } from "@forkhub/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@forkhub/ui/components/card";
import { Input } from "@forkhub/ui/components/input";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { orpc } from "@/utils/orpc";

type Maintainer = "all" | "forkhub" | "third-party" | "community";
type Status = "all" | "active" | "draft" | "coming-soon";
type Sort = "stars" | "updated" | "patches" | "name";

const selectClass =
  "h-8 rounded-none border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring dark:bg-input/30";

export default function OssPage() {
  const [q, setQ] = useState("");
  const [maintainer, setMaintainer] = useState<Maintainer>("all");
  const [status, setStatus] = useState<Status>("all");
  const [sort, setSort] = useState<Sort>("stars");

  const entries = useQuery(orpc.oss.list.queryOptions({ input: { q, maintainer, status, sort } }));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="grid gap-6">
        <section className="grid gap-2">
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Supported OSS
          </p>
          <h1 className="text-4xl font-bold tracking-tight">Run patched builds, stay current.</h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            Every entry ships ForkHub intent-patches from the{" "}
            <a
              className="underline underline-offset-4"
              href="https://github.com/with-fh/.forkhub"
              rel="noreferrer"
              target="_blank"
            >
              with-fh/.forkhub
            </a>{" "}
            catalog. Search, filter by maintainer, sort by what matters — then reuse with one
            command.
          </p>
        </section>

        {/* Controls */}
        <section className="flex flex-wrap items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, upstream, tagline…"
            className="max-w-xs"
          />
          <select
            aria-label="Maintainer"
            className={selectClass}
            value={maintainer}
            onChange={(e) => setMaintainer(e.target.value as Maintainer)}
          >
            <option value="all">All maintainers</option>
            <option value="forkhub">ForkHub-maintained</option>
            <option value="third-party">3rd-party-maintained</option>
            <option value="community">Community-maintained</option>
          </select>
          <select
            aria-label="Status"
            className={selectClass}
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="coming-soon">Coming soon</option>
          </select>
          <select
            aria-label="Sort"
            className={selectClass}
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
          >
            <option value="stars">Sort: stars</option>
            <option value="updated">Sort: recently updated</option>
            <option value="patches">Sort: most patches</option>
            <option value="name">Sort: name</option>
          </select>
        </section>

        {/* Results */}
        <section className="grid gap-4 sm:grid-cols-2">
          {entries.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading catalog…</p>
          ) : entries.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No matches. Try clearing the search or choosing a different maintainer.
            </p>
          ) : (
            entries.data?.map((e) => (
              <Card key={e.slug}>
                <CardHeader>
                  <CardTitle>{e.name}</CardTitle>
                  <CardDescription className="font-mono text-[11px]">{e.upstream}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <p className="text-xs text-muted-foreground">{e.tagline}</p>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded border px-2 py-0.5">
                      {e.maintainer === "forkhub"
                        ? "ForkHub-maintained"
                        : e.maintainer === "third-party"
                          ? "3rd-party-maintained"
                          : "Community-maintained"}
                    </span>
                    <span className="rounded border px-2 py-0.5">
                      {e.patchCount} {e.patchCount === 1 ? "patch" : "patches"}
                    </span>
                    <span className="rounded border px-2 py-0.5">{e.status}</span>
                    <span className="rounded border px-2 py-0.5">
                      ★ {e.stars >= 1000 ? `${(e.stars / 1000).toFixed(0)}k` : e.stars}
                    </span>
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
        </section>
      </div>
    </div>
  );
}

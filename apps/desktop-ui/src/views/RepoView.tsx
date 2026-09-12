import { useEffect, useRef, useState } from "react";
import type { Child } from "@tauri-apps/plugin-shell";
import { fhEnv, runFh, spawnFh } from "../lib/fh";
import { parseDriftJson, parseStatus } from "../lib/parse";
import { CommandCard, type Activity } from "../components/CommandCard";
import { Badge, Btn, Card, Check, Field, KV, LogView, TextInput } from "../components/ui";

function StatusCard(props: { repo: string; onActivity: (a: Activity) => void }) {
  const [out, setOut] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function refresh() {
    if (!props.repo || loading) return;
    setLoading(true);
    try {
      const res = await runFh(["status"], { cwd: props.repo, env: fhEnv() });
      setOut(res.stdout);
      setErr(res.stderr);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setOut("");
    setErr("");
    if (props.repo) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.repo]);

  const parsed = parseStatus(out);
  return (
    <Card
      title="Status"
      desc="Current tag, latest tag, and whether an update is available."
      right={
        <Btn variant="ghost" onClick={refresh} disabled={!props.repo || loading}>
          Refresh
        </Btn>
      }
    >
      {!props.repo && <p className="text-xs text-amber-300">Pick a fork checkout above first.</p>}
      {parsed.current && (
        <KV
          rows={[
            ["Current", parsed.current],
            ["Latest", parsed.latest],
            ["State", parsed.behind ? "update available — run fh update" : "up to date"],
          ]}
        />
      )}
      <LogView stdout="" stderr={err} />
    </Card>
  );
}

function DriftCard(props: { repo: string; onActivity: (a: Activity) => void }) {
  return (
    <CommandCard
      cmd="drift-check"
      title="Drift check"
      desc="Detect which patches drifted from upstream. Uses --json for a structured table."
      button="Check drift"
      repo={props.repo}
      onActivity={props.onActivity}
      buildArgs={() => ["drift-check", "--json"]}
      renderResult={(result) => {
        if (result.code !== 0) return <LogView stdout={result.stdout} stderr={result.stderr} />;
        const drift = parseDriftJson(result.stdout);
        if (!drift) return <LogView stdout={result.stdout} stderr={result.stderr} />;
        const tone = (s: string) =>
          s === "drifted" ? "bad" : s === "current" ? "ok" : s === "upstreamed" ? "info" : "warn";
        return (
          <div className="grid gap-2">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="muted">total {drift.summary.total}</Badge>
              <Badge tone="ok">current {drift.summary.current}</Badge>
              <Badge tone="bad">drifted {drift.summary.drifted}</Badge>
              <Badge tone="muted">skippable {drift.summary.wouldSkip}</Badge>
              <Badge tone={drift.upstreamAdvanced ? "warn" : "muted"}>
                upstream {drift.upstreamSha.slice(0, 7)}
                {drift.upstreamAdvanced ? " (advanced)" : " (unchanged)"}
              </Badge>
            </div>
            {drift.patches.length === 0 ? (
              <p className="text-xs text-zinc-500">No intent patches tracked.</p>
            ) : (
              <div className="overflow-auto rounded-lg border border-white/10">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-white/10 text-xs text-zinc-500">
                      <th className="px-3 py-1.5 font-medium">Patch</th>
                      <th className="px-3 py-1.5 font-medium">Status</th>
                      <th className="px-3 py-1.5 font-medium">Upstream / area</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drift.patches.map((p) => (
                      <tr key={p.patchId} className="border-b border-white/5 last:border-0">
                        <td className="px-3 py-1.5">
                          <div className="font-mono text-[12px] text-zinc-200">{p.patchId}</div>
                          {p.title && <div className="text-[11px] text-zinc-500">{p.title}</div>}
                        </td>
                        <td className="px-3 py-1.5">
                          <Badge tone={tone(p.status) as "ok" | "warn" | "bad" | "muted" | "info"}>
                            {p.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-1.5 text-[12px] text-zinc-400">
                          {p.upstreamChanged ? "upstream changed" : "upstream same"}
                          {" · "}
                          {p.targetAreaChanged
                            ? `area changed (${p.filesChangedInTargetArea.length} files)`
                            : "area same"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      }}
    />
  );
}

function WatchCard(props: { repo: string }) {
  const [once, setOnce] = useState(true);
  const [interval, setInterval] = useState("300");
  const [agent, setAgent] = useState("");
  const [watching, setWatching] = useState(false);
  const [log, setLog] = useState("");
  const childRef = useRef<Child | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log]);

  useEffect(() => () => void childRef.current?.kill().catch(() => {}), []);

  async function start() {
    if (!props.repo || watching) return;
    const args = ["watch"];
    if (once) args.push("--once");
    const secs = Number.parseInt(interval, 10);
    if (!once && Number.isFinite(secs) && secs > 0) args.push("--interval", String(secs));
    if (agent.trim()) args.push("--agent", agent.trim());
    setLog(`$ fh ${args.join(" ")}\n`);
    setWatching(true);
    try {
      const { child, closed } = await spawnFh(args, {
        cwd: props.repo,
        env: fhEnv(),
        onOut: (l) => setLog((prev) => `${prev}${l}\n`),
        onErr: (l) => setLog((prev) => `${prev}${l}\n`),
      });
      childRef.current = child;
      await closed;
    } catch (e) {
      setLog((prev) => `${prev}${e instanceof Error ? e.message : String(e)}\n`);
    } finally {
      childRef.current = null;
      setWatching(false);
    }
  }

  async function stop() {
    await childRef.current?.kill().catch(() => {});
  }

  return (
    <Card
      title="Watch daemon"
      desc="Auto-detect drift, regenerate bundles, apply. Streams live output; stop anytime."
      right={
        watching ? (
          <Btn variant="danger" onClick={stop}>
            Stop
          </Btn>
        ) : (
          <Btn onClick={start} disabled={!props.repo}>
            Start watch
          </Btn>
        )
      }
    >
      {!props.repo && <p className="text-xs text-amber-300">Pick a fork checkout above first.</p>}
      <div className="grid gap-2 sm:grid-cols-3">
        <Check value={once} onChange={setOnce} label="--once" />
        <Field label="--interval (sec)">
          <TextInput value={interval} onChange={setInterval} placeholder="300" mono />
        </Field>
        <Field label="--agent">
          <TextInput value={agent} onChange={setAgent} placeholder="opencode" mono />
        </Field>
      </div>
      {log && (
        <div
          ref={logRef}
          className="log-view max-h-72 overflow-auto rounded-lg border border-white/10 bg-black/60 p-3 text-zinc-300"
        >
          {log}
        </div>
      )}
    </Card>
  );
}

export function RepoView(props: { repo: string; onActivity: (a: Activity) => void }) {
  return (
    <div className="grid gap-4">
      <StatusCard repo={props.repo} onActivity={props.onActivity} />
      <div className="grid gap-4 xl:grid-cols-2">
        <CommandCard
          cmd="update"
          title="Update"
          desc="Advance the checkout to the latest (or a given) upstream tag."
          repo={props.repo}
          onActivity={props.onActivity}
          fields={[
            { key: "tag", label: "--tag", kind: "text", placeholder: "(latest)" },
            { key: "dry-run", label: "--dry-run", kind: "check" },
            { key: "skip-install", label: "--skip-install", kind: "check" },
          ]}
          buildArgs={(v) => {
            const args = ["update"];
            if (typeof v.tag === "string" && v.tag.trim()) args.push("--tag", v.tag.trim());
            if (v["dry-run"] === true) args.push("--dry-run");
            if (v["skip-install"] === true) args.push("--skip-install");
            return args;
          }}
        />
        <CommandCard
          cmd="rollback"
          title="Rollback"
          desc="Roll back to the previous tag."
          repo={props.repo}
          onActivity={props.onActivity}
          fields={[
            { key: "dry-run", label: "--dry-run", kind: "check" },
            { key: "skip-install", label: "--skip-install", kind: "check" },
          ]}
          buildArgs={(v) => {
            const args = ["rollback"];
            if (v["dry-run"] === true) args.push("--dry-run");
            if (v["skip-install"] === true) args.push("--skip-install");
            return args;
          }}
        />
      </div>
      <DriftCard repo={props.repo} onActivity={props.onActivity} />
      <WatchCard repo={props.repo} />
    </div>
  );
}

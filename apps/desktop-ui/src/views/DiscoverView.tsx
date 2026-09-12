import { useState } from "react";
import { fhEnv, loadToken, runFh, saveToken } from "../lib/fh";
import { kv, parseSearch, type SearchRow } from "../lib/parse";
import { CommandCard, type Activity } from "../components/CommandCard";
import { Badge, Btn, Card, KV, TextInput } from "../components/ui";

function ImportButton(props: { url: string; repo: string; label?: string }) {
  const [state, setState] = useState<"idle" | "running" | "ok" | "fail">("idle");
  async function run() {
    if (!props.repo || state === "running") return;
    setState("running");
    try {
      const res = await runFh(["import", props.url], { cwd: props.repo, env: fhEnv() });
      setState(res.code === 0 ? "ok" : "fail");
    } catch {
      setState("fail");
    }
  }
  return (
    <Btn variant="ghost" onClick={run} disabled={!props.repo || state === "running"}>
      {state === "running"
        ? "Importing…"
        : state === "ok"
          ? "Imported ✓"
          : state === "fail"
            ? "Failed — retry"
            : (props.label ?? "Import")}
    </Btn>
  );
}

function ResultList(props: { rows: SearchRow[]; repo: string; emptyNote: string }) {
  if (props.rows.length === 0) return <p className="text-xs text-zinc-500">{props.emptyNote}</p>;
  return (
    <div className="grid gap-2">
      {props.rows.map((r) => (
        <div
          key={`${r.author}-${r.patchId}`}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2"
        >
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-[12.5px] text-zinc-100">{r.patchId}</div>
            <div className="truncate text-xs text-zinc-400">
              {r.title} · by {r.author}
              {r.target ? ` · target ${r.target}` : ""}
            </div>
          </div>
          <Badge tone="muted">★ {r.stars}</Badge>
          {r.url && (
            <>
              <ImportButton url={r.url} repo={props.repo} />
              <Btn
                variant="ghost"
                onClick={() => navigator.clipboard?.writeText(r.url ?? "").catch(() => {})}
              >
                Copy URL
              </Btn>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

const searchFields = [
  { key: "query", label: "query", kind: "text", placeholder: "cheat flag" },
  { key: "target", label: "--target", kind: "text", placeholder: "github.com/owner/repo" },
  { key: "author", label: "--author", kind: "text", placeholder: "alice" },
  { key: "limit", label: "--limit", kind: "text", placeholder: "20" },
  { key: "sort", label: "--sort stars", kind: "check" },
] as const;

function buildSearchArgs(v: Record<string, string | boolean>, base: string[]): string[] {
  const args = [...base];
  for (const k of ["query", "target", "author", "limit"] as const) {
    const val = v[k];
    if (k === "query") {
      if (typeof val === "string" && val.trim()) args.push(val.trim());
    } else if (typeof val === "string" && val.trim()) {
      args.push(`--${k}`, val.trim());
    }
  }
  if (v.sort === true) args.push("--sort", "stars");
  return args;
}

export function DiscoverView(props: { repo: string; onActivity: (a: Activity) => void }) {
  const { repo, onActivity } = props;
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <CommandCard
          cmd="search"
          title="Search patches"
          desc="Find published patch intents on GitHub. Import straight from a result."
          button="Search"
          repo={repo}
          needsRepo={false}
          onActivity={onActivity}
          fields={[...searchFields]}
          buildArgs={(v) => buildSearchArgs(v, ["search"])}
          renderResult={(r) =>
            r.code === 0 ? (
              <ResultList rows={parseSearch(r.stdout)} repo={repo} emptyNote="No patches found." />
            ) : null
          }
        />
        <CommandCard
          cmd="popular"
          title="Popular patches"
          desc="Most-starred patches first — the merge-priority signal."
          button="Show popular"
          repo={repo}
          needsRepo={false}
          onActivity={onActivity}
          fields={[
            { key: "query", label: "query", kind: "text", placeholder: "(optional)" },
            {
              key: "target",
              label: "--target",
              kind: "text",
              placeholder: "github.com/owner/repo",
            },
            { key: "author", label: "--author", kind: "text", placeholder: "(optional)" },
          ]}
          buildArgs={(v) => buildSearchArgs(v, ["popular"])}
          renderResult={(r) =>
            r.code === 0 ? (
              <ResultList rows={parseSearch(r.stdout)} repo={repo} emptyNote="No patches found." />
            ) : null
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <CommandCard
          cmd="import"
          title="Import"
          desc="Import a patch intent from another user's .forkhub."
          repo={repo}
          onActivity={onActivity}
          required={["url"]}
          fields={[
            {
              key: "url",
              label: "INTENT.md URL",
              kind: "text",
              placeholder: "https://github.com/…/INTENT.md",
            },
            { key: "force", label: "--force", kind: "check" },
          ]}
          buildArgs={(v) => {
            const args = ["import", String(v.url ?? "").trim()];
            if (v.force === true) args.push("--force");
            return args;
          }}
          renderResult={(r) => (
            <KV
              rows={[
                ["Patch ID", kv(r.stdout, "Patch ID")],
                ["Target repo", kv(r.stdout, "Target repo")],
                ["Author", kv(r.stdout, "Author")],
                ["Files", kv(r.stdout, "Files")],
              ]}
            />
          )}
        />
        <CommandCard
          cmd="reuse"
          title="Reuse"
          desc="Import + build a re-derivation bundle in one step."
          repo={repo}
          onActivity={onActivity}
          required={["url"]}
          fields={[
            {
              key: "url",
              label: "INTENT.md URL",
              kind: "text",
              placeholder: "https://github.com/…/INTENT.md",
            },
            { key: "agent", label: "--agent", kind: "text", placeholder: "opencode" },
            { key: "force", label: "--force", kind: "check" },
          ]}
          buildArgs={(v) => {
            const args = ["reuse", String(v.url ?? "").trim()];
            const agent = v.agent;
            if (typeof agent === "string" && agent.trim()) args.push("--agent", agent.trim());
            if (v.force === true) args.push("--force");
            return args;
          }}
          renderResult={(r) => (
            <KV
              rows={[
                ["Patch ID", kv(r.stdout, "Patch ID")],
                ["Target repo", kv(r.stdout, "Target repo")],
                ["Bundle", kv(r.stdout, "Bundle")],
              ]}
            />
          )}
        />
      </div>

      <Card
        title="GitHub token"
        desc="Search uses the public GitHub API (60 req/h anonymous). Set a token to raise the limit — passed as GH_TOKEN to fh runs only."
      >
        <TokenField />
      </Card>
    </div>
  );
}

function TokenField() {
  const [token, setToken] = useState(loadToken());
  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <TextInput
          value={token}
          onChange={setToken}
          placeholder="ghp_… (stored in this app only)"
          mono
        />
      </div>
      <Btn variant="ghost" onClick={() => saveToken(token)}>
        Save
      </Btn>
      {token && (
        <Btn
          variant="ghost"
          onClick={() => {
            setToken("");
            saveToken("");
          }}
        >
          Clear
        </Btn>
      )}
    </div>
  );
}

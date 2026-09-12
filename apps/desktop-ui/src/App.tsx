import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, GitBranch, Compass, Radio } from "lucide-react";
import { loadRepo, runFh, saveRepo } from "./lib/fh";
import type { Activity } from "./components/CommandCard";
import { Badge, LogView } from "./components/ui";
import { RepoView } from "./views/RepoView";
import { PatchesView } from "./views/PatchesView";
import { DiscoverView } from "./views/DiscoverView";

type Tab = "repo" | "patches" | "discover";

const TABS: Array<{ id: Tab; label: string; icon: typeof Radio }> = [
  { id: "repo", label: "Repository", icon: Radio },
  { id: "patches", label: "Patches", icon: GitBranch },
  { id: "discover", label: "Discover", icon: Compass },
];

function RepoPicker(props: { repo: string; onPick: (p: string) => void }) {
  async function pick() {
    try {
      const selected = await open({ directory: true, title: "Open fork checkout" });
      if (typeof selected === "string") props.onPick(selected);
    } catch (e) {
      console.error(e);
    }
  }
  return (
    <div className="flex min-w-0 items-center gap-2">
      <button
        onClick={pick}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-200 hover:bg-white/10"
      >
        <FolderOpen size={15} />
        {props.repo ? "Switch repo" : "Open fork checkout…"}
      </button>
      {props.repo && (
        <span className="truncate font-mono text-[12.5px] text-zinc-400" title={props.repo}>
          {props.repo}
        </span>
      )}
    </div>
  );
}

function ActivityFeed(props: { items: Activity[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
  if (props.items.length === 0) {
    return <p className="px-4 py-3 text-xs text-zinc-600">No commands run yet this session.</p>;
  }
  return (
    <ul className="max-h-56 divide-y divide-white/5 overflow-auto">
      {props.items.map((a) => (
        <li key={a.id}>
          <button
            className="flex w-full items-center gap-2 px-4 py-1.5 text-left hover:bg-white/[0.03]"
            onClick={() => setOpenId((cur) => (cur === a.id ? null : a.id))}
          >
            <span className="truncate font-mono text-[12px] text-zinc-300">{a.cmd}</span>
            <span className="ml-auto flex shrink-0 items-center gap-2">
              <span className="text-[11px] text-zinc-600">{a.ms}ms</span>
              <Badge tone={a.code === 0 ? "ok" : "bad"}>exit {a.code ?? "?"}</Badge>
            </span>
          </button>
          {openId === a.id && (
            <div className="px-4 pb-2">
              <LogView stdout={a.stdout} stderr={a.stderr} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("repo");
  const [repo, setRepo] = useState(loadRepo());
  const [activities, setActivities] = useState<Activity[]>([]);
  const [version, setVersion] = useState("");

  useEffect(() => {
    runFh(["--version"], {})
      .then((r) => setVersion(r.stdout.trim() || r.stderr.trim()))
      .catch(() => setVersion("sidecar unavailable"));
  }, []);

  function pick(path: string) {
    setRepo(path);
    saveRepo(path);
  }

  function pushActivity(a: Activity) {
    setActivities((prev) => [a, ...prev].slice(0, 30));
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 font-mono text-sm font-bold text-black">
            F
          </span>
          <span className="text-sm font-semibold">ForkHub Desktop</span>
          {version && <span className="text-[11px] text-zinc-600">{version}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <RepoPicker repo={repo} onPick={pick} />
        </div>
        <nav className="flex shrink-0 gap-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-white/10 text-zinc-100"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                }`}
              >
                <Icon size={15} />
                {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="min-h-0 flex-1 overflow-auto p-4">
        <div className="mx-auto grid max-w-5xl gap-4 pb-2">
          {tab === "repo" && <RepoView repo={repo} onActivity={pushActivity} />}
          {tab === "patches" && <PatchesView repo={repo} onActivity={pushActivity} />}
          {tab === "discover" && <DiscoverView repo={repo} onActivity={pushActivity} />}
        </div>
      </main>

      <footer className="border-t border-white/10">
        <div className="px-4 pt-1.5 text-[11px] font-medium tracking-wide text-zinc-600 uppercase">
          Activity
        </div>
        <ActivityFeed items={activities} />
      </footer>
    </div>
  );
}

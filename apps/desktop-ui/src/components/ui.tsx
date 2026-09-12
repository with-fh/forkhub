import type { ReactNode } from "react";

export function Card(props: {
  title: string;
  desc?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03]">
      <header className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">{props.title}</h3>
          {props.desc && <p className="mt-0.5 text-xs text-zinc-400">{props.desc}</p>}
        </div>
        {props.right}
      </header>
      <div className="grid gap-3 px-4 py-3">{props.children}</div>
    </section>
  );
}

export function Field(props: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-zinc-300">{props.label}</span>
      {props.children}
      {props.hint && <span className="text-[11px] text-zinc-500">{props.hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40";

export function TextInput(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <input
      className={inputCls + (props.mono ? " font-mono text-[13px]" : "")}
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
      spellCheck={false}
    />
  );
}

export function TextArea(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      className={inputCls + " resize-y"}
      value={props.value}
      rows={props.rows ?? 3}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
      spellCheck={false}
    />
  );
}

export function Check(props: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300 select-none">
      <input
        type="checkbox"
        className="h-4 w-4 rounded accent-emerald-500"
        checked={props.value}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      <span className="font-mono text-[13px]">{props.label}</span>
    </label>
  );
}

export function Btn(props: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  variant?: "primary" | "ghost" | "danger";
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";
  const style =
    props.variant === "ghost"
      ? "border border-white/10 bg-transparent text-zinc-300 hover:bg-white/5"
      : props.variant === "danger"
        ? "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
        : "bg-emerald-500 text-black hover:bg-emerald-400";
  return (
    <button className={`${base} ${style}`} onClick={props.onClick} disabled={props.disabled}>
      {props.children}
    </button>
  );
}

export function Badge(props: {
  tone: "ok" | "warn" | "bad" | "muted" | "info";
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    warn: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    bad: "border-red-500/30 bg-red-500/10 text-red-300",
    muted: "border-white/10 bg-white/5 text-zinc-400",
    info: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones[props.tone]}`}
    >
      {props.children}
    </span>
  );
}

export function KV(props: { rows: Array<[string, string | null]> }) {
  const visible = props.rows.filter(([, v]) => v !== null && v !== "");
  if (visible.length === 0) return null;
  return (
    <dl className="grid gap-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2">
      {visible.map(([k, v]) => (
        <div key={k} className="flex gap-3 text-[13px]">
          <dt className="w-28 shrink-0 text-zinc-500">{k}</dt>
          <dd className="min-w-0 flex-1 break-words font-mono text-[12.5px] text-zinc-200">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LogView(props: { stdout: string; stderr: string }) {
  if (!props.stdout && !props.stderr) return null;
  return (
    <div className="log-view max-h-72 overflow-auto rounded-lg border border-white/10 bg-black/60 p-3">
      {props.stdout && <div className="text-zinc-300">{props.stdout}</div>}
      {props.stderr && <div className="text-red-400">{props.stderr}</div>}
    </div>
  );
}

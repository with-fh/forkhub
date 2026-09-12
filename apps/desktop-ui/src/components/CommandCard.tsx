import { useState, type ReactNode } from "react";
import { fhEnv, runFh, type RunResult } from "../lib/fh";
import { Btn, Card, Check, Field, LogView, TextArea, TextInput } from "./ui";

export type FieldDef =
  | { key: string; label: string; kind: "text"; placeholder?: string; hint?: string; def?: string }
  | {
      key: string;
      label: string;
      kind: "textarea";
      placeholder?: string;
      hint?: string;
      def?: string;
    }
  | { key: string; label: string; kind: "check"; hint?: string; def?: boolean };

export type Values = Record<string, string | boolean>;

export type Activity = {
  id: number;
  cmd: string;
  code: number | null;
  ms: number;
  stdout: string;
  stderr: string;
};

let activitySeq = 1;

export function FieldInput(props: {
  field: FieldDef;
  value: string | boolean;
  onChange: (v: string | boolean) => void;
}) {
  const { field, value, onChange } = props;
  if (field.kind === "check") {
    return <Check value={value === true} onChange={onChange} label={field.label} />;
  }
  const input =
    field.kind === "textarea" ? (
      <TextArea
        value={typeof value === "string" ? value : ""}
        onChange={onChange}
        placeholder={field.placeholder}
      />
    ) : (
      <TextInput
        value={typeof value === "string" ? value : ""}
        onChange={onChange}
        placeholder={field.placeholder}
        mono
      />
    );
  return (
    <Field label={field.label} hint={field.hint}>
      {input}
    </Field>
  );
}

export function CommandCard(props: {
  cmd: string;
  title: string;
  desc?: string;
  button?: string;
  fields?: FieldDef[];
  required?: string[];
  buildArgs: (v: Values) => string[];
  renderResult?: (result: RunResult, v: Values) => ReactNode;
  repo: string;
  needsRepo?: boolean;
  onActivity: (a: Activity) => void;
}) {
  const initial: Values = {};
  for (const f of props.fields ?? []) {
    initial[f.key] = f.def ?? (f.kind === "check" ? false : "");
  }
  const [values, setValues] = useState<Values>(initial);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  const missing = (props.required ?? []).filter((k) => {
    const v = values[k];
    return typeof v !== "string" || v.trim() === "";
  });
  const noRepo = (props.needsRepo ?? true) && !props.repo;

  async function run() {
    if (missing.length > 0 || noRepo || running) return;
    setRunning(true);
    setResult(null);
    const started = Date.now();
    try {
      const res = await runFh(props.buildArgs(values), {
        cwd: props.repo || undefined,
        env: fhEnv(),
      });
      setResult(res);
      props.onActivity({
        id: activitySeq++,
        cmd: `fh ${props.cmd}`,
        code: res.code,
        ms: Date.now() - started,
        stdout: res.stdout,
        stderr: res.stderr,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const res = { code: null, stdout: "", stderr: message };
      setResult(res);
      props.onActivity({
        id: activitySeq++,
        cmd: `fh ${props.cmd}`,
        code: null,
        ms: Date.now() - started,
        stdout: "",
        stderr: message,
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card
      title={props.title}
      desc={props.desc}
      right={
        <Btn onClick={run} disabled={missing.length > 0 || noRepo || running}>
          {running ? "Running…" : (props.button ?? `fh ${props.cmd}`)}
        </Btn>
      }
    >
      {noRepo && <p className="text-xs text-amber-300">Pick a fork checkout above first.</p>}
      {(props.fields ?? []).map((f) => (
        <FieldInput
          key={f.key}
          field={f}
          value={values[f.key] ?? ""}
          onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
        />
      ))}
      {result && (
        <div className="grid gap-2">
          {props.renderResult?.(result, values)}
          <details>
            <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">
              Raw output (exit {result.code ?? "?"})
            </summary>
            <div className="mt-1">
              <LogView stdout={result.stdout} stderr={result.stderr} />
            </div>
          </details>
        </div>
      )}
    </Card>
  );
}

import { Command, type Child } from "@tauri-apps/plugin-shell";

export type RunResult = {
  code: number | null;
  stdout: string;
  stderr: string;
};

export type RunOpts = {
  cwd?: string;
  env?: Record<string, string>;
  onOut?: (line: string) => void;
  onErr?: (line: string) => void;
};

function tauriGuard(): void {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) return;
  throw new Error("fh sidecar is only available inside the ForkHub desktop app.");
}

/** Run `fh <args>` in `cwd`, streaming output. Resolves on process close. */
export async function runFh(args: string[], opts: RunOpts = {}): Promise<RunResult> {
  tauriGuard();
  const cmd = Command.sidecar("binaries/fh", args, {
    cwd: opts.cwd,
    env: opts.env,
  });
  let stdout = "";
  let stderr = "";
  cmd.stdout.on("data", (line) => {
    stdout += `${line}\n`;
    opts.onOut?.(line);
  });
  cmd.stderr.on("data", (line) => {
    stderr += `${line}\n`;
    opts.onErr?.(line);
  });
  return new Promise<RunResult>((resolve, reject) => {
    cmd.on("close", (payload) => resolve({ code: payload.code, stdout, stderr }));
    cmd.on("error", (message) => reject(new Error(message)));
    cmd.spawn().catch((err: unknown) => {
      reject(err instanceof Error ? err : new Error(String(err)));
    });
  });
}

export type SpawnedProc = {
  child: Child;
  closed: Promise<number | null>;
};

/** Spawn `fh <args>` for long-running commands (watch). Kill via child.kill(). */
export async function spawnFh(args: string[], opts: RunOpts = {}): Promise<SpawnedProc> {
  tauriGuard();
  const cmd = Command.sidecar("binaries/fh", args, {
    cwd: opts.cwd,
    env: opts.env,
  });
  cmd.stdout.on("data", (line) => opts.onOut?.(line));
  cmd.stderr.on("data", (line) => opts.onErr?.(line));
  let settle!: (code: number | null) => void;
  const closed = new Promise<number | null>((resolve) => {
    settle = resolve;
  });
  cmd.on("close", (payload) => settle(payload.code));
  cmd.on("error", () => settle(null));
  const child = await cmd.spawn();
  return { child, closed };
}

const REPO_KEY = "forkhub-desktop.repo";
const TOKEN_KEY = "forkhub-desktop.ghToken";

export function loadRepo(): string {
  try {
    return localStorage.getItem(REPO_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveRepo(path: string): void {
  try {
    localStorage.setItem(REPO_KEY, path);
  } catch {
    /* ignore */
  }
}

export function loadToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

/** Extra env for fh runs (GitHub token for search, when configured). */
export function fhEnv(): Record<string, string> | undefined {
  const token = loadToken().trim();
  return token ? { GH_TOKEN: token, GITHUB_TOKEN: token } : undefined;
}

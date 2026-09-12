import { kv } from "../lib/parse";
import { CommandCard, type Activity } from "../components/CommandCard";
import { KV, LogView } from "../components/ui";

export function PatchesView(props: { repo: string; onActivity: (a: Activity) => void }) {
  const { repo, onActivity } = props;
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <CommandCard
          cmd="init"
          title="Init"
          desc="Set up the .forkhub repo + config in this checkout."
          repo={repo}
          onActivity={onActivity}
          fields={[
            {
              key: "target",
              label: "--target",
              kind: "text",
              placeholder: "github.com/owner/repo",
            },
            {
              key: "upstream-remote",
              label: "--upstream-remote",
              kind: "text",
              placeholder: "upstream",
            },
            { key: "fork-remote", label: "--fork-remote", kind: "text", placeholder: "origin" },
          ]}
          buildArgs={(v) => {
            const args = ["init"];
            for (const k of ["target", "upstream-remote", "fork-remote"]) {
              const val = v[k];
              if (typeof val === "string" && val.trim()) args.push(`--${k}`, val.trim());
            }
            return args;
          }}
          renderResult={(r) => (
            <KV
              rows={[
                ["Target repo", kv(r.stdout, "Target repo")],
                ["Upstream", kv(r.stdout, "Upstream remote")],
                ["Fork", kv(r.stdout, "Fork remote")],
                [".forkhub", kv(r.stdout, ".forkhub")],
              ]}
            />
          )}
        />
        <CommandCard
          cmd="draft"
          title="Draft"
          desc="Create a draft branch + INTENT.md for a new patch."
          repo={repo}
          onActivity={onActivity}
          required={["intent"]}
          fields={[
            {
              key: "intent",
              label: "Intent",
              kind: "textarea",
              placeholder: "add --cheat flag to reveal the secret number",
            },
          ]}
          buildArgs={(v) => ["draft", String(v.intent ?? "").trim()]}
          renderResult={(r) => (
            <KV
              rows={[
                ["Branch", kv(r.stdout, "Branch")],
                ["Slug", kv(r.stdout, "Slug")],
                ["Base", kv(r.stdout, "Base")],
                ["Draft", kv(r.stdout, "Draft")],
              ]}
            />
          )}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <CommandCard
          cmd="satisfied"
          title="Satisfied"
          desc="Finalize the intent, capture the diff, port to forkhub/main."
          repo={repo}
          onActivity={onActivity}
          fields={[{ key: "skip-port", label: "--skip-port", kind: "check" }]}
          buildArgs={(v) =>
            v["skip-port"] === true ? ["satisfied", "--skip-port"] : ["satisfied"]
          }
          renderResult={(r) => (
            <KV
              rows={[
                ["Patch ID", kv(r.stdout, "Patch ID")],
                ["Branch", kv(r.stdout, "Branch")],
                ["Files changed", kv(r.stdout, "Files changed")],
                ["Ported to", kv(r.stdout, "Ported to")],
                ["Tag", kv(r.stdout, "Tag")],
              ]}
            />
          )}
        />
        <CommandCard
          cmd="re-derive"
          title="Re-derive"
          desc="Generate the AI re-derivation context bundle for a patch."
          repo={repo}
          onActivity={onActivity}
          required={["patch"]}
          fields={[
            { key: "patch", label: "patch-id", kind: "text", placeholder: "fix-…-xxxx" },
            { key: "force", label: "--force", kind: "check" },
          ]}
          buildArgs={(v) => {
            const args = ["re-derive", String(v.patch ?? "").trim()];
            if (v.force === true) args.push("--force");
            return args;
          }}
          renderResult={(r) => (
            <KV
              rows={[
                ["Patch ID", kv(r.stdout, "Patch ID")],
                ["Bundle", kv(r.stdout, "Bundle")],
                ["Status", kv(r.stdout, "Status")],
              ]}
            />
          )}
        />
      </div>

      <CommandCard
        cmd="apply"
        title="Apply"
        desc="Apply an AI realization from a context bundle (verify gate + tag)."
        repo={repo}
        onActivity={onActivity}
        required={["bundle"]}
        fields={[
          { key: "bundle", label: "bundle path", kind: "text", placeholder: "/path/to/bundle" },
          { key: "skip-tests", label: "--skip-tests", kind: "check" },
          { key: "skip-tag", label: "--skip-tag", kind: "check" },
        ]}
        buildArgs={(v) => {
          const args = ["apply", String(v.bundle ?? "").trim()];
          if (v["skip-tests"] === true) args.push("--skip-tests");
          if (v["skip-tag"] === true) args.push("--skip-tag");
          return args;
        }}
        renderResult={(r) => (
          <div className="grid gap-2">
            <KV
              rows={[
                ["Patch ID", kv(r.stdout, "Patch ID")],
                ["Bundle", kv(r.stdout, "Bundle")],
                ["Diff applied", kv(r.stdout, "Diff applied")],
                ["Tests pass", kv(r.stdout, "Tests pass")],
                ["Tag", kv(r.stdout, "Tag")],
              ]}
            />
            <LogView stdout="" stderr={r.stderr} />
          </div>
        )}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <CommandCard
          cmd="pr"
          title="Open PR"
          desc="Push the branch to your fork and open a PR upstream."
          repo={repo}
          onActivity={onActivity}
          fields={[
            { key: "draft", label: "--draft", kind: "check" },
            { key: "base", label: "--base", kind: "text", placeholder: "(upstream default)" },
            { key: "title", label: "--title", kind: "text", placeholder: "PR title" },
            { key: "body", label: "--body", kind: "textarea", placeholder: "PR body" },
            { key: "no-push", label: "--no-push", kind: "check" },
          ]}
          buildArgs={(v) => {
            const args = ["pr"];
            if (v.draft === true) args.push("--draft");
            for (const k of ["base", "title", "body"]) {
              const val = v[k];
              if (typeof val === "string" && val.trim()) args.push(`--${k}`, val.trim());
            }
            if (v["no-push"] === true) args.push("--no-push");
            return args;
          }}
          renderResult={(r) => (
            <KV
              rows={[
                ["Branch", kv(r.stdout, "Branch")],
                ["Pushed", kv(r.stdout, "Pushed")],
                ["PR", kv(r.stdout, "PR")],
                ["PR #", kv(r.stdout, "PR #")],
              ]}
            />
          )}
        />
        <div className="grid gap-4">
          <CommandCard
            cmd="link-pr"
            title="Link PR"
            desc="Link an existing upstream PR to a patch."
            repo={repo}
            onActivity={onActivity}
            required={["patch", "pr"]}
            fields={[
              { key: "patch", label: "patch-id | branch", kind: "text" },
              { key: "pr", label: "pr number | url", kind: "text" },
            ]}
            buildArgs={(v) => ["link-pr", String(v.patch ?? "").trim(), String(v.pr ?? "").trim()]}
            renderResult={(r) => (
              <KV
                rows={[
                  ["Patch", kv(r.stdout, "Patch")],
                  ["PR", kv(r.stdout, "PR")],
                  ["PR #", kv(r.stdout, "PR #")],
                ]}
              />
            )}
          />
          <CommandCard
            cmd="publish"
            title="Publish"
            desc="Push your .forkhub intent repo so others can import."
            repo={repo}
            onActivity={onActivity}
            fields={[
              {
                key: "message",
                label: "--message (-m)",
                kind: "text",
                placeholder: "publish patch intents",
              },
              { key: "allow-missing-pr", label: "--allow-missing-pr", kind: "check" },
            ]}
            buildArgs={(v) => {
              const args = ["publish"];
              const msg = v.message;
              if (typeof msg === "string" && msg.trim()) args.push("--message", msg.trim());
              if (v["allow-missing-pr"] === true) args.push("--allow-missing-pr");
              return args;
            }}
            renderResult={(r) => (
              <KV
                rows={[
                  ["Pushed", kv(r.stdout, "Pushed")],
                  ["Files", kv(r.stdout, "Files")],
                  ["Message", kv(r.stdout, "Message")],
                ]}
              />
            )}
          />
        </div>
      </div>
    </div>
  );
}

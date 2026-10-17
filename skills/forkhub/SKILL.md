# forkhub

## Description

Manage patches for forked repositories using intent-based re-derivation. Use when the user wants to create a patch, finalize a patch, check for drift, or re-derive patches against new upstream releases.

## When to Use

- User says `/forkhub "<intent>"` — create a new patch (DRAFTING)
- User says `/forkhub` (no args) — process pending re-derivation bundle
- User says they're satisfied with a patch — finalize it
- User wants to check if patches need re-derivation — drift-check
- User wants to re-derive patches against new upstream

## DRAFTING Flow (`/forkhub "<intent>"`)

When the user invokes `/forkhub "<intent description>"`:

### Step 1: Create draft

```bash
bun run <forkhub-cli> draft "<intent>"
```

This creates a `*` branch and a `.forkhub-draft.md` file.

### Step 2: Read and understand

Read the draft file and the current source code. Understand what needs to change.

### Step 3: Implement

Implement the feature/fix described in the intent. Rules:

- Modify only files necessary for the patch
- Write clean, minimal code
- Do NOT modify files the intent says are off-limits
- Run `bun test` to verify existing tests pass

### Step 4: Fill INTENT.md sections

Edit `.forkhub-draft.md` to fill in the template sections:

**## Why** — Why does the user want this? Why won't the maintainer merge it?

**## Non-negotiables** — What MUST be true? (e.g., "flag is opt-in", "game.ts not modified")

**## Implementation notes** — What did you do? Be specific:

- Which files changed and where
- What approach was taken and why
- Any gotchas for future re-derivation

Write these so a cold-start AI can re-derive the patch from INTENT.md alone.

### Step 5: User test

Tell the user: "Patch implemented on branch `<branch>`. Test it with: `<run command>`"

Ask if they're satisfied.

### Step 6a: Satisfied

If the user says they're satisfied:

```bash
bun run <forkhub-cli> satisfied
```

This finalizes the intent, captures the diff, ports to `forkhub/main`, and tags.

### Step 6c: Open PR upstream (fork workflows only)

If the user wants to also contribute the patch back to the original repo (the
fork workflow), and the local clone is set up as a fork with separate
`upstream` and `origin` remotes:

```bash
bun run <forkhub-cli> pr --draft
```

This pushes the current branch to `origin` (your fork) and opens a draft PR
against `upstream` via `gh pr create`. The PR URL and number are saved into
the manifest under `patches[<patch-id>].applied_upstream_pr`.

Skip this step if the user doesn't want to contribute upstream, or if the
local repo isn't a fork (single-remote setup).

### Step 6b: Not satisfied

If the user wants changes:

- Make the requested changes
- Update the Implementation notes in `.forkhub-draft.md`
- Re-test
- Ask again

## DISCOVERY Flow (find + reuse someone else's patch)

Published patches live in public `.forkhub` repos. Anyone — including you
acting for the user — can find and reuse them:

### Step 1: Search

```bash
fh search --target github.com/owner/repo          # patches for a repo
fh search --author alice                          # one publisher's patches
fh search --target github.com/owner/repo --sort stars
fh popular --target github.com/owner/repo         # most-starred first
```

Results show ★ stars (publisher-repo stars = popularity proxy), author,
target, and a ready `fh reuse` command per patch. Needs network + GitHub
API; set `GH_TOKEN` to avoid rate limits.

### Step 2: Reuse in one command

```bash
fh reuse https://github.com/ALICE/.forkhub/blob/main/repos/.../patches/<patch-id>/INTENT.md
```

This imports the intent (author attribution kept) and builds the
re-derivation bundle against the user's fork. `fh reuse <url> --agent opencode`
also invokes the agent on the bundle.

### Step 3: Realize + promote (your job as the agent)

1. Read the bundle (`INTENT.md`, `ACCEPTANCE.md`, `siblings/`, `fork/`)
2. Implement and write `REALIZATION/realization.diff` + `REALIZATION/report.md`
3. Tell the user to run `fh apply <bundle>` (verify gate) then `fh update`
   to move their checkout to the new release (`fh rollback` reverts)

For maintainers: `fh popular --target github.com/owner/repo` shows which
community patches are most-starred — a merge-priority signal.

## RE-DERIVATION Flow (`/forkhub` with no args)

When the user invokes `/forkhub` with no arguments, check for pending
re-derivation bundles. The `forkhub watch` daemon generates these bundles
when patches drift. Your job is to implement the patch and save the result.

### Step 1: Find the latest pending bundle

```bash
# Find the most recent pending bundle
LATEST_BUNDLE=$(find ../.forkhub/derive -type d -mindepth 2 -maxdepth 2 2>/dev/null | sort | tail -1)

# Check if it already has a realization (watch would have applied it)
if [ -f "$LATEST_BUNDLE/REALIZATION/realization.diff" ]; then
  echo "Bundle already has realization. Nothing to do."
  exit 0
fi
```

### Step 2: Read the bundle

Read all files in the bundle:

1. **README.md** — step-by-step instructions (authoritative)
2. **INTENT.md** — source of truth (what to implement)
3. **ACCEPTANCE.md** — verification criteria
4. **drift-summary.txt** — what changed in upstream
5. **reference.diff** — previous realization (HINT only)
6. **attempts.jsonl** — past failures to avoid
7. **siblings/** — other patches already applied (preserve their code)
8. **upstream/** — clean upstream code
9. **fork/** — current fork state (this is your working basis)

### Step 3: Implement

Implement the patch against the `fork/` files. Use the same constraints as
DRAFTING (don't modify off-limits files, preserve siblings, etc.).

### Step 4: Save realization

Write a proper git diff to `REALIZATION/realization.diff`:

```bash
# Example: after editing fork/index.ts, generate the diff
diff -u upstream/index.ts fork/index.ts > REALIZATION/realization.diff
# OR: use git diff if fork/ is a git checkout
```

The diff format MUST be valid `git apply` format with proper `--- a/` and
`+++ b/` headers and line numbers in hunk headers.

### Step 5: Write report

Write `REALIZATION/report.md` with:

- What you changed (files, line numbers, approach)
- Whether each acceptance criterion passes
- Self-confidence (high/medium/low) and reasoning

### Step 6: Notify

The watch daemon will detect the realization and auto-apply it. The user will
see "✅ Patch applied successfully" in the watch output.

## RE-DERIVATION Flow (when run manually)

When re-deriving a patch against new upstream (drift):

### Inputs you receive

1. **INTENT.md** — the source of truth (what to implement)
2. **reference.diff** — previous realization (HINT only, do NOT apply mechanically)
3. **drift-context.txt** — what changed in upstream + sibling patch state
4. **attempts.jsonl** — past attempts (learn from failures)
5. **Current source code** — the new upstream + siblings already applied

### Process

1. Read INTENT.md thoroughly — this is truth, not suggestion
2. Read drift-context.txt — understand what changed and where siblings are
3. Read reference.diff — understand the previous approach (do NOT `git apply`)
4. Read attempts.jsonl — avoid approaches that previously failed
5. Implement the patch against the current codebase
6. Run verification: `bun test`
7. Check acceptance criteria from ACCEPTANCE.md
8. Verify sibling patches still work

### Constraints

- DO NOT apply reference.diff mechanically — re-derive from intent
- DO NOT modify files the INTENT says are off-limits
- DO NOT duplicate code that upstream or siblings already provide
- DO preserve sibling patches' code verbatim

### Output

Report:

- What files changed and the diff summary
- Test results
- Acceptance criteria pass/fail
- Sibling compatibility check
- Self-confidence (high/medium/low) and reasoning

## INTENT.md Quality Rules

The INTENT.md is the ONLY artifact that survives across re-derivations. It must be:

- **Self-contained**: an AI reading it cold (no project context) should understand exactly what to do
- **Specific**: "add --cheat flag that prints the secret before the banner" not "add cheat mode"
- **Constraint-heavy**: list what NOT to do (e.g., "DO NOT modify game.ts")
- **Implementation-aware**: note where code was inserted, what approach was taken, and why
- **Pitfall-aware**: after iterations, add "Pitfalls" section with what NOT to try

Bad intent: "make the game easier"
Good intent: "add --hint flag that shows narrowed range (guess+1 to max, or min to guess-1) after each wrong guess"

## Patch Granularity Rules (split vs combine)

Catalog policy: **one intent-patch per software per fork-purpose**
(e.g. `<repo>` has exactly one `forkhub-support` patch — "add ForkHub
support into that OSS"). A published `.forkhub` catalog is
ForkHub-maintained and ForkHub-enabled: agents must merge same-purpose
patches instead of adding new ones, and split only by the rules below.

Measure a patch by: `reference.diff` lines + files touched,
`verify.sh` wall time, number of independent "Why"s in the intent, and
architectural layers in `target_area` (e.g. main-process, renderer,
build scripts, native).

### SPLIT when any of these hold

1. **Too big to verify cheaply**: `reference.diff` > ~1500 lines or
   > ~25 files, or `verify.sh` takes > ~10 min / needs > 1 runtime
   > (node + electron + docker). Each patch pays this cost on EVERY
   > drift re-derivation.
2. **Multiple independent behaviors**: the intent has ≥2 "Why"s that
   could ship, release, and be acceptance-tested alone. Rule of thumb:
   if you can write two ACCEPTANCE.md files that pass independently,
   those are two patches.
3. **Independent drift rates**: one behavior's `target_area` churns
   upstream far more often than the rest. Split it so re-derivation
   doesn't burn agent tokens + CI time re-proving the stable parts.
4. **Independent layers with independent acceptance**: `target_area`
   spans ≥3 layers (e.g. main-process + renderer + build scripts)
   whose criteria don't overlap. Shared files alone don't force a
   split — shared _behavior_ does.

### COMBINE when any of these hold

1. **Same purpose, overlapping files**: two patches for one software
   touch the same files or one only applies on top of the other
   ("applied after" coupling). Stacked diffs on shared files make
   `apply_order` fragile; a single diff applies atomically.
2. **Too small to stand alone**: each `reference.diff` < ~100 lines
   AND < ~5 files AND identical/trivial verify AND they always drift
   together (the same upstream change triggers all of them).
3. **Cannot ship or verify independently**: patch B is meaningless
   without patch A (no standalone acceptance story).
4. **Catalog count rule**: more than one patch for the same
   (software, purpose) pair → squash. Procedure: verify the stack
   applies cleanly in order → capture the combined diff → run the
   union of all `verify.sh` suites → replace the manifest entries with
   one patch + one `apply_order` entry (note the squash in
   `attempts.jsonl`).

### Size bands (defaults, adjust per repo)

- **Combine candidate**: < 100 diff lines, < 5 files, verify < 2 min.
- **Healthy single patch**: one independently shippable behavior,
  verify < 10 min.
- **Split**: > 1500 lines or > 25 files or verify > 10 min or ≥2
  independent Whys or ≥3 layers with independent acceptance.

When unsure, bias to ONE patch: a slightly large patch that verifies
in one run is cheaper over its lifetime than two patches that drift,
re-derive, and rebuild separately forever.

## CLI Location

The forkhub CLI is at the project root:

```
bun run src/cli.ts <command>
```

Or if installed globally:

```
forkhub <command>
```

## Commands Reference

| Command                                                     | Purpose                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------- |
| `init [--target <repo>]`                                    | Set up .forkhub repo (auto-detects fork vs single-remote)     |
| `draft "<intent>"`                                          | Create draft branch                                           |
| `satisfied [--skip-port]`                                   | Finalize intent, port, tag                                    |
| `pr [--draft] [--base <branch>]`                            | Push current branch to fork + open PR to upstream (fork only) |
| `link-pr <patch\|branch> <pr#\|url>`                        | Link an existing upstream PR to a patch                       |
| `search [--target <repo>] [--author <user>] [--sort stars]` | Find published patches (★ = popularity)                       |
| `popular [--target <repo>]`                                 | Most-starred patches first                                    |
| `import <url>`                                              | Import one patch intent                                       |
| `reuse <url> [--agent <name>]`                              | Import + build re-derivation bundle in one step               |
| `status`                                                    | Show current tag state                                        |
| `update [--tag <tag>]`                                      | Consumer: advance to tag                                      |
| `rollback`                                                  | Consumer: roll back                                           |

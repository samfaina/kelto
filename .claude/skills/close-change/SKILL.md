---
name: close-change
description: "Close a finished OpenSpec change: simplify, harden, verify against its specs, archive it into the living spec, and hand its branch over."
disable-model-invocation: true
---

# Close Change

Close one finished **change**: simplify its code, harden it, verify it against its spec, archive it so its delta specs merge into the living spec, and hand its branch over as a pull request or a local merge. `code-review` already ran on every ticket during `/implement`; this skill looks at the change as a whole instead.

Read `docs/agents/issue-tracker.md` first: it defines changes, tickets, branches and commit trailers.

## Process

### 1. Check the change is ready

The argument is the change name. Without one, run `openspec list`; with exactly one active change take it. With no active change, when `git branch --show-current` prints `change/<name>` and `<name>` is an archived change, take it. Otherwise ask which one.

A change is **archived** when `openspec list` does not show it and `openspec/changes/archive/<date>-<change>/` exists: OpenSpec prefixes the folder with the date of the archive. An earlier run of this skill archived it, but its hand-over did not finish.

Every check below must hold. When one fails, report which and stop:

- `git branch --show-current` prints `change/<change>`.
- `git status --porcelain` prints nothing.
- `openspec instructions apply --change <change> --json` reports `progress.remaining` as 0. Otherwise list the unticked boxes and tell the user to run `/implement <change>#N` for the first ticket that has one; the manual test ticket counts. Skip this check for an archived change.
- `openspec validate <change> --strict` says the change is valid. Skip this check for an archived change.

An archived change passed the last two checks before its archive: when the first two hold, skip steps 2 to 7 and resume at step 8.

### 2. Pin the diff

Find the base: the first branch of `protectedBranches` in `.claude/agent-workflow.json` that exists locally, then `git merge-base HEAD <that branch>`. The change's diff is `git diff <base>...HEAD`; its files are `git diff --name-only <base>...HEAD`. The **code files** are those outside `openspec/`, `docs/` and `.claude/`. With no code files, skip to step 5.

### 3. Simplify

Call the Skill tool with `code-simplification`, scoped to the code files. Behaviour stays exactly as the specs describe it. Run `checkCommand` from `.claude/agent-workflow.json`; when it passes, commit `refactor(<change>): simplify` with the trailer `Refs: <change>`. When nothing is worth simplifying, say so and move on.

### 4. Harden

Call the Skill tool with `security-and-hardening` to audit the code files, starting from the trust boundaries the change introduces or touches. For each finding, record its severity and the `file:line` it points at.

- Fix every critical and high finding in the change's own code, run `checkCommand`, and commit `fix(<change>): <what was hardened>` with the trailer `Refs: <change>`.
- When a fix would change behaviour the specs describe, ask the user before applying it.
- Medium and low findings go to the report.

### 5. Verify

Run `openspec instructions apply --change <change> --json` again and read every file in `contextFiles`. Check the change along three dimensions, citing `file:line` evidence for each item:

- **Completeness**: every box in `tasks.md` is ticked; every ADDED or MODIFIED requirement has an implementation; every REMOVED requirement's behaviour (read its body in `openspec/specs/<capability>/spec.md`) is gone from the code.
- **Correctness**: every scenario under an ADDED or MODIFIED requirement is handled by the code and covered by a test whose name or assertions match its WHEN and THEN.
- **Coherence**: every decision in `design.md` is followed, and new code matches the project's existing patterns.

Grade each issue: **CRITICAL** (a missing requirement, a removed behaviour still present, an unticked box), **WARNING** (an uncovered scenario, a design decision not followed), **SUGGESTION** (a pattern inconsistency). Show the report as a table with one row per dimension, followed by the issues grouped by grade.

- Any CRITICAL issue: stop here and tell the user what to fix.
- Any WARNING: ask the user whether to archive anyway.

### 6. Archive

Run `openspec archive <change> --yes`. Then run `openspec validate --specs --strict` to check the living spec. Commit `docs(<change>): archive change` with the trailer `Refs: <change>`.

### 7. Report

Summarise in a few lines: the simplification and hardening commits, the security findings left open, the verification table, and the capabilities the living spec gained or changed.

### 8. Hand the branch over

Write the pull request for `change/<change>` into the base branch of step 2:

- **Title**: one Conventional Commits line for the whole change, `<type>(<change>): <what it does>`, taken from `proposal.md`.
- **Body**: when `.claude/skills/pr/SKILL.md` exists, call the Skill tool with `pr` to write it. Otherwise write a short body: what the change does and why (from `proposal.md`), the capabilities the living spec gained or changed, the verification table, and the security findings left open.

When resuming an archived change, find the base branch as step 2 does. Read `proposal.md` from `openspec/changes/archive/<date>-<change>/`; the capabilities are the folder names under its `specs/`. The verification table and the security findings belong to the earlier run, so the body leaves them out, whether `pr` writes it or you do.

Read `pullRequest` from `.claude/agent-workflow.json`; when it is missing, it is `{ "via": "none" }`. Run `git remote`: the remote is `origin` when it is listed, otherwise the first one listed. Then follow the first case that applies:

- **No remote.** Give the user the commands to merge the change themselves, and stop:

  ```
  git switch <base branch>
  git merge --no-ff change/<change> -m "<title>"
  ```

- **`via` is `none`.** Give the user `git push -u <remote> change/<change>`, tell them to open a pull request from `change/<change>` into `<base branch>` in their code host, and show the title and the body, each in its own code block, ready to paste. Stop.

- **`via` is `cli` or `mcp`.** When `allowPush` is `true`, run `git push -u <remote> change/<change>` yourself. Otherwise give the user that command. Then ask "Once the branch is pushed, shall I open the pull request with `<command's first word, or the MCP server>`?" and stop. When the user says yes:

  1. Run `git ls-remote --heads <remote> change/<change>`. When it prints nothing, the branch is not pushed yet: ask the user to push it and stop.
  2. Open the pull request:
     - `cli`: take `command` and replace `{base}`, `{branch}`, `{title}` and `{body}` with the base branch, `change/<change>`, the title and the body, each quoted for the shell you run it in. For `{bodyFile}`, write the body to a temporary file outside the repository and use its path. Run the command.
     - `mcp`: use the tool of the MCP server named in `server` that creates a pull request (or merge request), with `change/<change>` as the source, the base branch as the target, and the title and body. When that server or such a tool is not available, say so.
  3. Show the pull request's URL. When opening it failed, show the error and fall back to the `none` case: give the title and body for the user to open it by hand.

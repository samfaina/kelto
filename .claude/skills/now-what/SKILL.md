---
name: now-what
description: "Tell the user which workflow command comes next, from where the work stands."
disable-model-invocation: true
---

# Now What

Tell the user the one command that comes next. This skill is a **guide**: it diagnoses where the work stands and recommends a command, and the user runs it.

It is **read-only**. Read files and run only commands that report state (`git status`, `git branch`, `git remote`, `git ls-remote`, `openspec list`, `openspec instructions`). Leave every file, branch and commit as it is: no `git switch`, `git fetch` or commit, and no Skill tool call for the recommended skill.

## 1. Read the conversation

Before any command, note what this conversation already holds:

- **Grilling**: `/grill-with-docs` or `grilling` ran here, and no `/to-spec` ran after it.
- **Situation**: the user described something off the workflow, such as a bug, a design question or a long session (see **Map off the workflow**).
- **Earlier work**: anything that happened before `/now-what`.

## 2. Read the repository

Read `docs/agents/issue-tracker.md`: it defines changes, tickets, the **frontier ticket** and branches. Then gather:

- whether `openspec/` and `.claude/agent-workflow.json` exist;
- `git status --porcelain` and `git branch --show-current`;
- the **active changes**: `openspec list --json`; for each one, whether `openspec/changes/<change>/tasks.md` exists and which of its boxes are ticked;
- the **base**: the first branch of `protectedBranches` in `.claude/agent-workflow.json` that exists locally;
- the **pending hand-overs**: each branch in `git branch --list "change/*" --no-merged <base>` whose `<x>` has a folder `openspec/changes/archive/<date>-<x>/`.

## 3. Find the state

Walk these states in order and stop at the first that applies.

1. **Not installed**: `openspec/` or `.claude/agent-workflow.json` is missing. Next: `npx github:samfaina/agent-workflow init`, then restart Claude Code.
2. **Stray files**: `git status --porcelain` lists a file outside `openspec/changes/<change>/`, `GLOSSARY.md` and `docs/adr/`. Next: commit or stash those files; name them.
3. **Grilled, not published**: the conversation holds a grilling. Next: `/to-spec <change>`, proposing a kebab-case name that starts with a verb, taken from the interview.
4. **Context lost**: no active change, the tree is dirty only with `GLOSSARY.md` or `docs/adr/`, and the conversation holds no grilling. Next: `/grill-with-docs` to rebuild the context, then `/to-spec <change>`. Why: `/to-spec` works from the interview, which a fresh session lacks.
5. **No tickets**: an active change has no `tasks.md`. Next: `/to-tickets <change>`.
6. **Tickets open**: an active change has an unticked box. Next: `/implement <change>#N`, N being its frontier ticket. Find it with the rule in `docs/agents/issue-tracker.md`.
7. **Finished**: every box of an active change is ticked. Next: `/close-change <change>`.
8. **Hand-over pending**: a pending hand-over exists. Run `git remote`: the remote is `origin` when it is listed, otherwise the first one listed.
   - No remote, or `git ls-remote --heads <remote> change/<x>` prints nothing: the branch is not pushed. Next: `/close-change <x>`.
   - Otherwise the pull request waits in the code host. Next: review and merge it there; once merged, `git switch <base>` and `git pull`.
9. **Nothing in flight**: Next: `/grill-with-docs` to start a change. When the conversation holds a situation, use **Map off the workflow** instead.

**Several active changes** reach states 5 to 7 together: list each change with its state and next command, and mark the one whose branch `change/<change>` is the current branch. The user picks; this skill does not ask.

## 4. Answer

Answer in the user's language, the `language` setting in `.claude/settings.local.json`, in this format and nothing more:

```
Where you are: change add-greeting, ticket 2 of 4 done
Next: /implement add-greeting#3
Why: ticket 3's blockers (1, 2) are done
Session: start a fresh one first (/clear)
```

- **Where you are**: the state in a few words, with the change and its progress when there is one.
- **Next**: the command, exactly as the user types it.
- **Why**: the fact from step 2 that decided the state.
- **Session**: only when the next command is `/to-tickets`, `/implement` or `/close-change` and the conversation holds earlier work. Each of those starts from a fresh session.

For several active changes, write one `Where you are` / `Next` pair per change and one `Why` for all of them.

## Map off the workflow

Use this map only when the conversation holds a situation, and only after steps 2 and 3: a change in states 2 to 8 comes first. Recommend a skill only when `.claude/skills/<skill>/SKILL.md` exists; optional skills may not be installed. When the right one is missing, say that the installer offers it.

- A bug that resists a quick fix, a crash, or a slowdown → `diagnosing-bugs`
- A design question that only running code can answer → `prototype`
- Reading legwork: docs, API facts, a question for primary sources → `research`
- A review of a branch or of work in progress → `code-review`
- A long session that another session should continue → `handoff`
- Refactoring opportunities in existing code → `improve-codebase-architecture`
- Improving the agent's setup after a session → `retro`
- Editing a skill, `AGENTS.md` or `CLAUDE.md` → `writing-for-agents`
- Work on one topic, such as security, performance or a UI: the specialist `CLAUDE.md` lists for it, under **Specialist skills**.

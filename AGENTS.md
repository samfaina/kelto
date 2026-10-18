<!-- agent-workflow:start -->
# Agent instructions

## Workflow

Planned work goes through one **change** at a time:

1. `/grill-with-docs`: interview until the plan is clear; records terms in `GLOSSARY.md` and decisions in `docs/adr/`.
2. `/to-spec <change>`: publishes the spec as an OpenSpec change.
3. `/to-tickets <change>`: breaks it into tickets in the change's `tasks.md`.
4. `/implement <change>#N`: builds ticket N, or the frontier ticket when N is left out. One ticket per fresh session.
5. `/close-change <change>`: simplification, security, verification, archive, and the pull request or local merge.

Not sure what comes next? `/now-what`

Specs and tickets live in OpenSpec (`openspec/`), reached only through the steps above. `docs/agents/issue-tracker.md` says how.

## Git

- Each change lives on `change/<change>`. Protected branches (`protectedBranches` in `.claude/agent-workflow.json`) receive work only through a pull request, or a merge the user makes when the project has no remote. `/close-change` hands the branch over; it opens a pull request only when `pullRequest` in `.claude/agent-workflow.json` names a tool and the user says yes.
- Commit messages follow Conventional Commits. Work on a ticket ends with the trailer `Refs: <change>#N`.
- The user pushes, unless `allowPush` is `true`.

## Quality gate

A hook runs `checkCommand` from `.claude/agent-workflow.json` on every `git commit` and blocks the commit when it fails, showing you its output. Commit normally: there is no need to run the check yourself first. When a commit is blocked, fix the cause and commit again.

The hooks also block pushes, destructive git commands and writes to protected paths. When one blocks an action, tell the user what was blocked and why; changing what is allowed is the user's decision.

## Agent skills

### Issue tracker

Specs and tickets are OpenSpec changes under `openspec/changes/`. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root, plus the living spec in `openspec/specs/`. See `docs/agents/domain.md`.
<!-- agent-workflow:end -->

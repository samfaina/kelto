# Issue tracker: OpenSpec

Specs and tickets for this repo live as **OpenSpec changes** under `openspec/changes/<change>/`. Use the `openspec` CLI. This file is the only place that says how the engineering skills read and write them.

## Vocabulary

When a skill says... | ...in this repo it means
--- | ---
issue tracker | `openspec/changes/`
spec, PRD, parent issue | a **change**: `proposal.md`, `specs/**/spec.md` and `design.md` in the change folder
ticket, issue, sub-issue | one numbered group `## N. <title>` in the change's `tasks.md` (see **Ticket format**)
issue number, ticket reference | `<change>` or `<change>#N`, for example `add-greeting#2`
blocking link, blocked by | the ticket's `Blocked by:` line
close the ticket, mark it done | tick every checkbox of the ticket
comment on the ticket | a `- Note:` bullet under the ticket's checkboxes
triage label (`ready-for-agent`, `needs-triage`...) | nothing: this tracker has no labels, so skip every label step

## Branch

Every change lives on its own branch, `change/<change>`, created from a protected branch (`protectedBranches` in `.claude/agent-workflow.json`, by default `main` and `master`). Before writing any file of a change:

1. Run `git branch --show-current`. If it prints `change/<change>`, you are done.
2. Run `git status --porcelain`. If it lists files that are not part of this change (anything outside `openspec/changes/<change>/`, `GLOSSARY.md` and `docs/adr/`), stop and ask the user to commit or stash them first.
3. If `change/<change>` exists, run `git switch change/<change>`. Otherwise switch to the first protected branch that exists and run `git switch -c change/<change>`; uncommitted change files come along.

Pushing is the user's job, unless `allowPush` is `true`. Only `/close-change` opens a pull request, with the tool named in `pullRequest` and after the user says yes.

## When a skill says "publish to the issue tracker" (a spec)

Used by `/to-spec`.

1. Pick the change name: kebab-case, starting with a verb (`add-greeting`, `fix-login-timeout`). If `openspec list` already shows that name, ask the user for another one.
2. Get onto the change branch (see **Branch**), then run `openspec new change <change>`.
3. For each artifact in this order, `proposal`, `specs`, `design`: run `openspec instructions <artifact> --change <change>`, read the files it lists, and write the file at its output path following its instruction, template, `<project_context>` and `<rules>`. Always write `design.md`, even for a small change.
4. Map the spec template sections onto the artifacts:

   Spec template section | Goes to
   --- | ---
   Problem Statement | `proposal.md`, **Why**
   Solution | `proposal.md`, **What Changes**
   Out of Scope | `proposal.md`, **Out of Scope**
   User Stories | requirements in `specs/<capability>/spec.md` (see below)
   Implementation Decisions | `design.md`, **Decisions**
   Testing Decisions, including the agreed seams | `design.md`, **Testing Decisions**
   Further Notes | `design.md`, **Open Questions**, or **Risks / Trade-offs**

   User stories become requirements:
   - Group the stories into capabilities as the proposal instruction describes, one `spec.md` per capability.
   - Each requirement is `### Requirement: <name>` with one behaviour stated with SHALL or MUST, in at most 500 characters.
   - Each requirement has one success scenario plus one scenario for every error or edge case the stories mention, each `#### Scenario: <name>` with **WHEN** and **THEN** bullets.
   - Every user story is covered by at least one requirement. Several stories may share one requirement.
5. Run `openspec validate <change> --strict` and fix every error and warning until it prints that the change is valid.
6. Commit the change folder: `docs(<change>): publish spec`.
7. Tell the user the change name and that the next step is `/to-tickets <change>`.

## When a skill says "publish the tickets"

Used by `/to-tickets`, after the user approves the breakdown.

1. Get onto the change branch (see **Branch**).
2. Run `openspec instructions tasks --change <change>`, read the files it lists, and write `tasks.md` at its output path. Write one group per approved ticket, in the **Ticket format** below, numbered from 1 in dependency order (blockers first, prefactoring first). Its last group is always the **manual test ticket**.
3. Leave `proposal.md`, the specs and `design.md` as they are: publishing tickets never edits the spec.
4. Run `openspec validate <change> --strict` until it passes, then `openspec list` and check that the change shows the expected number of tasks.
5. Commit: `docs(<change>): publish tickets`.
6. Tell the user the next steps, one command per ticket, each in a fresh session: `/implement <change>#1`, `/implement <change>#2`, and so on, ending with the manual test ticket. Say that `/implement <change>` without a number takes the next unblocked ticket.

## Ticket format

```markdown
## 2. Greet the user by name

Blocked by: 1

What to build: the end-to-end behaviour this ticket makes work, from the user's perspective, in one to three sentences.

- [ ] 2.1 Starting the app with a name prints "Hello, <name>"; verified by a test at the CLI seam
- [ ] 2.2 Starting the app without a name prints "Hello, world"; verified by a test at the CLI seam
```

- A ticket is a vertical slice: a narrow path through every layer it touches, demoable or verifiable on its own, sized for one session.
- `Blocked by:` lists ticket numbers (`Blocked by: 1, 3`) or says `Blocked by: none`. A group with no `Blocked by:` line, written before this repo used tickets, is blocked by the group before it.
- Checkboxes `- [ ] N.M` hold the acceptance criteria and nothing else; each one says how it is verified. OpenSpec counts these boxes as the change's progress.
- Each ticket includes the tests and docs its own work needs.
- No file paths or code snippets, as the skills already ask.
- The **manual test ticket** is the last group, `Blocked by:` every other ticket. Its checkboxes are steps a human performs by hand and the result they should see. Keep it to about five steps: the main path, one failure, and what only a person can judge, such as the docs or the wording of a message. Behaviour the automated tests already cover stays with them. The steps run in order on one fresh setup, so each expected result must follow from the state the earlier steps leave: work out ids, counts and lists from that state, not from the examples in other tickets. A step that needs a different starting state says so.

## When a skill says "fetch the relevant ticket"

Used by `/implement`, `/to-tickets` and `/code-review`.

1. Parse the reference. `<change>#N` names ticket N. `<change>` alone means the **frontier ticket**: the first group, in order, whose blockers have every box ticked and which still has an unticked box. With no reference and several changes in `openspec list`, ask which one.
2. Run `openspec instructions apply --change <change> --json` and read every file in `contextFiles`: the ticket's group in `tasks.md`, plus the proposal, specs and design it belongs to.
3. If ticket N was named and one of its blockers still has an unticked box, stop: name the blocker and the command for it, `/implement <change>#<blocker>`.
4. State `Ticket <change>#N: <title>` before starting.
5. If every box of every ticket is ticked, the change is finished: tell the user to run `/close-change <change>`.

If the ticket is the manual test ticket:

1. Before listing the steps, check each expected result against the spec and against the state the steps before it leave. When one cannot happen, say so, add a `- Note:` to the ticket with the result that should happen, and use that one.
2. List the steps with their expected results, then give them as one block the user pastes into their shell (PowerShell on Windows, bash elsewhere). The block starts from a fresh setup, runs every step in order, and prints each command, its output and its exit code, plus whatever a step asks the user to look at, such as a doc. End the message with a direct question asking for the block's output. Do not offer a list of steps to tick.
3. Compare the output with each expected result. Tick only the boxes whose result matches; for the others, add a `- Note:` with what was seen.
4. The ticket changes only `tasks.md`: skip tdd and code-review, which the build tickets and `/close-change` already cover, and commit the ticked boxes.

## While working on a ticket

Used by `/implement`.

- Work on the change branch (see **Branch**).
- Tick a box (`- [x] N.M`) as soon as its criterion is met and verified. The ticket is done when all its boxes are ticked.
- Commit with a Conventional Commits message and the trailer `Refs: <change>#N` on its last line, with the ticked `tasks.md` in the same commit as the code.
- When the work shows the spec is wrong or incomplete, leave the spec as it is: add a `- Note:` bullet to the ticket and tell the user.
- In the final message of a build ticket, show the code-review reports under the headings `## Standards` and `## Spec`, written exactly so in every conversation language, as their own sections and not folded into the ticket summary.
- End the final message with the next command: `/implement <change>#N` for the next frontier ticket, or `/close-change <change>` when every box of every ticket is ticked.

## When a skill says "comment on the ticket"

Add a plain bullet `- Note: <text>` under the ticket's checkboxes. Prototype branches, findings and decisions made during the ticket go here.

## Finding the spec behind a diff

Used by `/code-review`. Read the `Refs: <change>#N` trailers in `git log <fixed-point>..HEAD`. The spec is `openspec/changes/<change>/` (proposal, specs, design) and ticket N in its `tasks.md`. An archived change sits in `openspec/changes/archive/<date>-<change>/`.

## Archive and the living spec

`openspec/specs/` is the living spec. Only `/close-change` changes it, by running `openspec archive`. Every other skill reads it and leaves it as it is.

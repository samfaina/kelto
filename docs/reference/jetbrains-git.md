# JetBrains Git feature reference (for kelto)

## What this reference is for
Functional spec of the Git integration of JetBrains IDEs (IntelliJ IDEA 2026.2), area by area, with the git commands
underneath. The agent reads it at `docs/reference/jetbrains-git.md` and cites the section (e.g. "§4 Update Project")
in every OpenSpec `proposal.md`.

Rules:
- Reproduce behavior, not interface: no JetBrains names, icons, colors, shortcuts, help wording.
- "(proposal)" = JetBrains docs don't say how; recommended kelto implementation.
- Phase: 1 MVP, 2 daily use, 3 advanced, 4 optional/out of scope.
- Src: V = verified against current help (Oct 2026); D = from first draft, re-verify before specifying;
  X = kelto extension (git supports it, JetBrains help does not document it).
- [IDE] = depends on IDE concepts; see last section.
- Minimum git 2.38 (`--update-refs`); `--force-if-includes` needs 2.30. Feature-detect via `git --version`.

## UI surfaces (behavioral)
- Branch popup/widget: current branch, incoming/outgoing indicators, Recent/Local/Remote/Tags, search, Abort/Continue of ongoing operation. [V]
- Commit panel tabs: Changes (Changes, Unversioned Files, Merge Conflicts node), Stash, Shelf (optionally combined "Stashes and Shelves"). [V]
- Git panel tabs: Log (branches pane, graph, changed files, details), Update Info (after Update Project), History, Console, Worktrees. [V except Console/Worktrees: D]
- Status bar: cherry-pick/rebase/merge state with Abort/Continue. [V]

## 1. Repository
| Feature | Behavior | Git | Ph | Src |
|---|---|---|---|---|
| Detect git | Path field + Test. Windows: if git not installed, uses git from WSL2; auto-switches to WSL git for `\\wsl$` projects | `git --version` | 1 | V |
| Open repository | Detect root; offer nested unregistered roots; flag invalid roots | `git rev-parse --show-toplevel`; scan for `.git` (proposal) | 1 | D |
| Clone | URL+folder; hosted repo list; shallow + unshallow; recursive submodules | `git clone [--depth N] [--recurse-submodules] --progress`; `git fetch --unshallow` | 1 (shallow 3) | D |
| Init | | `git init` | 1 | D |
| Add files | Add unversioned; ask on new files; force-add ignored; ask on delete | `git add [-f] -- <p>`; `git rm [--cached]` | 1 | D |
| Ignore | `.gitignore` or `.git/info/exclude`; show ignored | `git status --ignored=matching` | 2 | D |
| Manage remotes | "Manage Remotes" dialog; edit/remove from Branches pane; "Define remote" in Push dialog (name, URL, "Fetch remote") | `git remote add/set-url/remove` | 2 | V |
| Credentials | Option "Use credential helper" (don't override configured helpers) | system helper; kelto `GIT_ASKPASS`/`SSH_ASKPASS` helper; stores no passwords | 1 | V |
| Multi-repo | Several roots; per-root grouping; synchronous branch control (ops on all roots) | one repo actor per root (proposal) | 3 | V |

## 2. Local changes & staging
| Feature | Behavior | Git | Ph | Src |
|---|---|---|---|---|
| Changes view | Modified (blue), added (green), Unversioned Files, conflicts; group by dir/flat | `git status --porcelain=v2 -z --branch --untracked-files=all` | 1 | V |
| File diff | vs HEAD (changelists) or vs index (staging) | `git diff [--cached] -- <p>`; `git show HEAD:<p>` / `:<p>` | 1 | D |
| Partial commit hunk/line | Checkboxes per hunk/line | full-context patch + `git apply --cached --recount` (temp index) | 2 | D |
| Staging area mode | Setting "Enable staging area" (deletes existing changelists); stage file/hunk/line; commit overlapping changes separately | `git add`, `git apply --cached [-R] --recount`, `git restore --staged` | 1/2 | V |
| Rollback | Optionally delete added files | `git restore --source=HEAD --staged --worktree -- <p>`; `git rm --cached` | 1 | D |
| Changelists | IDE-only | none [IDE] | 4 | V |
| CRLF warning | Warns before committing CRLF and **suggests `core.autocrlf` true/input** per OS; skips files with git attributes set | `git config core.autocrlf`; `git check-attr text eol` (proposal) | 2 | V |

## 3. Commit
| Feature | Behavior | Git | Ph | Src |
|---|---|---|---|---|
| Commit | Message, history, template; asks name/email first time | `git commit -F <file>` | 1 | V/D |
| Message checks | Blank line, length margins, spelling | none | 2 | D |
| Amend | Last; earlier via fixup/squash (Commit panel or file History) | `--amend`; `--fixup=<sha>` + `GIT_SEQUENCE_EDITOR=true git rebase -i --autosquash <sha>^` | 1/3 | V |
| Author / sign-off / skip hooks | | `--author`, `--signoff`, `--no-verify` | 2 | D |
| GPG | "Configure GPG Key" in settings | `commit.gpgsign`, `user.signingkey`, `%G?` | 3 | V |
| Commit and Push | Push dialog shown per settings ("Show Push dialog for Commit and Push" / "only when committing to protected branches"), else pushes directly | commit + push | 1 | V |
| Pre-commit checks | [IDE] | "run a command before commit" + hooks | 4 | D |
| Unusual-state warning | "Warn when committing in detached HEAD or during rebase" | `git symbolic-ref -q HEAD`; `git rev-parse --git-path rebase-merge` | 1 | V |

## 4. Synchronization
| Feature | Behavior | Git | Ph | Src |
|---|---|---|---|---|
| Fetch | Menu, widget, "Fetch All Remotes" | `git fetch --all --progress` | 1 | V |
| Auto fetch | Every 20 min (registry `git.update.incoming.info.time`) | timer | 2 | V  |
| Check remote for incoming | Marks branches with unfetched commits | `git ls-remote --heads` vs tracking refs (proposal) | 3 | V |
| In/out counts | Next to branch | `git rev-list --left-right --count <b>...<b>@{u}` | 1 | V |
| Fetch tags | Auto / Sync (`--prune-tags`) / Always (`--tags`) / Never (`--no-tags`) | | 3 | V  |
| Pull | Repo, remote, branch (upstream default; remembers other choice); `--rebase --ff-only --no-ff --squash --no-commit --no-verify` | `git pull [opts] <r> <b>` | 1 | V |
| Update branch | Selected branch(es) from tracked remote, configured method | current: fetch+merge/rebase; other, ff-able: `git fetch <r> refs/heads/<rb>:refs/heads/<lb>` (proposal) | 2 | V |
| Update Project | Fetch all roots; **Merge / Rebase / Reset to the Remote Branch**; clean tree with Stash or Shelve; submodules on branch updated, detached → `git submodule update`; Update Info tab; path filter | `git merge|rebase @{u}` / `git reset --hard @{u}` wrapped in stash save/restore | 2 | V |
| Push | Repo → branch → editable target; commits+diff; Define remote; tags: Current Branch or All | `git push [-u] <r> <l>:refs/heads/<t>`; All=`--tags`; Current Branch ≠ `--follow-tags` (that is annotated-only) → push `git tag --merged <b>` explicitly | 1 | V |
| Force push | Blocked on protected branches | `--force-with-lease=<ref>:<sha> --force-if-includes` | 2 | V/X |
| Protected branches | Regex list (`;`), team-shared; "Load branch protection rules from GitHub" synced on fetch | settings + API | 3 | V |
| Rejected push | Dialog rebase/merge + remember; or "Auto-update if push rejected" (first time silent merge) | parse rejection, update, retry | 2 | V |
| Push up to here | | `git push <r> <sha>:refs/heads/<b>` | 3 | D |
| Add commits to remote branch | Cherry-pick selected commits onto a chosen remote branch | temp worktree + cherry-pick + push (proposal) | 3 | V |
| Checkout and Update | Checkout then update with configured method (**not** `--ff-only`) | `git switch` + merge/rebase | 2 | V |

## 5. Branches & tags
| Feature | Behavior | Git | Ph | Src |
|---|---|---|---|---|
| Branch popup | Recent/Local/Remote/Tags; search; per-repo groups | `git for-each-ref`; recent from reflog | 1 | V |
| Branches pane | Delete, Show My Branches, Fetch All, favorites, group by dir | | 1 | V |
| New branch | Base HEAD/branch/commit; checkout option | `git check-ref-format --branch`; `git switch -c` | 1 | D |
| Checkout remote | Tracking local; existing local: reset if nothing lost, else Drop Local Commits / Rebase onto Remote | `git switch --track`; `git branch -f`; `git rebase` | 1 | V  |
| Checkout revision/tag | Detached | `git switch --detach` | 1 | D |
| Smart checkout | Save, switch, restore; or force | | 2 | D |
| Rename | Then push and delete old remote | `git branch -m`; `git push <r> --delete <old>` | 1 | V |
| Delete | Immediate even if unmerged; links to unmerged commits and to delete tracked remote branch | `git branch -D`; `git push <r> --delete <b>` | 1 | V  |
| Show Diff with Working Tree | gray = only in selected, green = only in current, blue = differ; Swap; **Get from Branch** | `git diff --name-status <b>`; `git restore --source=<b> -- <p>` | 2 | V |
| Branch menu | Checkout and Rebase onto current; Rebase current onto; Merge into current; Pull using rebase/merge; Update; Push; Rename; Delete; worktree | | 1–2 | V |
| Tags | New (annotated w/ message); Go to tag; delete; push one tag from Tags node | `git tag -a`; `git push <r> refs/tags/<t>`; `git tag -d` | 2 | V |
| Delete remote tag | Not documented | `git push <r> --delete refs/tags/<t>` | 3 | X |

## 6. Log, history, blame
| Feature | Behavior | Git | Ph | Src |
|---|---|---|---|---|
| Graph | Ref labels; current-branch highlight; own commits bold; author≠committer mark | `git log --branches --remotes --tags HEAD --date-order -z --format=%H%x00%P%x00%an%x00%ae%x00%at%x00%cn%x00%ct%x00%s` (refs via `for-each-ref`) | 1 | D |
| Performance | Virtualized, streamed | `git commit-graph write --reachable` | 1/3 | D |
| Search/filters | Text, branch, user, date, paths, root | `--grep [-E -i] --author --since --until -- <p>` | 1/2 | V |
| Highlight Non-Picked Commits | Grey out already applied | `git log --cherry-mark --right-only <cur>...<other>` | 3 | V |
| Go to Hash/Branch/Tag | | `git rev-parse --verify --quiet <x>^{commit}` | 1 | V |
| Details / changed files | Containing branches; merge vs each parent | `git branch -a --contains`; `git diff-tree -r -z -M --root [-m] <sha>` | 1 | D |
| Commit menu | Copy Revision Number, Cherry-pick, Checkout Revision, Reset Current Branch to Here, Revert, Undo Commit, Edit Message, Fixup/Squash Into, Drop, Squash Commits, Interactively Rebase from Here, Rebase onto Selected Commit, New Branch/Tag | §7, §8 | 1–3 | V |
| File menu in commit | **Cherry-Pick Selected Changes**, **Drop Selected Changes**, extract, History Up to Here | | 2–3 | V |
| File history | | `git log --follow --name-status -z -- <p>` | 1 | V |
| Folder / selection history | | `git log -- <dir>`; `git log -L a,b:<p>` | 2/3 | D |
| History for method | [IDE][unconfirmed] | `git log -L :<func>:<p>` | 4 | D |
| Blame | ignore whitespace, detect moves; previous revision; ignore revs | `git blame --porcelain [-w -M -C]`; `<sha>^`; `--ignore-rev` | 2/3 | D |

## 7. Merge, rebase, cherry-pick, conflicts
| Feature | Behavior | Git | Ph | Src |
|---|---|---|---|---|
| Merge | Quick merge; dialog `--no-ff --ff-only --squash -m --no-commit --no-verify --allow-unrelated-histories`; Smart merge (stash/unstash); Abort | `git merge [opts]`; `--abort` | 1/2 | V  |
| Rebase | Quick actions; dialog: target, `--onto` new/old base, another branch to rebase (checked out first), `--interactive --rebase-merges --keep-empty --root --update-refs --autosquash` | `git rebase [opts] --onto <new> <old> [<b>]` | 2/3 | V |
| In progress | Abort/Continue for rebase/merge/cherry-pick | `git rev-parse --git-path MERGE_HEAD|CHERRY_PICK_HEAD|REVERT_HEAD|rebase-merge|rebase-apply` | 1 | V |
| Skip during rebase | Not documented (only Abort/Continue) | `git rebase --skip` | 2 | X |
| Cherry-pick | Multiple; conflicts land in Changes; Abort/Continue; "cherry-picked from" suffix only for commits pushed to protected branches | `git cherry-pick [-x]` | 1 | V |
| Partial cherry-pick | Selected files into changelist, uncommitted | `git diff <sha>^ <sha> -- <p> | git apply -3` | 3 | V |
| Conflicts | Accept yours/theirs, merge tool; unresolved stay under Merge Conflicts | `git ls-files -u -z`; `git checkout --ours/--theirs` + `git add` | 1/2 | V/D |
| 3-pane merge | | stages `:1: :2: :3:`; `git merge-file -p --diff3` | 2/3 | D |

Side swap: during rebase, `--ours`/stage 2 = upstream being rebased onto; `--theirs`/stage 3 = your replayed commit.
Label sides by meaning, never "ours/theirs".

## 8. Rewriting history
Only current-branch commits; never commits pushed to protected branches; pushed commits need force push.
"Interactively Rebase from Here" disabled if the commit has several parents, is not in the current branch, or is pushed to a protected branch. 
| Feature | Git | Ph | Src |
|---|---|---|---|
| Edit message | HEAD `--amend`; older: rebase `reword` via sequence editor + `GIT_EDITOR` | 2 | V |
| Fixup/Squash into | `--fixup/--squash` + `--autosquash` (otherwise depends on `rebase.autoSquash`) | 3 | V |
| Squash / Drop commits | rebase plan | 3 | V |
| Extract / Drop selected changes | rebase `edit` + `git reset HEAD^ -- <p>` / `git restore --source=HEAD^ --staged --worktree -- <p>` + amend | 3 | V |
| Interactive rebase dialog | reorder, Pick, Stop to Edit, Reword, Squash, Fixup, Drop, Reset, preview graph | 3 | V |
| exec/break/label/reset/merge/update-ref | Not offered; helper must preserve them | 3/4 | X |
| Undo commit | `git reset --soft HEAD~1` (root: `git update-ref -d HEAD`) | 1 | V |
| Revert | `git revert [-m 1]` | 1 | D |
| Reset to here | `--soft/--mixed/--hard` (+`--keep`) | 2 | V  |
| Backup ref | `git update-ref refs/kelto/backup/<ts> HEAD` | 1 | X |

## 9. Stash & shelve
| Feature | Behavior | Git | Ph | Src |
|---|---|---|---|---|
| Stash | Root, branch, message, Keep index; stashes **all** changes | `git stash push [-m] [--keep-index] [-u]` | 1 | V  |
| Stash tab | Show Diff vs local version (default) or parent commit (setting) | `git stash list`; `git stash show -p` | 1 | V |
| Unstash | Apply/pop, Reinstate index, as branch; help: can't apply onto dirty copy | `git stash apply|pop [--index]`; `git stash branch` | 1 | V |
| Partial stash | Not offered (Shelf is used) | `git stash push -- <paths>` | 2 | X |
| Combine tabs | Setting | | 3 | V |
| Shelf [IDE] | Select files; silent; Save to Shelf; Recently Deleted; Restore; Import Patches; shelve base revisions; location | own store + `git apply -3` | 3 | V |

## 10. Patches (D): `git diff --binary`, `git format-patch -1 --stdout`; apply `git apply -3 [-p<n>]`, `git am -3`. Phase 3.

## 11. Worktrees, submodules, forks
| Feature | Git | Ph | Src |
|---|---|---|---|
| Worktrees | `git worktree list --porcelain`, add, remove, prune | 3 | D |
| Submodules on update | branch → updated; detached → `git submodule update` | 3 | V |
| Submodule add/remove | `submodule add`; `deinit -f` + `git rm` | 4 | X |
| Sync Fork | origin = fork; add/reuse `upstream`; fetch; rebase onto upstream default | 3 | V  |

## 12. Diff viewer (V)
Side-by-side/unified; only local side editable; prev/next difference, next file; whitespace: None / Trim / Ignore / Ignore + empty lines / imports [IDE]; highlighting: Words / Lines / Split / Characters / None; collapse unchanged; sync scroll.

## 13. Local History [IDE] — out of scope; backup refs + reflog instead.

## 14. Misc
Gutter markers (`git diff -U0`), status colors, read-only git console, hooks output, issue links (regex), GitHub (share, protection rules, Sync Fork), PR/MR (`gh`/`glab`/APIs) — phase 1–4 as listed in first draft.

## Settings to offer (V)
Path to git/Test; Commit: staging area, CRLF warning, detached/rebase warning, cherry-pick suffix, GPG; Push: auto-update on rejection, push dialog options, protected branches, GitHub rules; Update: method, clean tree via Stash/Shelve, path filter, auto fetch, incoming check, fetch tags, credential helper; Stash: combine tabs, diff target.

## How kelto talks to git (corrected)
Git4Idea runs the git CLI ("Requires external Git command line tool to function"); see `plugins/git4idea/src/git4idea/commands/GitHandler.java`, `history/GitLogUtil.java`, `update/GitFetcher.java` for edge cases.
1. Argument arrays, `--` before paths; `GIT_TERMINAL_PROMPT=0`; `GIT_OPTIONAL_LOCKS=0` for reads; `GIT_PAGER=cat`; `-c core.quotepath=false -c color.ui=false`; Windows `CREATE_NO_WINDOW`.
2. Locale: JetBrains sets en_US (commit 8c4591c). Use English UTF-8 locale, fallback `C`; prefer porcelain/exit codes to messages.
3. `git status --porcelain=v2 -z --branch --untracked-files=all`; rename records carry an extra NUL path.
4. Stream log, lanes from `%P`; `--topo-order` fast only with commit-graph; refs via `for-each-ref`.
5. Operation state via `git rev-parse --git-path`.
6. Interactive rebase: `GIT_SEQUENCE_EDITOR` helper + `GIT_EDITOR`; preserve unknown todo lines; honor `core.commentChar`.
7. Staging hunks/lines: full-context patch vs index, `git apply --cached --recount` (`-R` to unstage); `--unidiff-zero` only as fallback.
8. Partial commit: copy index to temp, `GIT_INDEX_FILE`, apply, commit; then refresh the real index for committed paths.
9. Conflicts: `git ls-files -u -z`, `git show :1:/:2:/:3:`, `git merge-file -p --diff3`; side-swap during rebase.
10. Stash detection: `git stash push` exits 0 with "No local changes to save" — compare `git rev-parse -q --verify refs/stash` before/after.
11. `git fetch <r> refs/heads/<rb>:refs/heads/<lb>` only fast-forwards and refuses the branch checked out in this worktree; check `git worktree list`.
12. Force push: `--force-with-lease=<ref>:<sha> --force-if-includes` (kelto auto-fetches, which defeats a bare lease).
13. Credentials via helpers + `GIT_ASKPASS`; no stored passwords.
14. One write queue per repo, parallel reads; watch worktree, HEAD, index, refs/, packed-refs; typed errors.
15. `--progress` parsing of `\r` stderr.

## IDE-dependent features
Changelists → staging area; Shelf → stash first, own shelf later; pre-commit checks → command + hooks; method history → `git log -L :func:`; Local History → backup refs; AI → out of scope.
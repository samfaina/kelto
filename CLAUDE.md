<!-- agent-workflow:start -->
@AGENTS.md

## Repository language

Write everything that goes into the repository in English: code, comments, commit messages, OpenSpec artifacts and docs. The language you talk to the user in comes from the `language` setting in `.claude/settings.local.json`. Every message to the user is in that language, short notes between tool calls included.

## Specialist skills

These skills bring expertise on one topic. Reach for one when the work touches its topic; the workflow above stays in charge.

- `code-simplification`: simplifying working code without changing its behaviour.
- `security-and-hardening`: handling untrusted input, authentication, secrets, personal data or new dependencies.
- `performance-optimization`: a performance requirement exists or a slowdown is suspected.
- `frontend-ui-engineering`: building or changing user interfaces.
<!-- agent-workflow:end -->

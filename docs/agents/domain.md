# Domain Docs

How the engineering skills consume this repo's domain documentation. Layout: single-context.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root: the project's domain language.
- **`docs/adr/`**: the ADRs that touch the area you are about to work in.
- **`openspec/specs/`**: the living spec, what the product does today. `openspec list --specs` lists its capabilities and `openspec show <capability> --type spec` prints one.

If any of these is missing, proceed silently. `/grill-with-docs` creates `GLOSSARY.md` and ADRs when terms and decisions get resolved, and `/close-change` grows the living spec.

## Use the glossary's vocabulary

When your output names a domain concept (a requirement, a ticket title, a test name, a hypothesis), use the term as `GLOSSARY.md` defines it, and none of the synonyms it lists under _Avoid_. A concept missing from the glossary is either invented language (reconsider it) or a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

When your output contradicts an existing ADR, say so explicitly instead of silently overriding it:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because..._

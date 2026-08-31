# Domain docs

How engineering skills consume this repository's domain documentation.

## Before exploring

Read these when they exist:

- `CONTEXT.md` at the repository root.
- ADRs under `docs/adr/` that affect the area being changed.

Proceed silently when either location does not exist. The `domain-modeling` skill creates these files lazily when domain terms or decisions are resolved.

## Layout

This repository uses a single-context layout:

```text
/
├── CONTEXT.md
├── docs/adr/
└── src/
```

## Use the glossary's vocabulary

When output names a domain concept—such as in an issue title, refactoring proposal, hypothesis, or test—use the term defined in `CONTEXT.md`. Avoid synonyms that the glossary explicitly rejects.

If a needed concept is absent, reconsider whether the term belongs to the project or note the gap for `domain-modeling`.

## Flag ADR conflicts

Surface any conflict with an existing ADR instead of silently overriding it:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_

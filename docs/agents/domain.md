# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in.

If either doesn't exist, **proceed silently**. Don't flag absence upfront; create lazily when terms or decisions resolve.

## File structure

Single-context repo:

```
/
├── CONTEXT.md
├── docs/adr/
├── backend/
└── client/
```

## Use the glossary's vocabulary

When naming domain concepts (in ticket titles, refactors, hypotheses, test names), use terms as defined in `CONTEXT.md`.

## Flag ADR conflicts

If output contradicts an existing ADR, surface it explicitly:
> _Contradicts ADR-0001 (...), but worth reopening because…_

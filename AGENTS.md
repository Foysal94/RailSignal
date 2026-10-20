# Folder/Workspace description
A TypeScript monorepo for RailSignal. It consists of a Fastify Node.js API and BullMQ worker backend paired with a dedicated React frontend client.

## Operational Routing
- Always check the relevant directory's instruction file before executing tasks:
  - For backend work: refer strictly to `backend/AGENTS.md`
  - For frontend work: refer strictly to `client/AGENTS.md`

## Commands
- Build: `npm run build`
- Dev: `npm run dev`
- Test: `npm run test`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint` (Biome check across entire monorepo)
- Format: `npm run format` (Biome format write across entire monorepo)
- Lint & Fix: `npm run lint:fix` (Biome check write across entire monorepo)

## Agent skills

### Issue tracker

GitHub issues using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context (`CONTEXT.md` at root + `docs/adr/`). See `docs/agents/domain.md`.

## Universal Engineering Directives
- **Modularity & SRP:** A file must have one reason to change. Never co-locate external I/O/transport, domain business logic, and payload transformation in a single file. Ticket file paths define public entry points; decompose internal responsibilities into focused sibling modules.
- **No Shallow Wrappers:** Do not create separate service or helper files for trivial pass-throughs lacking business logic (e.g. direct queue dispatches or simple queries). Extract only when genuine domain rules or multi-step coordination exist.
- **Encapsulation & Extraction:** Never expose private class members, internal component state, or route handlers purely for test access. If unexported helper logic requires dedicated unit testing, extract it into a focused pure module and test that module's public contract directly.
- **Comments (Why, Never What):** Zero tautological comments (`// fetch data`, `// set state`). Mandatory rationale comments for non-obvious logic: vendor quirks, framework traps, temporal edge cases, or domain heuristics.
- **No JSDoc:** Never write JSDoc blocks (`/** ... */`). TypeScript types, interfaces, and function signatures are the documentation. Use inline comments (`//`) strictly for non-obvious rationale (vendor quirks, temporal edge cases).


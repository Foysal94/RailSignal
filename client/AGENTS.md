# Frontend Directives: RailSignal React Client

> Reference `docs/technical-specification.md` for UI domain contracts.

## Commands
- Dev Server: `npm run dev` (inside `/client`)
- Build: `npm run build`
- Run Tests: `npm run test`
- Lint & Typecheck: `npm run lint && npm run typecheck`

## Architecture & Conventions
- **API Client Layer:** All HTTP calls route through `src/api/client.ts` to the local Fastify backend. Never call external third-party vendor APIs directly from the browser.
- **Server State:** Use TanStack Query v5 object syntax in `src/hooks/`. Gate loading skeletons on `isFetching` (active network activity).
- **Component Layout:** Feature domains live in `src/components/<domain>/`, shared primitives in `src/components/common/`, layout in `src/components/layout/`.
- **Pure Leaf Components:** Presentational leaf components must remain pure (props in -> JSX out). Keep state, caching, and mutations isolated in container views or hooks.
- **React 19 & TypeScript:** Standard function components (no `React.FC`). Pass `ref` as a normal prop (no `forwardRef`). Compute derived state during render; never sync props in `useEffect`.
- **Date Handling:** Dates (`YYYY-MM-DD`) must be parsed using UTC getters or string splitting to prevent timezone shift bugs.
- **Styling & Components:** Tailwind CSS for all styling. Use headless primitives (Radix, `react-datepicker`) for complex widgets; do not import monolithic UI frameworks (MUI, AntD). Mobile interactive controls require `min-h-[44px]`.
- **Comments (Why, Never What):** Forbid tautological comments (`// render row`, `// set state`). Only comment browser workarounds or vendor payload quirks.

## Testing Standards
- Place component and hook tests in adjacent `__tests__/` subdirectories.
- Test Naming: Every test case must follow `Should_...`.
- Query DOM via user-facing roles (`getByRole`, `getByLabelText`) with `@testing-library/user-event`.
- Mock network interactions using MSW handlers; do not mock `fetch` via `vi.fn()`.

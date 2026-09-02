# Coding Conventions

- Use TypeScript. Prefer ES modules.
- Follow the repo Prettier configuration (2 spaces, print width 120, single quotes, no semicolons, trailing commas).
- Do not commit files from `dist` or `node_modules`.
- Ownership/disposal: never use raw `addEventListener`/`setTimeout`/`setInterval`/`requestAnimationFrame`/`new ResizeObserver` in `src/**` — use the `Scope` equivalents (`scope.listen`, `scope.timeout`, ...). ESLint enforces this (`no-restricted-syntax` in `eslint.config.js`); the rule messages tell you the right replacement.
- New plugins use `definePlugin` (see `src/define-plugin.ts` and any of `src/plugins/hover.ts`, `zoom.ts`, `timeline.ts` as references). Do not author new `BasePlugin` subclasses.
- Every new `src/**/*.ts` file gets a matching test file in `src/__tests__/` (or the nearest `__tests__/` directory).

# Programmatic Checks

Run ALL of these after making changes, in this order (approximate timings on a typical machine):

1. `yarn lint` — ESLint, check-only (~8s). Use `yarn lint:fix` to auto-fix, then review the diff it makes.
2. `yarn typecheck` — type-checks both the library and the test files (~6s).
3. `yarn test:unit` — Jest unit tests, ~580 tests (~20s). Coverage thresholds are enforced; if they fail, add tests rather than lowering the thresholds.
4. `yarn test:leaks` — GC leak harness (~25s). **Mandatory when touching `scope.ts`, any `destroy()` path, plugin teardown, or the reactive layer**; cheap enough to always run.
5. `yarn build` — full build incl. `verify-exports` (~30s). Required when touching public types, exports, or `rollup.config.js`.

Beware: `yarn test` (without `:unit`) runs Cypress e2e — it needs a prior `yarn build`, a served page, and a browser binary. Don't use it for quick verification; use `yarn test:unit`.

If a command fails due to environment limits (e.g. no browser for Cypress), note this in the PR — but the unit-test/lint/typecheck gauntlet above is expected to run everywhere.

# Pull Request Guidelines

When opening a PR, use the provided template and include:
- **Short description**
- **Implementation details**
- **How to test it**
- **Checklist** with the items from `.github/PULL_REQUEST_TEMPLATE.md`.

The title of the PR should follow the semantic commit convention (e.g. `fix(Regions): remove unused variable`).

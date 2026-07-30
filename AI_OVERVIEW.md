# Repository Overview for AI Agents

This document gives a condensed view of the project structure and build process so that AI tools (like Codex) can reason about the codebase without scanning every file.

## Project Structure

- **`src/`** – TypeScript source files for the library. The entry point is [`wavesurfer.ts`](../src/wavesurfer.ts). Other files implement features such as the player, plugins, and utilities.
  - **`src/scope.ts`** – `Scope`, the disposal-tree primitive (listeners, timers, observers, signal subscriptions, child lifetimes) that every `destroy()` in the codebase is expressed with.
  - **`src/reactive/`** – the signal store (`store.ts`: `signal`/`computed`/`effect`/`batch`, always-disposable) plus stream primitives (`event-streams.ts`, `drag-stream.ts`, `scroll-stream.ts`) that wrap DOM events as composable, scope-owned subscriptions.
  - **`src/state/`** – `WaveSurferState`/`WaveSurferActions` (`wavesurfer-state.ts`), the centralized reactive state returned by `wavesurfer.getState()`.
  - **`src/define-plugin.ts`** – `definePlugin(name, (ctx, options) => api)`, the functional plugin API; six first-party plugins (`hover`, `zoom`, `timeline`, `minimap`, `envelope`, `regions`) are built on it. `BasePlugin`-based (class) plugins keep working unchanged.
  - **`src/__tests__/`** – unit tests colocated with `src/` (excluded from `tsc`'s build output via `tsconfig.json`'s `exclude`, but still type-checked/run by `ts-jest`).
- **`examples/`** – Stand‑alone demos used for manual testing and documentation. Each example is an HTML page importing the library and demonstrating a specific feature.
- **`cypress/`** – End‑to‑end and visual regression tests powered by Cypress. Tests live in `cypress/e2e` and snapshots reside in `cypress/snapshots`.
- **`scripts/`** – Helper scripts for cleaning the build directory and creating new plugins.
- **Root config files** – `package.json` defines the build, lint, and test commands. TypeScript configuration is in `tsconfig.json`; ESLint is configured in `eslint.config.js` (flat config), including `no-restricted-syntax` bans on raw `addEventListener`/`setTimeout`/`new ResizeObserver`/etc. in `src/**` outside a small primitive-file allowlist, in favor of the `Scope` equivalents.

## Common Tasks

- **Install dependencies**: `yarn`
- **Run the dev server**: `yarn start` (compiles TypeScript in watch mode and serves examples on <http://localhost:9090>)
- **Build for production**: `yarn build`
- **Run lint checks**: `yarn lint`
- **Run unit tests**: `yarn test:unit` (Jest; `jest.config.js` defines two projects — `default`, everything except the GC-leaks suite, and `leaks`, `src/__tests__/gc-leaks.test.ts` only, run separately via `yarn test:leaks` with `--expose-gc` since it asserts real garbage collection)
- **Run Cypress tests**: `yarn cypress`

## Contribution Notes

- Follow the coding conventions in [`AGENTS.md`](AGENTS.md).
- Do not commit generated files from `dist/` or `node_modules/`.

This overview should help an AI agent quickly locate relevant source files and scripts without traversing the entire repository.

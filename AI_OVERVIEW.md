# Repository Overview for AI Agents

This document gives a condensed view of the project structure and build process so that AI tools (like Codex) can reason about the codebase without scanning every file.

## Project Structure

- **`src/`** – TypeScript source files for the library. The entry point is [`wavesurfer.ts`](../src/wavesurfer.ts). Other files implement features such as the player, plugins, and utilities.
- **`examples/`** – Stand‑alone demos used for manual testing and documentation. Each example is an HTML page importing the library and demonstrating a specific feature.
- **`cypress/`** – End‑to‑end and visual regression tests powered by Cypress. Tests live in `cypress/e2e` and snapshots reside in `cypress/snapshots`.
- **`scripts/`** – Helper scripts for cleaning the build directory and creating new plugins.
- **Root config files** – `package.json` defines the build, lint, and test commands. TypeScript configuration is in `tsconfig.json`, and linting rules are in `.eslintrc` and `.prettierrc`.

## Common Tasks

- **Install dependencies**: `yarn`
- **Run the dev server**: `yarn start` (compiles TypeScript in watch mode and serves examples on <http://localhost:9090>)
- **Build for production**: `yarn build`
- **Run lint checks**: `yarn lint`
- **Run Cypress tests**: `yarn cypress`

## Contribution Notes

- Follow the coding conventions in [`AGENTS.md`](AGENTS.md).
- Do not commit generated files from `dist/` or `node_modules/`.

This overview should help an AI agent quickly locate relevant source files and scripts without traversing the entire repository.

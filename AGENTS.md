# Coding Conventions

- Use TypeScript. Prefer ES modules.
- Follow the repo Prettier configuration (2 spaces, print width 120, single quotes, no semicolons, trailing commas).
- Do not commit files from `dist` or `node_modules`.

# Programmatic Checks

1. `yarn lint`

Run these after making changes. If a command fails due to environment limits, note this in the PR.

# Pull Request Guidelines

When opening a PR, use the provided template and include:
- **Short description**
- **Implementation details**
- **How to test it**
- **Checklist** with the items from `.github/PULL_REQUEST_TEMPLATE.md`.

The title of the PR should follow the semantic commit convention (e.g. `fix(Regions): remove unused variable`).

# Issue Tracking with Beads

This project uses [Beads](https://github.com/steveyegge/beads) (`bd`) for issue tracking and task management. Beads is a lightweight, git-based issue tracker designed specifically for AI coding agents.

## Quick Start

If you haven't already, run `bd onboard` to get started. This will integrate Beads into your workflow.

## Important Notes for AI Agents

- **Working Directory:** You are already in the repository root - do NOT prefix commands with `cd` to the repository directory
- **Command Efficiency:** Run commands directly (e.g., `bd ready`, not `cd <repo-path> && bd ready`)
- **Multiple Operations:** Use tool calling to run multiple independent commands simultaneously

## Core Workflow

**Finding work:**
```bash
bd ready --json              # Find issues ready to work on (no blockers)
bd list --status open        # View all open issues
bd show <issue-id>           # View issue details
```

**During work:**
```bash
bd update <issue-id> --status in_progress
bd create "Discovered bug" -t bug -p 0 --json  # File new issues as discovered
bd dep add <new-id> <parent-id> --type discovered-from  # Link to parent work
```

**Completing work:**
```bash
bd close <issue-id> --reason "Implemented and tested"
git add -A && git commit -m "feat: <brief description>" # Commit after each task completion
bd sync  # Sync with git
```

**Important:** Always commit your changes after completing each task. This creates atomic, reviewable changes.

**Creating issues:**
- Use `bd create` instead of markdown TODO lists
- Link related issues with dependencies (`bd dep add`)
- File issues proactively as you discover work

## Key Features

- **Dependency tracking**: Four types (blocks, related, parent-child, discovered-from)
- **Ready work detection**: Automatically finds unblocked issues
- **Git-versioned**: Syncs across machines via git
- **JSON output**: Perfect for programmatic use with `--json` flag

See the [Beads documentation](https://github.com/steveyegge/beads) for complete details.

## Reactive Refactoring Epic

A major refactoring effort is underway to transform wavesurfer.js from imperative to declarative/reactive architecture.

**Epic:** `wavesurfer.js-wpg` - Refactor to Declarative/Reactive Architecture

**Rendering Architecture Principles:**
1. ✅ **Canvas rendering:** Only waveform and spectrogram
2. ✅ **DOM rendering:** Everything else (regions, cursor, timeline, hover, etc.)
3. ✅ **No markers plugin:** Markers are zero-width regions (where `end = start` or no `end` specified)

**View all tasks and status:**
```bash
bd show wavesurfer.js-wpg                    # View epic details
bd ready                                      # See tasks ready to start
bd list --status open                         # View all open tasks
bd list --status closed                       # View completed tasks
```

**View tasks by phase:**
```bash
# View all tasks for a specific phase
bd list --json | jq '.[] | select(.title | contains("Phase 2, Task"))'
bd list --json | jq '.[] | select(.title | contains("Phase 3, Task"))'
bd list --json | jq '.[] | select(.title | contains("Phase 4, Task"))'
bd list --json | jq '.[] | select(.title | contains("Phase 5, Task"))'

# Count tasks per phase
bd list --json | jq 'map(select(.title | contains("Phase 2, Task"))) | length'
```

**Key Info:**
- All implementation details are in `bd` issue descriptions (no separate MD files)
- Use `bd show <task-id>` to see full task details with code examples
- Each task has explicit dependency relationships

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

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

### Phase Status

**✅ Phase 1: Implement Reactive Foundation** (COMPLETE)
- Reactive store with signals, effects, computed
- Type-safe signal system with subscriptions
- Core reactive primitives

**✅ Phase 2: Migrate Rendering to Reactive** (COMPLETE)
- Declarative renderer architecture
- Component-based DOM rendering (Progress, Cursor)
- Reactive render scheduling
- Regions plugin converted to reactive

**✅ Phase 3: Transform Events to Reactive Streams** (COMPLETE)
- Reactive state (WaveSurferState) with automatic event emission
- Media event bridges (bridgeMediaEvents)
- State-driven event emission (setupStateEventEmission)
- Reactive animation (removed Timer class)
- Event stream API for users (toStream, toStreams, mergeStreams)
- Reactive interaction streams (scroll, drag)
- 370 unit tests passing, 100% coverage on reactive modules

**🚧 Phase 4: Separate Pure Logic from Side Effects** (IN PROGRESS)
- Extract pure functions from components
- Separate business logic from rendering
- Pure function utilities

**📋 Phase 5: Renderer & Plugin Refactor + Polish** (PLANNED)
- Refactor Renderer to fully reactive (expose streams not events)
- Refactor all plugins to reactive architecture
- Documentation and migration guides
- Performance optimization

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

## Task Selection Guidelines

**Focus on converting existing functionality, not adding new features:**
- ✅ **Convert:** Refactor imperative code to reactive patterns
- ✅ **Extract:** Separate pure functions from side effects
- ❌ **Avoid:** Adding new features like keyboard shortcuts (unless they existed before)
- When in doubt, check if the functionality already exists in the codebase

**Close duplicate or already-completed tasks:**
- Some tasks may overlap or be completed as part of other work
- Use `bd close <task-id> --reason "explanation"` to close duplicates
- Example: Task for audio events was completed during Player refactoring

**Prioritize tasks without dependencies:**
- Check `bd show <task-id>` to see dependencies
- Tasks with "Blocks: None" or all dependencies closed are ready
- Phase 4 tasks (pure function extraction) are often independent

# Coding Conventions

- Use TypeScript. Prefer ES modules.
- Follow the repo Prettier configuration (2 spaces, print width 120, single quotes, no semicolons, trailing commas).
- Do not commit files from `dist` or `node_modules`.

## Code Quality Practices

**Use existing utilities instead of verbose code:**
- ✅ Use `dom.ts` utilities (`createElement`) instead of manual DOM manipulation
- ✅ Example: Replace multiple `element.style.x = y` with declarative style objects
- Check existing utility files before writing new code: `dom.ts`, `renderer-utils.ts`, `decoder.ts`

**Pure function extraction guidelines:**
- Mark pure functions with "Pure function - no side effects" JSDoc comment
- Group related pure functions together with section headers
- Separate pure functions from side-effecting wrappers
- Pure functions should:
  - Have no side effects
  - Always return same output for same input
  - Be testable without mocking
  - Be composable and reusable

**Reactive pattern guidelines:**
- Use signals for reactive state: `signal<T>(initialValue)`
- Use effects for side effects: `effect(() => { ... }, [dependencies])`
- Use computed for derived values: `computed(() => { ... }, [dependencies])`
- Always clean up subscriptions in destroy/cleanup
- Pattern: signal → effect → emit events

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

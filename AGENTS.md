# Issue Tracking with Beads

This project uses [Beads](https://github.com/steveyegge/beads) (`bd`) for issue tracking and task management. Beads is a lightweight, git-based issue tracker designed specifically for AI coding agents.

## Quick Start

If you haven't already, run `bd onboard` to get started. This will integrate Beads into your workflow.

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
bd sync  # Sync with git
```

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

**Current Status:**
- **Total Issues:** 92 (83 open, 9 closed)
- **Epic:** 1 issue
- **Granular Implementation Tasks:** 39 tasks (Phase 2-5, all with detailed descriptions)
- **Supporting Tasks:** ~43 additional tasks (infrastructure, reviews, etc.)
- **Phase 1 (Reactive Foundation):** ✅ Complete (9 closed tasks)
- **Phase 2 (Declarative Rendering):** 11 granular tasks ready
- **Phase 3 (Event Streams):** 10 granular tasks defined
- **Phase 4 (Pure Functions):** 10 granular tasks defined
- **Phase 5 (Integration & Polish):** 8 granular tasks defined

**View the epic and all tasks:**
```bash
bd show wavesurfer.js-wpg                    # View epic details
bd ready                                      # See tasks ready to start
bd list --status open                         # View all 83 open tasks
```

**Get started on Phase 2:**
```bash
bd show wavesurfer.js-uas                    # Phase 2, Task 1: Render tree abstraction
bd update wavesurfer.js-uas --status in_progress
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

**Key Characteristics:**
- ✅ All implementation details in bd issue descriptions (no separate MD files)
- ✅ 5 phases with clear dependencies between tasks
- ✅ Comprehensive descriptions with code examples in each task
- ✅ Phase 1 (Reactive Foundation) 100% complete
- ✅ Phase 2-5: All 39 granular tasks defined and ready
- 📝 Estimated timeline: 15-21 weeks total (Phase 1: 4 weeks done, remaining: 11-17 weeks)

**Phase Overview:**

**Phase 1: Reactive Foundation** ✅ COMPLETE (9 tasks closed)
- Signal and effect system
- Computed signals with automatic dependency tracking
- Memoization utilities
- Comprehensive test suite
- Documentation

**Phase 2: Declarative Rendering** (11 granular tasks)
- Task 1: Create declarative Canvas render tree abstraction
- Task 2: Convert Renderer drawWaveform to declarative
- Task 3: Convert Renderer drawBars to declarative
- Task 4: Convert cursor rendering to declarative
- Task 5: Convert Regions plugin rendering to declarative
- Task 6: Convert Markers plugin rendering to declarative
- Task 7: Create declarative hover effects system
- Task 8: Implement render batching and RAF scheduling
- Task 9: Add layer compositing system
- Task 10: Convert Spectrogram plugin to declarative rendering
- Task 11: Add render tree testing utilities

**Phase 3: Event Streams** (10 granular tasks)
- Task 1: Create event stream abstraction
- Task 2: Convert click events to streams
- Task 3: Convert drag events to streams
- Task 4: Convert scroll/zoom events to streams
- Task 5: Convert keyboard events to streams
- Task 6: Convert audio events to streams
- Task 7: Convert resize events to streams
- Task 8: Implement region interaction streams
- Task 9: Replace EventEmitter with event streams
- Task 10: Add event stream testing utilities

**Phase 4: Pure Functions** (10 granular tasks)
- Task 1: Extract pure audio decoding functions
- Task 2: Extract pure peak calculation functions
- Task 3: Extract pure waveform path generation
- Task 4: Extract pure coordinate transformation functions
- Task 5: Extract pure color manipulation functions
- Task 6: Separate business logic from side effects in plugins
- Task 7: Extract pure time/pixel conversion functions
- Task 8: Create pure zoom calculation functions
- Task 9: Add property-based testing for pure functions
- Task 10: Document pure function architecture

**Phase 5: Integration & Polish** (8 granular tasks)
- Task 1: Complete test coverage for reactive system (>90%)
- Task 2: Performance benchmarking and optimization
- Task 3: Memory leak detection and prevention
- Task 4: Update all plugins to reactive architecture
- Task 5: Create migration guide for users
- Task 6: Update API documentation
- Task 7: Add reactive DevTools integration
- Task 8: Final code cleanup and linting

**Success Metrics (tracked in epic):**
- 20% LOC reduction (~8,741 → ~7,000 lines)
- >90% test coverage
- ≤5% performance overhead
- Zero memory leaks (automatic subscription cleanup)
- Better state predictability and debuggability

**Task Dependencies:**
- Each task has explicit `blocks` dependencies
- Use `bd show <task-id>` to see full implementation details
- Dependencies ensure proper build order across phases

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

# DeclarativeRenderer Migration Plan

## Overview
Migrate WaveSurfer from using the old imperative Renderer for cursor/progress to the new reactive DeclarativeRenderer.

## Parent Task
**wavesurfer.js-fl6**: Migrate WaveSurfer to use DeclarativeRenderer for cursor/progress UI

## Task Breakdown

### ✅ Ready to Start (No Blockers)

#### Task 1: Extract waveform canvas rendering from old Renderer
**ID**: wavesurfer.js-mdo  
**Priority**: P1  
**Description**: Extract pure waveform canvas rendering logic into separate module  
**Files**: Create `src/renderer/canvas-renderer.ts`  
**Effort**: ~3-4 days

#### Task 3: Update DeclarativeRenderer to handle all cursor/progress options
**ID**: wavesurfer.js-awz  
**Priority**: P1  
**Description**: Add missing features to DeclarativeRenderer (setOptions, auto-scroll, etc.)  
**Files**: `src/renderer/declarative-renderer.ts`  
**Effort**: ~2-3 days

#### Task 4: Wire up WaveSurferState to Renderer
**ID**: wavesurfer.js-0jp  
**Priority**: P1  
**Description**: Pass reactive state to Renderer so DeclarativeRenderer can use it  
**Files**: `src/wavesurfer.ts`, `src/renderer.ts`  
**Effort**: ~1-2 days

### 🔒 Blocked Tasks

#### Task 2: Integrate DeclarativeRenderer into old Renderer for cursor/progress
**ID**: wavesurfer.js-2v4  
**Priority**: P1  
**Blocked by**: Tasks 1, 3, 4  
**Description**: Make old Renderer delegate cursor/progress to DeclarativeRenderer  
**Effort**: ~3-4 days

#### Task 5: Update plugins to work with DeclarativeRenderer
**ID**: wavesurfer.js-358  
**Priority**: P1  
**Blocked by**: Task 2  
**Description**: Update Record and other plugins to work with new architecture  
**Effort**: ~2-3 days

#### Task 6: Add integration tests for DeclarativeRenderer migration
**ID**: wavesurfer.js-x8h  
**Priority**: P1  
**Blocked by**: Task 5  
**Description**: Comprehensive tests for migration  
**Effort**: ~2-3 days

## Execution Order

```
Phase 1 (Parallel):
  ├── Task 1: Extract canvas rendering
  ├── Task 3: Enhance DeclarativeRenderer
  └── Task 4: Wire up state

Phase 2:
  └── Task 2: Integrate DeclarativeRenderer

Phase 3:
  └── Task 5: Update plugins

Phase 4:
  └── Task 6: Integration tests
```

## Total Effort
13-19 days (~3-4 weeks)

## Success Criteria
- [ ] Cursor and progress rendered by DeclarativeRenderer
- [ ] Record plugin cursor visible in continuous mode
- [ ] All existing APIs still work
- [ ] All tests pass
- [ ] No manual cursor/progress manipulation needed
- [ ] Code coverage maintained or improved

## Benefits
1. **Fixes cursor regression**: Record plugin cursor will work automatically
2. **Reactive architecture**: Cursor/progress update automatically via state
3. **Cleaner code**: Separation of concerns (canvas vs UI rendering)
4. **Better testability**: Reactive effects are easier to test
5. **Foundation for future**: Can fully deprecate old Renderer later

## Related Issues
- Commit 27be88e: Introduced cursor hiding for scrolling mode
- Commit 32f66e3: Attempted cursor fix
- Epic wavesurfer.js-wpg: Reactive Architecture Refactoring

## Files to Modify
- `src/renderer.ts` - Old Renderer (modify)
- `src/renderer/declarative-renderer.ts` - DeclarativeRenderer (enhance)
- `src/renderer/canvas-renderer.ts` - New file (create)
- `src/wavesurfer.ts` - WaveSurfer main class (modify)
- `src/plugins/record.ts` - Record plugin (simplify)
- Various test files

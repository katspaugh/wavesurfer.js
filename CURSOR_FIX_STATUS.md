# Record Plugin Cursor Issue - Status

## Problem
The cursor is not visible during recording in the Record plugin, particularly in continuous waveform mode.

## Root Cause Analysis

### Architecture Issue
WaveSurfer.js is currently mid-migration from imperative to reactive architecture:
- **Old Renderer** (`src/renderer.ts`): 844 lines, handles everything (waveform, cursor, progress, events)
- **New DeclarativeRenderer** (`src/renderer/declarative-renderer.ts`): 277 lines, handles only cursor/progress reactively
- **Current State**: WaveSurfer still uses old Renderer; DeclarativeRenderer exists but isn't wired up

### The Cursor Fix Applied
In `src/plugins/record.ts` lines 131-135:
```typescript
} else {
  // Ensure cursor is visible in continuous waveform and default modes
  // Restore from original options or use default  
  this.wavesurfer.options.cursorWidth = this.originalOptions.cursorWidth ?? 1
}
```

This explicitly restores `cursorWidth` for non-scrolling modes.

### Why It Should Work
1. Record plugin calls `wavesurfer.load()` repeatedly (every 10ms)
2. `load()` calls `renderer.render(audioData)` 
3. `render()` sets `cursor.style.width = this.options.cursorWidth + 'px'` (line 671 of renderer.ts)
4. Record plugin calls `wavesurfer.setTime()` to position cursor
5. `setTime()` calls `renderer.renderProgress()` which sets `cursor.style.left`

### Testing
Created `test-record-cursor.html` to debug cursor visibility in real browser environment.
The test page logs cursor properties and allows testing all three modes.

## Next Steps

### Short Term (Immediate Fix)
1. Test with real browser using test-record-cursor.html
2. If cursor still not visible, check:
   - Is cursor element actually in DOM?
   - What are its computed styles?
   - Is it hidden by CSS or z-index issues?
   - Is setTime() actually being called?

### Long Term (Architecture Fix)  
Task: wavesurfer.js-fl6 - "Migrate WaveSurfer to use DeclarativeRenderer"

This requires:
1. Refactor old Renderer to delegate cursor/progress to DeclarativeRenderer
2. Keep waveform canvas rendering in old Renderer (or extract to separate class)
3. Wire up reactive state to DeclarativeRenderer
4. Ensure all renderer methods still work
5. Update all plugins

This is a Phase 5 task in the reactive refactoring epic.

## Files Modified
- `src/plugins/record.ts` - Added cursor width restoration for continuous mode
- `test-record-cursor.html` - Test page for debugging

## References
- Epic: wavesurfer.js-wpg (Reactive Architecture Refactoring)
- Task: wavesurfer.js-fl6 (DeclarativeRenderer Migration)
- Commit: 27be88e (introduced cursor hiding for scrolling mode)
- Commit: 32f66e3 (attempted fix for cursor visibility)

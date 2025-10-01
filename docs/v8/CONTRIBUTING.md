# Contributing to WaveSurfer.js v8

Thank you for your interest in contributing! This guide will help you get started with v8 development.

## Quick Links

- **[Plugin Development Guide](./PLUGIN_DEVELOPMENT_GUIDE.md)** - Build plugins for v8
- **[Architecture Documentation](./V8_IMPLEMENTATION_COMPLETE.md)** - Understand the v8 architecture
- **[API Reference](./API.md)** - Complete API documentation

## Development Setup

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/katspaugh/wavesurfer.js.git
cd wavesurfer.js

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Project Structure

```
wavesurfer.js/
├── src/
│   ├── streams/          # Reactive streams
│   ├── state/            # State management
│   ├── core/             # Pure functions
│   ├── utils/            # Utilities
│   ├── plugins/          # Plugin system
│   └── ...               # Core components
├── examples/             # Example files
├── docs/                 # Documentation
└── src/__tests__/        # Tests
```

## v8 Architecture

### Core Concepts

1. **Reactive Streams** - Observable pattern for data flow
2. **Immutable State** - Centralized state management
3. **Pure Functions** - Testable business logic in `core/`
4. **Composition** - Plugin system based on functions, not classes
5. **Automatic Cleanup** - ResourcePool prevents memory leaks

### Key Technologies

- **Vite** - Fast build tool
- **Vitest** - Fast test runner
- **TypeScript** - Type safety
- **Zero dependencies** - No runtime dependencies

## Development Workflow

### Making Changes

1. Create a feature branch
2. Make your changes
3. Write/update tests
4. Run tests: `npm test`
5. Build: `npm run build`
6. Commit with clear message

### Running Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Specific tests
npm test -- path/to/test.ts

# Coverage
npm run test:coverage
```

### Code Style

- Follow existing patterns
- Use TypeScript
- Write tests for new features
- Keep functions small and focused
- Document public APIs

## Plugin Development

If you're building a plugin, please see the **[Plugin Development Guide](./PLUGIN_DEVELOPMENT_GUIDE.md)**.

### Quick Plugin Example

```typescript
import { createPlugin } from 'wavesurfer.js/plugins'

export const MyPlugin = createPlugin(
  {
    id: 'my-plugin',
    version: '1.0.0',
    description: 'My custom plugin'
  },
  (context, options) => {
    // Plugin logic here

    return {
      streams: { /* ... */ },
      actions: { /* ... */ }
    }
  }
)
```

See the full [Plugin Development Guide](./PLUGIN_DEVELOPMENT_GUIDE.md) for details.

## Testing

### Unit Tests

Test files are located in `src/__tests__/` mirroring the source structure:

```
src/
├── streams/
│   └── stream.ts
└── __tests__/
    └── streams/
        └── stream.test.ts
```

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest'

describe('MyFeature', () => {
  it('should do something', () => {
    expect(true).toBe(true)
  })
})
```

### Test Coverage

We aim for high test coverage on core functionality:
- `src/streams/` - Stream implementations
- `src/state/` - State management
- `src/core/` - Pure functions
- `src/plugins/` - Plugin system

## Documentation

### Updating Docs

When adding features:
1. Update API documentation in `docs/v8/API.md`
2. Add examples in `examples/`
3. Update README if needed

### Writing Examples

Create standalone HTML examples in `examples/`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Example</title>
</head>
<body>
  <div id="waveform"></div>
  <script type="module">
    import WaveSurfer from '../dist/wavesurfer.esm.js'

    const wavesurfer = WaveSurfer.create({
      container: '#waveform'
    })

    wavesurfer.load('audio.mp3')
  </script>
</body>
</html>
```

## Submitting Changes

### Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b my-feature`
3. Make your changes
4. Write/update tests
5. Ensure tests pass: `npm test`
6. Build successfully: `npm run build`
7. Commit changes with clear message
8. Push to your fork
9. Open a Pull Request

### PR Guidelines

- **Clear title** - Describe what the PR does
- **Description** - Explain why and how
- **Tests** - Include tests for new features
- **Documentation** - Update docs if needed
- **Examples** - Add examples for new features
- **Breaking changes** - Clearly mark any breaking changes

### Commit Messages

Use clear, descriptive commit messages:

```
Add debounce operator to streams

- Implement debounce operator
- Add tests for debounce
- Update documentation
```

## Release Process

### Version Numbers

We follow [Semantic Versioning](https://semver.org/):

- **Major** (8.0.0) - Breaking changes
- **Minor** (8.1.0) - New features, backward compatible
- **Patch** (8.0.1) - Bug fixes

### Beta Releases

Beta versions for testing: `8.0.0-beta.1`

## Getting Help

- **Questions** - [GitHub Discussions](https://github.com/katspaugh/wavesurfer.js/discussions)
- **Bugs** - [GitHub Issues](https://github.com/katspaugh/wavesurfer.js/issues)
- **Chat** - Join our community chat

## Code of Conduct

Be respectful and constructive. We're all here to make WaveSurfer.js better.

## Resources

### v8 Documentation

- **[Plugin Development Guide](./PLUGIN_DEVELOPMENT_GUIDE.md)** - Build plugins
- **[API Reference](./API.md)** - Complete API
- **[Architecture](./V8_IMPLEMENTATION_COMPLETE.md)** - Design decisions
- **[File Structure](./FILE_STRUCTURE.md)** - Code organization

### External Resources

- **[TypeScript Handbook](https://www.typescriptlang.org/docs/)**
- **[Vite Documentation](https://vitejs.dev/)**
- **[Vitest Documentation](https://vitest.dev/)**

## Tips for Contributors

### Working with Streams

```typescript
// Streams are in src/streams/
import { Subject, BehaviorSubject } from '../streams'

const subject = new BehaviorSubject(0)
subject.subscribe(value => console.log(value))
subject.next(1)
```

### Working with State

```typescript
// State is in src/state/
import { createStore } from '../state'

const store = createStore(initialState)
store.select(s => s.playback.isPlaying)
  .subscribe(isPlaying => console.log(isPlaying))
```

### Working with Plugins

See the [Plugin Development Guide](./PLUGIN_DEVELOPMENT_GUIDE.md) for comprehensive documentation.

### Pure Functions

Keep business logic in `src/core/`:

```typescript
// src/core/waveform.ts
export function calculateProgress(
  currentTime: number,
  duration: number
): number {
  if (duration === 0) return 0
  return currentTime / duration
}
```

Pure functions are:
- Easy to test
- Easy to understand
- Easy to reuse
- Optimizable

## Questions?

Don't hesitate to ask! Open a [Discussion](https://github.com/katspaugh/wavesurfer.js/discussions) or reach out to maintainers.

## Thank You!

Your contributions make WaveSurfer.js better for everyone. Thank you for taking the time to contribute! 🎵

---

**[← Back to Plugin Development Guide](./PLUGIN_DEVELOPMENT_GUIDE.md)**

import { createDefaultEsmPreset } from 'ts-jest'

// Two projects (Jest 29's `projects` + `--selectProjects <displayName>`, see
// https://jestjs.io/docs/configuration#projects-arraystring--projectconfig):
//   - 'default': every existing test EXCEPT gc-leaks.test.ts. This is what `yarn test:unit`
//     (and CI) runs, and must behave exactly as the pre-split single-project config did.
//   - 'leaks': ONLY gc-leaks.test.ts, run via `yarn test:leaks` with `NODE_OPTIONS=--expose-gc`
//     so `global.gc()` is callable (the harness asserts this itself at suite start and fails
//     loudly, see gc-leaks.test.ts, rather than silently no-op'ing).
// Each entry in `projects` is a fully independent Jest config when given as an inline object
// (NOT merged with anything outside `projects` other than a handful of global-only options like
// collectCoverage/collectCoverageFrom below) - so the shared bits are factored out here and
// spread into both, rather than relying on any implicit inheritance.
//
// The 'leaks' project is only registered when `global.gc` is already callable (i.e. the process
// was started with --expose-gc, as `yarn test:leaks` does). Without this, a bare `jest` (no
// --selectProjects) picks up BOTH projects by default, and 'leaks' fails all 7 tests with the
// "requires global.gc()" guard below - correct in spirit (it IS misconfigured to run that way)
// but it makes the plain `jest` entry point red for a reason unrelated to what it's testing.
// Gating registration means a bare `jest` only ever sees (and runs) 'default'. This is
// belt-and-suspenders with the in-test `beforeAll` guard in gc-leaks.test.ts: that guard is what
// makes `--selectProjects leaks` without --expose-gc fail loudly and actionably (Jest can't run
// a project with zero registered instances of it, so this file's gating instead surfaces as
// Jest's own "no configured project" / no matching tests error in that case - still not silent).
const sharedProjectConfig = {
  ...createDefaultEsmPreset({ tsconfig: 'tsconfig.test.json' }),
  testEnvironment: 'jsdom',
  // Silences jsdom's "Not implemented: HTMLMediaElement.prototype.pause/load" console noise for
  // every suite in both projects -- see the file's own comment.
  setupFiles: ['<rootDir>/src/__tests__/helpers/jsdom-media-stubs.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // rollup-plugin-web-worker-loader's virtual module scheme (see src/web-worker-loader.d.ts)
    // only resolves under rollup; every spectrogram suite that imports plugins/spectrogram.ts or
    // plugins/spectrogram-windowed.ts (both import the worker eagerly at this exact specifier)
    // needs *something* to resolve here under ts-jest. Redirecting it here (once, for both
    // projects — the 'leaks' project's gc-leaks.test.ts imports plugins/spectrogram.ts too) means
    // individual suites no longer need their own `jest.mock('web-worker:./spectrogram-worker.ts',
    // ..., { virtual: true })` — see helpers/spectrogram-worker-mock.ts.
    '^web-worker:\\./spectrogram-worker\\.ts$': '<rootDir>/src/__tests__/helpers/spectrogram-worker-mock.ts',
  },
}

const leaksProject = {
  ...sharedProjectConfig,
  displayName: 'leaks',
  roots: ['<rootDir>/src'],
  testMatch: ['<rootDir>/src/__tests__/gc-leaks.test.ts'],
}

export default {
  collectCoverage: true,
  // Library source only: test suites and their shared helpers (src/**/__tests__/**) and ambient
  // declaration files are not code under test, and counting them skews the global numbers
  // (gc-leaks.test.ts alone, never run by the 'default' project, reported 0% of ~380 lines).
  collectCoverageFrom: ['src/**/*.ts', '!src/**/__tests__/**', '!src/**/*.d.ts'],
  // Ratchet, set just below the current global numbers: raise as coverage
  // improves, never lower. Global (not per-file) on purpose — moving code
  // between files shouldn't trip it.
  coverageThreshold: {
    global: {
      statements: 87,
      branches: 76,
      functions: 87,
      lines: 89,
    },
  },
  projects: [
    {
      ...sharedProjectConfig,
      displayName: 'default',
      roots: ['<rootDir>/src'],
      // src/__tests__/helpers/ holds shared fixtures, not test suites — Jest's default testMatch
      // (`**/__tests__/**/*.[jt]s?(x)`) would otherwise pick up every file under it and fail each
      // one with "must contain at least one test" (no describe/it in a fixture module). The
      // 'leaks' project doesn't need this: it overrides testMatch to the single gc-leaks.test.ts
      // file explicitly, so it never globs the __tests__ directory in the first place.
      testPathIgnorePatterns: [
        '/node_modules/',
        '<rootDir>/src/__tests__/gc-leaks.test.ts',
        '<rootDir>/src/__tests__/helpers/',
      ],
    },
    ...(typeof globalThis.gc === 'function' ? [leaksProject] : []),
  ],
}

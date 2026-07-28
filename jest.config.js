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
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  globals: {
    'ts-jest': {
      useESM: true,
      tsconfig: 'tsconfig.test.json',
    },
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
  collectCoverageFrom: ['src/**/*.ts'],
  projects: [
    {
      ...sharedProjectConfig,
      displayName: 'default',
      roots: ['<rootDir>/src'],
      testPathIgnorePatterns: ['/node_modules/', '<rootDir>/src/__tests__/gc-leaks.test.ts'],
    },
    ...(typeof globalThis.gc === 'function' ? [leaksProject] : []),
  ],
}

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
    {
      ...sharedProjectConfig,
      displayName: 'leaks',
      roots: ['<rootDir>/src'],
      testMatch: ['<rootDir>/src/__tests__/gc-leaks.test.ts'],
    },
  ],
}

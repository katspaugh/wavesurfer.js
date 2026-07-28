/**
 * Ambient module declaration for imports handled by rollup-plugin-web-worker-loader, e.g.
 * `import SpectrogramWorker from 'web-worker:./spectrogram-worker.ts'` (see spectrogram.ts). At
 * build time the plugin inlines the referenced script and rewrites the import into a constructor
 * that produces a real Worker; in Jest, spectrogram tests replace it via
 * `jest.mock('web-worker:./spectrogram-worker.ts', ...)`. TypeScript has no visibility into
 * either transform, so this declares the shape both expect: a zero-arg constructor producing a
 * Worker. Do not change the `import ... from 'web-worker:./foo.ts'` call sites to match some
 * other shape - rollup-plugin-web-worker-loader depends on that exact import form.
 */
declare module 'web-worker:*' {
  const WorkerFactory: new () => Worker
  export default WorkerFactory
}

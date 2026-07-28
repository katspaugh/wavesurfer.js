import { glob } from 'glob'
import typescript from '@rollup/plugin-typescript'
import terser from '@rollup/plugin-terser'
import dts from 'rollup-plugin-dts'
import webWorkerLoader from 'rollup-plugin-web-worker-loader'

const plugins = [
  webWorkerLoader(),
  typescript({ declaration: false, declarationDir: null }),
  terser({ format: { comments: false } }),
]

export default [
  // ES module
  {
    input: 'src/wavesurfer.ts',
    output: {
      file: 'dist/wavesurfer.esm.js',
      format: 'esm',
    },
    plugins,
  },
  // CommonJS module (Node.js)
  {
    input: 'src/wavesurfer.ts',
    output: {
      file: 'dist/wavesurfer.cjs',
      format: 'cjs',
      exports: 'default',
    },
    plugins,
  },
  // UMD (browser script tag)
  {
    input: 'src/wavesurfer.ts',
    output: {
      name: 'WaveSurfer',
      file: 'dist/wavesurfer.min.js',
      format: 'umd',
      exports: 'default',
    },
    plugins,
  },

  // Compiled type definitions
  {
    input: './dist/wavesurfer.d.ts',
    output: [{ file: 'dist/types.d.ts', format: 'es' }],
    plugins: [dts()],
  },

  // Wavesurfer plugins (exclude worker files and internal shared modules that live under
  // src/plugins/ but aren't public plugin entries themselves - spectrogram-windowing.ts has no
  // default export, which the CJS/UMD `exports: 'default'` builds below require; it's only
  // ever imported by ../spectrogram-setup.ts, never built standalone)
  ...glob
    .sync('src/plugins/*.ts')
    .filter((plugin) => !plugin.includes('worker') && !plugin.includes('spectrogram-windowing'))
    .map((plugin) => [
      // ES module
      {
        input: plugin,
        output: {
          file: plugin.replace('src/', 'dist/').replace('.ts', '.js'),
          format: 'esm',
        },
        plugins,
      },
      // ES module again but with an .esm.js extension
      {
        input: plugin,
        output: {
          file: plugin.replace('src/', 'dist/').replace('.ts', '.esm.js'),
          format: 'esm',
        },
        plugins,
      },
      // CommonJS module (Node.js)
      {
        input: plugin,
        output: {
          name: plugin.replace('src/plugins/', '').replace('.ts', ''),
          file: plugin.replace('src/', 'dist/').replace('.ts', '.cjs'),
          format: 'cjs',
          exports: 'default',
        },
        plugins,
      },
      // UMD (browser script tag)
      {
        input: plugin,
        output: {
          name: plugin
            .replace('src/plugins/', '')
            .replace('.ts', '')
            .replace(/^./, (c) => `WaveSurfer.${c.toUpperCase()}`),
          file: plugin.replace('src/', 'dist/').replace('.ts', '.min.js'),
          format: 'umd',
          extend: true,
          globals: {
            WaveSurfer: 'WaveSurfer',
          },
          exports: 'default',
        },
        external: ['WaveSurfer'],
        plugins,
      },
    ])
    .flat(),
]

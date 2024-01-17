import glob from 'glob'
import typescript from '@rollup/plugin-typescript'
import terser from '@rollup/plugin-terser'
import dts from 'rollup-plugin-dts'

const plugins = [typescript(), terser()]

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

  // Wavesurfer plugins
  ...glob
    .sync('src/plugins/*.ts')
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

  // ES module
  {
    input: 'src/base-plugin.ts',
    output: {
      file: 'dist/base-plugin.esm.js',
      format: 'esm',
    },
    plugins,
  },
  // CommonJS module (Node.js)
  {
    input: 'src/base-plugin.ts',
    output: {
      file: 'dist/base-plugin.cjs',
      format: 'cjs',
      exports: 'default',
    },
    plugins,
  },
  // UMD (browser script tag)
  {
    input: 'src/base-plugin.ts',
    output: {
      name: 'BasePlugin',
      file: 'dist/base-plugin.min.js',
      format: 'umd',
      exports: 'default',
    },
    plugins,
  },

  // ES module
  {
    input: 'src/dom.ts',
    output: {
      file: 'dist/dom.esm.js',
      format: 'esm',
    },
    plugins,
  },
  // CommonJS module (Node.js)
  {
    input: 'src/dom.ts',
    output: {
      file: 'dist/dom.cjs',
      format: 'cjs',
      exports: 'default',
    },
    plugins,
  },
  // UMD (browser script tag)
  {
    input: 'src/dom.ts',
    output: {
      name: 'createElement',
      file: 'dist/dom.min.js',
      format: 'umd',
      exports: 'default',
    },
    plugins,
  },
]

import glob from 'glob'
import typescript from '@rollup/plugin-typescript'
import terser from '@rollup/plugin-terser'

const plugins = [typescript(), terser()]

export default [
  // ES module
  {
    input: 'src/wavesurfer.ts',
    output: {
      file: 'dist/wavesurfer.esm.js',
      format: 'esm',
    },
    plugins: [typescript(), terser()],
  },
  // CommonJS module (Node.js)
  {
    input: 'src/wavesurfer.ts',
    output: {
      file: 'dist/wavesurfer.cjs',
      format: 'cjs',
      exports: 'named',
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
      exports: 'named',
    },
    plugins,
  },

  // Wavesurfer plugins
  ...glob
    .sync('src/plugins/*.ts')
    .map((plugin) => [
      // ES module
      {
        input: plugin,
        output: {
          file: plugin.replace('src/', 'dist/').replace('.ts', '.esm.js'),
          format: 'esm',
        },
        plugins,
      },
      // CommonJS module (Node.js
      {
        input: plugin,
        output: {
          name: plugin.replace('src/plugins/', '').replace('.ts', ''),
          file: plugin.replace('src/', 'dist/').replace('.ts', '.cjs'),
          format: 'cjs',
          exports: 'named',
        },
        plugins,
      },
      // UMD (browser script tag)
      {
        input: plugin,
        output: {
          name: plugin.replace('src/plugins/', '').replace('.ts', ''),
          file: plugin.replace('src/', 'dist/').replace('.ts', '.min.js'),
          format: 'umd',
          globals: {
            WaveSurfer: 'WaveSurfer',
          },
          exports: 'named',
        },
        external: ['WaveSurfer'],
        plugins,
      },
    ])
    .flat(),
]

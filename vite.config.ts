import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: {
        wavesurfer: resolve(__dirname, 'src/wavesurfer.ts'),
        // v8 composition-based plugins
        'plugins/regions': resolve(__dirname, 'src/plugins/regions.ts'),
        'plugins/timeline': resolve(__dirname, 'src/plugins/timeline.ts'),
        // v7 BasePlugin-based plugins (backward compatible)
        'plugins/minimap': resolve(__dirname, 'src/plugins/minimap.ts'),
        'plugins/envelope': resolve(__dirname, 'src/plugins/envelope.ts'),
        'plugins/record': resolve(__dirname, 'src/plugins/record.ts'),
        'plugins/spectrogram': resolve(__dirname, 'src/plugins/spectrogram.ts'),
        'plugins/hover': resolve(__dirname, 'src/plugins/hover.ts'),
        'plugins/zoom': resolve(__dirname, 'src/plugins/zoom.ts'),
      },
      formats: ['es', 'cjs', 'umd'],
      name: 'WaveSurfer',
    },
    rollupOptions: {
      external: ['web-worker:./spectrogram-worker.ts'],
      output: [
        {
          format: 'es',
          entryFileNames: '[name].esm.js',
          chunkFileNames: 'chunks/[name]-[hash].js',
        },
        {
          format: 'cjs',
          entryFileNames: '[name].cjs',
          chunkFileNames: 'chunks/[name]-[hash].cjs',
        },
        // TODO: UMD build requires inlineDynamicImports which conflicts with code-splitting
        // Consider creating a separate build step for UMD or using a bundler that supports it
        // {
        //   format: 'umd',
        //   entryFileNames: '[name].min.js',
        //   name: 'WaveSurfer',
        //   globals: {
        //     WaveSurfer: 'WaveSurfer',
        //   },
        // },
      ],
    },
    sourcemap: true,
    minify: 'esbuild',
    target: 'es2020',
  },
  plugins: [
    dts({
      rollupTypes: true,
      insertTypesEntry: true,
    }),
  ],
  server: {
    port: 9090,
    open: false,
  },
})

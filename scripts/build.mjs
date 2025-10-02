#!/usr/bin/env node
/**
 * Build script for WaveSurfer.js
 * 
 * This script is necessary because Vite doesn't support:
 * 1. Multiple output formats (ES, CJS, UMD) in a single build
 * 2. UMD format with multiple entry points
 * 
 * We orchestrate multiple Vite builds to generate all required output files.
 */

import { build } from 'vite'
import { globSync } from 'glob'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dts from 'vite-plugin-dts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const srcDir = path.resolve(rootDir, 'src')

const mainEntry = path.resolve(srcDir, 'wavesurfer.ts')

const webWorkerPrefixPlugin = () => ({
  name: 'web-worker-prefix',
  resolveId(source, importer) {
    if (source.startsWith('web-worker:')) {
      const resolved = source.replace('web-worker:', '')
      return this.resolve(`${resolved}?worker`, importer, { skipSelf: true })
    }
    return null
  },
})

const pluginEntries = globSync('src/plugins/*.ts', {
  cwd: rootDir,
  windowsPathsNoEscape: true,
}).filter((pluginPath) => !pluginPath.includes('worker'))

async function buildAll() {
  console.log('🔨 Building WaveSurfer.js...\n')

  // Build main library + all plugins for ES, ESM, and CJS (support multiple entries)
  const multiEntryFormats = [
    { name: 'ES (.js)', format: 'es', ext: '.js', minify: false, withDts: true },
    { name: 'ES (.esm.js)', format: 'es', ext: '.esm.js', minify: false, withDts: false },
    { name: 'CommonJS', format: 'cjs', ext: '.cjs', minify: false, withDts: false },
  ]

  for (const { name, format, ext, minify, withDts } of multiEntryFormats) {
    console.log(`📦 Building ${name}...`)

    const entries = { wavesurfer: mainEntry }
    pluginEntries.forEach((pluginPath) => {
      const pluginName = path.basename(pluginPath, '.ts')
      entries[`plugins/${pluginName}`] = path.resolve(rootDir, pluginPath)
    })

    const plugins = [webWorkerPrefixPlugin()]
    if (withDts) {
      plugins.push(
        dts({
          include: ['src/**/*.ts'],
          exclude: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
          entryRoot: 'src',
          outDir: 'dist',
          copyDtsFiles: true,
          rollupTypes: true,
        })
      )
    }

    await build({
      plugins,
      publicDir: false,
      build: {
        emptyOutDir: false,
        minify: minify ? 'esbuild' : false,
        lib: {
          entry: entries,
          formats: [format],
          fileName: (fmt, entryName) => `${entryName}${ext}`,
        },
        rollupOptions: {
          external: (id) => {
            // Externalize wavesurfer for plugins
            return id.includes('wavesurfer') && !id.includes('wavesurfer.ts') && id.match(/\/wavesurfer\.(js|ts)$/)
          },
          output: {
            exports: format === 'cjs' ? 'default' : undefined,
          },
        },
      },
    })
  }

  // Build UMD format individually for each entry (UMD doesn't support multiple entries)
  console.log(`📦 Building UMD (minified)...`)

  // Build main UMD
  await build({
    plugins: [webWorkerPrefixPlugin()],
    publicDir: false,
    build: {
      emptyOutDir: false,
      minify: 'esbuild',
      lib: {
        entry: mainEntry,
        formats: ['umd'],
        name: 'WaveSurfer',
        fileName: () => 'wavesurfer.min.js',
      },
      rollupOptions: {
        output: {
          exports: 'default',
        },
      },
    },
  })

  // Build plugin UMDs
  for (const pluginPath of pluginEntries) {
    const pluginName = path.basename(pluginPath, '.ts')
    const globalName = `WaveSurfer.${pluginName.replace(/^./, (c) => c.toUpperCase())}`

    await build({
      plugins: [webWorkerPrefixPlugin()],
      publicDir: false,
      build: {
        emptyOutDir: false,
        minify: 'esbuild',
        lib: {
          entry: path.resolve(rootDir, pluginPath),
          formats: ['umd'],
          name: globalName,
          fileName: () => `plugins/${pluginName}.min.js`,
        },
        rollupOptions: {
          external: ['WaveSurfer'],
          output: {
            globals: { WaveSurfer: 'WaveSurfer' },
            extend: true,
            exports: 'default',
          },
        },
      },
    })
  }

  console.log('\n🎉 Build completed successfully!')
}

buildAll().catch((error) => {
  console.error('❌ Build failed:', error)
  process.exit(1)
})

#!/usr/bin/env node

import { build } from 'vite'
import { globSync } from 'glob'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import dts from 'vite-plugin-dts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const srcDir = path.resolve(rootDir, 'src')
const distDir = path.resolve(rootDir, 'dist')

const mainEntry = path.resolve(srcDir, 'wavesurfer.ts')

// Web worker plugin
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

const createPluginName = (pluginPath) => path.basename(pluginPath, '.ts')
const createGlobalName = (pluginName) => `WaveSurfer.${pluginName.replace(/^./, (c) => c.toUpperCase())}`

const createMainConfigs = () => {
  return [
    // ES module (.js extension for backward compatibility)
    {
      plugins: [
        webWorkerPrefixPlugin(),
        dts({
          include: ['src/**/*.ts'],
          exclude: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
          entryRoot: 'src',
          outDir: 'dist',
          copyDtsFiles: true,
          rollupTypes: true, // Bundle types into a single file
        }),
      ],
      publicDir: false,
      build: {
        emptyOutDir: false,
        lib: {
          entry: mainEntry,
          formats: ['es'],
          fileName: () => 'wavesurfer.js',
        },
      },
    },
    // ES module (.esm.js extension)
    {
      plugins: [webWorkerPrefixPlugin()],
      publicDir: false,
      build: {
        emptyOutDir: false,
        lib: {
          entry: mainEntry,
          formats: ['es'],
          fileName: () => 'wavesurfer.esm.js',
        },
      },
    },
    // CommonJS module
    {
      plugins: [webWorkerPrefixPlugin()],
      publicDir: false,
      build: {
        emptyOutDir: false,
        lib: {
          entry: mainEntry,
          formats: ['cjs'],
          fileName: () => 'wavesurfer.cjs',
        },
        rollupOptions: {
          output: {
            exports: 'default',
          },
        },
      },
    },
    // UMD (minified)
    {
      plugins: [webWorkerPrefixPlugin()],
      publicDir: false,
      build: {
        emptyOutDir: false,
        minify: 'esbuild',
        lib: {
          entry: mainEntry,
          name: 'WaveSurfer',
          formats: ['umd'],
          fileName: () => 'wavesurfer.min.js',
        },
        rollupOptions: {
          output: {
            exports: 'default',
          },
        },
      },
    },
  ]
}

const createPluginConfigs = (pluginPath) => {
  const pluginName = createPluginName(pluginPath)
  const entry = path.resolve(rootDir, pluginPath)
  const globalName = createGlobalName(pluginName)

  return [
    // ES module (.js extension for backward compatibility)
    {
      plugins: [webWorkerPrefixPlugin()],
      publicDir: false,
      build: {
        emptyOutDir: false,
        lib: {
          entry,
          formats: ['es'],
          fileName: () => `plugins/${pluginName}.js`,
        },
        rollupOptions: {
          external: [/^.*\/wavesurfer\.js$/],
        },
      },
    },
    // ES module (.esm.js extension)
    {
      plugins: [webWorkerPrefixPlugin()],
      publicDir: false,
      build: {
        emptyOutDir: false,
        lib: {
          entry,
          formats: ['es'],
          fileName: () => `plugins/${pluginName}.esm.js`,
        },
        rollupOptions: {
          external: [/^.*\/wavesurfer\.js$/],
        },
      },
    },
    // CommonJS module
    {
      plugins: [webWorkerPrefixPlugin()],
      publicDir: false,
      build: {
        emptyOutDir: false,
        lib: {
          entry,
          formats: ['cjs'],
          fileName: () => `plugins/${pluginName}.cjs`,
        },
        rollupOptions: {
          external: [/^.*\/wavesurfer\.js$/],
          output: {
            exports: 'default',
          },
        },
      },
    },
    // UMD (minified)
    {
      plugins: [webWorkerPrefixPlugin()],
      publicDir: false,
      build: {
        emptyOutDir: false,
        minify: 'esbuild',
        lib: {
          entry,
          name: globalName,
          formats: ['umd'],
          fileName: () => `plugins/${pluginName}.min.js`,
        },
        rollupOptions: {
          external: ['WaveSurfer'],
          output: {
            globals: {
              WaveSurfer: 'WaveSurfer',
            },
            extend: true,
            exports: 'default',
          },
        },
      },
    },
  ]
}

async function buildAll() {
  try {
    console.log('🔨 Building WaveSurfer.js...\n')

    // Get all plugin files
    const pluginEntries = globSync('src/plugins/*.ts', {
      cwd: rootDir,
      windowsPathsNoEscape: true,
    }).filter((pluginPath) => !pluginPath.includes('worker'))

    // Build main library outputs
    console.log('📦 Building main library...')
    const mainConfigs = createMainConfigs()
    for (const config of mainConfigs) {
      await build(config)
    }
    console.log('✅ Main library built\n')

    // Build plugin outputs
    console.log('🔌 Building plugins...')
    for (const pluginPath of pluginEntries) {
      const pluginName = path.basename(pluginPath, '.ts')
      console.log(`  - Building ${pluginName}...`)
      const pluginConfigs = createPluginConfigs(pluginPath)
      for (const config of pluginConfigs) {
        await build(config)
      }
    }
    console.log('✅ Plugins built\n')

    console.log('🎉 Build completed successfully!')
  } catch (error) {
    console.error('❌ Build failed:', error)
    process.exit(1)
  }
}

buildAll()

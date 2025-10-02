import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { globSync } from 'glob'
import dts from 'rollup-plugin-dts'
import type { Plugin, UserConfig } from 'vite'
import { defineConfig } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const rootDir = __dirname
const srcDir = path.resolve(rootDir, 'src')
const distDir = path.resolve(rootDir, 'dist')
const examplesDir = path.resolve(rootDir, 'examples')

const mainEntry = path.resolve(srcDir, 'wavesurfer.ts')

const pluginEntries = globSync('src/plugins/*.ts', {
  cwd: rootDir,
  windowsPathsNoEscape: true,
}).filter((pluginPath) => !pluginPath.includes('worker'))

const mimeTypes: Record<string, string> = {
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.ogg': 'audio/ogg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
}

const examplesStaticPlugin = (): Plugin => ({
  name: 'examples-static-server',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/examples', (req, res, next) => {
      const requestUrl = new URL(req.originalUrl ?? req.url ?? '', 'http://localhost')
      const requestPath = decodeURIComponent(requestUrl.pathname.replace(/^\/examples/, ''))
      const normalizedPath = requestPath.startsWith('/') ? requestPath.slice(1) : requestPath
      const filePath = path.join(examplesDir, normalizedPath)

      if (!filePath.startsWith(examplesDir)) {
        next()
        return
      }

      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
          next()
          return
        }

        const contentType = mimeTypes[path.extname(filePath)]

        if (contentType) {
          res.setHeader('Content-Type', contentType)
        }

        const stream = fs.createReadStream(filePath)
        stream.on('error', next)
        stream.pipe(res)
      })
    })
  },
})

const webWorkerPrefixPlugin = (): Plugin => ({
  name: 'web-worker-prefix',
  resolveId(source, importer) {
    if (source.startsWith('web-worker:')) {
      const resolved = source.replace('web-worker:', '')
      return this.resolve(`${resolved}?worker`, importer, { skipSelf: true })
    }
    return null
  },
})

const createPluginName = (pluginPath: string) => path.basename(pluginPath, '.ts')

const createGlobalName = (pluginName: string) => `WaveSurfer.${pluginName.replace(/^./, (c) => c.toUpperCase())}`

const createPluginConfigs = (pluginPath: string): UserConfig[] => {
  const pluginName = createPluginName(pluginPath)
  const entry = path.resolve(rootDir, pluginPath)
  const globalName = createGlobalName(pluginName)

  const externalDeps = ['../wavesurfer.js']

  return [
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
          external: externalDeps,
        },
      },
    },
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
          external: externalDeps,
        },
      },
    },
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
          external: externalDeps,
          output: {
            exports: 'default',
          },
        },
      },
    },
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
          external: externalDeps,
          output: {
            globals: {
              '../wavesurfer.js': 'WaveSurfer',
            },
            extend: true,
            exports: 'default',
          },
        },
      },
    },
  ]
}

export default defineConfig(({ command }) => {
  if (command === 'serve') {
    return {
      root: rootDir,
      publicDir: false,
      plugins: [examplesStaticPlugin(), webWorkerPrefixPlugin()],
      server: {
        port: 9090,
        host: '0.0.0.0',
      },
    }
  }

  const configs: UserConfig[] = [
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
    {
      plugins: [dts()],
      publicDir: false,
      build: {
        emptyOutDir: false,
        lib: {
          entry: path.resolve(distDir, 'wavesurfer.d.ts'),
          formats: ['es'],
          fileName: () => 'types.d.ts',
        },
      },
    },
  ]

  for (const pluginPath of pluginEntries) {
    configs.push(...createPluginConfigs(pluginPath))
  }

  return configs
})

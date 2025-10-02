import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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

// Default config for dev server
export default defineConfig({
  root: rootDir,
  publicDir: false,
  plugins: [examplesStaticPlugin(), webWorkerPrefixPlugin()],
  server: {
    port: 9090,
    host: '0.0.0.0',
  },
})

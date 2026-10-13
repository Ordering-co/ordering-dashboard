import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, realpath, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { Readable } from 'node:stream'
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path'

import { handleSourceDownloadsRequest, sourceDownloadsConstants } from '../worker/sourceDownloads.js'

const require = createRequire(import.meta.url)
const dashboardConfig = require('../src/config.json')

const FIXTURE_CATALOG_FILE = 'catalog.json'
const MAX_CATALOG_BYTES = 1024 * 1024
const ZIP_FILENAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}\.zip$/i

const isInsideRoot = (root, filePath) => {
  const relativePath = relative(root, filePath)
  return relativePath === '' || (!relativePath.startsWith(`..${sep}`) && relativePath !== '..' && !isAbsolute(relativePath))
}

const pathsOverlap = (first, second) => isInsideRoot(first, second) || isInsideRoot(second, first)

const canonicalizePath = async (path) => {
  let candidate = resolve(path)
  const suffix = []
  while (true) {
    try {
      const canonicalParent = await realpath(candidate)
      return resolve(canonicalParent, ...suffix.reverse())
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      const parent = dirname(candidate)
      if (parent === candidate) throw error
      suffix.unshift(basename(candidate))
      candidate = parent
    }
  }
}

const unsafeFixtureError = () => Object.assign(
  new Error('Local source-download fixture is not configured safely.'),
  { code: 'unsafe_fixture_config' }
)

const toWebStream = (nodeStream) => Readable.toWeb(nodeStream)

const streamSha256 = async (filePath) => {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(filePath)) hash.update(chunk)
  return new Uint8Array(hash.digest())
}

/** Read-only R2-shaped adapter for a real producer ZIP outside every Vite-served root. */
export const createSourceDownloadsFixtureBucket = (fixtureDirectory, { servedRoots } = {}) => {
  const hasFixturePath = typeof fixtureDirectory === 'string' && fixtureDirectory.length > 0
  const requestedRoot = typeof fixtureDirectory === 'string' && isAbsolute(fixtureDirectory)
    ? resolve(fixtureDirectory)
    : null
  const rootsToProtect = (servedRoots || [
    process.cwd(),
    process.cwd(),
    resolve(process.cwd(), 'public'),
    resolve(process.cwd(), 'dist')
  ]).filter(rootPath => typeof rootPath === 'string' && rootPath.length > 0).map(rootPath => resolve(rootPath))
  let canonicalRootPromise

  const assertSafe = async () => {
    if (!hasFixturePath) {
      throw Object.assign(new Error('Local source-download fixture is not configured.'), { code: 'fixture_not_configured' })
    }
    if (!requestedRoot || rootsToProtect.some(servedRoot => pathsOverlap(servedRoot, requestedRoot))) {
      throw unsafeFixtureError()
    }
    if (!canonicalRootPromise) {
      canonicalRootPromise = (async () => {
        let root
        try {
          root = await realpath(requestedRoot)
          if (!(await stat(root)).isDirectory()) throw unsafeFixtureError()
          for (const servedRoot of rootsToProtect) {
            const canonicalServedRoot = await canonicalizePath(servedRoot)
            if (pathsOverlap(canonicalServedRoot, root)) throw unsafeFixtureError()
          }
          return root
        } catch (_) {
          throw unsafeFixtureError()
        }
      })()
    }
    return canonicalRootPromise
  }

  const getCanonicalFile = async (segments) => {
    const root = await assertSafe()
    const candidate = resolve(root, ...segments)
    if (!isInsideRoot(root, candidate)) throw unsafeFixtureError()
    try {
      const filePath = await realpath(candidate)
      if (!isInsideRoot(root, filePath)) throw unsafeFixtureError()
      return filePath
    } catch (error) {
      if (error?.code === 'ENOENT') return null
      if (error?.code === 'unsafe_fixture_config') throw error
      throw unsafeFixtureError()
    }
  }

  return {
    isConfigured: hasFixturePath,
    assertSafe,
    async get (key) {
      if (typeof key !== 'string') return null

      let filePath
      if (key === sourceDownloadsConstants.catalogKey) {
        filePath = await getCanonicalFile([FIXTURE_CATALOG_FILE])
      } else {
        const match = /^source-distributions\/(website-marketplace)\/(v\d{4}\.\d{2}\.\d{2}\.\d{6})\/(website-marketplace-v\d{4}\.\d{2}\.\d{2}\.\d{6}\.zip)$/i.exec(key)
        if (!match || !ZIP_FILENAME_PATTERN.test(match[3])) return null
        filePath = await getCanonicalFile([match[1], match[2], match[3]])
      }
      if (!filePath) return null

      let fileInfo
      try {
        fileInfo = await stat(filePath)
      } catch (_) {
        return null
      }
      if (!fileInfo.isFile() || !Number.isSafeInteger(fileInfo.size)) return null

      if (key === sourceDownloadsConstants.catalogKey) {
        if (fileInfo.size > MAX_CATALOG_BYTES) return { size: fileInfo.size, body: null }
        try {
          const bytes = await readFile(filePath)
          return { size: bytes.byteLength, body: toWebStream(Readable.from([bytes])) }
        } catch (_) {
          return null
        }
      }

      let sha256
      try {
        sha256 = await streamSha256(filePath)
      } catch (_) {
        return null
      }
      return {
        size: fileInfo.size,
        checksums: { sha256 },
        customMetadata: { sha256: Buffer.from(sha256).toString('hex') },
        body: toWebStream(createReadStream(filePath))
      }
    }
  }
}

const getLocalApiConfig = () => ({
  ...dashboardConfig,
  api: {
    ...dashboardConfig.api,
    url: process.env.SOURCE_DOWNLOADS_API_URL || dashboardConfig.api?.url,
    version: process.env.SOURCE_DOWNLOADS_API_VERSION || dashboardConfig.api?.version,
    language: process.env.SOURCE_DOWNLOADS_API_LANGUAGE || dashboardConfig.api?.language
  },
  project: process.env.SOURCE_DOWNLOADS_PROJECT || dashboardConfig.project
})

const matchesSourceDownloadsPath = (pathname) =>
  pathname === '/api/source-catalog' || pathname.startsWith('/api/source-catalog/') ||
  pathname === '/api/source-downloads' || pathname.startsWith('/api/source-downloads/')

const buildRequestHeaders = (incomingHeaders) => {
  const headers = new Headers()
  for (const [key, value] of Object.entries(incomingHeaders)) {
    if (key.toLowerCase() === 'host' || typeof value !== 'string') continue
    headers.set(key, value)
  }
  return headers
}

const writeResponse = async (nodeResponse, response) => {
  nodeResponse.statusCode = response.status
  response.headers.forEach((value, key) => nodeResponse.setHeader(key, value))
  if (!response.body) {
    nodeResponse.end()
    return
  }
  await new Promise((resolve, reject) => {
    const stream = Readable.fromWeb(response.body)
    stream.on('error', reject)
    nodeResponse.on('error', reject)
    nodeResponse.on('finish', resolve)
    stream.pipe(nodeResponse)
  })
}

const serviceUnavailable = (code = 'source_downloads_unavailable') => new Response(JSON.stringify({
  error: {
    code,
    message: code === 'unsafe_fixture_config'
      ? 'The local source-download fixture is not configured safely.'
      : 'Local source downloads are temporarily unavailable.'
  }
}), {
  status: 503,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer'
  }
})

/** Vite-only local adapter. It has no R2 credentials and never falls back to public SPA files. */
export const sourceDownloadsLocalPlugin = ({ searchWorkspaceRoot = rootPath => rootPath } = {}) => {
  let initPromise
  let fixtureBucket
  let env
  let apiConfig

  const initialize = (viteConfig) => {
    if (!initPromise) {
      initPromise = (async () => {
        const root = resolve(viteConfig.root)
        const allowedRoots = viteConfig.server.fs.allow?.length
          ? viteConfig.server.fs.allow
          : [searchWorkspaceRoot(root)]
        const servedRoots = [
          root,
          viteConfig.publicDir,
          resolve(root, viteConfig.build.outDir),
          ...allowedRoots
        ].filter(rootPath => typeof rootPath === 'string' && rootPath.length > 0)
        fixtureBucket = createSourceDownloadsFixtureBucket(process.env.SOURCE_DOWNLOADS_FIXTURE_DIR, { servedRoots })
        env = { SOURCE_DOWNLOADS: fixtureBucket }
        apiConfig = getLocalApiConfig()

        if (fixtureBucket.isConfigured) {
          try {
            await fixtureBucket.assertSafe()
          } catch (_) {
            throw new Error('[source-downloads-local-fixture] SOURCE_DOWNLOADS_FIXTURE_DIR must resolve outside every Vite-served and server.fs.allow root.')
          }
        }
      })()
    }
    return initPromise
  }

  return {
    name: 'source-downloads-local-fixture',
    async configResolved (viteConfig) {
      await initialize(viteConfig)
    },
    async configureServer (server) {
      await initialize(server.config)

      server.middlewares.use((nodeRequest, nodeResponse, next) => {
        let url
        try {
          url = new URL(nodeRequest.url || '/', `http://${nodeRequest.headers.host || 'localhost'}`)
        } catch (_) {
          next()
          return
        }
        if (!matchesSourceDownloadsPath(url.pathname)) {
          next()
          return
        }

        const request = new Request(url, {
          method: nodeRequest.method || 'GET',
          headers: buildRequestHeaders(nodeRequest.headers)
        })
        return fixtureBucket.assertSafe()
          .then(() => handleSourceDownloadsRequest(request, env, apiConfig))
          .then(response => writeResponse(nodeResponse, response))
          .catch(error => writeResponse(
            nodeResponse,
            serviceUnavailable(error?.code === 'unsafe_fixture_config' ? 'unsafe_fixture_config' : 'source_downloads_unavailable')
          ))
      })
    }
  }
}

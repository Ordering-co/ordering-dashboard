import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import worker from './index.js'
import { createSourceDownloadsFixtureBucket, sourceDownloadsLocalPlugin } from '../scripts/source-downloads-fixture-adapter.js'
import { getPrivateArtifactKey, handleSourceDownloadsRequest, sourceDownloadsConstants } from './sourceDownloads.js'
import { validateProjectViaCurrentStrict } from './seo.js'

const encoder = new TextEncoder()
const config = {
  api: { url: 'https://api.ordering.test', version: 'v400', language: 'en' },
  project: 'tenant-a'
}

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

const makeProduct = (archiveBytes, overrides = {}) => ({
  id: 'website-marketplace',
  name: 'Website Marketplace',
  descriptionByLocale: { en: 'Ordering website source.' },
  version: 'v2026.10.02.132200',
  publishedAt: '2026-10-02T13:22:00-06:00',
  timezone: 'UTC-06:00',
  sourceSha: 'a'.repeat(40),
  submodules: [{ path: 'ordering-components', sha: 'b'.repeat(40) }],
  license: { id: 'MIT', text: 'See included license.' },
  instructionsByLocale: { en: 'Install dependencies and start the site.' },
  artifact: {
    filename: 'website-marketplace-v2026.10.02.132200.zip',
    sizeBytes: archiveBytes.byteLength,
    sha256: sha256(archiveBytes)
  },
  privateObjectKey: 'must-not-be-returned',
  ...overrides
})

const makeCatalog = (product) => ({ schemaVersion: 1, products: [product] })

const makeBucket = ({ catalog = makeCatalog(makeProduct(encoder.encode('PK\u0003\u0004archive'))), archive, archiveSha, archiveSize } = {}) => {
  const catalogBytes = encoder.encode(JSON.stringify(catalog))
  const product = catalog.products[0]
  const archiveBytes = archive || encoder.encode('PK\u0003\u0004archive')
  const artifactKey = product ? getPrivateArtifactKey(product) : ''
  const get = vi.fn(async key => {
    if (key === sourceDownloadsConstants.catalogKey) {
      return { size: catalogBytes.byteLength, body: new Response(catalogBytes).body }
    }
    if (key === artifactKey && archive !== null) {
      const checksum = archiveSha === undefined ? sha256(archiveBytes) : archiveSha
      return {
        size: archiveSize === undefined ? archiveBytes.byteLength : archiveSize,
        checksums: checksum ? { sha256: Uint8Array.from(Buffer.from(checksum, 'hex')) } : {},
        customMetadata: checksum ? { sha256: checksum } : {},
        body: new Response(archiveBytes).body
      }
    }
    return null
  })
  return { bucket: { get }, get, archiveBytes }
}

const request = (path, { token = 'dashboard-session', method = 'GET' } = {}) => new Request(`https://tenant-a.ordering.co${path}`, {
  method,
  headers: token ? { authorization: `Bearer ${token}` } : {}
})

const identityFetch = (user = { id: 7, level: 0, enabled: true }, { status = 200, payload } = {}) => vi.fn(async () =>
  new Response(JSON.stringify(payload || { error: false, result: user }), {
    status,
    headers: { 'content-type': 'application/json' }
  })
)

const readJson = response => response.json()

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('source downloads Worker endpoints', () => {
  it.each([0])('returns only the contract whitelist for an enabled administrator level %i', async level => {
    const { bucket, archiveBytes } = makeBucket()
    const fetchImpl = identityFetch({ id: 12, level, enabled: true })
    const response = await handleSourceDownloadsRequest(request('/api/source-catalog'), { SOURCE_DOWNLOADS: bucket }, config, fetchImpl)

    expect(response.status).toBe(200)
    const payload = await readJson(response)
    expect(Object.keys(payload).sort()).toEqual(['products', 'schemaVersion'])
    expect(payload.schemaVersion).toBe(1)
    expect(Object.keys(payload.products[0]).sort()).toEqual([
      'artifact', 'descriptionByLocale', 'id', 'instructionsByLocale', 'license',
      'name', 'publishedAt', 'sourceSha', 'submodules', 'timezone', 'version'
    ])
    expect(payload.products[0].privateObjectKey).toBeUndefined()
    expect(payload.products[0].artifact.privateObjectKey).toBeUndefined()
    expect(payload.products[0].artifact.sizeBytes).toBe(archiveBytes.byteLength)
    expect(payload.products[0].artifact.sha256).toBe(sha256(archiveBytes))
    expect(sourceDownloadsConstants.catalogKey).toBe('source-distributions/catalog.json')
    expect(getPrivateArtifactKey(payload.products[0])).toBe(
      'source-distributions/website-marketplace/v2026.10.02.132200/website-marketplace-v2026.10.02.132200.zip'
    )
  })

  it('keeps the versioned JSON Schema aligned with the public response whitelist', async () => {
    const schema = JSON.parse(await readFile(join(process.cwd(), 'docs/source-code-contract.schema.json'), 'utf8'))
    const catalog = schema.$defs.catalog
    const product = schema.$defs.product
    expect(Object.keys(catalog.properties).sort()).toEqual(['products', 'schemaVersion'])
    expect(Object.keys(product.properties).sort()).toEqual([
      'artifact', 'descriptionByLocale', 'id', 'instructionsByLocale', 'license',
      'name', 'publishedAt', 'sourceSha', 'submodules', 'timezone', 'version'
    ])
    expect(product.additionalProperties).toBe(false)
    expect(schema.$defs.localizedStrings.patternProperties['^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$'].type).toBe('string')
  })

  it('rejects missing and query-string credentials before reading R2', async () => {
    const { bucket, get } = makeBucket()
    const fetchImpl = identityFetch()
    const missing = await handleSourceDownloadsRequest(request('/api/source-catalog', { token: null }), { SOURCE_DOWNLOADS: bucket }, config, fetchImpl)
    const queryToken = await handleSourceDownloadsRequest(
      new Request('https://tenant-a.ordering.co/api/source-catalog?token=secret'),
      { SOURCE_DOWNLOADS: bucket }, config, fetchImpl
    )

    expect(missing.status).toBe(401)
    expect((await readJson(missing)).error.code).toBe('authentication_required')
    expect(queryToken.status).toBe(404)
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(get).not.toHaveBeenCalled()
  })

  it('maps invalid API bearer sessions to 401 and unavailable identity service to 503', async () => {
    const { bucket } = makeBucket()
    const invalid = await handleSourceDownloadsRequest(request('/api/source-catalog'), { SOURCE_DOWNLOADS: bucket }, config, identityFetch(null, { status: 401 }))
    const unavailable = await handleSourceDownloadsRequest(request('/api/source-catalog'), { SOURCE_DOWNLOADS: bucket }, config, vi.fn(async () => { throw new Error('offline') }))

    expect(invalid.status).toBe(401)
    expect((await readJson(invalid)).error.code).toBe('invalid_session')
    expect(unavailable.status).toBe(503)
    expect((await readJson(unavailable)).error.code).toBe('identity_service_unavailable')
  })

  it('uses manual identity redirects and permits a valid bearer session on the catalog', async () => {
    const { bucket } = makeBucket()
    const fetchImpl = vi.fn(async (_url, options) => {
      if (options.redirect === 'error') throw new TypeError('Unsupported redirect mode during Request construction')
      return new Response(JSON.stringify({ error: false, result: { id: 12, level: 0, enabled: true } }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    })

    const response = await handleSourceDownloadsRequest(request('/api/source-catalog'), { SOURCE_DOWNLOADS: bucket }, config, fetchImpl)

    expect(response.status).toBe(200)
    expect((await readJson(response)).products).toHaveLength(1)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      cache: 'no-store',
      redirect: 'manual'
    })
    expect(fetchImpl.mock.calls[0][1].headers.authorization).toBe('Bearer dashboard-session')
  })

  it.each([301, 302, 303, 307, 308])('rejects identity redirect %i without following Location or reading R2', async status => {
    const { bucket, get } = makeBucket()
    let redirectResponse
    const fetchImpl = vi.fn(async () => {
      redirectResponse = new Response('must not be read', {
        status,
        headers: { location: 'https://attacker.example/collect?token=stolen' }
      })
      return redirectResponse
    })

    const response = await handleSourceDownloadsRequest(request('/api/source-catalog'), { SOURCE_DOWNLOADS: bucket }, config, fetchImpl)

    expect(response.status).toBe(503)
    expect((await readJson(response)).error.code).toBe('identity_service_unavailable')
    expect(response.headers.get('location')).toBeNull()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0][1].redirect).toBe('manual')
    expect(redirectResponse.bodyUsed).toBe(false)
    expect(get).not.toHaveBeenCalled()
  })

  it.each([
    [{ id: 8, level: 1, enabled: true }, 'forbidden'],
    [{ id: 8, level: 2, enabled: true }, 'forbidden'],
    [{ id: 8, level: 3, enabled: true }, 'forbidden'],
    [{ id: 8, level: 4, enabled: true }, 'forbidden'],
    [{ id: 8, level: 5, enabled: true }, 'forbidden'],
    [{ id: 8, level: 8, enabled: true }, 'forbidden'],
    [{ id: 8, level: 9, enabled: true }, 'forbidden'],
    [{ id: 8, level: 0, enabled: false }, 'forbidden'],
    [{ id: 8, level: 2 }, 'identity_response_invalid']
  ])('does not authorize other, disabled, or incomplete identities', async (user, expectedCode) => {
    const { bucket } = makeBucket()
    const response = await handleSourceDownloadsRequest(request('/api/source-catalog'), { SOURCE_DOWNLOADS: bucket }, config, identityFetch(user))
    expect(response.status).toBe(expectedCode === 'forbidden' ? 403 : 503)
    expect((await readJson(response)).error.code).toBe(expectedCode)
  })

  it('uses only the server-selected Ordering API project when verifying the bearer', async () => {
    const fetchImpl = identityFetch()
    await handleSourceDownloadsRequest(request('/api/source-catalog'), { SOURCE_DOWNLOADS: makeBucket().bucket }, config, fetchImpl)
    const [url, options] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.ordering.test/v400/en/tenant-a/users/me?params=id,level,enabled')
    expect(options.headers.authorization).toBe('Bearer dashboard-session')
    expect(url).not.toContain('query-project')
  })

  it('returns 503 for a missing bucket or missing catalogue instead of an empty success response', async () => {
    const fetchImpl = identityFetch()
    const noBucket = await handleSourceDownloadsRequest(request('/api/source-catalog'), {}, config, fetchImpl)
    const emptyBucket = await handleSourceDownloadsRequest(request('/api/source-catalog'), { SOURCE_DOWNLOADS: { get: async () => null } }, config, fetchImpl)

    expect(noBucket.status).toBe(503)
    expect(emptyBucket.status).toBe(503)
    expect((await readJson(noBucket)).error.code).toBe('catalog_unavailable')
    expect((await readJson(emptyBucket)).error.code).toBe('catalog_unavailable')
  })

  it('returns 503 for malformed or invalid catalogue JSON', async () => {
    const fetchImpl = identityFetch()
    const badJson = { get: async () => ({ size: 5, body: new Response('{oops').body }) }
    const badSchema = { get: async () => ({ size: 2, body: new Response('{}').body }) }
    const invalidJsonResponse = await handleSourceDownloadsRequest(request('/api/source-catalog'), { SOURCE_DOWNLOADS: badJson }, config, fetchImpl)
    const invalidSchemaResponse = await handleSourceDownloadsRequest(request('/api/source-catalog'), { SOURCE_DOWNLOADS: badSchema }, config, fetchImpl)

    expect(invalidJsonResponse.status).toBe(503)
    expect((await readJson(invalidJsonResponse)).error.code).toBe('catalog_invalid')
    expect(invalidSchemaResponse.status).toBe(503)
  })

  it('rejects source metadata with a mismatched CalVer, source SHA, submodule pin, ZIP name, or digest', async () => {
    const validProduct = makeProduct(encoder.encode('PK\u0003\u0004archive'))
    const invalidProducts = []
    for (const mutate of [
      product => { product.publishedAt = '2026-10-02T13:22:01-06:00' },
      product => { product.sourceSha = null },
      product => { product.submodules = [] },
      product => { product.artifact.filename = 'arbitrary.zip' },
      product => { product.artifact.sha256 = null }
    ]) {
      const product = structuredClone(validProduct)
      mutate(product)
      invalidProducts.push(product)
    }
    const fetchImpl = identityFetch()

    for (const product of invalidProducts) {
      const { bucket } = makeBucket({ catalog: makeCatalog(product) })
      const response = await handleSourceDownloadsRequest(request('/api/source-catalog'), { SOURCE_DOWNLOADS: bucket }, config, fetchImpl)
      expect(response.status).toBe(503)
      expect((await readJson(response)).error.code).toBe('catalog_invalid')
    }
  })

  it('streams the private ZIP with its verified size and attachment headers', async () => {
    const { bucket, archiveBytes } = makeBucket()
    const fetchImpl = identityFetch({ id: 2, level: 0, enabled: true })
    const response = await handleSourceDownloadsRequest(
      request('/api/source-downloads/website-marketplace/v2026.10.02.132200'),
      { SOURCE_DOWNLOADS: bucket }, config, fetchImpl
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/zip')
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="website-marketplace-v2026.10.02.132200.zip"')
    expect(response.headers.get('content-length')).toBe(String(archiveBytes.byteLength))
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual(Array.from(archiveBytes))
  })

  it('fails closed on corrupt archive bytes, missing native SHA-256, or size mismatch', async () => {
    const original = encoder.encode('PK\u0003\u0004original')
    const product = makeProduct(original)
    const corruptBytes = encoder.encode('PK\u0003\u0004corrupt')
    const fetchImpl = identityFetch()
    const corrupt = makeBucket({ catalog: makeCatalog(product), archive: corruptBytes })
    const noChecksum = makeBucket({ catalog: makeCatalog(product), archive: original, archiveSha: null })
    const wrongSize = makeBucket({ catalog: makeCatalog(product), archive: original, archiveSize: original.byteLength + 1 })
    const path = `/api/source-downloads/website-marketplace/${product.version}`

    for (const { bucket } of [corrupt, noChecksum, wrongSize]) {
      const response = await handleSourceDownloadsRequest(request(path), { SOURCE_DOWNLOADS: bucket }, config, fetchImpl)
      expect(response.status).toBe(503)
      expect((await readJson(response)).error.code).toMatch(/^artifact_/)
    }
  })

  it('returns 503 when the catalogue names an object that has disappeared', async () => {
    const product = makeProduct(encoder.encode('PK\u0003\u0004archive'))
    const catalogBytes = encoder.encode(JSON.stringify(makeCatalog(product)))
    const bucket = {
      get: async key => key === sourceDownloadsConstants.catalogKey
        ? { size: catalogBytes.byteLength, body: new Response(catalogBytes).body }
        : null
    }
    const response = await handleSourceDownloadsRequest(
      request(`/api/source-downloads/${product.id}/${product.version}`),
      { SOURCE_DOWNLOADS: bucket }, config, identityFetch()
    )
    expect(response.status).toBe(503)
    expect((await readJson(response)).error.code).toBe('artifact_unavailable')
  })

  it('returns 404 for an unpublished product or version', async () => {
    const { bucket } = makeBucket()
    const response = await handleSourceDownloadsRequest(
      request('/api/source-downloads/website-marketplace/v2026.10.02.132201'),
      { SOURCE_DOWNLOADS: bucket }, config, identityFetch()
    )
    expect(response.status).toBe(404)
    expect((await readJson(response)).error.code).toBe('not_found')
  })

  it('resolves each custom-domain tenant before checking identity and never falls back across tenants', async () => {
    const { bucket, get } = makeBucket()
    const assets = {
      fetch: async () => new Response(JSON.stringify({
        project: 'fallback-project',
        api: { url: 'https://api.ordering.test', version: 'v400', language: 'en' }
      }), { headers: { 'content-type': 'application/json' } })
    }
    const env = {
      ASSETS: assets,
      SOURCE_DOWNLOADS: bucket,
      PROJECT: 'fallback-project',
      USE_PROJECT_SUBDOMAIN: 'false',
      USE_PROJECT_DOMAIN: 'true',
      DISABLE_CACHE: 'true'
    }
    const fetchImpl = vi.fn(async (url, options) => {
      const value = String(url)
      if (value.endsWith('/_/current')) {
        const project = options.headers.referer.includes('tenant-b.example.test') ? 'tenant-b' : 'tenant-a'
        return new Response(JSON.stringify({ error: false, result: { code: project } }), { status: 200 })
      }
      if (value.includes('/tenant-b/')) {
        return new Response(JSON.stringify({ error: true, result: ['You do not have permission'] }), { status: 401 })
      }
      return new Response(JSON.stringify({ error: false, result: { id: 9, level: 0, enabled: true } }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchImpl)

    const first = await worker.fetch(new Request('https://tenant-a.example.test/api/source-catalog', {
      headers: { authorization: 'Bearer session-a' }
    }), env, {})
    const second = await worker.fetch(new Request('https://tenant-b.example.test/api/source-catalog', {
      headers: { authorization: 'Bearer session-b' }
    }), env, {})

    expect(first.status).toBe(200)
    expect(second.status).toBe(401)
    expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual([
      'https://api.ordering.test/v400/en/_/current',
      'https://api.ordering.test/v400/en/tenant-a/users/me?params=id,level,enabled',
      'https://api.ordering.test/v400/en/_/current',
      'https://api.ordering.test/v400/en/tenant-b/users/me?params=id,level,enabled'
    ])
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('uses the selected orderingv1 tenant on the official shared host for catalog and ZIP', async () => {
    const { bucket, get, archiveBytes } = makeBucket()
    const assetsFetch = vi.fn(async () => new Response(JSON.stringify({
      project: 'orderingplus',
      api: { url: 'https://api.ordering.test', version: 'v400', language: 'en' }
    }), { headers: { 'content-type': 'application/json' } }))
    const env = { ASSETS: { fetch: assetsFetch }, SOURCE_DOWNLOADS: bucket, PROJECT: 'orderingplus', USE_PROJECT_DOMAIN: 'true', DISABLE_CACHE: 'true' }
    const identity = vi.fn(async url => new Response(JSON.stringify(
      String(url).includes('/orderingv1/')
        ? { error: false, result: { id: 9, level: 0, enabled: true } }
        : { error: true, result: ['unauthorized'] }
    ), { status: String(url).includes('/orderingv1/') ? 200 : 401 }))
    vi.stubGlobal('fetch', identity)
    const headers = { authorization: 'Bearer selected-tenant-session', 'x-ordering-project': 'orderingv1' }

    const catalog = await worker.fetch(new Request('https://dashboard.orderingplus.com/api/source-catalog', { headers }), env, {})
    const download = await worker.fetch(new Request('https://dashboard.orderingplus.com/api/source-downloads/website-marketplace/v2026.10.02.132200', { headers }), env, {})
    expect(catalog.status).toBe(200)
    expect(catalog.headers.get('content-type')).toContain('application/json')
    expect(download.status).toBe(200)
    expect(download.headers.get('content-type')).toBe('application/zip')
    expect(Array.from(new Uint8Array(await download.arrayBuffer()))).toEqual(Array.from(archiveBytes))
    expect(identity.mock.calls.map(([url]) => String(url))).toEqual([
      'https://api.ordering.test/v400/en/orderingv1/users/me?params=id,level,enabled',
      'https://api.ordering.test/v400/en/orderingv1/users/me?params=id,level,enabled'
    ])
    expect(get).toHaveBeenCalledTimes(3)

    const wrongSelection = await worker.fetch(new Request('https://dashboard.orderingplus.com/api/source-catalog', {
      headers: { ...headers, 'x-ordering-project': 'orderingplus' }
    }), env, {})
    expect(wrongSelection.status).toBe(401)
    expect((await wrongSelection.json()).error.code).toBe('invalid_session')
    expect(get).toHaveBeenCalledTimes(3)
  })

  it('rejects anonymous, malformed, and custom-domain project overrides before identity or storage access', async () => {
    const { bucket, get } = makeBucket()
    const assetsFetch = vi.fn(async () => new Response('{}', { headers: { 'content-type': 'application/json' } }))
    const env = { ASSETS: { fetch: assetsFetch }, SOURCE_DOWNLOADS: bucket, PROJECT: 'orderingplus', USE_PROJECT_DOMAIN: 'true' }
    const identity = vi.fn()
    vi.stubGlobal('fetch', identity)

    const anonymous = await worker.fetch(new Request('https://dashboard.orderingplus.com/api/source-catalog'), env, {})
    expect(anonymous.status).toBe(401)
    expect(anonymous.headers.get('content-type')).toContain('application/json')
    for (const selection of [null, '', '_', '../orderingv1', 'orderingv1/foo', 'orderingv1?token=x', 'orderingv1,orderingplus']) {
      const headers = { authorization: 'Bearer selected-tenant-session' }
      if (selection !== null) headers['x-ordering-project'] = selection
      const response = await worker.fetch(new Request('https://dashboard.orderingplus.com/api/source-catalog', { headers }), env, {})
      expect(response.status).toBe(400)
      expect((await response.json()).error.code).toBe('invalid_project_selection')
    }
    const override = await worker.fetch(new Request('https://tenant.example.test/api/source-catalog', {
      headers: { authorization: 'Bearer selected-tenant-session', 'x-ordering-project': 'orderingv1' }
    }), env, {})
    expect(override.status).toBe(400)
    expect(identity).not.toHaveBeenCalled()
    expect(get).not.toHaveBeenCalled()
  })

  it.each([undefined, '1'])('cancels oversized strict /current JSON when Content-Length is %s', async contentLength => {
    let cancelled = false
    let producedChunks = 0
    const body = new ReadableStream({
      pull (controller) {
        producedChunks += 1
        controller.enqueue(new Uint8Array(8192))
      },
      cancel () {
        cancelled = true
      }
    })
    const headers = contentLength ? { 'content-length': contentLength } : {}
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200, headers })))

    const result = await validateProjectViaCurrentStrict({
      api: { url: 'https://api.ordering.test', version: 'v400', language: 'en' }
    }, '_', { DISABLE_CACHE: 'true' }, {}, 'https://tenant.example.test', 'https://tenant.example.test/')

    expect(result).toBeNull()
    expect(cancelled).toBe(true)
    expect(producedChunks).toBeLessThan(10)
  })

  it.each([301, 302, 303, 307, 308])('rejects strict /current redirect %i without parsing or caching it', async status => {
    const match = vi.fn(async () => null)
    const put = vi.fn(async () => {})
    const waitUntil = vi.fn()
    vi.stubGlobal('caches', { default: { match, put } })
    let redirectResponse
    const fetchImpl = vi.fn(async () => {
      redirectResponse = new Response('{"result":{"code":"attacker-project"}}', {
        status,
        headers: { location: 'https://attacker.example/tenant' }
      })
      return redirectResponse
    })
    vi.stubGlobal('fetch', fetchImpl)

    const result = await validateProjectViaCurrentStrict({
      api: { url: 'https://api.ordering.test', version: 'v400', language: 'en' }
    }, '_', {}, { waitUntil }, 'https://tenant.example.test', 'https://tenant.example.test/')

    expect(result).toBeNull()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ cache: 'no-store', redirect: 'manual' })
    expect(redirectResponse.bodyUsed).toBe(false)
    expect(match).toHaveBeenCalledTimes(1)
    expect(put).not.toHaveBeenCalled()
    expect(waitUntil).not.toHaveBeenCalled()
  })

  it('keeps unrelated static assets on the existing Assets path', async () => {
    const assetsFetch = vi.fn(async () => new Response('existing asset', { status: 200 }))
    const response = await worker.fetch(new Request('https://dashboard.ordering.co/assets/app.js'), {
      ASSETS: { fetch: assetsFetch }
    }, {})
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('existing asset')
    expect(assetsFetch).toHaveBeenCalledTimes(1)
  })
})

describe('local producer fixture adapter', () => {
  it('maps a local catalogue and producer ZIP outside public SPA paths and calculates its real checksum', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dashboard-source-fixture-'))
    try {
      const archive = encoder.encode('PK\u0003\u0004producer-zip-fixture')
      const product = makeProduct(archive)
      const archivePath = join(root, product.id, product.version, product.artifact.filename)
      await mkdir(join(root, product.id, product.version), { recursive: true })
      await writeFile(join(root, 'catalog.json'), JSON.stringify(makeCatalog(product)))
      await writeFile(archivePath, archive)

      const bucket = createSourceDownloadsFixtureBucket(root)
      const catalog = await bucket.get(sourceDownloadsConstants.catalogKey)
      const stored = await bucket.get(getPrivateArtifactKey(product))
      const catalogResponse = new Response(catalog.body)

      expect(JSON.parse(await catalogResponse.text()).products[0].id).toBe(product.id)
      expect(Buffer.from(stored.checksums.sha256).toString('hex')).toBe(sha256(await readFile(archivePath)))
      expect(Array.from(new Uint8Array(await new Response(stored.body).arrayBuffer()))).toEqual(Array.from(archive))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('refuses fixture directories under Vite public/ or dist/', async () => {
    const publicBucket = createSourceDownloadsFixtureBucket(join(process.cwd(), 'public', 'source-fixtures'))
    const distBucket = createSourceDownloadsFixtureBucket(join(process.cwd(), 'dist', 'source-fixtures'))
    await expect(publicBucket.assertSafe()).rejects.toMatchObject({ code: 'unsafe_fixture_config' })
    await expect(distBucket.assertSafe()).rejects.toMatchObject({ code: 'unsafe_fixture_config' })
  })

  it('rejects a fixture root inside a Vite fs allow root or a symlink resolving into it', async () => {
    const scratch = await mkdtemp(join(tmpdir(), 'dashboard-vite-fs-root-'))
    try {
      const servedRoot = join(scratch, 'workspace')
      const actualFixture = join(servedRoot, 'private-fixture')
      const symlinkedFixture = join(scratch, 'fixture-link')
      await mkdir(actualFixture, { recursive: true })
      await symlink(actualFixture, symlinkedFixture, 'dir')

      const insideWorkspace = createSourceDownloadsFixtureBucket(actualFixture, { servedRoots: [servedRoot] })
      const symlinkIntoWorkspace = createSourceDownloadsFixtureBucket(symlinkedFixture, { servedRoots: [servedRoot] })
      await expect(insideWorkspace.assertSafe()).rejects.toMatchObject({ code: 'unsafe_fixture_config' })
      await expect(symlinkIntoWorkspace.assertSafe()).rejects.toMatchObject({ code: 'unsafe_fixture_config' })
    } finally {
      await rm(scratch, { recursive: true, force: true })
    }
  })

  it('rejects catalogue symlinks that escape the canonical fixture root', async () => {
    const scratch = await mkdtemp(join(tmpdir(), 'dashboard-fixture-symlink-'))
    try {
      const fixtureRoot = join(scratch, 'fixture')
      const outsideFile = join(scratch, 'outside-catalog.json')
      await mkdir(fixtureRoot, { recursive: true })
      await writeFile(outsideFile, JSON.stringify(makeCatalog(makeProduct(encoder.encode('PK\u0003\u0004')))))
      await symlink(outsideFile, join(fixtureRoot, 'catalog.json'))

      const bucket = createSourceDownloadsFixtureBucket(fixtureRoot, { servedRoots: [join(scratch, 'workspace')] })
      await expect(bucket.get(sourceDownloadsConstants.catalogKey)).rejects.toMatchObject({ code: 'unsafe_fixture_config' })
    } finally {
      await rm(scratch, { recursive: true, force: true })
    }
  })

  it('aborts Vite startup before installing middleware when a fixture root is served by Vite', async () => {
    const previousFixture = process.env.SOURCE_DOWNLOADS_FIXTURE_DIR
    process.env.SOURCE_DOWNLOADS_FIXTURE_DIR = join(process.cwd(), 'private-fixture')
    const use = vi.fn()
    try {
      await expect(sourceDownloadsLocalPlugin().configureServer({
        config: {
          root: process.cwd(),
          publicDir: join(process.cwd(), 'public'),
          build: { outDir: 'dist' },
          server: { fs: { allow: [process.cwd()] } }
        },
        middlewares: { use }
      })).rejects.toThrow('SOURCE_DOWNLOADS_FIXTURE_DIR must resolve outside every Vite-served and server.fs.allow root.')
      expect(use).not.toHaveBeenCalled()
    } finally {
      if (previousFixture === undefined) delete process.env.SOURCE_DOWNLOADS_FIXTURE_DIR
      else process.env.SOURCE_DOWNLOADS_FIXTURE_DIR = previousFixture
    }
  })

  it('blocks an unauthenticated Vite /@fs request and aborts startup for a symlinked fixture root', async () => {
    const adapterPath = join(process.cwd(), 'scripts/source-downloads-fixture-adapter.js')
    const harness = `
      import { createServer as createHttpServer } from 'node:http'
      import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
      import { tmpdir } from 'node:os'
      import { join, resolve } from 'node:path'
      import { pathToFileURL } from 'node:url'
      import { createServer, searchForWorkspaceRoot } from 'vite'

      const pluginModule = await import(pathToFileURL(${JSON.stringify(adapterPath)}).href)
      const { sourceDownloadsLocalPlugin } = pluginModule
      const scratch = await mkdtemp(join(tmpdir(), 'dashboard-vite-live-security-'))
      let viteServer
      let httpServer
      const serverConfig = (root, fixture) => ({
        configFile: false,
        root,
        publicDir: false,
        plugins: [sourceDownloadsLocalPlugin({ searchWorkspaceRoot: searchForWorkspaceRoot })],
        server: { middlewareMode: true, hmr: false, fs: { strict: true, allow: [root] } },
        build: { outDir: 'dist' },
        envDir: false,
        define: {}
      })
      try {
      const workspace = join(scratch, 'workspace')
      const fixture = join(scratch, 'fixture')
      const marker = 'PRIVATE_FIXTURE_MARKER_74E2'
      console.error('fixture-test:setup')
      await mkdir(workspace, { recursive: true })
        await mkdir(fixture, { recursive: true })
        const catalogue = join(fixture, 'catalog.json')
        await writeFile(catalogue, marker)

        process.env.SOURCE_DOWNLOADS_FIXTURE_DIR = fixture
        viteServer = await createServer(serverConfig(workspace, fixture))
        console.error('fixture-test:vite-created')
        httpServer = createHttpServer(viteServer.middlewares)
        await new Promise((resolvePromise, rejectPromise) => {
          httpServer.once('error', rejectPromise)
          httpServer.listen(0, '127.0.0.1', resolvePromise)
        })
        const address = httpServer.address()
        const fsPath = '/@fs' + encodeURI(catalogue)
        console.error('fixture-test:before-request')
        const response = await fetch('http://127.0.0.1:' + address.port + fsPath, {
          headers: { connection: 'close' },
          signal: AbortSignal.timeout(5000)
        })
        console.error('fixture-test:after-request', response.status)
        const body = await response.text()
        console.error('fixture-test:after-body', body.length)
        if (response.status !== 403 || body.includes(marker)) throw new Error('unauthenticated /@fs was not denied')
        const directFsStatus = response.status
        const markerLeaked = body.includes(marker)
        httpServer.closeAllConnections?.()
        await new Promise(resolvePromise => httpServer.close(resolvePromise))
        console.error('fixture-test:http-closed')
        httpServer = null
        await viteServer.close()
        console.error('fixture-test:vite-closed')
        viteServer = null

        const allowed = join(scratch, 'allowed-workspace')
        const target = join(allowed, 'private-fixture')
        const alias = join(scratch, 'fixture-alias')
        await mkdir(target, { recursive: true })
        await symlink(target, alias, 'dir')
        process.env.SOURCE_DOWNLOADS_FIXTURE_DIR = alias
        let startupFailure = ''
        console.error('fixture-test:before-symlink-startup')
        try {
          const unsafeServer = await createServer(serverConfig(allowed, alias))
          await unsafeServer.close()
        } catch (error) {
          startupFailure = String(error?.message || error)
        }
        if (!startupFailure.includes('SOURCE_DOWNLOADS_FIXTURE_DIR')) throw new Error('Vite started with a fixture symlink resolving into its fs.allow root')
        console.error('fixture-test:symlink-startup-rejected')
        console.log(JSON.stringify({ directFsStatus, markerLeaked, unsafeSymlinkStartupAborted: true }))
      } finally {
        if (httpServer) {
          httpServer.closeAllConnections?.()
          await new Promise(resolvePromise => httpServer.close(resolvePromise))
        }
        if (viteServer) await viteServer.close()
        await rm(scratch, { recursive: true, force: true })
      }
    `
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', harness], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 10000,
      env: { PATH: process.env.PATH || '', NODE_ENV: 'test' }
    })
    expect(result.status, result.stderr || result.stdout).toBe(0)
    expect(JSON.parse(result.stdout.trim())).toMatchObject({ directFsStatus: 403, markerLeaked: false, unsafeSymlinkStartupAborted: true })
  })
})

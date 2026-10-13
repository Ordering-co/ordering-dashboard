import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  cancelBuilderBuild,
  getBuilderAdHocInstallUrl,
  getBuilderBuildDownload,
  getBuilderBuildLog,
  getBuilderLatestBuilds,
  listBuilderBuilds,
  requestBuilderBuild,
  retryBuilderBuild,
  updateBuilderProductStatus
} from '../builderApi'

const ordering = { root: 'http://localhost:8080/v400/en/development', appInternalName: 'dashboard' }
const BUILDS = '/v400/en/development/dashboard/builder/products/41/apps/310/builds'

const respond = (body, { ok = true, status = 200 } = {}) => {
  global.fetch = vi.fn(async () => ({ ok, status, json: async () => body }))
}

const lastCall = () => {
  const [url, options] = global.fetch.mock.calls.at(-1)
  return { url: new URL(url), options }
}

describe('builderApi builds', () => {
  const originalFetch = global.fetch

  beforeEach(() => respond({ error: false, result: {} }))
  afterEach(() => { global.fetch = originalFetch })

  it('asks for an iOS build without a type and an Android one with it', async () => {
    await requestBuilderBuild(ordering, 'tok', 41, 310, { platform: 'ios', mode: 'ad-hoc', type: null })
    let call = lastCall()
    expect(call.url.pathname).toBe(BUILDS)
    expect(call.options.method).toBe('POST')
    expect(JSON.parse(call.options.body)).toEqual({ platform: 'ios', mode: 'ad-hoc' })

    await requestBuilderBuild(ordering, 'tok', 41, 310, { platform: 'android', mode: 'release', type: 'bundle' })
    call = lastCall()
    expect(JSON.parse(call.options.body)).toEqual({ platform: 'android', mode: 'release', type: 'bundle' })
  })

  it('keeps the checks of a refusal', async () => {
    const checks = [{ code: 'missing_file', level: 'warning', platform: 'ios' }]
    respond({ error: true, result: ['Complete the app'], error_codes: ['build.blocked'], checks }, { ok: false, status: 400 })
    const response = await requestBuilderBuild(ordering, 'tok', 41, 310, { platform: 'ios', mode: 'app-store' })
    expect(response).toMatchObject({ error: true, status: 400, errorCodes: ['build.blocked'], checks })

    respond({ error: true, result: ['x'], error_codes: ['product.incomplete'], checks: [{ app_id: 310, warnings: 1 }] }, { ok: false, status: 400 })
    const status = await updateBuilderProductStatus(ordering, 'tok', 41, 'active')
    expect(status.checks).toEqual([{ app_id: 310, warnings: 1 }])

    respond({ error: true, result: ['x'], error_codes: ['product.incomplete'], checks: [], missing: ['name'] }, { ok: false, status: 400 })
    const web = await updateBuilderProductStatus(ordering, 'tok', 43, 'active')
    expect(web).toMatchObject({ checks: [], missing: ['name'] })
  })

  it('lists the history by page, platform and statuses', async () => {
    await listBuilderBuilds(ordering, 'tok', 41, 310, { page: 2, pageSize: 80, platform: 'android', statuses: ['pending', 'queued'] })
    const { url } = lastCall()
    expect(url.pathname).toBe(BUILDS)
    expect(Object.fromEntries(url.searchParams)).toEqual({ page: '2', page_size: '50', platform: 'android', status: 'pending,queued' })

    await listBuilderBuilds(ordering, 'tok', 41, 310)
    expect(Object.fromEntries(lastCall().url.searchParams)).toEqual({ page: '1', page_size: '10' })
  })

  it.each([
    ['latest', () => getBuilderLatestBuilds(ordering, 'tok', 41, 310), `${BUILDS}/latest`, 'GET'],
    ['log', () => getBuilderBuildLog(ordering, 'tok', 41, 310, 9), `${BUILDS}/9/log`, 'GET'],
    ['download', () => getBuilderBuildDownload(ordering, 'tok', 41, 310, 9), `${BUILDS}/9/download`, 'GET'],
    ['retry', () => retryBuilderBuild(ordering, 'tok', 41, 310, 9), `${BUILDS}/9/retry`, 'POST'],
    ['cancel', () => cancelBuilderBuild(ordering, 'tok', 41, 310, 9), `${BUILDS}/9/cancel`, 'POST']
  ])('calls %s on its route', async (_name, call, path, method) => {
    await call()
    const { url, options } = lastCall()
    expect(url.pathname).toBe(path)
    expect(options.method).toBe(method)
    expect(options.headers.Authorization).toBe('Bearer tok')
  })

  it('installs ad hoc builds from the public route of My Products', () => {
    expect(getBuilderAdHocInstallUrl(ordering, 310)).toBe('http://localhost:8080/v400/en/development/builder/apps/310/downloads/ios/ad-hoc/ipa')
  })
})

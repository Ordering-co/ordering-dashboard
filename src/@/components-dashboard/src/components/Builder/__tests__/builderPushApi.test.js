import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getBuilderProductPush, removeBuilderProductFirebase, saveBuilderProductFirebase } from '../builderApi'

const ordering = { root: 'http://localhost:8080/v400/en/development', appInternalName: 'dashboard' }
const PUSH = '/v400/en/development/dashboard/builder/products/41/push'

const lastCall = () => {
  const [url, options] = global.fetch.mock.calls.at(-1)
  return { url: new URL(url), options }
}

describe('builderApi push', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ error: false, result: { firebase: null } }) }))
  })
  afterEach(() => { global.fetch = originalFetch })

  it('reads the push accounts of the product', async () => {
    await getBuilderProductPush(ordering, 'tok', 41)
    const { url, options } = lastCall()
    expect(url.pathname).toBe(PUSH)
    expect(options.method).toBe('GET')
    expect(options.headers.Authorization).toBe('Bearer tok')
  })

  it('saves the service account as text, not as a file', async () => {
    await saveBuilderProductFirebase(ordering, 'tok', 41, '{"type":"service_account"}')
    const { url, options } = lastCall()
    expect(url.pathname).toBe(`${PUSH}/firebase`)
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(options.body)).toEqual({ service_account: '{"type":"service_account"}' })
  })

  it('removes its own account', async () => {
    await removeBuilderProductFirebase(ordering, 'tok', 41)
    const { url, options } = lastCall()
    expect(url.pathname).toBe(`${PUSH}/firebase`)
    expect(options.method).toBe('DELETE')
  })
})

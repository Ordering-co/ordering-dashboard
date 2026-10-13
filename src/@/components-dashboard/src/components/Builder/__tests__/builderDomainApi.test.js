import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getBuilderProductDomain,
  removeBuilderProductDomain,
  saveBuilderProductDomain,
  verifyBuilderProductDomain
} from '../builderApi'

const ordering = { root: 'http://localhost:8080/v400/en/development', appInternalName: 'dashboard' }
const DOMAIN = '/v400/en/development/dashboard/builder/products/43/domain'

const lastCall = () => {
  const [url, options] = global.fetch.mock.calls.at(-1)
  return { url: new URL(url), options }
}

describe('builderApi own domain', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ error: false, result: { domain: null } }) }))
  })
  afterEach(() => { global.fetch = originalFetch })

  it('reads the domains of the website', async () => {
    await getBuilderProductDomain(ordering, 'tok', 43)
    const { url, options } = lastCall()
    expect(url.pathname).toBe(DOMAIN)
    expect(options.method).toBe('GET')
    expect(options.headers.Authorization).toBe('Bearer tok')
  })

  it('saves the domain as typed', async () => {
    await saveBuilderProductDomain(ordering, 'tok', 43, 'https://Shop.Example.com/x')
    const { url, options } = lastCall()
    expect(url.pathname).toBe(DOMAIN)
    expect(options.method).toBe('PUT')
    expect(JSON.parse(options.body)).toEqual({ domain: 'https://Shop.Example.com/x' })
  })

  it('removes the domain and verifies it again', async () => {
    await removeBuilderProductDomain(ordering, 'tok', 43)
    expect(lastCall().url.pathname).toBe(DOMAIN)
    expect(lastCall().options.method).toBe('DELETE')

    await verifyBuilderProductDomain(ordering, 'tok', 43)
    expect(lastCall().url.pathname).toBe(`${DOMAIN}/verify`)
    expect(lastCall().options.method).toBe('POST')
  })

  it('passes on where a missing CNAME record must point', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: true, result: ['Add a CNAME record'], error_codes: ['domain.cname_missing'], cname_target: 'cname.my-sites.app' })
    }))
    const response = await saveBuilderProductDomain(ordering, 'tok', 43, 'shop.example.com')
    expect(response.errorCodes).toEqual(['domain.cname_missing'])
    expect(response.cnameTarget).toBe('cname.my-sites.app')
  })
})

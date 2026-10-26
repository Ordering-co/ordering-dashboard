import { describe, expect, it, vi } from 'vitest'
import {
  fillPluginPlaceholders,
  getPluginPageLinkKeys,
  getPluginPagePath,
  requestPluginLaunch,
  resolvePluginUrl
} from '../pluginPages'

const clover = {
  name: 'Clover',
  root: 'https://clover.test',
  setup_url: '/views/setup?project_code=@{project_code}',
  links: {
    launch: '/@{project_code}/api/pages/launch',
    connection_status: '/@{project_code}/api/business/@{business_id}/connection',
    general_settings: '/views/settings'
  }
}

const answer = (body, { ok = true } = {}) => vi.fn(async () => ({ ok, json: async () => body }))

describe('resolvePluginUrl', () => {
  it('joins a path to the plugin root', () => {
    expect(resolvePluginUrl('/views/setup', 'https://clover.test')).toBe('https://clover.test/views/setup')
    expect(resolvePluginUrl('/views/setup', 'https://clover.test/')).toBe('https://clover.test/views/setup')
  })

  it('keeps an absolute or protocol-relative URL', () => {
    expect(resolvePluginUrl('https://calendly.com/pos/meet', 'https://clover.test')).toBe('https://calendly.com/pos/meet')
    expect(resolvePluginUrl('//calendly.com/pos/meet', 'https://clover.test')).toBe('//calendly.com/pos/meet')
  })

  it('has no URL without a path, or without a root for a relative one', () => {
    expect(resolvePluginUrl(null, 'https://clover.test')).toBeNull()
    expect(resolvePluginUrl('/setup', undefined)).toBeNull()
  })
})

describe('fillPluginPlaceholders', () => {
  it('fills the known placeholders and leaves the rest', () => {
    expect(fillPluginPlaceholders('/s?p=@{project_code}&b=@{business_id}&x=@{other}', { project_code: 'demo', business_id: 42 }))
      .toBe('/s?p=demo&b=42&x=@{other}')
  })

  it('leaves a placeholder without a value, such as the store outside Connect', () => {
    expect(fillPluginPlaceholders('/s?b=@{business_id}', { business_id: null })).toBe('/s?b=@{business_id}')
  })
})

describe('plugin pages', () => {
  it('reads setup from setup_url, else links.setup', () => {
    expect(getPluginPagePath(clover, 'setup')).toBe(clover.setup_url)
    expect(getPluginPagePath({ links: { setup: '/views/setup' } }, 'setup')).toBe('/views/setup')
  })

  it('never opens a reserved link as a page', () => {
    expect(getPluginPagePath(clover, 'launch')).toBeNull()
    expect(getPluginPagePath(clover, 'connection_status')).toBeNull()
    expect(getPluginPagePath(clover, 'general_settings')).toBe('/views/settings')
  })

  it('offers only the links that are pages', () => {
    expect(getPluginPageLinkKeys(clover)).toEqual(['general_settings'])
    expect(getPluginPageLinkKeys({ links: { setup: '/views/setup', report: '/views/report' } })).toEqual(['report'])
  })
})

describe('requestPluginLaunch', () => {
  const variables = { project_code: 'demo', business_id: 42 }
  const launch = (fetchImpl, overrides = {}) => requestPluginLaunch({
    plugin: clover,
    page: 'setup',
    body: { business_id: 42, dashboard_origin: 'https://dashboard.test' },
    token: 'session-token',
    variables,
    fetchImpl,
    ...overrides
  })

  it('posts the page with the session in the header, never in the URL', async () => {
    const fetchImpl = answer({ error: false, result: { url: '/views/setup?code=abc' } })
    await launch(fetchImpl)

    const [url, options] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://clover.test/demo/api/pages/launch')
    expect(options.method).toBe('POST')
    expect(options.headers.Authorization).toBe('Bearer session-token')
    expect(JSON.parse(options.body)).toEqual({ page: 'setup', business_id: 42, dashboard_origin: 'https://dashboard.test' })
  })

  it('returns the URL the plugin gives, joined to its root', async () => {
    expect(await launch(answer({ error: false, result: { url: '/views/setup?code=abc' } })))
      .toEqual({ url: 'https://clover.test/views/setup?code=abc' })
    expect(await launch(answer({ error: false, result: { url: 'https://pages.clover.test/setup?code=abc' } })))
      .toEqual({ url: 'https://pages.clover.test/setup?code=abc' })
  })

  it('fails with the plugin reason when it answers an error', async () => {
    expect(await launch(answer({ error: true, result: ['Merchant not found'] }))).toEqual({ error: 'failed', message: 'Merchant not found' })
    expect(await launch(answer({ error: true, result: 'Merchant not found' }))).toEqual({ error: 'failed', message: 'Merchant not found' })
  })

  it('fails without a URL, on an HTTP error or when the answer is not JSON', async () => {
    expect(await launch(answer({ error: false, result: {} }))).toEqual({ error: 'failed', message: null })
    expect(await launch(answer({ error: false, result: { url: '/x' } }, { ok: false }))).toEqual({ error: 'failed', message: null })
    expect(await launch(vi.fn(async () => ({ ok: true, json: async () => { throw new Error('not json') } }))))
      .toEqual({ error: 'failed', message: null })
    expect(await launch(vi.fn(async () => { throw new TypeError('Failed to fetch') })))
      .toEqual({ error: 'failed', message: null })
  })

  it('gives up when the plugin takes too long', async () => {
    const fetchImpl = vi.fn((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    expect(await launch(fetchImpl, { timeoutMs: 10 })).toEqual({ error: 'timeout', message: null })
  })
})

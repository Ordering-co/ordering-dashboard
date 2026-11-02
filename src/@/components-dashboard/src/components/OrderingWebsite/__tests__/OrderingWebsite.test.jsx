import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'jwt', user: { id: 7 } }] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'https://api.test/v400/en/demo', project: 'demo' }, { configurations: { subdomain: 'orderingplus' } }] }))
vi.mock('../../../contexts/ToastContext', () => ({ useToast: () => [{}, { showToast: vi.fn() }], ToastType: {} }))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, (_key, fallback) => fallback] }))
vi.mock('../../../contexts/WebsocketContext', () => ({
  useWebsocket: () => ({ on: vi.fn(), off: vi.fn(), join: vi.fn(), leave: vi.fn() }),
  useSocketInstance: () => null
}))

import { OrderingWebsite } from '../index'

/** The API with `sites`, which keeps the ones created; every other GET answers an empty list. */
const mockApi = (sites) => {
  global.fetch = vi.fn((url, options = {}) => {
    const method = options.method || 'GET'
    let result = []
    if (url.endsWith('/sites') && method === 'GET') result = sites
    if (url.endsWith('/sites') && method === 'POST') {
      result = { id: 100 + sites.length, ...JSON.parse(options.body) }
      sites.push(result)
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ error: false, result }) })
  })
}

const renderPage = (props) => {
  const UIComponent = vi.fn(() => null)
  render(<OrderingWebsite UIComponent={UIComponent} {...props} />)
  return UIComponent
}

const posts = () => global.fetch.mock.calls.filter(([, options = {}]) => options.method && options.method !== 'GET')

const sitePosts = () => posts().filter(([url, options]) => options.method === 'POST' && url.endsWith('/sites'))

describe('OrderingWebsite', () => {
  it('creates no site when a page asks it not to, and says there is none', async () => {
    mockApi([{ id: 45, code: 'heroic-sky-igzdqm', type: 'web_marketplace_26', product_type: 'marketplace_website' }])
    const UIComponent = renderPage({ appId: 'web_marketplace_26', type: 'web_marketplace_26', disableSiteCreation: true })
    await waitFor(() => expect(UIComponent).toHaveBeenLastCalledWith(expect.objectContaining({ siteMissing: true }), expect.anything()))
    expect(posts()).toEqual([])
  })

  it('keeps the site it has', async () => {
    mockApi([{ id: 41, code: 'website', type: null }])
    const UIComponent = renderPage({ appId: 'website', disableSiteCreation: true })
    await waitFor(() => expect(UIComponent).toHaveBeenLastCalledWith(expect.objectContaining({ site: expect.objectContaining({ id: 41 }), siteMissing: false }), expect.anything()))
    expect(posts()).toEqual([])
  })

  it('still creates its site where creating one is allowed', async () => {
    mockApi([])
    renderPage({ appId: 'website' })
    await waitFor(() => expect(posts().map(([url]) => url)).toContain('https://api.test/v400/en/demo/sites'))
  })

  it('names the site it creates after its product', async () => {
    mockApi([])
    renderPage({ appId: 'web_marketplace_26', app: { id: 9, name: 'Marketplace Website' } })
    await waitFor(() => expect(sitePosts()).toHaveLength(1))
    expect(JSON.parse(sitePosts()[0][1].body)).toEqual({ code: 'web_marketplace_26', name: 'Marketplace Website' })
  })

  it('keeps the name a page gives the site it creates', async () => {
    mockApi([])
    renderPage({ appId: 'web_franchises_x', type: 'franchiseweb', name: 'Franchise website', disableReplaceCode: true })
    await waitFor(() => expect(sitePosts()).toHaveLength(1))
    expect(JSON.parse(sitePosts()[0][1].body)).toEqual({ code: 'web_franchises_x', name: 'Franchise website', type: 'franchiseweb' })
  })
})

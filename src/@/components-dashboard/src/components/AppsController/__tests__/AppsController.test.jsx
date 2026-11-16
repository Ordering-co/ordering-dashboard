import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'jwt' }] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'https://api.test/v400/en/demo', project: 'demo' }, { configurations: { subdomain: 'orderingplus' } }] }))
vi.mock('../../../contexts/ToastContext', () => ({ useToast: () => [{}, { showToast: vi.fn() }], ToastType: {} }))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, (_key, fallback) => fallback] }))

import { AppsController } from '../index'

const mockApi = (sites) => {
  global.fetch = vi.fn((url, options = {}) => {
    const isGet = (options.method || 'GET') === 'GET'
    const result = isGet ? (url.endsWith('/sites') ? sites : []) : { id: 77, code: 'app_driver_26' }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ error: false, result }) })
  })
}

const sitePosts = () => global.fetch.mock.calls.filter(([url, options = {}]) => options.method === 'POST' && url.endsWith('/sites'))

const renderApp = (props) => render(<AppsController UIComponent={() => null} {...props} />)

describe('AppsController', () => {
  it('names the site it creates after its product', async () => {
    mockApi([])
    renderApp({ appId: 'app_driver_26', app: { id: 1484, name: 'Driver App', base: { code: 'app_driver_26' } } })
    await waitFor(() => expect(sitePosts()).toHaveLength(1))
    expect(JSON.parse(sitePosts()[0][1].body)).toEqual({ code: 'app_driver_26', name: 'Driver App' })
  })

  it('creates no site when the product already has one', async () => {
    mockApi([{ id: 1519, code: 'app_driver_26', name: 'My drivers' }])
    renderApp({ appId: 'app_driver_26', app: { id: 1484, name: 'Driver App', base: { code: 'app_driver_26' } } })
    await waitFor(() => expect(global.fetch.mock.calls.some(([url]) => url.endsWith('/sites/1519/themes'))).toBe(true))
    expect(sitePosts()).toEqual([])
  })

  // The editor is not drawn while the app loads: an app given with an id to load is loading from its first render, so what the
  // editor mounts (the Builds section, which asks for the QR's install link) is mounted once, not once before the load and again after.
  it('is loading from its first render when it has an app to load, and never shows it loaded before', async () => {
    mockApi([{ id: 1519, code: 'app_driver_26', name: 'My drivers' }])
    const seen = []
    const UI = ({ singleAppState }) => {
      seen.push(singleAppState.loading)
      return null
    }
    render(<AppsController UIComponent={UI} productId={1484} appId='app_driver_26' app={{ id: 1484, name: 'Driver App', base: { code: 'app_driver_26' } }} />)

    expect(seen[0]).toBe(true)
    await waitFor(() => expect(seen.at(-1)).toBe(false))
    // loading, then loaded: no render says «loaded» before the load ends, or «loading» after it
    expect(seen.lastIndexOf(true)).toBeLessThan(seen.indexOf(false))
    expect(global.fetch.mock.calls.some(([url]) => url.includes('/builder/apps/1484/base_actions'))).toBe(true)
  })

  it('is not loading when there is no app to load', async () => {
    mockApi([{ id: 1519, code: 'app_driver_26', name: 'My drivers' }])
    const seen = []
    const UI = ({ singleAppState }) => {
      seen.push(singleAppState.loading)
      return null
    }
    render(<AppsController UIComponent={UI} appId='app_driver_26' app={{ id: 1484, name: 'Driver App', base: { code: 'app_driver_26' } }} />)
    await waitFor(() => expect(global.fetch.mock.calls.some(([url]) => url.endsWith('/sites/1519/themes'))).toBe(true))

    expect(seen.some(Boolean)).toBe(false)
  })
})

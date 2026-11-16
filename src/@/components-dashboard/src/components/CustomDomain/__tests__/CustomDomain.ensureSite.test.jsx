/* eslint-disable import/first */
// /my-products/dashboard no longer creates its site on load, so the custom-domain dialog asks the page for the site
// to write on (`ensureSite`) before saving the domain. Without `ensureSite` (website, franchises) it writes on `site.id` as main.
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ showToast: vi.fn() }))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'test-token' }] }))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{
    root: 'https://api.test',
    setAccessToken: () => ({ configs: () => ({ save: (changes) => { mockSaveConfig(changes); return Promise.resolve({ content: { error: false, result: {} } }) } }) })
  }]
}))
vi.mock('../../../contexts/ConfigContext', () => ({ useConfig: () => [{ configs: { google_maps_api_key: { id: 3, key: 'google_maps_api_key' } } }] }))
const mockSaveConfig = vi.hoisted(() => vi.fn())
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, (key, text) => text] }))

import { CustomDomain } from '../index'

let ui
let calls

beforeEach(() => {
  ui = null
  calls = []
  mocks.showToast.mockClear()
  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    calls.push({ method: options.method || 'GET', path: url.replace('https://api.test', ''), body: JSON.parse(options.body) })
    return Promise.resolve({ json: () => Promise.resolve({ error: false, result: { id: 166, domain: 'admin.brand.com' } }) })
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const mount = (props) => render(<CustomDomain {...props} UIComponent={(uiProps) => { ui = uiProps; return null }} />)

describe('CustomDomain · ensureSite', () => {
  it('asks for the site first and writes the domain on the one it gets', async () => {
    const ensureSite = vi.fn().mockResolvedValue({ id: 166, code: 'web_dashboard_x' })
    const setSite = vi.fn()
    mount({ site: null, setSite, ensureSite })
    act(() => { ui.handleChangeFormState({ domain: 'admin.brand.com' }) })
    await act(async () => { await ui.handleChangeCustomDomain() })
    expect(ensureSite).toHaveBeenCalledTimes(1)
    expect(calls).toEqual([{ method: 'POST', path: '/sites/166', body: { domain: 'admin.brand.com', ssl_setup_type: 'automatic' } }])
    expect(setSite).toHaveBeenCalledWith(expect.objectContaining({ id: 166, code: 'web_dashboard_x', domain: 'admin.brand.com' }))
  })

  it('when the site cannot be created it says so and writes nothing', async () => {
    const ensureSite = vi.fn().mockRejectedValue(['Not allowed'])
    mount({ site: null, setSite: vi.fn(), ensureSite })
    act(() => { ui.handleChangeFormState({ domain: 'admin.brand.com' }) })
    await act(async () => { await ui.handleChangeCustomDomain() })
    expect(calls).toEqual([])
    expect(mocks.showToast).toHaveBeenCalledWith('error', ['Not allowed'])
  })

  it('when the site cannot be created the Maps key is not saved either (nothing half done)', async () => {
    mockSaveConfig.mockClear()
    const ensureSite = vi.fn().mockRejectedValue(['Not allowed'])
    mount({ site: null, setSite: vi.fn(), ensureSite })
    act(() => { ui.handleChangeFormState({ domain: 'admin.brand.com' }) })
    await act(async () => { await ui.handleChangeCustomDomain('maps-key') })
    expect(mockSaveConfig).not.toHaveBeenCalled()
    expect(calls).toEqual([])
  })

  it('without ensureSite it writes on site.id, as main', async () => {
    mount({ site: { id: 34, code: 'website' }, setSite: vi.fn() })
    act(() => { ui.handleChangeFormState({ domain: 'shop.brand.com' }) })
    await act(async () => { await ui.handleChangeCustomDomain() })
    expect(calls).toEqual([{ method: 'POST', path: '/sites/34', body: { domain: 'shop.brand.com', ssl_setup_type: 'automatic' } }])
  })
})

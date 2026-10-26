import React from 'react'
import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const toast = vi.hoisted(() => ({ showToast: vi.fn() }))

vi.mock('../../../../index', () => ({
  useApi: () => [{ project: 'demo' }],
  useSession: () => [{ token: 'session-token' }],
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useToast: () => [null, toast],
  ToastType: { Error: 'error' }
}))

import { usePluginPage } from '../usePluginPage'

let openPluginPage
const Probe = () => {
  openPluginPage = usePluginPage()
  return null
}

const square = {
  name: 'Square',
  root: 'https://square.test',
  links: {
    setup: '/views/setup?project_code=@{project_code}&token=@{access_token}&business_id=@{business_id}&origin=@{dashboard_origin}',
    general_settings: '/views/settings?lang=@{language_code}'
  }
}
const clover = {
  name: 'Clover',
  root: 'https://clover.test',
  setup_url: '/views/setup?token=@{access_token}',
  links: { launch: '/@{project_code}/api/pages/launch' }
}

describe('usePluginPage', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    toast.showToast.mockClear()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    render(<Probe />)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens the page of a plugin without a launch as before, with its placeholders filled', async () => {
    expect(await openPluginPage(square, 'setup', { businessId: 42 })).toBe(
      `https://square.test/views/setup?project_code=demo&token=session-token&business_id=42&origin=${encodeURIComponent(window.location.origin)}`
    )
    expect(await openPluginPage(square, 'general_settings')).toBe('https://square.test/views/settings?lang=en')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('says so when the plugin has no such page', async () => {
    expect(await openPluginPage({ ...square, links: {} }, 'setup', { businessId: 42 })).toBeNull()
    expect(toast.showToast).toHaveBeenCalledWith('error', 'This integration has no setup page. Contact support to finish the connection.')
  })

  it('asks a plugin with a launch for the URL and never puts the session in it', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ error: false, result: { url: '/views/setup?code=one-time' } }) })

    const url = await openPluginPage(clover, 'setup', { businessId: 42 })

    expect(url).toBe('https://clover.test/views/setup?code=one-time')
    expect(url).not.toContain('session-token')
    const [launchUrl, options] = fetchMock.mock.calls[0]
    expect(launchUrl).toBe('https://clover.test/demo/api/pages/launch')
    expect(options.headers.Authorization).toBe('Bearer session-token')
    expect(JSON.parse(options.body)).toEqual({ page: 'setup', business_id: 42, dashboard_origin: window.location.origin })
  })

  it('sends the delivery company when the page is for one', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ error: false, result: { url: '/views/setup?code=one-time' } }) })
    await openPluginPage(clover, 'setup', { driverCompanyId: 7 })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ page: 'setup', business_id: null, driver_company_id: 7, dashboard_origin: window.location.origin })
  })

  it('shows why the plugin could not open the page instead of an empty window', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ error: true, result: ['Merchant not found'] }) })
    expect(await openPluginPage(clover, 'setup', { businessId: 42 })).toBeNull()
    expect(toast.showToast).toHaveBeenCalledWith('error', 'Clover could not open this page: Merchant not found')

    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await openPluginPage(clover, 'setup', { businessId: 42 })).toBeNull()
    expect(toast.showToast).toHaveBeenLastCalledWith('error', 'Clover could not open this page. Try again in a moment.')
  })

  it('ignores a second click while the launch is waiting', async () => {
    let answer
    fetchMock.mockReturnValue(new Promise(resolve => { answer = resolve }))

    const first = openPluginPage(clover, 'setup', { businessId: 42 })
    expect(await openPluginPage(clover, 'setup', { businessId: 42 })).toBeNull()
    answer({ ok: true, json: async () => ({ error: false, result: { url: '/views/setup?code=one-time' } }) })

    expect(await first).toBe('https://clover.test/views/setup?code=one-time')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

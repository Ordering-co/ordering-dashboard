import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'

const toast = vi.hoisted(() => ({ showToast: vi.fn() }))

vi.mock('~components', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useApi: () => [{ project: 'demo' }],
  useConfig: () => [{ configs: {} }],
  useSession: () => [{ user: { level: 0 } }],
  useToast: () => [null, toast],
  ToastType: { Error: 'error', Success: 'success' },
  useUtils: () => [{ parseDate: (date) => date }]
}))
vi.mock('posthog-js/react', () => ({
  useActiveFeatureFlags: () => []
}))
vi.mock('~ui', () => ({
  Confirm: () => null,
  Alert: () => null,
  Modal: ({ open, title, children }) => open ? <div role='dialog' aria-label={title}>{children}</div> : null,
  useWindowSize: () => ({ width: 1200 })
}))

import { BusinessSummary } from '../index'
import { rememberedPluginFrameHeight } from '../../../../../../utils/pluginMessages'

/**
 * The plugin page in the setup modal tells the store panel it finished
 * (docs/PLUGIN_PAGES.md). Before, the panel never heard from it: the user
 * closed the modal by hand to see the new state.
 */
const clover = { id: 9, name: 'Clover', plugin_id: 9, plugin: { name: 'Clover', root: 'https://clover.test', setup_url: '/setup?origin=@{dashboard_origin}' } }

const renderPanel = (integration = clover) => {
  const props = {
    businessState: { loading: false, business: { id: 42, name: 'Store', third_party_integrations: [{ third_party_integration_id: 9, setup_status: 'failed' }] } },
    integrationsList: { thirdPartyIntegrations: [integration] },
    formState: { changes: {} },
    updateBusiness: vi.fn(),
    getIntegrations: vi.fn(),
    handleSelectIntegration: vi.fn(),
    handleSelectedItem: vi.fn()
  }
  renderWithProviders(<BusinessSummary {...props} />, { theme: { ...theme, images: { general: {} } } })
  return props
}

const openSetup = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }))
  return screen.findByRole('dialog', { name: 'Clover' })
}

const send = (data, overrides = {}) => act(() => {
  window.dispatchEvent(new MessageEvent('message', {
    data: { type: 'ordering:plugin', ...data },
    origin: 'https://clover.test',
    source: document.querySelector('iframe').contentWindow,
    ...overrides
  }))
})

describe('Store panel: messages from the plugin page', () => {
  beforeEach(() => {
    toast.showToast.mockClear()
  })

  it('passes the dashboard origin to the plugin page', async () => {
    renderPanel()
    await openSetup()
    expect(document.querySelector('iframe').getAttribute('src'))
      .toBe(`https://clover.test/setup?origin=${encodeURIComponent(window.location.origin)}`)
  })

  it('reads the store again and stays open when the setup succeeded', async () => {
    const props = renderPanel()
    await openSetup()

    send({ event: 'setup_finished', status: 'success', business_id: 42 })

    expect(screen.getByRole('dialog', { name: 'Clover' })).toBeInTheDocument()
    expect(props.updateBusiness).toHaveBeenCalledTimes(1)
    expect(props.getIntegrations).toHaveBeenCalledTimes(1)
    expect(toast.showToast).toHaveBeenCalledWith('success', 'Clover connected.')
  })

  it('closes after the setup when the page asks', async () => {
    const props = renderPanel()
    await openSetup()

    send({ event: 'setup_finished', status: 'success', business_id: 42, close: true })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(props.updateBusiness).toHaveBeenCalledTimes(1)
    expect(props.getIntegrations).toHaveBeenCalledTimes(1)
    expect(toast.showToast).toHaveBeenCalledWith('success', 'Clover connected.')
  })

  it('reads the store again but stays open when the setup failed', async () => {
    const props = renderPanel()
    await openSetup()

    send({ event: 'setup_finished', status: 'failed', message: 'Invalid merchant' })

    expect(screen.getByRole('dialog', { name: 'Clover' })).toBeInTheDocument()
    expect(props.updateBusiness).toHaveBeenCalledTimes(1)
    expect(toast.showToast).toHaveBeenCalledWith('error', 'Invalid merchant')
  })

  it('closes on request, like the X', async () => {
    const props = renderPanel()
    await openSetup()

    send({ event: 'close' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(props.updateBusiness).toHaveBeenCalledTimes(1)
  })

  it('fits the window to the height the page reports, and nothing else happens', async () => {
    const props = renderPanel()
    await openSetup()
    expect(document.querySelector('iframe').parentElement.style.height).toBe('85%')

    send({ event: 'resize', height: 452 })

    expect(document.querySelector('iframe').parentElement.style.height).toBe('452px')
    expect(screen.getByRole('dialog', { name: 'Clover' })).toBeInTheDocument()
    expect(props.updateBusiness).not.toHaveBeenCalled()
    expect(toast.showToast).not.toHaveBeenCalled()
  })

  it('ignores a resize from another origin', async () => {
    renderPanel()
    await openSetup()

    send({ event: 'resize', height: 452 }, { origin: 'https://evil.test' })

    expect(document.querySelector('iframe').parentElement.style.height).toBe('85%')
  })

  it('shows the plugin loading until its page loads, then fades it in', async () => {
    renderPanel()
    await openSetup()
    expect(screen.getByRole('status')).toHaveTextContent('Loading Clover…')

    act(() => { document.querySelector('iframe').dispatchEvent(new Event('load')) })

    expect(screen.queryByRole('status')).toBeNull()
  })

  it('ignores messages from another origin or about another store', async () => {
    const props = renderPanel()
    await openSetup()

    send({ event: 'setup_finished', status: 'success' }, { origin: 'https://evil.test' })
    send({ event: 'setup_finished', status: 'success', business_id: 7 })

    expect(screen.getByRole('dialog', { name: 'Clover' })).toBeInTheDocument()
    expect(props.updateBusiness).not.toHaveBeenCalled()
    expect(toast.showToast).not.toHaveBeenCalled()
  })
})

describe('Store panel: a plugin that opens its pages through a launch', () => {
  // The launch hands back a page on another host: its messages are the ones
  // that count, from the URL the modal loaded.
  const cloverLaunch = { ...clover, plugin: { ...clover.plugin, links: { launch: '/@{project_code}/api/pages/launch' } } }
  const fetchMock = vi.fn()

  beforeEach(() => {
    // Each test starts without a height remembered from another one.
    window.localStorage.clear()
    toast.showToast.mockClear()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads the one-time URL and takes the messages of its origin', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ error: false, result: { url: 'https://pages.clover.test/setup?code=one-time' } }) })
    const props = renderPanel(cloverLaunch)
    await openSetup()

    expect(fetchMock.mock.calls[0][0]).toBe('https://clover.test/demo/api/pages/launch')
    expect(document.querySelector('iframe').getAttribute('src')).toBe('https://pages.clover.test/setup?code=one-time')

    send({ event: 'setup_finished', status: 'success' }, { origin: 'https://clover.test' })
    expect(props.updateBusiness).not.toHaveBeenCalled()

    send({ event: 'setup_finished', status: 'success', close: true }, { origin: 'https://pages.clover.test' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(props.updateBusiness).toHaveBeenCalledTimes(1)
  })

  it('opens the window right away, compact, with a spinner until the launch answers', async () => {
    let answer
    fetchMock.mockReturnValue(new Promise(resolve => { answer = resolve }))
    renderPanel(cloverLaunch)

    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }))

    expect(await screen.findByRole('dialog', { name: 'Clover' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Loading Clover…')
    expect(document.querySelector('iframe')).toBeNull()

    await act(async () => answer({ ok: true, json: async () => ({ error: false, result: { url: 'https://pages.clover.test/setup?code=one-time' } }) }))

    expect(document.querySelector('iframe').getAttribute('src')).toBe('https://pages.clover.test/setup?code=one-time')
    expect(document.querySelector('iframe').parentElement.style.height).toBe('320px')
  })

  it('gives the maximum height to a launched page that never reports its height', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ error: false, result: { url: 'https://pages.clover.test/setup?code=one-time' } }) })
    renderPanel(cloverLaunch)
    await openSetup()
    await vi.waitFor(() => expect(document.querySelector('iframe')).not.toBeNull())

    act(() => { document.querySelector('iframe').dispatchEvent(new Event('load')) })
    expect(screen.queryByRole('status')).toBeNull()

    await vi.waitFor(() => expect(document.querySelector('iframe').parentElement.style.height).toBe(`${Math.floor(window.innerHeight * 0.8)}px`), { timeout: 3000 })
  })

  it('opens the next time at the height the page reported last time', async () => {
    window.localStorage.clear()
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ error: false, result: { url: 'https://pages.clover.test/setup?code=one-time' } }) })
    renderPanel(cloverLaunch)
    await openSetup()
    await vi.waitFor(() => expect(document.querySelector('iframe')).not.toBeNull())

    send({ event: 'resize', height: 410 }, { origin: 'https://pages.clover.test' })

    expect(document.querySelector('iframe').parentElement.style.height).toBe('410px')
    expect(rememberedPluginFrameHeight(`${cloverLaunch.plugin.key || cloverLaunch.plugin.id}:setup`)).toBe(410)
  })

  it('shows an error instead of an empty window when the launch fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: true, result: ['Merchant not found'] }) })
    renderPanel(cloverLaunch)

    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }))

    await vi.waitFor(() => expect(toast.showToast).toHaveBeenCalledWith('error', 'Clover could not open this page: Merchant not found'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

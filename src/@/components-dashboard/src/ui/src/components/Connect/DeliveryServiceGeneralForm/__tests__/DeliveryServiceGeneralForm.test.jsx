import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'

const toast = vi.hoisted(() => ({ showToast: vi.fn() }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useApi: () => [{ project: 'demo' }],
  useSession: () => [{ token: 'session-token' }],
  useToast: () => [null, toast],
  ToastType: { Error: 'error' }
}))
vi.mock('../../../Settings', () => ({ SettingsList: () => null }))
vi.mock('../../../Shared', () => ({ Alert: () => null }))

import { DeliveryServiceGeneralForm } from '../index'

const renderForm = (plugin) => renderWithProviders(
  <DeliveryServiceGeneralForm
    deliveryServiceState={{ deliveryService: { id: 7, plugin } }}
    changesState={{}}
    pluginState={{ loading: false, configs: [] }}
    projectCode='demo'
    deliveryServiceId={7}
    handleUpdateDeliveryGroup={vi.fn()}
  />,
  { theme }
)

/**
 * Delivery services open the plugin setup in a new tab. A plugin with
 * links.launch gets a one-time URL; the tab opens on the click, before the
 * plugin answers, so the browser does not block it.
 */
describe('Delivery service setup', () => {
  const fetchMock = vi.fn()
  let setupWindow

  beforeEach(() => {
    toast.showToast.mockClear()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    setupWindow = { opener: window, location: { href: '' }, close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(setupWindow)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('keeps the link of a plugin without a launch', () => {
    renderForm({ name: 'Doordash', setup_url: 'https://doordash.test/setup' })
    expect(screen.getByText('Start Setup').closest('a')).toHaveAttribute(
      'href',
      'https://doordash.test/setup?project_code=demo&access_token=session-token&driver_company_id=7'
    )
  })

  it('opens the tab on the click and sends it to the one-time URL', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ error: false, result: { url: '/views/setup?code=one-time' } }) })
    renderForm({ name: 'Uber Direct', root: 'https://uber.test', setup_url: '/views/setup', links: { launch: '/api/pages/launch' } })

    fireEvent.click(screen.getByRole('button', { name: 'Start Setup' }))

    expect(window.open).toHaveBeenCalledWith('', '_blank')
    await waitFor(() => expect(setupWindow.location.href).toBe('https://uber.test/views/setup?code=one-time'))
    expect(setupWindow.opener).toBeNull()
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ page: 'setup', driver_company_id: 7 })
  })

  it('closes the tab and says why when the launch fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    renderForm({ name: 'Uber Direct', root: 'https://uber.test', setup_url: '/views/setup', links: { launch: '/api/pages/launch' } })

    fireEvent.click(screen.getByRole('button', { name: 'Start Setup' }))

    await waitFor(() => expect(setupWindow.close).toHaveBeenCalled())
    expect(toast.showToast).toHaveBeenCalledWith('error', 'Uber Direct could not open this page. Try again in a moment.')
  })
})

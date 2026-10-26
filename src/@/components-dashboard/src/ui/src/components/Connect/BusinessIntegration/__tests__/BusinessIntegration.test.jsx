import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'

const state = vi.hoisted(() => ({ level: 2 }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useApi: () => [{ project: 'luisv4plus' }],
  useUtils: () => [{ parseDate: (date) => date }],
  useToast: () => [null, { showToast: vi.fn() }],
  ToastType: { Error: 'error' },
  useSession: () => [{ token: 'test-token', user: { level: state.level } }]
}))
vi.mock('../../../Shared', () => ({
  Alert: () => null,
  Confirm: ({ open, content, acceptText, onAccept, onCancel }) => open
    ? (
      <div role='alertdialog'>
        <p>{content}</p>
        <button type='button' onClick={onAccept}>{acceptText}</button>
        <button type='button' onClick={onCancel}>Cancel</button>
      </div>
      )
    : null,
  IntegrationLogs: () => null,
  Modal: ({ open, title, children }) => open
    ? (
      <div role='dialog' aria-label={title}>{children}</div>
      )
    : null
}))

import { BusinessIntegration } from '../index'

const square = {
  id: 430,
  name: 'Square POS Integration',
  plugin_id: 2477,
  plugin: {
    name: 'Square',
    root: 'https://square.test',
    links: {
      general_settings: '/views/settings?project_code=@{project_code}&token=@{access_token}',
      setup: '/views/setup?project_code=@{project_code}&token=@{access_token}&business_id=@{business_id}'
    }
  }
}

const renderPanel = (overrides = {}) => renderWithProviders(
  <BusinessIntegration
    business={{ id: 628, third_party_integrations: [{ third_party_integration_id: 430, enabled: true, setup_status: 'success' }] }}
    selectedIntegration={square}
    formState={{ changes: {} }}
    setFormState={vi.fn()}
    handleConnectBusiness={vi.fn()}
    handleDisconnectBusiness={vi.fn()}
    handlePushAction={vi.fn()}
    {...overrides}
  />,
  { theme }
)

// The plugin's own pages and Logs are in the "…" menu, as in the Stores business
// panel; the setup page is the status card's action.
const openMenu = () => fireEvent.click(document.getElementById('dropdown-menu-align-right'))
const menuItem = (name) => screen.getByText(name).closest('.dropdown-item')
const cardButton = (name) => screen.getByRole('button', { name })
// The plugin's pages and Logs are buttons at the bottom of the detail.
const pageButton = cardButton

describe('BusinessIntegration plugin links', () => {
  it.each([
    'https://calendly.com/pos/meet',
    'HTTP://calendly.com/pos/meet',
    '//calendly.com/pos/meet'
  ])('opens admin booking URL %s without prepending the plugin root', async (link) => {
    state.level = 0
    renderPanel({ selectedIntegration: { ...square, plugin: { ...square.plugin, links: { book_call: link } } } })
    fireEvent.click(pageButton('Book call'))
    await waitFor(() => expect(document.querySelector('iframe')).toHaveAttribute('src', link))
  })

  it.each([0, 2])('preserves absolute non-Calendly setup and template variables for level %s', async (level) => {
    state.level = level
    renderPanel({ selectedIntegration: { ...square, plugin: { ...square.plugin, links: { setup: 'https://setup.test/views/setup?business_id=@{business_id}' } } } })
    fireEvent.click(cardButton('Setup'))
    await waitFor(() => expect(document.querySelector('iframe')).toHaveAttribute('src', 'https://setup.test/views/setup?business_id=628'))
  })

  it.each([0, 2])('preserves non-Calendly setup with the store id for level %s', async (level) => {
    state.level = level
    renderPanel()
    fireEvent.click(cardButton('Setup'))
    await waitFor(() => expect(document.querySelector('iframe')).not.toBeNull())
    expect(document.querySelector('iframe').getAttribute('src')).toBe('https://square.test/views/setup?project_code=luisv4plus&token=test-token&business_id=628')
  })

  it.each([0, 2])('preserves non-Calendly General settings for level %s', async (level) => {
    state.level = level
    renderPanel()
    fireEvent.click(pageButton('General settings'))
    await waitFor(() => expect(document.querySelector('iframe')).not.toBeNull())
    expect(document.querySelector('iframe').getAttribute('src')).toBe('https://square.test/views/settings?project_code=luisv4plus&token=test-token')
  })

  it.each([2, undefined])('disables Calendly links only for non-admin level %s', (level) => {
    state.level = level
    renderPanel({ selectedIntegration: { ...square, plugin: { ...square.plugin, links: { ...square.plugin.links, book_call: 'https://calendly.com/pos/meet' } } } })
    const contactAdmin = pageButton('Contact admin')
    expect(contactAdmin).toBeDisabled()
    fireEvent.click(contactAdmin)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(cardButton('Setup')).toBeEnabled()
    expect(pageButton('General settings')).toBeEnabled()
  })

  it.each([
    [0, false],
    [2, true]
  ])('preserves Calendly plugin links for level %s with Sales Channels %s', async (level, fromSalesChannels) => {
    state.level = level
    renderPanel({ fromSalesChannels, selectedIntegration: { ...square, plugin: { name: 'Booking', root: 'https://calendly.com', links: { book_call: '/pos/meet' } } } })
    fireEvent.click(pageButton('Book call'))
    await waitFor(() => expect(document.querySelector('iframe')).toHaveAttribute('src', 'https://calendly.com/pos/meet'))
  })
})

describe('BusinessIntegration reserved plugin links', () => {
  it('never offers launch or connection_status as a page', () => {
    state.level = 0
    renderPanel({ selectedIntegration: { ...square, plugin: { ...square.plugin, links: { ...square.plugin.links, launch: '/api/pages/launch', connection_status: '/api/connection' } } } })

    expect(pageButton('General settings')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Launch' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Connection status' })).not.toBeInTheDocument()
  })
})

describe('BusinessIntegration status and actions', () => {
  const withRow = (row) => ({ id: 628, third_party_integrations: [{ third_party_integration_id: 430, enabled: true, ...row }] })

  it('shows the state, why and when it changed, and offers Reconnect when it failed', async () => {
    state.level = 0
    renderPanel({
      business: withRow({ setup_status: 'failed', setup_message: 'Square token revoked', setup_status_updated_at: '2026-10-21 19:19:10' })
    })

    expect(screen.getByText('Needs attention')).toBeInTheDocument()
    expect(screen.getByText('Square token revoked')).toBeInTheDocument()
    expect(screen.getByText(/2026-10-21 19:19:10/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }))
    expect(await screen.findByRole('dialog', { name: 'Square' })).toBeInTheDocument()
    expect(document.querySelector('iframe').getAttribute('src')).toBe('https://square.test/views/setup?project_code=luisv4plus&token=test-token&business_id=628')
  })

  it('offers Continue setup for a connection the plugin has not reported on yet', () => {
    state.level = 0
    renderPanel({ business: withRow({ setup_status: null }) })

    expect(screen.getByText('Setup pending')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue setup' })).toBeInTheDocument()
  })

  it('only syncs a connected POS, and runs each sync from its own button', () => {
    state.level = 0
    const handlePushAction = vi.fn()
    const { unmount } = renderPanel({ business: withRow({ setup_status: 'failed' }), handlePushAction })

    screen.getAllByRole('button', { name: 'Sync now' }).forEach(button => expect(button).toBeDisabled())
    expect(screen.getByText('Available once the POS is connected.')).toBeInTheDocument()
    unmount()

    renderPanel({ business: withRow({ setup_status: 'success' }), handlePushAction })
    const [syncBusiness, syncMenu] = screen.getAllByRole('button', { name: 'Sync now' })
    fireEvent.click(syncBusiness)
    fireEvent.click(syncMenu)

    expect(handlePushAction).toHaveBeenNthCalledWith(1, 430, 'sync_business', expect.any(String))
    expect(handlePushAction).toHaveBeenNthCalledWith(2, 430, 'sync_menu', expect.any(String))
    expect(screen.queryByRole('button', { name: 'Reconnect' })).not.toBeInTheDocument()
  })

  it('does not offer a sync the plugin cannot run', () => {
    state.level = 0
    const { unmount } = renderPanel({
      business: withRow({ setup_status: 'success' }),
      selectedIntegration: { ...square, plugin: { ...square.plugin, enabled: false } }
    })

    screen.getAllByRole('button', { name: 'Sync now' }).forEach(button => expect(button).toBeDisabled())
    expect(screen.getByText('The plugin of this integration is disabled or uninstalled.')).toBeInTheDocument()
    unmount()

    renderPanel({
      business: withRow({ setup_status: 'success' }),
      selectedIntegration: { ...square, plugin: { ...square.plugin, hooks: [{ hook: 'sync_menu' }] } }
    })
    const [syncBusiness, syncMenu] = screen.getAllByRole('button', { name: 'Sync now' })
    expect(syncBusiness).toBeDisabled()
    expect(syncMenu).toBeEnabled()
    expect(screen.getByText('This integration does not support it.')).toBeInTheDocument()
  })

  it('keeps Connected but warns and explains when the plugin is disabled', () => {
    renderPanel({
      business: withRow({ setup_status: 'success' }),
      selectedIntegration: { ...square, plugin: { ...square.plugin, enabled: false } }
    })

    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'The plugin of this integration is disabled.' })).toBeInTheDocument()
    expect(screen.getByText('The plugin of this integration is disabled, so syncing is paused.')).toBeInTheDocument()
    expect(screen.queryByText('The POS is connected and syncing with this store.')).not.toBeInTheDocument()
  })

  it('shows the integration logo in the status card', () => {
    renderPanel({ business: withRow({ setup_status: 'success' }), selectedIntegration: { ...square, logo: '/square-logo.png' } })

    expect(document.querySelector('[style*="square-logo.png"]')).toBeInTheDocument()
  })

  it('offers the setup page only in the card, never as a plugin page', () => {
    state.level = 0
    const { unmount } = renderPanel({ business: withRow({ setup_status: null }) })

    expect(cardButton('Continue setup')).toBeInTheDocument()
    expect(screen.queryByText('Setup')).not.toBeInTheDocument()
    expect(pageButton('General settings')).toBeInTheDocument()
    expect(pageButton('Logs')).toBeInTheDocument()
    unmount()

    renderPanel({ business: withRow({ setup_status: 'success' }) })
    expect(screen.getAllByText('Setup')).toHaveLength(1)
  })

  it('keeps only Disconnect in the "…" menu', () => {
    renderPanel({ business: withRow({ setup_status: 'success' }) })

    openMenu()
    const items = document.querySelectorAll('.dropdown-item')
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveTextContent('Disconnect')
  })

  // A plugin with setup_url and no links (Clover): the card offers the same
  // setup page the business panel row opens, and nothing when the plugin is off.
  it('offers Setup in the card of a connected POS like the business panel does', async () => {
    state.level = 0
    const clover = { id: 430, name: 'Clover', plugin_id: 63, plugin: { name: 'Clover', root: 'https://clover.test', setup_url: '/views/setup?business_id=@{business_id}', links: {} } }
    const { unmount } = renderPanel({ business: withRow({ setup_status: 'success' }), selectedIntegration: clover })

    fireEvent.click(cardButton('Setup'))
    await waitFor(() => expect(document.querySelector('iframe')).toHaveAttribute('src', 'https://clover.test/views/setup?business_id=628'))
    unmount()

    renderPanel({ business: withRow({ setup_status: 'success' }), selectedIntegration: { ...clover, plugin: { ...clover.plugin, enabled: false } } })
    expect(screen.queryByRole('button', { name: 'Setup' })).not.toBeInTheDocument()
  })

  it('keeps only Logs and explains why while the plugin of a pending POS is disabled', () => {
    state.level = 0
    renderPanel({
      business: withRow({ setup_status: null }),
      selectedIntegration: { ...square, plugin: { ...square.plugin, enabled: false } }
    })

    expect(screen.getByText('Setup pending')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'The plugin of this integration is disabled.' })).toBeInTheDocument()
    expect(screen.getByText('The plugin of this integration is disabled. Enable it to finish or resume the connection.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continue setup' })).not.toBeInTheDocument()
    expect(screen.queryByText('General settings')).not.toBeInTheDocument()
    expect(pageButton('Logs')).toBeInTheDocument()
    openMenu()
    expect(menuItem('Disconnect')).toBeInTheDocument()
  })

  it('labels the external id of a POS as its location id', () => {
    renderPanel({ business: withRow({ setup_status: 'success', external_id: 'L1NGAY5M6KJRX' }) })

    expect(screen.getByText('POS location ID')).toBeInTheDocument()
    expect(screen.getByDisplayValue('L1NGAY5M6KJRX')).toHaveAttribute('placeholder', 'POS location ID')
  })

  it('asks before disconnecting', () => {
    const handleDisconnectBusiness = vi.fn()
    renderPanel({ business: withRow({ setup_status: 'success' }), handleDisconnectBusiness })
    // Disconnect lives in the "…" menu.
    const openMenu = () => fireEvent.click(document.getElementById('dropdown-menu-align-right'))

    openMenu()
    fireEvent.click(screen.getByText('Disconnect'))
    expect(handleDisconnectBusiness).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Disconnect Square POS Integration from this store?')

    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))
    expect(handleDisconnectBusiness).not.toHaveBeenCalled()

    openMenu()
    fireEvent.click(screen.getByText('Disconnect'))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Disconnect' }))
    expect(handleDisconnectBusiness).toHaveBeenCalledWith(430, expect.any(Function))
  })
})

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'
import checkmateLogo from '~/assets/images/ItsaCheckmateLogo.png'
import deliverectLogo from '~/assets/images/deliverect.png'
import { POS_SETUP_CALL_URL } from '../../../../utils/connectAccess'

const state = vi.hoisted(() => ({ level: 2 }))

// The URL of the plugin page the setup modal loaded.
const pluginPageUrl = () => document.querySelector('iframe')?.getAttribute('src') ?? null

vi.mock('~components', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useApi: () => [{ project: 'kosherkav' }],
  useConfig: () => [{ configs: {} }],
  useSession: () => [{ user: { level: state.level } }],
  useToast: () => [null, { showToast: vi.fn() }],
  ToastType: { Error: 'error' },
  useUtils: () => [{ parseDate: (date) => date }]
}))
vi.mock('posthog-js/react', () => ({
  useActiveFeatureFlags: () => []
}))
vi.mock('~ui', () => ({
  Confirm: ({ open, content, onAccept }) => open
    ? (
      <div role='dialog'>
        <p>{content}</p>
        <button onClick={onAccept}>Accept</button>
      </div>
      )
    : null,
  Alert: () => null,
  Modal: ({ open, children }) => open ? <div>{children}</div> : null,
  useWindowSize: () => ({ width: 1200 })
}))

import { BusinessSummary } from '../index'

const renderSummary = (overrides = {}) => {
  const props = {
    businessState: { loading: false, business: { name: 'Test Store', third_party_integrations: [] } },
    integrationsList: { thirdPartyIntegrations: [] },
    formState: { changes: {} },
    handleInstallPosIntegration: vi.fn(async () => ({ installed: false, integration: null })),
    handleConnectBusiness: vi.fn(),
    handleSelectIntegration: vi.fn(),
    handleSelectedItem: vi.fn(),
    ...overrides
  }
  renderWithProviders(<BusinessSummary {...props} />, {
    theme: { ...theme, images: { general: { ItsaCheckmateLogo: checkmateLogo, deliverect: deliverectLogo } } }
  })
  return props
}

describe('POS setup calls', () => {
  beforeEach(() => {
    state.level = 2
  })

  it('shows both booking links with existing logos for admins', () => {
    state.level = 0
    const props = renderSummary()
    expect(screen.getByRole('img', { name: 'Checkmate' })).toHaveAttribute('src', checkmateLogo)
    expect(screen.getByRole('img', { name: 'Deliverect' })).toHaveAttribute('src', deliverectLogo)
    const links = [
      screen.getByRole('link', { name: 'Connect Checkmate' }),
      screen.getByRole('link', { name: 'Connect Deliverect' })
    ]
    expect(links).toHaveLength(2)
    links.forEach(link => {
      expect(link).toHaveAttribute('href', POS_SETUP_CALL_URL)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      fireEvent.click(link)
    })
    expect(props.handleInstallPosIntegration).not.toHaveBeenCalled()
    expect(props.handleConnectBusiness).not.toHaveBeenCalled()
    expect(props.handleSelectIntegration).not.toHaveBeenCalled()
    expect(document.querySelector('iframe')).toBeNull()
  })

  it.each([2, undefined, 1])('shows only disabled Contact admin buttons for non-admin level %s', (level) => {
    state.level = level
    const props = renderSummary()
    expect(screen.getByRole('img', { name: 'Checkmate' })).toHaveAttribute('src', checkmateLogo)
    expect(screen.getByRole('img', { name: 'Deliverect' })).toHaveAttribute('src', deliverectLogo)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    const buttons = screen.getAllByRole('button', { name: 'Contact admin' })
    expect(buttons).toHaveLength(2)
    buttons.forEach(button => {
      expect(button).toBeDisabled()
      expect(button).not.toHaveAttribute('href')
      fireEvent.click(button)
    })
    expect(props.handleInstallPosIntegration).not.toHaveBeenCalled()
    expect(props.handleConnectBusiness).not.toHaveBeenCalled()
    expect(props.handleSelectIntegration).not.toHaveBeenCalled()
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('replaces API-provided Checkmate and Deliverect setup entries without duplicates', () => {
    renderSummary({
      integrationsList: {
        thirdPartyIntegrations: [
          { id: 1, name: 'ItsaCheckmate', plugin_id: 1 },
          { id: 2, name: 'Deliverect POS', plugin_root: 'deliverect_plugin', plugin_id: 2 }
        ]
      },
      businessState: { business: { third_party_integrations: [{ third_party_integration_id: 1, setup_status: 'success' }, { third_party_integration_id: 2, setup_status: 'success' }] } }
    })
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Contact admin' })).toHaveLength(2)
    expect(screen.queryByText('ItsaCheckmate')).not.toBeInTheDocument()
    expect(screen.queryByText('Deliverect POS')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Setup' })).not.toBeInTheDocument()
  })

  it('does not add or replace integrations in Sales Channels', () => {
    const props = renderSummary({ fromSalesChannels: true, integrationsList: { thirdPartyIntegrations: [{ id: 2, name: 'Deliverect', plugin_id: 2 }] } })
    expect(screen.queryByRole('link', { name: /Connect (Checkmate|Deliverect)/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Checkmate')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }))
    expect(props.handleConnectBusiness).toHaveBeenCalledWith(2, { enabled: true }, expect.any(Function))
  })
})

describe('POS integration actions', () => {
  it.each([
    { plugin_id: 9, plugin: { root: 'https://calendly.com', setup_url: '/pos/meet' } },
    { plugin_id: 9, plugin: { root: 'https://plugin.test', links: { setup: 'https://calendly.com/pos/meet' } } },
    { plugin_id: null, plugin_root: 'https://calendly.com/pos/meet' }
  ])('restricts other POS with Calendly setup metadata: %j', (metadata) => {
    state.level = 2
    const props = renderSummary({
      integrationsList: { thirdPartyIntegrations: [{ id: 9, name: 'Other POS', ...metadata }] },
      businessState: { business: { third_party_integrations: metadata.plugin_id ? [{ third_party_integration_id: 9, setup_status: 'success' }] : [] } }
    })
    const row = within(screen.getByText('Other POS').closest('.connect-pos-wrapper'))
    const button = row.getByRole('button', { name: 'Contact admin' })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(document.querySelector('iframe')).toBeNull()
    expect(props.handleInstallPosIntegration).not.toHaveBeenCalled()
    expect(props.handleConnectBusiness).not.toHaveBeenCalled()
  })

  it('preserves the admin setup action for other Calendly POS', async () => {
    state.level = 0
    renderSummary({
      integrationsList: { thirdPartyIntegrations: [{ id: 9, name: 'Other POS', plugin_id: 9, plugin: { root: 'https://calendly.com', setup_url: '/pos/meet' } }] },
      businessState: { business: { third_party_integrations: [{ third_party_integration_id: 9, setup_status: 'success' }] } }
    })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Setup' })))
    expect(pluginPageUrl()).toBe('https://calendly.com/pos/meet')
  })

  const integrationsList = {
    thirdPartyIntegrations: [
      { id: 3, name: 'Install POS', plugin_root: 'install-root' },
      { id: 4, name: 'Connect POS', plugin_id: 4 },
      { id: 5, name: 'Setup POS', plugin_id: 5, plugin: { setup_url: 'https://example.com/setup', root: 'existing', name: 'Existing' } }
    ]
  }
  const businessState = { business: { third_party_integrations: [{ third_party_integration_id: 5, setup_status: 'success' }] } }

  it('gives an admin Install, Connect and Setup and never shows Contact Us', async () => {
    state.level = 0
    const props = renderSummary({ integrationsList, businessState })
    expect(screen.queryByText('Contact Us')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Contact administrator' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Install' }))
    expect(props.handleInstallPosIntegration).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toHaveTextContent('This installs Install POS for the whole project and connects it to this store.')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Accept' })))
    expect(props.handleInstallPosIntegration).toHaveBeenCalledWith(expect.objectContaining({ id: 3, plugin_root: 'install-root' }))
    // One POS per store: Setup POS is connected, so Connect POS cannot connect.
    const connectOther = within(screen.getByText('Connect POS').closest('.connect-pos-wrapper')).getByRole('button', { name: 'Connect' })
    expect(connectOther).toBeDisabled()
    fireEvent.click(connectOther)
    expect(props.handleConnectBusiness).not.toHaveBeenCalled()
    expect(screen.getByText('This store already uses Setup POS. Disconnect it to switch POS.')).toBeInTheDocument()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Setup' })))
    expect(pluginPageUrl()).toBe('https://example.com/setup')
  })

  it('installs a catalog POS, connects it to the store and opens its panel in one flow', async () => {
    state.level = 0
    const installed = { id: 430, key: 'square_pos_integration', name: 'Square', plugin_id: 2477, plugin: { root: 'https://square.test' } }
    const updateBusiness = vi.fn()
    const handleInstallPosIntegration = vi.fn(async () => ({ installed: true, integration: installed }))
    const handleConnectBusiness = vi.fn((id, data, callback) => callback())
    const catalogSquare = { id: 'catalog:square_pos_integration', key: 'square_pos_integration', name: 'Square', plugin_id: null, plugin_root: 'https://square.test', source: 'catalog' }
    renderSummary({
      integrationsList: { thirdPartyIntegrations: [catalogSquare] },
      updateBusiness,
      handleInstallPosIntegration,
      handleConnectBusiness
    })

    fireEvent.click(screen.getByRole('button', { name: 'Install' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('This installs Square for the whole project and connects it to this store.')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Accept' })))

    expect(handleInstallPosIntegration).toHaveBeenCalledWith(catalogSquare)
    expect(handleConnectBusiness).toHaveBeenCalledWith(430, { enabled: true }, expect.any(Function))
    expect(updateBusiness).toHaveBeenCalled()
  })

  it('does not connect the store when the install fails or is still finishing', async () => {
    state.level = 0
    const handleConnectBusiness = vi.fn()
    const handleInstallPosIntegration = vi.fn()
      .mockResolvedValueOnce({ installed: false, integration: null })
      .mockResolvedValueOnce({ installed: true, integration: null })
    renderSummary({
      integrationsList: { thirdPartyIntegrations: [{ id: 3, key: 'clover_integration', name: 'Clover', plugin_root: 'https://clover.test' }] },
      handleInstallPosIntegration,
      handleConnectBusiness
    })

    for (let attempt = 0; attempt < 2; attempt++) {
      fireEvent.click(screen.getByRole('button', { name: 'Install' }))
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Accept' })))
    }

    expect(handleInstallPosIntegration).toHaveBeenCalledTimes(2)
    expect(handleConnectBusiness).not.toHaveBeenCalled()
  })

  it('only installs when the store is already connected to another POS', async () => {
    state.level = 0
    const handleInstallPosIntegration = vi.fn(async () => ({ installed: true, integration: { id: 430, plugin_id: 2477 } }))
    const handleConnectBusiness = vi.fn()
    const square = { id: 'catalog:square_pos_integration', key: 'square_pos_integration', name: 'Square', type: 'pos', plugin_id: null, plugin_root: 'https://square.test' }
    renderSummary({
      integrationsList: { thirdPartyIntegrations: [{ id: 133, key: 'simphony_integration', name: 'Simphony', type: 'pos', plugin_id: 1 }, square] },
      businessState: { business: { third_party_integrations: [{ third_party_integration_id: 133, setup_status: 'success' }] } },
      handleInstallPosIntegration,
      handleConnectBusiness
    })

    fireEvent.click(screen.getByRole('button', { name: 'Install' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('This installs Square for the whole project. This store stays connected to Simphony.')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Accept' })))

    expect(handleInstallPosIntegration).toHaveBeenCalledWith(square)
    expect(handleConnectBusiness).not.toHaveBeenCalled()
  })

  it('still connects sales channels after installing even if the store has a POS', async () => {
    state.level = 0
    const channel = { id: 67, key: 'rappi_integration', name: 'Rappi', type: 'sales_channel', plugin_id: null, plugin_root: 'https://rappi.test' }
    const handleInstallPosIntegration = vi.fn(async () => ({ installed: true, integration: { ...channel, plugin_id: 9 } }))
    const handleConnectBusiness = vi.fn()
    renderSummary({
      fromSalesChannels: true,
      integrationsList: { thirdPartyIntegrations: [channel] },
      businessState: { business: { third_party_integrations: [{ third_party_integration_id: 133, setup_status: 'success' }] } },
      handleInstallPosIntegration,
      handleConnectBusiness
    })

    fireEvent.click(screen.getByRole('button', { name: 'Install' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('This installs Rappi for the whole project and connects it to this store.')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Accept' })))

    expect(handleConnectBusiness).toHaveBeenCalledWith(67, { enabled: true }, expect.any(Function))
  })

  it('shows Installing on the POS being installed and blocks the other buttons', () => {
    state.level = 0
    renderSummary({
      integrationsList: {
        thirdPartyIntegrations: [
          { id: 3, key: 'square_pos_integration', name: 'Square', plugin_root: 'https://square.test' },
          { id: 4, key: 'clover_integration', name: 'Clover', plugin_root: 'https://clover.test' }
        ]
      },
      installingPluginRoot: 'https://square.test'
    })

    expect(screen.getByRole('button', { name: 'Installing...' })).toBeDisabled()
    expect(within(screen.getByText('Clover').closest('.connect-pos-wrapper')).getByRole('button', { name: 'Install' })).toBeDisabled()
  })

  it.each([0, 2])('preserves non-Calendly links.setup for level %s', async (level) => {
    state.level = level
    renderSummary({
      integrationsList: { thirdPartyIntegrations: [{ id: 298, name: 'Wansoft', plugin_id: 1717, plugin: { root: 'https://wansoft.test', setup_url: null, links: { setup: '/views/setup?b=1' } } }] },
      businessState: { business: { third_party_integrations: [{ third_party_integration_id: 298, setup_status: 'success' }] } }
    })

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Setup' })))
    expect(pluginPageUrl()).toBe('https://wansoft.test/views/setup?b=1')
  })

  it('connects a POS when the store has none', () => {
    state.level = 0
    const props = renderSummary({ integrationsList, businessState: { business: { third_party_integrations: [] } } })

    expect(screen.queryByText(/already uses/)).not.toBeInTheDocument()
    fireEvent.click(within(screen.getByText('Connect POS').closest('.connect-pos-wrapper')).getByRole('button', { name: 'Connect' }))
    expect(props.handleConnectBusiness).toHaveBeenCalledWith(4, { enabled: true }, expect.any(Function))
  })

  it('does not limit sales channels to one', () => {
    state.level = 0
    const props = renderSummary({
      fromSalesChannels: true,
      integrationsList: { thirdPartyIntegrations: [{ id: 7, name: 'Rappi', plugin_id: 7 }, { id: 8, name: 'Uber Eats', plugin_id: 8 }] },
      businessState: { business: { third_party_integrations: [{ third_party_integration_id: 7, setup_status: 'success' }] } }
    })

    fireEvent.click(within(screen.getByText('Uber Eats').closest('.connect-pos-wrapper')).getByRole('button', { name: 'Connect' }))
    expect(props.handleConnectBusiness).toHaveBeenCalledWith(8, { enabled: true }, expect.any(Function))
  })

  it('lets a business owner Connect and Setup but asks the administrator to install missing plugins', async () => {
    state.level = 2
    const props = renderSummary({ integrationsList, businessState })
    expect(screen.queryByText('Contact Us')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument()
    const contactAdmin = within(screen.getByText('Install POS').closest('.connect-pos-wrapper')).getByRole('button', { name: 'Contact administrator' })
    expect(contactAdmin).toBeDisabled()
    fireEvent.click(contactAdmin)
    expect(props.handleInstallPosIntegration).not.toHaveBeenCalled()
    // One POS per store: Setup POS is connected, so Connect POS cannot connect.
    const connectOther = within(screen.getByText('Connect POS').closest('.connect-pos-wrapper')).getByRole('button', { name: 'Connect' })
    expect(connectOther).toBeDisabled()
    fireEvent.click(connectOther)
    expect(props.handleConnectBusiness).not.toHaveBeenCalled()
    expect(screen.getByText('This store already uses Setup POS. Disconnect it to switch POS.')).toBeInTheDocument()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Setup' })))
    expect(pluginPageUrl()).toBe('https://example.com/setup')
  })
})

describe('Connected POS first', () => {
  const clover = { id: 9, name: 'Clover', plugin_id: 9, plugin: { root: 'https://clover.test', setup_url: '/setup' } }
  const square = { id: 16, name: 'Square', plugin_id: 16, plugin: { root: 'https://square.test', setup_url: '/setup' } }

  beforeEach(() => {
    state.level = 0
  })

  it('lists the connected POS with its state above the ones the store can connect', () => {
    renderSummary({
      integrationsList: { thirdPartyIntegrations: [square, clover] },
      businessState: { business: { third_party_integrations: [{ third_party_integration_id: 9, setup_status: 'success' }] } }
    })

    const [connected, available] = screen.getAllByText(/^(Connected|Available POS)$/, { selector: 'p.section-title' })
    expect(connected).toHaveTextContent('Connected')
    expect(available).toHaveTextContent('Available POS')
    expect(connected.compareDocumentPosition(screen.getByText('Clover')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('Clover').compareDocumentPosition(available) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(screen.getByText('Square').closest('.connect-pos-wrapper')).getByRole('button', { name: 'Connect' })).toBeInTheDocument()
  })

  it.each([
    ['failed', 'Needs attention', 'Reconnect'],
    [null, 'Setup pending', 'Continue setup']
  ])('offers the setup again for a %s connection', async (setupStatus, label, action) => {
    renderSummary({
      integrationsList: { thirdPartyIntegrations: [clover] },
      businessState: { business: { third_party_integrations: [{ third_party_integration_id: 9, setup_status: setupStatus }] } }
    })

    expect(screen.getByText(label)).toBeInTheDocument()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: action })))
    expect(pluginPageUrl()).toBe('https://clover.test/setup')
  })
})

describe('Connected section while the detail is open', () => {
  const rappi = { id: 3, name: 'Rappi', plugin_id: 3, plugin: { root: 'https://rappi.test', setup_url: '/setup' } }
  const uberEats = { id: 4, name: 'Uber Eats', plugin_id: 4, plugin: { root: 'https://uber-eats.test', setup_url: '/setup' } }
  const props = {
    fromSalesChannels: true,
    integrationsList: { thirdPartyIntegrations: [rappi, uberEats] },
    businessState: {
      business: {
        third_party_integrations: [
          { third_party_integration_id: 3, setup_status: null },
          { third_party_integration_id: 4, setup_status: null }
        ]
      }
    }
  }
  const rowOf = (name) => screen.getByText(name).closest('.connect-pos-wrapper')

  it('keeps every connected integration listed and marks the one whose detail is open', () => {
    state.level = 0
    renderSummary({ ...props, extraOpen: true, selectedItem: 'integration', selectedIntegration: uberEats })

    expect(screen.getByText('Connected', { selector: 'p.section-title' })).toBeInTheDocument()
    expect(rowOf('Uber Eats')).toHaveAttribute('aria-current', 'true')
    expect(rowOf('Rappi')).not.toHaveAttribute('aria-current')
    expect(screen.getAllByRole('button', { name: 'Continue setup' })).toHaveLength(2)
  })

  it('marks no row when no detail is open', () => {
    state.level = 0
    renderSummary({ ...props, extraOpen: false, selectedItem: null, selectedIntegration: uberEats })

    expect(screen.getByText('Connected', { selector: 'p.section-title' })).toBeInTheDocument()
    expect(rowOf('Uber Eats')).not.toHaveAttribute('aria-current')
    expect(rowOf('Rappi')).not.toHaveAttribute('aria-current')
  })
})

describe('Setup of the connected POS', () => {
  const clover = { id: 9, name: 'Clover', plugin_id: 9, plugin: { root: 'https://clover.test', setup_url: '/setup', links: {} } }
  const connected = { business: { third_party_integrations: [{ third_party_integration_id: 9, setup_status: 'success' }] } }

  it('offers Setup when the plugin is enabled and has a setup page', () => {
    state.level = 0
    renderSummary({ integrationsList: { thirdPartyIntegrations: [clover] }, businessState: connected })

    expect(within(screen.getByText('Clover').closest('.connect-pos-wrapper')).getByRole('button', { name: 'Setup' })).toBeInTheDocument()
  })

  it('offers no setup when the plugin is disabled', () => {
    state.level = 0
    renderSummary({
      integrationsList: { thirdPartyIntegrations: [{ ...clover, plugin: { ...clover.plugin, enabled: false } }] },
      businessState: connected
    })

    expect(within(screen.getByText('Clover').closest('.connect-pos-wrapper')).queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('Installed integration whose plugin is disabled', () => {
  const disabledPos = { id: 4, name: 'Disabled POS', plugin_id: 4, plugin: { root: 'https://pos.test', enabled: false } }
  const enabledPos = { id: 5, name: 'Enabled POS', plugin_id: 5, plugin: { root: 'https://pos2.test', enabled: true } }
  const notInstalled = { id: 6, name: 'New POS', plugin_root: 'https://new.test' }
  const noPos = { business: { third_party_integrations: [] } }

  it('cannot be connected and says why, while the others work as before', () => {
    state.level = 0
    const props = renderSummary({ integrationsList: { thirdPartyIntegrations: [disabledPos, enabledPos, notInstalled] }, businessState: noPos })

    const disabledRow = within(screen.getByText('Disabled POS').closest('.connect-pos-wrapper'))
    expect(disabledRow.getByText('Plugin disabled')).toBeInTheDocument()
    expect(disabledRow.getByRole('button', { name: 'Connect' })).toBeDisabled()

    fireEvent.click(within(screen.getByText('Enabled POS').closest('.connect-pos-wrapper')).getByRole('button', { name: 'Connect' }))
    expect(props.handleConnectBusiness).toHaveBeenCalledWith(5, { enabled: true }, expect.any(Function))
    expect(within(screen.getByText('New POS').closest('.connect-pos-wrapper')).getByRole('button', { name: 'Install' })).toBeEnabled()
  })

  it('applies to sales channels too', () => {
    state.level = 0
    renderSummary({
      fromSalesChannels: true,
      integrationsList: { thirdPartyIntegrations: [{ ...disabledPos, name: 'Disabled channel' }] },
      businessState: noPos
    })

    const row = within(screen.getByText('Disabled channel').closest('.connect-pos-wrapper'))
    expect(row.getByText('Plugin disabled')).toBeInTheDocument()
    expect(row.getByRole('button', { name: 'Connect' })).toBeDisabled()
  })
})

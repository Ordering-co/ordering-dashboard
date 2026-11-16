// (the four developer cards are real buttons, and the focus enters the panel and comes back to its card) and
// (the panel content leaves room for the 44px expand and close buttons of the SideBar).
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, defaultTheme } from '~/__tests__/helpers/testUtils'

const runtime = vi.hoisted(() => ({ width: 1440 }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: 0 } }]
}))

vi.mock('../../../../../../components/McpTokens', () => ({ MCP_ALLOWED_LEVELS: [0, 2] }))

vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: vi.fn() }]
}))

vi.mock('../../../../hooks/useWindowSize', () => ({
  useWindowSize: () => ({ width: runtime.width, height: 900 })
}))

vi.mock('../../../../../../utils/settingsRedirects', () => ({
  buildSettingsPath: ({ group, category, id }) => `/settings?group=${group}&category=${category}${id ? `&id=${id}` : ''}`
}))

vi.mock('../../../Shared', async () => ({
  SideBar: (await vi.importActual('../../../Shared/UI/SideBar')).SideBar,
  Modal: () => null
}))

vi.mock('react-hubspot-form', () => ({ default: () => null }))

vi.mock('../../PluginList', () => ({ PluginList: () => <div data-testid='plugin-list'><h1>Plugins</h1><button type='button'>Add plugin</button></div> }))
vi.mock('../../WebhookList', () => ({ WebhookList: () => <div data-testid='webhook-list'><h1>Webhooks</h1><button type='button'>Add webhook</button></div> }))
vi.mock('../../ApiKeysList', () => ({ ApiKeysList: () => <div data-testid='api-keys-list'><h1>Api Keys</h1><button type='button'>Add API Key</button></div> }))
vi.mock('../../McpTokens', () => ({ McpTokens: () => <div data-testid='mcp-tokens'><h1>MCP (Claude Code &amp; Codex)</h1></div> }))
vi.mock('../../DoordashConnect', () => ({ DoordashConnect: () => null }))
vi.mock('../../LalaMoveConnect', () => ({ LalaMoveConnect: () => null }))
vi.mock('../../Deliverect', () => ({ Deliverect: () => null }))
vi.mock('../../ItsaCheckmate', () => ({ ItsaCheckmate: () => null }))
vi.mock('../../PickerExpress', () => ({ PickerExpress: () => null }))
vi.mock('../PaymentGateway', () => ({ PaymentGateway: () => null }))
vi.mock('../Analytics', () => ({ Analytics: () => null }))

import { IntegrationListing } from '../index'

const theme = { ...defaultTheme, colors: { ...defaultTheme.colors, secundary: '#f8f9fa' }, images: { general: {} } }

const render = () => renderWithProviders(<IntegrationListing avoidExpand />, {
  theme,
  initialEntries: ['/settings?group=developers&category=developers']
})

const CARDS = ['Plugins', 'Webhooks', 'Api Keys', 'MCP (Claude Code & Codex)']

describe('IntegrationListing developer cards', () => {
  afterEach(() => {
    runtime.width = 1440
  })

  it('makes each card a native button that Tab reaches', async () => {
    const user = userEvent.setup()
    render()

    CARDS.forEach(name => expect(screen.getByRole('button', { name })).toBeInTheDocument())

    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Plugins' }))
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Webhooks' }))
  })

  it('opens a panel with Enter and with Space', async () => {
    const user = userEvent.setup()
    render()

    screen.getByRole('button', { name: 'Webhooks' }).focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByTestId('webhook-list')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByTestId('webhook-list')).not.toBeInTheDocument())

    screen.getByRole('button', { name: 'Api Keys' }).focus()
    await user.keyboard(' ')
    expect(await screen.findByTestId('api-keys-list')).toBeInTheDocument()
  })

  it('moves the focus into the panel when it opens and back to its card when it closes', async () => {
    const user = userEvent.setup()
    render()

    const card = screen.getByRole('button', { name: 'Plugins' })
    card.focus()
    await user.keyboard('{Enter}')

    const panel = await screen.findByTestId('plugin-list')
    await waitFor(() => expect(document.activeElement).not.toBe(document.body))
    expect(panel.closest('#plugins-integrations').contains(document.activeElement)).toBe(true)
    expect(document.activeElement).toBe(within(panel).getByRole('heading', { name: 'Plugins' }))

    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByTestId('plugin-list')).not.toBeInTheDocument())
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Plugins' }))
  })

  it('also returns the focus to the card when Escape closes the panel', async () => {
    const user = userEvent.setup()
    render()

    screen.getByRole('button', { name: 'Api Keys' }).focus()
    await user.keyboard('{Enter}')
    await screen.findByTestId('api-keys-list')

    fireEvent.keyDown(document, { code: 'Escape', key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('api-keys-list')).not.toBeInTheDocument())
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Api Keys' }))
  })
})

describe('IntegrationListing panels and the SideBar expand button', () => {
  afterEach(() => {
    runtime.width = 1440
  })

  // The SideBar puts a 44px close button and a 44px expand button over the panel's right edge (20px from it), so the
  // content ends 32px before it: the header actions of the lists (Add plugin, Add webhook, Add API Key) stay clear.
  it.each([
    ['Plugins', 'plugin-list'],
    ['Webhooks', 'webhook-list'],
    ['Api Keys', 'api-keys-list']
  ])('%s leaves room for the expand button at desktop width', async (name, testId) => {
    render()

    fireEvent.click(screen.getByRole('button', { name }))
    const content = (await screen.findByTestId(testId)).parentElement

    expect(getComputedStyle(content).paddingRight).toBe('32px')
  })

  // review of batch S: the panel content may shrink below the wide Webhooks table, which scrolls in its own region, and
  // focusing the title does not scroll the panel sideways
  it('lets the panel content shrink and focuses the title without scrolling', async () => {
    runtime.width = 400
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    render()

    fireEvent.click(screen.getByRole('button', { name: 'Webhooks' }))
    const content = (await screen.findByTestId('webhook-list')).parentElement

    expect(getComputedStyle(content).minWidth).toBe('0')
    await waitFor(() => expect(focus.mock.calls.some(([options]) => options?.preventScroll === true)).toBe(true))
    focus.mockRestore()
  })

  // (overlap sweep): on a phone the expand button is not drawn, but the close button still is, 20 to 64px from the
  // edge; the lists end their header 55px from it, so «Add plugin», «Add webhook» and «Add API Key» ran 9px under it
  it.each([
    ['Plugins', 'plugin-list'],
    ['Webhooks', 'webhook-list'],
    ['Api Keys', 'api-keys-list']
  ])('%s leaves room for the close button only on a phone', async (name, testId) => {
    runtime.width = 400
    render()

    fireEvent.click(screen.getByRole('button', { name }))
    const content = (await screen.findByTestId(testId)).parentElement

    expect(screen.queryByRole('button', { name: 'Click to expand' })).not.toBeInTheDocument()
    expect(getComputedStyle(content).paddingRight).toBe('16px')
  })

  // (overlap sweep): the MCP header keeps 65px for the close button only; from 577px the expand button is drawn too
  // and sat over the end of its description at 912, 1280 and 1440. There it takes the same room as the other three panels; on a
  // phone its 65px already clear the close button, so nothing more (review of AH)
  it('the MCP panel leaves room for the expand button at desktop width', async () => {
    render()

    fireEvent.click(screen.getByRole('button', { name: 'MCP (Claude Code & Codex)' }))
    const content = (await screen.findByTestId('mcp-tokens')).parentElement

    expect(getComputedStyle(content).paddingRight).toBe('32px')
  })

  it('the MCP panel takes no extra room on a phone', async () => {
    runtime.width = 400
    render()

    fireEvent.click(screen.getByRole('button', { name: 'MCP (Claude Code & Codex)' }))
    const content = (await screen.findByTestId('mcp-tokens')).parentElement

    expect(['16px', '32px']).not.toContain(getComputedStyle(content).paddingRight)
  })
})

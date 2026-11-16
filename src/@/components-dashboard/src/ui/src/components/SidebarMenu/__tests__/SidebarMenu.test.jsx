// redesign 5.1 copy: labels in sentence case (C14), approved with the catalog sync on 2026-10-06.
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import labels from '../../../../../components/SourceCodeDownloads/sourceCodeTranslations.generated.json'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const state = vi.hoisted(() => ({
  sessionState: {},
  configs: {},
  project: 'orderingplus',
  configurations: { subdomain: 'orderingplus' },
  projectStatus: { websiteProduct: 'web_marketplace_26' },
  sites: [],
  sitesLoading: false,
  emit: vi.fn(),
  handleMenuCollapse: vi.fn(),
  assistant: { isAvailable: false, isOpen: false, setOpen: vi.fn() },
  language: { code: 'en' },
  apiLabels: {},
  aiModuleEnabled: null,
  getAiAgentsCode: vi.fn()
}))

vi.mock('../../../../../index', async () => {
  const React = await import('react')

  return {
    SidebarMenu: ({ UIComponent, ...props }) => React.createElement(UIComponent, {
      ...props,
      productsState: { loading: false, error: null, apps: [] },
      getBillingToken: vi.fn(),
      billingUrl: 'https://billing.example.com',
      setShowBillingPayment: vi.fn(),
      aiModuleEnabled: state.aiModuleEnabled,
      getAiAgentsCode: state.getAiAgentsCode
    }),
    // redesign 5.1: Logout is the LogoutAction controller painted as an account-menu item
    LogoutAction: ({ UIComponent, ...props }) => React.createElement(UIComponent, { ...props, handleLogoutClick: vi.fn() }),
    useApi: () => [{ root: 'https://api.example.com', project: state.project }, { configurations: state.configurations }],
    useConfig: () => [{ configs: state.configs }],
    useEvent: () => [{ emit: state.emit }],
    useLanguage: () => [{ language: state.language }, (key, fallback) => state.apiLabels[`DASHBOARD_${key}`] ?? state.apiLabels[key] ?? fallback],
    useSession: () => [state.sessionState],
    useSite: () => [{ sites: state.sites, loading: state.sitesLoading }],
    useAssistantDock: () => state.assistant
  }
})

vi.mock('../../../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.example.com', project: state.project }]
}))
vi.mock('../../../../../contexts/SessionContext', () => ({
  useSession: () => [state.sessionState]
}))

vi.mock('../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: state.handleMenuCollapse }]
}))

vi.mock('../../../contexts/ProjectContext', () => ({
  useProjectState: () => [state.projectStatus]
}))

vi.mock('../../../hooks/useWindowSize', () => ({
  useWindowSize: () => ({ width: 1280, height: 800 })
}))

vi.mock('../../Shared/UI/LanguageSelector', () => ({
  LanguageSelector: () => <button type='button'>Language selector</button>
}))

vi.mock('../../AiAgentsUpgradeModal', () => ({
  AiAgentsUpgradeModal: ({ open, onClose, formUrl, variant }) => open
    ? (
      <div role='dialog' aria-label={variant === 'legacy-plan' ? 'Request an upgrade' : 'Upgrade to use AI Agents'}>
        <a href={formUrl}>Upgrade form</a>
        <button type='button' onClick={onClose}>Close upgrade</button>
      </div>
      )
    : null
}))

import { SidebarMenu } from '../index'
import { LegacyPlanUpgradeProvider } from '../../../contexts/LegacyPlanUpgradeContext'

const UpgradeSidebar = () => <LegacyPlanUpgradeProvider><SidebarMenu /></LegacyPlanUpgradeProvider>
const renderSidebar = () => renderWithProviders(<UpgradeSidebar />)
// the tab opens blank in the click and goes to ai.ordering.co once the one-time code arrives
const blankTab = () => {
  const tab = { opener: window, location: { replace: vi.fn() }, close: vi.fn() }
  return { tab, open: vi.spyOn(window, 'open').mockImplementation(() => tab) }
}
const UPGRADE_FORM_URL = 'https://forms.example.test/upgrade'
const AI_AGENTS_CODE_URL = 'https://ai.ordering.co/?session_code=one-time-code&project=orderingplus'
const RouterProbe = () => <output data-testid='current-path'>{useLocation().pathname}</output>

// redesign 5.1: profile, downloads, ideas, help, language and logout live in the account menu; open it to reach them
const openAccount = async () => {
  await userEvent.click(screen.getByRole('button', { name: /^Account:/ }))
  return screen.findByRole('dialog')
}
const accountLabels = dialog => within(dialog).getAllByRole('link').map(link => link.querySelector('span').textContent)

describe('SidebarMenu external resources', () => {
  afterEach(() => vi.unstubAllEnvs())

  beforeEach(() => {
    state.sessionState = {}
    state.configs = {}
    state.project = 'orderingplus'
    state.configurations = { subdomain: 'orderingplus' }
    state.projectStatus = { websiteProduct: 'web_marketplace_26' }
    state.sites = []
    state.sitesLoading = false
    state.emit.mockClear()
    state.assistant = { isAvailable: false, isOpen: false, setOpen: vi.fn() }
    state.language = { code: 'en' }
    state.apiLabels = {}
    state.aiModuleEnabled = null
    state.getAiAgentsCode = vi.fn().mockResolvedValue('one-time-code')
  })

  it.each([
    [
      'web_franchises_x',
      'https://shop.franchise.example.com',
      'https://orderingplus.franchises.orderingplus.com'
    ],
    [
      'web_marketplace_26',
      'https://shop.marketplace.example.com',
      'https://v26-orderingplus.orderingplus.com'
    ]
  ])('uses the subscribed %s website for external links', async (websiteProduct, liveUrl, temporaryUrl) => {
    state.sessionState = { user: { level: 0 } }
    state.projectStatus = { websiteProduct }
    state.sites = [
      {
        type: 'franchiseweb',
        domain: 'shop.franchise.example.com',
        temporal_domain: 'orderingplus.franchises.orderingplus.com',
        ssl_process_status: 'ended'
      },
      {
        type: 'web_marketplace_26',
        domain: 'shop.marketplace.example.com',
        temporal_domain: 'orderingplus.orderingplus.com',
        ssl_process_status: 'ended'
      }
    ]
    renderSidebar()

    await userEvent.click(screen.getByRole('button', { name: 'My website' }))

    expect(screen.getByRole('link', { name: 'Live website' })).toHaveAttribute('href', liveUrl)
    expect(screen.getByRole('link', { name: 'Temporary website' })).toHaveAttribute('href', temporaryUrl)
  })

  it('does not expose website links while the subscription product is unresolved', () => {
    state.sessionState = { user: { level: 0 } }
    state.projectStatus = { websiteProduct: null }
    state.sites = [
      { type: 'franchiseweb', domain: 'franchise.example.com', ssl_process_status: 'ended' },
      { type: 'web_marketplace_26', domain: 'marketplace.example.com', ssl_process_status: 'ended' }
    ]
    renderSidebar()

    expect(screen.getByRole('button', { name: 'My website' })).toBeDisabled()
    expect(screen.queryByRole('link', { name: 'Live website' })).not.toBeInTheDocument()
    expect(document.querySelector('[href*="franchise.example.com"], [href*="marketplace.example.com"]')).not.toBeInTheDocument()
  })

  it.each([
    // main: Open Source Code follows Free downloads for levels 0 and 2, read-only or not
    [{ level: 0 }, ['Profile', 'Free downloads', 'Open source code', 'Share ideas', 'Help']],
    [{ level: 0, user_system_id: 42 }, ['Profile', 'Free downloads', 'Open source code', 'Share ideas', 'Help']],
    [{ level: 0, readOnlyAdmin: true }, ['Profile', 'Free downloads', 'Open source code', 'Help']]
  ])('keeps Free downloads in the account menu, after Profile, for %j', async (user, labels) => {
    // redesign 5.1: Free downloads moved from the lower utility group of the nav to the account menu
    state.sessionState = { user }
    renderSidebar()
    const dialog = await openAccount()
    const link = within(dialog).getByRole('link', { name: 'Free downloads' })
    expect(accountLabels(dialog)).toEqual(labels)
    expect(screen.getByTestId('sidebar-scroll-content')).not.toContainElement(link)
  })

  it('navigates Free downloads internally and keeps its active state', async () => {
    state.sessionState = { user: { level: 0, user_system_id: 42 } }
    renderWithProviders(<SidebarMenu />, { initialEntries: ['/free-downloads'] })
    const dialog = await openAccount()
    const link = within(dialog).getByRole('link', { name: 'Free downloads' })
    expect(link).toHaveAttribute('href', '/free-downloads')
    // redesign 5.1: the active state is aria-current (btn-primary is gone)
    expect(link).toHaveAttribute('aria-current', 'page')
    await userEvent.click(link)
    expect(state.emit).toHaveBeenCalledWith('go_to_page', { page: 'free_products' })
  })

  // main on the new menu (C11): Open Source Code lives in the account menu, for levels 0 and 2 only.
  it.each([
    // main: only administrators
    { level: 0 }, { level: 0, readOnlyAdmin: true }
  ])('offers source code to eligible session role %j, regardless of editing privileges or system ID', async user => {
    state.sessionState = { user }
    renderWithProviders(<SidebarMenu />, { initialEntries: ['/open-source-code'] })
    const dialog = await openAccount()
    const link = within(dialog).getByRole('link', { name: 'Open source code' })
    expect(link).toHaveAttribute('href', '/open-source-code')
    // redesign 5.1: the active state is aria-current (btn-primary is gone)
    expect(link).toHaveAttribute('aria-current', 'page')
  })

  // main: business owners (level 2) no longer see it; «without a session» is its own test below
  it.each([{ level: 1 }, { level: 2 }, { level: 2, readOnlyBusinessOwner: true }, { level: 5 }, { level: 8 }, { level: '2' }])('hides the source link for ineligible session %j', async user => {
    state.sessionState = { user }
    renderSidebar()
    // open the account menu, or the absence proves nothing
    await openAccount()
    expect(screen.queryByRole('link', { name: 'Open source code' })).not.toBeInTheDocument()
  })

  it('hides the source link without a session', () => {
    state.sessionState = {}
    renderSidebar()
    expect(screen.queryByRole('link', { name: 'Open source code' })).not.toBeInTheDocument()
  })

  it('navigates the source link internally without sending a session token or download data to the event bus', async () => {
    state.sessionState = { user: { level: 0 }, token: 'controlled-token' }
    renderWithProviders(<><SidebarMenu /><RouterProbe /></>, { initialEntries: ['/orders'] })
    const dialog = await openAccount()
    await userEvent.click(within(dialog).getByRole('link', { name: 'Open source code' }))
    expect(screen.getByTestId('current-path')).toHaveTextContent('/open-source-code')
    expect(state.emit).not.toHaveBeenCalled()
    expect(document.querySelector('[href*="controlled-token"]')).toBeNull()
  })

  it.each(['es-MX', 'ar-SA'])('localizes only the new source link from the canonical %s subset', async code => {
    state.language = { code }
    state.sessionState = { user: { level: 0 } }
    renderSidebar()
    const dialog = await openAccount()
    expect(within(dialog).getByRole('link', { name: labels.SOURCE_CODE_PAGE_TITLE[code.split('-')[0]] })).toHaveAttribute('href', '/open-source-code')
    expect(within(dialog).getByRole('button', { name: 'Language selector' })).toBeInTheDocument()
  })

  // the Orders, Delivery, Marketing, Reports and Logs submenus print the catalog as it is: German nouns keep their capital
  it('keeps the capitals of a submenu label inside the text (de «Fahrer-Dashboard», «Zeitanzeige des Fahrers»)', async () => {
    state.language = { code: 'de' }
    state.apiLabels = { DRIVERS_TIME_DISPLAY: 'Zeitanzeige des Fahrers', DELIVERY_DASHBOARD: 'Lieferungs-Dashboard' }
    state.sessionState = { user: { level: 0 } }
    renderSidebar()
    await userEvent.click(screen.getByRole('button', { name: 'Delivery' }))
    expect(screen.getByRole('link', { name: 'Zeitanzeige des Fahrers' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Lieferungs-Dashboard' })).toBeInTheDocument()
  })

  it('in English keeps main\'s sentence case: «drivers time display» and the live «Delivery Groups» read as before', async () => {
    state.apiLabels = { DRIVERS_TIME_DISPLAY: 'drivers time display', DELIVERY_GROUPS: 'Delivery Groups' }
    state.sessionState = { user: { level: 0 } }
    renderSidebar()
    await userEvent.click(screen.getByRole('button', { name: 'Delivery' }))
    expect(screen.getByRole('link', { name: 'Drivers time display' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Delivery groups' })).toBeInTheDocument()
  })

  it('lets an existing source menu API label override the local fallback', async () => {
    state.language = { code: 'ar' }
    state.apiLabels = { DASHBOARD_SOURCE_CODE_PAGE_TITLE: 'Controlled API menu' }
    state.sessionState = { user: { level: 0 } }
    renderSidebar()
    const dialog = await openAccount()
    expect(within(dialog).getByRole('link', { name: 'Controlled API menu' })).toHaveAttribute('href', '/open-source-code')
  })

  // main on the new menu (C11): Builder sits in the Catalog group, after My products, with a «New» tag,
  // only for a Builder project (development, exampletenant) and level 0.
  it.each(['development', 'exampletenant'])('shows Builder to an administrator of the Builder project %s', async project => {
    state.project = project
    state.sessionState = { user: { level: 0 } }
    renderWithProviders(<SidebarMenu />, { initialEntries: ['/builder/12'] })
    const link = screen.getByRole('link', { name: /^Builder/ })
    expect(link).toHaveAttribute('href', '/builder')
    expect(link).toHaveAttribute('aria-current', 'page')
    expect(within(link).getByText('New')).toBeInTheDocument()
    // right after My products, in the same Catalog group
    expect(screen.getByRole('button', { name: 'My products' }).compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await userEvent.click(link)
    expect(state.emit).toHaveBeenCalledWith('go_to_page', { page: 'builder' })
  })

  // main: every project sees Builder at level 0; only the level and read-only hide it
  it.each([
    ['development', { level: 2 }],
    ['development', { level: 0, readOnlyAdmin: true }],
    ['development', undefined]
  ])('hides Builder for project %s and session %j', (project, user) => {
    state.project = project
    state.sessionState = { user }
    renderSidebar()
    expect(screen.queryByRole('link', { name: /^Builder/ })).not.toBeInTheDocument()
  })

  it.each([undefined, { level: 2, user_system_id: 42 }, { level: 5, user_system_id: 42 }])('preserves download menu eligibility for %j', async (user) => {
    state.sessionState = { user }
    renderSidebar()
    // redesign 5.1: open the account menu, or the absence proves nothing
    await openAccount()
    expect(screen.queryByRole('link', { name: 'Free downloads' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Free downloads' })).not.toBeInTheDocument()
  })

  it.each([undefined, null, 0])('shows Free downloads for admins with system ID %j without exposing billing or addons', async (systemId) => {
    state.sessionState = { user: { level: 0, user_system_id: systemId } }
    state.configs = { white_label_module: { value: true } }
    renderSidebar()
    const dialog = await openAccount()
    expect(within(dialog).getByRole('link', { name: 'Free downloads' })).toHaveAttribute('href', '/free-downloads')
    expect(screen.queryByRole('button', { name: 'Billing' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Apps & add-ons' })).not.toBeInTheDocument()
  })

  it.each([null, 42])('shows Free downloads to read-only admins with system ID %j without exposing editing resources', async (systemId) => {
    state.sessionState = { user: { level: 0, readOnlyAdmin: true, user_system_id: systemId } }
    renderSidebar()
    const dialog = await openAccount()
    expect(within(dialog).getByRole('link', { name: 'Free downloads' })).toHaveAttribute('href', '/free-downloads')
    expect(screen.queryByRole('button', { name: 'Billing' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Apps & add-ons' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
  })

  it('updates Free downloads visibility when the session resolves or changes role', async () => {
    const { rerender } = renderSidebar()
    // redesign 5.1: the account menu stays open across the session changes
    await openAccount()
    expect(screen.queryByRole('link', { name: 'Free downloads' })).not.toBeInTheDocument()
    state.sessionState = { user: { level: 0 } }
    rerender(<UpgradeSidebar />)
    expect(screen.getByRole('link', { name: 'Free downloads' })).toBeInTheDocument()
    state.sessionState = { user: { level: 0, readOnlyAdmin: true } }
    rerender(<UpgradeSidebar />)
    expect(screen.getByRole('link', { name: 'Free downloads' })).toBeInTheDocument()
    state.sessionState = { user: { level: 2 } }
    rerender(<UpgradeSidebar />)
    expect(screen.queryByRole('link', { name: 'Free downloads' })).not.toBeInTheDocument()
  })

  it('shows Share ideas in the account menu for a white-label administrator without a system user ID', async () => {
    // redesign 5.1: Share ideas moved from after Logs audit in the nav to the account menu; Logs audit stays in Platform
    state.configs = { white_label_module: { value: true } }
    state.sessionState = { user: { level: 0, name: 'Admin', lastname: 'User' } }
    const { rerender } = renderSidebar()

    const scrollContent = screen.getByTestId('sidebar-scroll-content')
    // main: Logs audit is a direct link to its only page, not a disclosure
    const logsAudit = within(screen.getByRole('group', { name: 'Platform' })).getByRole('link', { name: 'Logs audit' })
    expect(logsAudit).toHaveAttribute('href', '/settings/logs')
    expect(screen.queryByRole('link', { name: 'Settings logs' })).not.toBeInTheDocument()
    const dialog = await openAccount()
    const shareIdeas = within(dialog).getByRole('link', { name: 'Share ideas' })

    expect(scrollContent).not.toContainElement(shareIdeas)
    expect(shareIdeas).toHaveAttribute('href', 'https://tally.so/r/WO4pdJ')
    expect(shareIdeas).toHaveAttribute('target', '_blank')
    expect(shareIdeas).toHaveAttribute('rel', 'noopener noreferrer')
    expect(shareIdeas).toHaveAccessibleDescription('opens in a new tab')

    state.sessionState = { user: { level: 2, name: 'Owner', lastname: 'User' } }
    rerender(<UpgradeSidebar />)
    expect(screen.queryByRole('link', { name: 'Share ideas' })).not.toBeInTheDocument()

    state.sessionState = {}
    rerender(<UpgradeSidebar />)
    expect(screen.queryByRole('link', { name: 'Share ideas' })).not.toBeInTheDocument()
  })

  it.each([
    ['unresolved session', {}, {}],
    ['administrator with a system user ID', { level: 0, user_system_id: 42 }, {}],
    ['administrator without a system user ID', { level: 0 }, {}],
    ['white-label administrator with a system user ID', { level: 0, user_system_id: 42 }, { white_label_module: { value: true } }],
    ['business owner', { level: 2, user_system_id: 42 }, {}],
    ['white-label business owner', { level: 2, user_system_id: 42 }, { white_label_module: { value: true } }],
    ['delivery manager', { level: 5, user_system_id: 42 }, {}]
  ])('does not offer the retired community for %s', async (_scenario, user, configs) => {
    state.sessionState = { user }
    state.configs = configs
    renderSidebar()
    // redesign 5.1: Logout is in the account menu
    await openAccount()

    expect(screen.queryByRole('button', { name: 'Join our Community' })).not.toBeInTheDocument()
    expect(screen.queryByText('Join our Community')).not.toBeInTheDocument()
    expect(document.querySelector('[href*="discord."]')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()
  })

  it('keeps the community absent when the session resolves or changes roles', () => {
    const { rerender } = renderSidebar()

    for (const user of [
      { level: 0, user_system_id: 42 },
      { level: 2, user_system_id: 42 },
      { level: 0 },
      undefined
    ]) {
      state.sessionState = { user }
      rerender(<UpgradeSidebar />)
      expect(screen.queryByText('Join our Community')).not.toBeInTheDocument()
    }
  })

  it('preserves the account controls for an administrator with a system user ID', async () => {
    // redesign 5.1: Profile, Help, Share ideas and Logout are one account menu, not neighboring footer controls
    state.sessionState = {
      token: 'session-token',
      user: { level: 0, user_system_id: 42, name: 'Admin', lastname: 'User' }
    }
    const { tab, open } = blankTab()
    const user = userEvent.setup()
    renderSidebar()

    try {
      expect(screen.getByRole('button', { name: 'Account: Admin User' })).toBeInTheDocument()
      const dialog = await openAccount()
      expect(within(dialog).getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profile')
      expect(within(dialog).getByRole('link', { name: 'Help' })).toHaveAttribute('href', 'https://docs.ordering.co')
      expect(within(dialog).getByRole('link', { name: 'Share ideas' })).toHaveAttribute('href', 'https://tally.so/r/WO4pdJ')
      expect(within(dialog).getByRole('button', { name: 'Log out' })).toBeInTheDocument()
      await user.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

      await user.click(screen.getByRole('button', { name: 'AI agents' }))
      expect(open).toHaveBeenCalledExactlyOnceWith('', '_blank')
      expect(tab.opener).toBeNull()
      await waitFor(() => expect(tab.location.replace).toHaveBeenCalledExactlyOnceWith(AI_AGENTS_CODE_URL))
      expect(tab.close).not.toHaveBeenCalled()
      // the session token reaches neither the new tab nor the event bus, only the one-time code does
      expect(JSON.stringify([open.mock.calls, tab.location.replace.mock.calls])).not.toContain('session-token')
      expect(JSON.stringify(state.emit.mock.calls)).not.toContain('session-token')
      // the URL is built on the click only. The token never sits in the page (no href, no attribute, no text)
      // where a hover, «Copy link» or an extension could read it.
      expect(document.documentElement.outerHTML).not.toContain('session-token')
      expect([...document.querySelectorAll('[href]')].filter(node => /access_token/.test(node.getAttribute('href')))).toEqual([])
    } finally {
      open.mockRestore()
    }
  })

  it('does not open AI agents when the session token is missing', async () => {
    state.sessionState = { user: { level: 0, name: 'Admin', lastname: 'User' } }
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const user = userEvent.setup()
    renderSidebar()

    try {
      await user.click(screen.getByRole('button', { name: 'AI agents' }))
      expect(open).not.toHaveBeenCalled()
      expect(state.getAiAgentsCode).not.toHaveBeenCalled()
    } finally {
      open.mockRestore()
    }
  })

  it('closes the blank tab when the one-time code does not arrive', async () => {
    state.sessionState = { token: 'session-token', user: { level: 0, name: 'Admin', lastname: 'User' } }
    state.getAiAgentsCode = vi.fn().mockResolvedValue(null)
    const { tab, open } = blankTab()
    const user = userEvent.setup()
    renderSidebar()

    try {
      await user.click(screen.getByRole('button', { name: 'AI agents' }))
      await waitFor(() => expect(tab.close).toHaveBeenCalledTimes(1))
      expect(tab.location.replace).not.toHaveBeenCalled()
    } finally {
      open.mockRestore()
    }
  })

  it('shows the upgrade form instead of opening AI Agents for a project without the AI module', async () => {
    vi.stubEnv('VITE_DASHBOARD_UPGRADE_FORM_URL', UPGRADE_FORM_URL)
    vi.stubEnv('VITE_DASHBOARD_UPGRADE_FORM_PREFILL', 'true')
    state.aiModuleEnabled = false
    state.sessionState = {
      token: 'session-token',
      user: { level: 0, email: 'admin@example.com', name: 'Admin', lastname: 'User' }
    }
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const user = userEvent.setup()
    renderSidebar()

    try {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'AI agents' }))

      expect(open).not.toHaveBeenCalled()
      // the entry no longer says it opens a new tab when it opens the form here
      expect(screen.getByRole('button', { name: 'AI agents' })).not.toHaveAccessibleDescription(/new tab/i)
      const formUrl = new URL(screen.getByRole('link', { name: 'Upgrade form' }).getAttribute('href'))
      expect(`${formUrl.origin}${formUrl.pathname}`).toBe(UPGRADE_FORM_URL)
      expect(formUrl.searchParams.get('email')).toBe('admin@example.com')
      expect(formUrl.searchParams.get('ref')).toBe('orderingplus')
      expect(formUrl.toString()).not.toContain('session-token')

      await user.click(screen.getByRole('button', { name: 'Close upgrade' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    } finally {
      open.mockRestore()
    }
  })

  it('opens AI Agents for a project with the AI module', async () => {
    state.aiModuleEnabled = true
    state.sessionState = { token: 'session-token', user: { level: 0 } }
    const { tab, open } = blankTab()
    const user = userEvent.setup()
    renderSidebar()

    try {
      await user.click(screen.getByRole('button', { name: 'AI agents' }))

      expect(open).toHaveBeenCalledExactlyOnceWith('', '_blank')
      await waitFor(() => expect(tab.location.replace).toHaveBeenCalledExactlyOnceWith(AI_AGENTS_CODE_URL))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    } finally {
      open.mockRestore()
    }
  })

  it('hides AI agents from a business owner', () => {
    state.sessionState = {
      token: 'session-token',
      user: { level: 2, name: 'Owner', lastname: 'User' }
    }
    renderSidebar()

    expect(screen.queryByRole('button', { name: 'AI agents' })).not.toBeInTheDocument()
  })

  it('hides the Assistant while it is not available for the project', () => {
    state.sessionState = { token: 'session-token', user: { level: 0, name: 'Admin', lastname: 'User' } }
    renderSidebar()

    expect(screen.queryByRole('button', { name: 'Mia' })).not.toBeInTheDocument()
  })

  it('toggles the Assistant panel, apart from AI agents', async () => {
    state.sessionState = { token: 'session-token', user: { level: 0, name: 'Admin', lastname: 'User' } }
    state.assistant = { isAvailable: true, isOpen: false, setOpen: vi.fn() }
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const user = userEvent.setup()
    renderSidebar()

    try {
      const assistant = screen.getByRole('button', { name: 'Mia' })
      expect(assistant).toHaveAttribute('aria-pressed', 'false')
      // redesign 5.1: the assistant is a plain row with only the stage badge (C11); the extra "AI" badge is gone
      expect(within(assistant).queryByText('AI')).not.toBeInTheDocument()
      expect(within(assistant).getByText('Beta')).toHaveAttribute('aria-hidden', 'true')
      await user.click(assistant)

      expect(state.assistant.setOpen).toHaveBeenCalledOnce()
      const toggle = state.assistant.setOpen.mock.calls[0][0]
      expect(toggle(false)).toBe(true)
      expect(toggle(true)).toBe(false)
      expect(open).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'AI agents' })).toBeInTheDocument()
    } finally {
      open.mockRestore()
    }
  })

  it('requests an upgrade from Mia without opening the assistant or leaving the page', async () => {
    vi.stubEnv('VITE_DASHBOARD_UPGRADE_FORM_URL', UPGRADE_FORM_URL)
    vi.stubEnv('VITE_DASHBOARD_UPGRADE_FORM_PREFILL', 'true')
    state.sessionState = { token: 'session-token', user: { level: 0, email: 'admin@example.test' } }
    state.projectStatus = { dashboardUpgradeRequired: true }
    state.assistant = { isAvailable: true, isOpen: false, setOpen: vi.fn() }
    const user = userEvent.setup()
    const { rerender } = renderSidebar()

    await user.click(screen.getByRole('button', { name: 'Mia' }))
    const dialog = screen.getByRole('dialog', { name: 'Request an upgrade' })
    const formUrl = new URL(within(dialog).getByRole('link', { name: 'Upgrade form' }).href)
    expect(formUrl.origin + formUrl.pathname).toBe(UPGRADE_FORM_URL)
    expect(formUrl.searchParams.get('utm_campaign')).toBe('legacy_plan_upgrade')
    expect(state.assistant.setOpen).not.toHaveBeenCalled()
    expect(state.emit).not.toHaveBeenCalled()

    state.projectStatus = { dashboardUpgradeRequired: false }
    state.project = 'second-project'
    rerender(<UpgradeSidebar />)
    expect(screen.queryByRole('dialog', { name: 'Request an upgrade' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Mia' }))
    expect(state.assistant.setOpen).toHaveBeenCalledOnce()
  })

  it.each([true, false])('waits for the project decision before opening Appointments (upgrade=%s)', async upgrade => {
    state.sessionState = { token: 'session-token', user: { level: 0, name: 'Admin' } }
    state.projectStatus = { dashboardUpgradePending: true, dashboardUpgradeRequired: null }
    const { rerender } = renderSidebar()

    await userEvent.click(screen.getByRole('button', { name: 'Orders' }))
    await userEvent.click(screen.getByRole('link', { name: 'Appointments' }))
    expect(state.emit).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Request an upgrade' })).not.toBeInTheDocument()

    state.projectStatus = { dashboardUpgradePending: false, dashboardUpgradeRequired: upgrade }
    rerender(<UpgradeSidebar />)
    if (upgrade) {
      expect(screen.getByRole('dialog', { name: 'Request an upgrade' })).toBeInTheDocument()
      expect(state.emit).not.toHaveBeenCalled()
    } else {
      expect(state.emit).toHaveBeenCalledWith('go_to_page', { page: 'appointments' })
    }
  })

  it('discards a pending click when the active project changes', async () => {
    state.sessionState = { token: 'session-token', user: { level: 0, name: 'Admin' } }
    state.projectStatus = { dashboardUpgradePending: true }
    const { rerender } = renderSidebar()
    await userEvent.click(screen.getByRole('button', { name: 'Orders' }))
    await userEvent.click(screen.getByRole('link', { name: 'Appointments' }))

    state.project = 'next-tenant'
    state.projectStatus = { dashboardUpgradeRequired: true }
    rerender(<UpgradeSidebar />)
    expect(screen.queryByRole('dialog', { name: 'Request an upgrade' })).not.toBeInTheDocument()
    expect(state.emit).not.toHaveBeenCalled()
  })

  it.each([
    ['Orders', '/appointments'],
    [null, '/schools'],
    ['Delivery', '/all-in-one'],
    ['Delivery', '/delivery/drivers-companies'],
    ['Delivery', '/driver-store-status'],
    ['Delivery', '/delivery/drivers-time-display'],
    ['Stores', '/stores/devices'],
    ['Stores', '/stores/markups'],
    [null, '/builder'],
    ['Marketing', '/marketing/campaign'],
    ['Users', '/users/professionals'],
    ['Users', '/users/callcenter-agents'],
    ['Reports', '/intelligence/business-payments'],
    ['Reports', '/intelligence/reports'],
    ['Connect', '/connect/delivery-services'],
    ['Connect', '/connect/pos-menu'],
    ['Connect', '/connect/importers'],
    ['Connect', '/connect/sales-channels'],
    ['Connect', '/connect/whatsapp-bots'],
    [null, '/settings/logs'],
    ['account', '/open-source-code']
  ])('opens the upgrade dialog for the legacy plan at %s %s', async (section, path) => {
    state.sessionState = { token: 'session-token', user: { level: 0, name: 'Admin' } }
    state.projectStatus = { dashboardUpgradeRequired: true }
    const user = userEvent.setup()
    const { container } = renderWithProviders(<><UpgradeSidebar /><RouterProbe /></>, { initialEntries: ['/home'] })

    if (section === 'account') await openAccount()
    else if (section) await user.click(screen.getByRole('button', { name: section }))
    const entry = (section === 'account' ? document : container).querySelector(`a[href="${path}"]`)
    expect(entry).toBeVisible()
    await user.click(entry)

    expect(screen.getByRole('dialog', { name: 'Request an upgrade' })).toBeInTheDocument()
    expect(state.emit).not.toHaveBeenCalled()
    expect(screen.getByTestId('current-path')).toHaveTextContent('/home')
  })

  it.each([true, false])('keeps the ordinary destinations for legacy=%s unless listed', async legacy => {
    state.sessionState = { token: 'session-token', user: { level: 0, name: 'Admin' } }
    state.projectStatus = { dashboardUpgradeRequired: legacy }
    const user = userEvent.setup()
    renderSidebar()

    await user.click(screen.getByRole('button', { name: 'Orders' }))
    await user.click(screen.getByRole('link', { name: legacy ? 'Orders list' : 'Appointments' }))
    expect(state.emit).toHaveBeenCalledWith('go_to_page', { page: legacy ? 'orders' : 'appointments' })
    expect(screen.queryByRole('dialog', { name: 'Request an upgrade' })).not.toBeInTheDocument()
  })

  it('opens Help at the requested documentation URL in a safe new tab', async () => {
    state.sessionState = { user: { level: 0, name: 'Admin', lastname: 'User' } }
    renderSidebar()

    // redesign 5.1: Help is in the account menu
    const dialog = await openAccount()
    const help = within(dialog).getByRole('link', { name: 'Help' })
    expect(help).toHaveAttribute('href', 'https://docs.ordering.co')
    expect(help).toHaveAttribute('target', '_blank')
    expect(help).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('shows Schools in the Operate group, before the Platform group', async () => {
    // redesign 5.1: Schools moved from the top of the lower utility group to Operate; the language selector moved into the account menu
    state.sessionState = { user: { level: 0, name: 'Admin', lastname: 'User' } }
    renderSidebar()

    const schools = screen.getByRole('link', { name: 'Schools' })
    const settings = screen.getByRole('link', { name: 'Settings' })

    expect(schools).toHaveAttribute('href', '/schools')
    expect(screen.getByRole('group', { name: 'Operate' })).toContainElement(schools)
    expect(screen.getByRole('group', { name: 'Platform' })).toContainElement(settings)
    expect(schools.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Language selector' })).not.toBeInTheDocument()

    await userEvent.click(schools)
    expect(state.emit).toHaveBeenCalledWith('go_to_page', { page: 'schools' })
  })

  it('offers the language selector inside the account menu for an administrator', async () => {
    // redesign 5.1: new case for where the language selector went
    state.sessionState = { user: { level: 0, name: 'Admin', lastname: 'User' } }
    renderSidebar()
    const dialog = await openAccount()
    expect(within(dialog).getByRole('button', { name: 'Language selector' })).toBeInTheDocument()
  })

  it('keeps Schools in the same spot for a business owner, who has no Settings', () => {
    state.sessionState = { user: { level: 2, name: 'Owner', lastname: 'User' } }
    renderSidebar()

    const schools = screen.getByRole('link', { name: 'Schools' })
    expect(schools).toHaveAttribute('href', '/schools')
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
    expect(schools.closest('.accordion')).toBeNull()
  })

  it('hides Schools from a delivery manager', () => {
    state.sessionState = { user: { level: 5, name: 'Driver', lastname: 'Manager' } }
    renderSidebar()

    expect(screen.queryByText('Schools')).not.toBeInTheDocument()
  })
})

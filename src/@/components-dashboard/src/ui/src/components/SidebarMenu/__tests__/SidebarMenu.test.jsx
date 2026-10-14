import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
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
  apiLabels: {}
}))

vi.mock('../../../../../index', async () => {
  const React = await import('react')

  return {
    SidebarMenu: ({ UIComponent, ...props }) => React.createElement(UIComponent, {
      ...props,
      productsState: { loading: false, error: null, apps: [] },
      getBillingToken: vi.fn(),
      billingUrl: 'https://billing.example.com',
      setShowBillingPayment: vi.fn()
    }),
    useApi: () => [{ root: 'https://api.example.com', project: state.project }, { configurations: state.configurations }],
    useConfig: () => [{ configs: state.configs }],
    useEvent: () => [{ emit: state.emit }],
    useLanguage: () => [{ language: state.language }, (key, fallback) => state.apiLabels[`DASHBOARD_${key}`] ?? state.apiLabels[key] ?? fallback],
    useSession: () => [state.sessionState],
    useSite: () => [{ sites: state.sites, loading: state.sitesLoading }],
    useAssistantDock: () => state.assistant
  }
})

vi.mock('../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: state.handleMenuCollapse }]
}))

vi.mock('../../../contexts/ProjectContext', () => ({
  useProjectState: () => [state.projectStatus]
}))

vi.mock('../../../hooks/useWindowSize', () => ({
  useWindowSize: () => ({ width: 1280, height: 800 })
}))

vi.mock('../../LanguageSelector', () => ({
  LanguageSelector: () => <button type='button'>Language selector</button>
}))

vi.mock('../../LogoutButton', () => ({
  LogoutButton: () => <button type='button'>Logout</button>
}))

import { SidebarMenu } from '../index'

const renderSidebar = () => renderWithProviders(<SidebarMenu />)
const RouterProbe = () => <output data-testid='current-path'>{useLocation().pathname}</output>

describe('SidebarMenu external resources', () => {
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

    await userEvent.click(screen.getByRole('button', { name: 'My Website' }))

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

    expect(screen.getByRole('button', { name: 'My Website' })).toBeDisabled()
    expect(screen.queryByRole('link', { name: 'Live website' })).not.toBeInTheDocument()
    expect(document.querySelector('[href*="franchise.example.com"], [href*="marketplace.example.com"]')).not.toBeInTheDocument()
  })

  it.each([
    [{ level: 0 }, 'Language selector', 'Open Source Code'],
    [{ level: 0, user_system_id: 42 }, 'Billing', 'Open Source Code'],
    [{ level: 0, readOnlyAdmin: true }, null, 'Open Source Code']
  ])('keeps Free downloads in the original lower utility group for %j', (user, previous, next) => {
    state.sessionState = { user }
    renderSidebar()
    const scrollContent = screen.getByTestId('sidebar-scroll-content')
    const link = screen.getByRole('link', { name: 'Free downloads' })
    expect(scrollContent.children).toHaveLength(2)
    expect(link.parentElement).toBe(scrollContent.lastElementChild)
    expect(link.previousElementSibling?.textContent ?? null).toBe(previous)
    expect(link.nextElementSibling?.textContent ?? null).toBe(next)
    expect(document.querySelector('#user_info')).not.toContainElement(link)
  })

  it('navigates Free downloads internally and keeps its active state', async () => {
    state.sessionState = { user: { level: 0, user_system_id: 42 } }
    renderWithProviders(<SidebarMenu />, { initialEntries: ['/free-downloads'] })
    const link = screen.getByRole('link', { name: 'Free downloads' })
    expect(link).toHaveAttribute('href', '/free-downloads')
    expect(link).toHaveClass('btn-primary')
    await userEvent.click(link)
    expect(state.emit).toHaveBeenCalledWith('go_to_page', { page: 'free_products' })
  })

  it.each([
    { level: 0 }, { level: 0, readOnlyAdmin: true }
  ])('offers source code to eligible session role %j, regardless of editing privileges or system ID', user => {
    state.sessionState = { user }
    renderWithProviders(<SidebarMenu />, { initialEntries: ['/open-source-code'] })
    const link = screen.getByRole('link', { name: 'Open Source Code' })
    expect(link).toHaveAttribute('href', '/open-source-code')
    expect(link).toHaveAttribute('aria-current', 'page')
    expect(link).toHaveClass('btn-primary')
  })

  it.each([undefined, { level: 2 }, { level: 2, readOnlyBusinessOwner: true }, { level: 5 }, { level: 8 }, { level: '2' }])('hides the source link for ineligible session %j', user => {
    state.sessionState = { user }
    renderSidebar()
    expect(screen.queryByRole('link', { name: 'Open Source Code' })).not.toBeInTheDocument()
  })

  it('navigates the source link internally without sending a session token or download data to the event bus', async () => {
    state.sessionState = { user: { level: 0 }, token: 'controlled-token' }
    renderWithProviders(<><SidebarMenu /><RouterProbe /></>, { initialEntries: ['/orders'] })
    await userEvent.click(screen.getByRole('link', { name: 'Open Source Code' }))
    expect(screen.getByTestId('current-path')).toHaveTextContent('/open-source-code')
    expect(state.emit).not.toHaveBeenCalled()
    expect(document.querySelector('[href*="controlled-token"]')).toBeNull()
  })

  it.each(['es-MX', 'ar-SA'])('localizes only the new source link from the canonical %s subset', code => {
    state.language = { code }
    state.sessionState = { user: { level: 0 } }
    renderSidebar()
    expect(screen.getByRole('link', { name: labels.SOURCE_CODE_TITLE[code.split('-')[0]] })).toHaveAttribute('href', '/open-source-code')
    expect(screen.getByRole('button', { name: 'Language selector' })).toBeInTheDocument()
  })

  it('lets an existing source menu API label override the local fallback', () => {
    state.language = { code: 'ar' }
    state.apiLabels = { DASHBOARD_SOURCE_CODE_TITLE: 'Controlled API menu' }
    state.sessionState = { user: { level: 0 } }
    renderSidebar()
    expect(screen.getByRole('link', { name: 'Controlled API menu' })).toHaveAttribute('href', '/open-source-code')
  })

  it.each([undefined, { level: 2, user_system_id: 42 }, { level: 5, user_system_id: 42 }])('preserves download menu eligibility for %j', (user) => {
    state.sessionState = { user }
    renderSidebar()
    expect(screen.queryByRole('link', { name: 'Free downloads' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Free downloads' })).not.toBeInTheDocument()
  })

  it.each([undefined, null, 0])('shows Free downloads for admins with system ID %j without exposing billing or addons', (systemId) => {
    state.sessionState = { user: { level: 0, user_system_id: systemId } }
    state.configs = { white_label_module: { value: true } }
    renderSidebar()
    expect(screen.getByRole('link', { name: 'Free downloads' })).toHaveAttribute('href', '/free-downloads')
    expect(screen.queryByRole('button', { name: 'Billing' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Apps & Addons' })).not.toBeInTheDocument()
  })

  it.each([null, 42])('shows Free downloads to read-only admins with system ID %j without exposing editing resources', (systemId) => {
    state.sessionState = { user: { level: 0, readOnlyAdmin: true, user_system_id: systemId } }
    renderSidebar()
    expect(screen.getByRole('link', { name: 'Free downloads' })).toHaveAttribute('href', '/free-downloads')
    expect(screen.queryByRole('button', { name: 'Billing' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Apps & Addons' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
  })

  it('updates Free downloads visibility when the session resolves or changes role', () => {
    const { rerender } = renderSidebar()
    expect(screen.queryByRole('link', { name: 'Free downloads' })).not.toBeInTheDocument()
    state.sessionState = { user: { level: 0 } }
    rerender(<SidebarMenu />)
    expect(screen.getByRole('link', { name: 'Free downloads' })).toBeInTheDocument()
    state.sessionState = { user: { level: 0, readOnlyAdmin: true } }
    rerender(<SidebarMenu />)
    expect(screen.getByRole('link', { name: 'Free downloads' })).toBeInTheDocument()
    state.sessionState = { user: { level: 2 } }
    rerender(<SidebarMenu />)
    expect(screen.queryByRole('link', { name: 'Free downloads' })).not.toBeInTheDocument()
  })

  it('shows Share ideas after Logs Audit for a white-label administrator without a system user ID', () => {
    state.configs = { white_label_module: { value: true } }
    state.sessionState = { user: { level: 0, name: 'Admin', lastname: 'User' } }
    const { rerender } = renderSidebar()

    const scrollContent = screen.getByTestId('sidebar-scroll-content')
    const logsAuditMenu = screen.getByTestId('logs-audit-menu')
    const logsAudit = screen.getByRole('button', { name: 'Logs Audit' })
    const shareIdeas = screen.getByRole('link', { name: 'Share ideas' })

    expect(scrollContent).toContainElement(logsAudit)
    expect(scrollContent).toContainElement(shareIdeas)
    expect(logsAuditMenu).toContainElement(logsAudit)
    expect(logsAuditMenu.nextElementSibling).toBe(shareIdeas)
    expect(shareIdeas).toHaveAttribute('href', 'https://tally.so/r/WO4pdJ')
    expect(shareIdeas).toHaveAttribute('target', '_blank')
    expect(shareIdeas).toHaveAttribute('rel', 'noopener noreferrer')
    expect(document.querySelector('#user_info')).not.toContainElement(shareIdeas)

    state.sessionState = { user: { level: 2, name: 'Owner', lastname: 'User' } }
    rerender(<SidebarMenu />)
    expect(screen.queryByRole('link', { name: 'Share ideas' })).not.toBeInTheDocument()

    state.sessionState = {}
    rerender(<SidebarMenu />)
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
  ])('does not offer the retired community for %s', (_scenario, user, configs) => {
    state.sessionState = { user }
    state.configs = configs
    renderSidebar()

    expect(screen.queryByRole('button', { name: 'Join our Community' })).not.toBeInTheDocument()
    expect(screen.queryByText('Join our Community')).not.toBeInTheDocument()
    expect(document.querySelector('[href*="discord."]')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument()
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
      rerender(<SidebarMenu />)
      expect(screen.queryByText('Join our Community')).not.toBeInTheDocument()
    }
  })

  it('preserves the neighboring footer controls for an administrator with a system user ID', async () => {
    state.sessionState = {
      token: 'session-token',
      user: { level: 0, user_system_id: 42, name: 'Admin', lastname: 'User' }
    }
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const user = userEvent.setup()
    renderSidebar()

    try {
      expect(screen.getByRole('link', { name: 'Admin User' })).toHaveAttribute('href', '/profile')
      expect(screen.getByRole('link', { name: 'Help' })).toHaveAttribute('href', 'https://docs.ordering.co')
      expect(screen.getByRole('link', { name: 'Share ideas' })).toHaveAttribute('href', 'https://tally.so/r/WO4pdJ')
      expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'AI Agents' }))
      expect(open).toHaveBeenCalledExactlyOnceWith(
        'https://ai.ordering.co/?access_token=session-token&project=orderingplus',
        '_blank',
        'noopener,noreferrer'
      )
      expect(JSON.stringify(state.emit.mock.calls)).not.toContain('session-token')
    } finally {
      open.mockRestore()
    }
  })

  it('does not open AI Agents when the session token is missing', async () => {
    state.sessionState = { user: { level: 0, name: 'Admin', lastname: 'User' } }
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const user = userEvent.setup()
    renderSidebar()

    try {
      await user.click(screen.getByRole('button', { name: 'AI Agents' }))
      expect(open).not.toHaveBeenCalled()
    } finally {
      open.mockRestore()
    }
  })

  it('hides AI Agents from a business owner', () => {
    state.sessionState = {
      token: 'session-token',
      user: { level: 2, name: 'Owner', lastname: 'User' }
    }
    renderSidebar()

    expect(screen.queryByRole('button', { name: 'AI Agents' })).not.toBeInTheDocument()
  })

  it('hides the Assistant while it is not available for the project', () => {
    state.sessionState = { token: 'session-token', user: { level: 0, name: 'Admin', lastname: 'User' } }
    renderSidebar()

    expect(screen.queryByRole('button', { name: 'Mia' })).not.toBeInTheDocument()
  })

  it('toggles the Assistant panel, apart from AI Agents', async () => {
    state.sessionState = { token: 'session-token', user: { level: 0, name: 'Admin', lastname: 'User' } }
    state.assistant = { isAvailable: true, isOpen: false, setOpen: vi.fn() }
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const user = userEvent.setup()
    renderSidebar()

    try {
      const assistant = screen.getByRole('button', { name: 'Mia' })
      expect(assistant).toHaveAttribute('aria-pressed', 'false')
      expect(within(assistant).getByText('AI')).toHaveAttribute('aria-hidden', 'true')
      expect(within(assistant).getByText('Beta')).toHaveAttribute('aria-hidden', 'true')
      await user.click(assistant)

      expect(state.assistant.setOpen).toHaveBeenCalledOnce()
      const toggle = state.assistant.setOpen.mock.calls[0][0]
      expect(toggle(false)).toBe(true)
      expect(toggle(true)).toBe(false)
      expect(open).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'AI Agents' })).toBeInTheDocument()
    } finally {
      open.mockRestore()
    }
  })

  it('opens Help at the requested documentation URL in a safe new tab', () => {
    state.sessionState = { user: { level: 0, name: 'Admin', lastname: 'User' } }
    renderSidebar()

    const help = screen.getByRole('link', { name: 'Help' })
    expect(help).toHaveAttribute('href', 'https://docs.ordering.co')
    expect(help).toHaveAttribute('target', '_blank')
    expect(help).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('shows Schools at the top of the lower group, above the language selector', async () => {
    state.sessionState = { user: { level: 0, name: 'Admin', lastname: 'User' } }
    renderSidebar()

    const scrollContent = screen.getByTestId('sidebar-scroll-content')
    const schools = screen.getByText('Schools').closest('a')
    const settings = screen.getByRole('link', { name: 'Settings' })

    expect(schools).toHaveAttribute('href', '/schools')
    expect(schools.parentElement).toBe(scrollContent.lastElementChild)
    expect(schools.previousElementSibling).toBeNull()
    expect(schools.nextElementSibling).toHaveTextContent('Language selector')
    expect(schools.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await userEvent.click(schools)
    expect(state.emit).toHaveBeenCalledWith('go_to_page', { page: 'schools' })
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

/* eslint-disable import/first */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const runtime = vi.hoisted(() => ({
  emit: vi.fn(),
  languageControllerProps: null,
  logoutControllerProps: null,
  menuControllerProps: null,
  selectProps: null,
  collapse: vi.fn(),
  rail: vi.fn(),
  isCollapse: false,
  isRail: false,
  width: 1280,
  pathname: '/home',
  assistant: { isAvailable: false, isOpen: false, setOpen: () => {} },
  session: { user: { level: 0, name: 'Ada', lastname: 'Admin', user_system_id: null } }
}))

vi.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: runtime.pathname, search: '', state: null }), useHistory: () => ({ push: () => {} }) }))
vi.mock('../../../../../index', () => ({
  LanguageSelector: props => { runtime.languageControllerProps = props; return <div data-testid='language-controller' /> },
  LogoutAction: props => { runtime.logoutControllerProps = props; return <div data-testid='logout-controller' /> },
  SidebarMenu: props => { runtime.menuControllerProps = props; return <div data-testid='menu-controller' /> },
  useApi: () => [{}, { configurations: {} }],
  useConfig: () => [{ configs: {} }],
  useEvent: () => [{ emit: runtime.emit }],
  useLanguage: () => [{}, (key, fallback) => fallback || key],
  useSession: () => [runtime.session],
  useSite: () => [{ sites: [], loading: false }],
  useAssistantDock: () => runtime.assistant
}))
// redesign 5.1: the width is a variable (the drawer and rail cases) and the sidebar state adds isRail / handleMenuRail
vi.mock('../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: runtime.width, height: 900 }) }))
vi.mock('../../../contexts/InfoShareContext', () => ({ useInfoShare: () => [{ isCollapse: runtime.isCollapse, isRail: runtime.isRail }, { handleMenuCollapse: runtime.collapse, handleMenuRail: runtime.rail }] }))
vi.mock('../../../contexts/ProjectContext', () => ({ useProjectState: () => [{ plan: {} }] }))
vi.mock('../../../utils', () => ({
  canAccessSchoolsPage: () => false,
  capitalize: value => value,
  firstLetterCapital: value => value,
  getConnectProjectRules: () => ({}),
  getConnectVisualAccess: () => ({ showConnectTab: false, marketingCampaigns: false }),
  getDashboardLogoUrl: (configs, fallback) => fallback,
  getUserType: () => false,
  isConnectRestrictedUser: () => false
}))
vi.mock('../../../utils/getPreferredSiteUrl', () => ({ getPreferredSiteDestinations: () => [] }))
vi.mock('../../../styles/Select', () => ({
  Select: props => {
    runtime.selectProps = props
    return <button type='button' onClick={() => props.onChange('es')}>Language select</button>
  }
}))

import { LanguageSelector, LanguageSelectorUI } from './LanguageSelector'
import { Layout } from './Layout'
import { LogoutButton, LogoutButtonUI } from './LogoutButton'
import { SidebarMenu, SidebarMenuUI } from './SidebarMenu'

const dashboardTheme = {
  ...createDashboardTheme(theme),
  images: { logos: { logotype: '/tenant-logo.svg' } }
}
const renderWithTheme = content => render(<ThemeProvider theme={dashboardTheme}>{content}</ThemeProvider>)

beforeEach(() => {
  runtime.emit.mockClear()
  runtime.collapse.mockClear()
  runtime.rail.mockClear()
  runtime.languageControllerProps = null
  runtime.logoutControllerProps = null
  runtime.menuControllerProps = null
  runtime.selectProps = null
  runtime.isCollapse = false
  runtime.isRail = false
  runtime.width = 1280
  runtime.pathname = '/home'
  runtime.assistant = { isAvailable: false, isOpen: false, setOpen: vi.fn() }
  runtime.session = { user: { level: 0, name: 'Ada', lastname: 'Admin', user_system_id: null } }
})

describe('L2e-E1 shell helpers', () => {
  it('keeps Layout children and the exact pt default/override', () => {
    const rendered = renderWithTheme(<Layout><span>Content</span></Layout>)
    const root = document.querySelector('[data-slot="shell-layout"]')
    expect(root).toHaveStyle({ paddingTop: '0px', width: 'var(--app-width,100%)', maxWidth: 'var(--app-width,100%)' })
    expect(root).toHaveTextContent('Content')
    rendered.rerender(<ThemeProvider theme={dashboardTheme}><Layout pt={18}><span>Next</span></Layout></ThemeProvider>)
    expect(root).toHaveStyle({ paddingTop: '18px' })
  })

  it('sorts copied language options and preserves loading/default/callback payloads', async () => {
    const user = userEvent.setup()
    const handleChangeLanguage = vi.fn()
    const languages = [{ code: 'es', name: 'Spanish' }, { code: 'en', name: 'English' }]
    renderWithTheme(
      <LanguageSelectorUI
        languagesState={{ loading: false, languages }}
        currentLanguage='en'
        handleChangeLanguage={handleChangeLanguage}
        defaultLanguages={[{ value: 'en', content: 'English' }]}
        defaultCurrentLanguage='en'
      />
    )
    expect(runtime.selectProps.options.map(option => option.content)).toEqual(['English', 'Spanish'])
    expect(languages.map(language => language.name)).toEqual(['Spanish', 'English'])
    expect(runtime.selectProps.defaultValue).toBe('en')
    await user.click(screen.getByRole('button', { name: 'Language select' }))
    expect(handleChangeLanguage).toHaveBeenCalledWith('es', true)
  })

  // redesign fix-qa E8: the account menu asks for `variant='menu'`: one single-choice Product menu, not the legacy select.
  it('variant menu: the languages are a single-choice menu of the current language, same callback, no legacy select', async () => {
    const user = userEvent.setup()
    const handleChangeLanguage = vi.fn()
    const languages = [{ code: 'es', name: 'Spanish' }, { code: 'en', name: 'English' }, { code: 'it', name: 'Italian' }]
    renderWithTheme(
      <LanguageSelectorUI
        variant='menu'
        languagesState={{ loading: false, languages }}
        currentLanguage='en'
        handleChangeLanguage={handleChangeLanguage}
        defaultLanguages={[{ value: 'en', content: 'English' }]}
        defaultCurrentLanguage='en'
      />
    )
    expect(runtime.selectProps).toBeNull()
    const trigger = screen.getByRole('button', { name: 'English' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    await user.click(trigger)
    const menu = await screen.findByRole('menu')
    expect(menu).toHaveAttribute('data-field-menu')
    const radios = within(menu).getAllByRole('menuitemradio')
    expect(radios.map(item => item.textContent)).toEqual(['English', 'Italian', 'Spanish'])
    expect(radios.map(item => item.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false'])
    // the language that is already the current one changes nothing
    await user.click(radios[0])
    expect(handleChangeLanguage).not.toHaveBeenCalled()
    await user.click(trigger)
    await user.click(within(await screen.findByRole('menu')).getByRole('menuitemradio', { name: 'Spanish' }))
    expect(handleChangeLanguage).toHaveBeenCalledOnce()
    expect(handleChangeLanguage).toHaveBeenCalledWith('es', true)
  })

  it('variant menu: while the languages load it shows the default one; one or zero languages keep their branches', () => {
    const loading = renderWithTheme(
      <LanguageSelectorUI
        variant='menu'
        languagesState={{ loading: true, languages: [{ code: 'es', name: 'Spanish' }, { code: 'en', name: 'English' }] }}
        currentLanguage='es'
        handleChangeLanguage={vi.fn()}
        defaultLanguages={[{ value: 'en', content: 'English' }, { value: 'fr', content: 'French' }]}
        defaultCurrentLanguage='en'
      />
    )
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument()
    loading.unmount()
    renderWithTheme(<LanguageSelectorUI variant='menu' languagesState={{ languages: [{ code: 'es', name: 'Español' }] }} />)
    expect(document.querySelector('[data-slot="language-single"]')).toHaveTextContent('Español')
  })

  it('keeps one/zero language branches and controller defaults', () => {
    const one = renderWithTheme(<LanguageSelectorUI languagesState={{ languages: [{ code: 'es', name: 'Español' }] }} />)
    expect(document.querySelector('[data-slot="language-single"]')).toHaveTextContent('Español')
    one.unmount()
    const zero = renderWithTheme(<LanguageSelectorUI languagesState={{ languages: [] }} />)
    expect(document.querySelector('[data-slot="language-selector"]')).not.toBeInTheDocument()
    expect(document.querySelector('[data-slot="language-single"]')).not.toBeInTheDocument()
    zero.unmount()
    renderWithTheme(<LanguageSelector notReload />)
    expect(runtime.languageControllerProps).toMatchObject({ UIComponent: LanguageSelectorUI, defaultCurrentLanguage: 'en', defaultLanguages: [{ content: 'English', showOnSelected: 'EN', value: 'en' }] })
    expect(runtime.languageControllerProps.onChangeLanguage).toEqual(expect.any(Function))
  })

  it('keeps logout callback and controller wiring', async () => {
    const user = userEvent.setup()
    const handleLogoutClick = vi.fn()
    renderWithTheme(<LogoutButtonUI handleLogoutClick={handleLogoutClick} />)
    const action = screen.getByRole('button', { name: 'Log out' })
    expect(action).toHaveAttribute('type', 'button')
    expect(action).toHaveClass('od-button')
    await user.click(action)
    expect(handleLogoutClick).toHaveBeenCalledOnce()
    renderWithTheme(<LogoutButton marker='logout' />)
    expect(runtime.logoutControllerProps).toMatchObject({ marker: 'logout', UIComponent: LogoutButtonUI })
  })
})

describe('L2e-E1 SidebarMenu', () => {
  const props = () => ({ productsState: { apps: [] }, getBillingToken: vi.fn(), billingUrl: 'https://billing.test', setShowBillingPayment: vi.fn() })

  // redesign fix-qa E8: the first Tab stop of the shell jumps past the 19 stops of the sidebar.
  it('has a Skip to content link as the first stop, before the navigation, that takes the focus to the page start', async () => {
    const user = userEvent.setup()
    const title = document.createElement('h1')
    title.textContent = 'Orders'
    title.getClientRects = () => [{ width: 1, height: 1 }]
    document.body.append(title)
    try {
      const { container } = renderWithTheme(<SidebarMenuUI {...props()} />)
      const skip = screen.getByRole('link', { name: 'Skip to content' })
      expect(skip).toHaveClass('odc-skip-link')
      const nav = screen.getByRole('navigation', { name: 'Menu' })
      expect(skip.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(container.querySelector('a, button')).toBe(skip)
      await user.tab()
      expect(skip).toHaveFocus()
      await user.keyboard('{Enter}')
      expect(title).toHaveFocus()
      expect(window.location.hash).toBe('')
    } finally {
      title.remove()
    }
  })

  it('renders native navigation, accessible logo/collapse and single-open mounted disclosures', async () => {
    const user = userEvent.setup()
    renderWithTheme(<SidebarMenuUI {...props()} />)
    const nav = screen.getByRole('navigation', { name: 'Menu' })
    expect(nav).toHaveAttribute('data-slot', 'sidebar-navigation')
    const logo = screen.getByRole('button', { name: 'Home' })
    // redesign 5.1: at 1280px the header button is "Collapse sidebar" (it was "Close"); it rails the menu, it does not hide it
    const collapseToRail = screen.getByRole('button', { name: 'Collapse sidebar' })
    // redesign 5.1: new markup classes instead of od-icon-button
    expect(logo).toHaveClass('odc-sidebar-logo')
    expect(logo.querySelector('img')).toHaveAttribute('src', '/tenant-logo.svg')
    expect(collapseToRail).toHaveClass('odc-btn')
    await user.click(collapseToRail)
    expect(runtime.rail).toHaveBeenCalledWith(true)
    expect(runtime.collapse).not.toHaveBeenCalled()

    const orders = screen.getByRole('button', { name: 'Orders' })
    const stores = screen.getByRole('button', { name: 'Stores' })
    // redesign 5.1: new markup class instead of od-button
    expect(orders).toHaveClass('odc-nav-item')
    expect(orders.querySelector('button')).not.toBeInTheDocument()
    expect(orders).toHaveAttribute('aria-expanded', 'false')
    await user.click(orders)
    expect(orders).toHaveAttribute('aria-expanded', 'true')
    const ordersPanel = document.getElementById(orders.getAttribute('aria-controls'))
    expect(within(ordersPanel).getByRole('link', { name: 'Orders list' })).toHaveAttribute('href', '/orders')
    await user.click(stores)
    expect(orders).toHaveAttribute('aria-expanded', 'false')
    expect(ordersPanel).toHaveAttribute('inert')
    await waitFor(() => expect(ordersPanel).toHaveAttribute('hidden'))
  })

  // redesign 5.1: new cases for the header button by width and mode
  it('closes the menu from the header below 1024px and expands the rail from it at 1280px', async () => {
    const user = userEvent.setup()
    runtime.width = 800
    const narrow = renderWithTheme(<SidebarMenuUI {...props()} />)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(runtime.collapse).toHaveBeenCalledWith(true)
    expect(runtime.rail).not.toHaveBeenCalled()
    narrow.unmount()

    runtime.width = 1280
    runtime.isRail = true
    renderWithTheme(<SidebarMenuUI {...props()} />)
    expect(document.getElementById('side_bar')).toHaveAttribute('data-rail')
    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    expect(runtime.rail).toHaveBeenCalledWith(false)
  })

  // redesign F6d (Q3-07): the collapse below 1024px came from the width, so it is undone when the width comes back.
  // main has the same effect (SidebarMenu/index.js:115-118) and never reopens it.
  describe('collapse by width (Q3-07)', () => {
    const rerenderAt = (rendered, width) => {
      runtime.width = width
      rendered.rerender(<ThemeProvider theme={dashboardTheme}><SidebarMenuUI {...props()} /></ThemeProvider>)
    }

    it('reopens the menu when the width is back at 1024px or more after being collapsed by the width', () => {
      runtime.width = 1440
      const rendered = renderWithTheme(<SidebarMenuUI {...props()} />)
      expect(runtime.collapse).not.toHaveBeenCalled()
      rerenderAt(rendered, 390)
      expect(runtime.collapse).toHaveBeenLastCalledWith(true)
      runtime.isCollapse = true
      rerenderAt(rendered, 1440)
      expect(runtime.collapse).toHaveBeenLastCalledWith(false)
    })

    it('does not touch a menu the user had already collapsed when the width goes narrow and wide again', () => {
      runtime.width = 1440
      runtime.isCollapse = true
      const rendered = renderWithTheme(<SidebarMenuUI {...props()} />)
      rerenderAt(rendered, 800)
      rerenderAt(rendered, 1440)
      expect(runtime.collapse).not.toHaveBeenCalledWith(false)
    })

    it('reopens a menu that was collapsed by the width of a first load below 1024px', () => {
      runtime.width = 800
      const rendered = renderWithTheme(<SidebarMenuUI {...props()} />)
      expect(runtime.collapse).toHaveBeenCalledWith(true)
      runtime.isCollapse = true
      rerenderAt(rendered, 1280)
      expect(runtime.collapse).toHaveBeenLastCalledWith(false)
    })

    it('does not reopen it again on later renders at a wide width', () => {
      runtime.width = 800
      const rendered = renderWithTheme(<SidebarMenuUI {...props()} />)
      runtime.isCollapse = true
      rerenderAt(rendered, 1280)
      runtime.isCollapse = false
      runtime.collapse.mockClear()
      rerenderAt(rendered, 1300)
      expect(runtime.collapse).not.toHaveBeenCalled()
    })
  })

  it('is a drawer below 768px: the scrim closes it and a navigation collapses it', async () => {
    const user = userEvent.setup()
    runtime.width = 600
    renderWithTheme(<SidebarMenuUI {...props()} />)
    expect(document.getElementById('side_bar')).toHaveAttribute('data-drawer')
    runtime.collapse.mockClear()
    await user.click(screen.getByRole('link', { name: 'Home' }))
    expect(runtime.collapse).toHaveBeenCalledWith(true)
    expect(runtime.emit).toHaveBeenCalledWith('go_to_page', { page: 'home' })
    runtime.collapse.mockClear()
    await user.click(document.querySelector('[data-slot="sidebar-scrim"]'))
    expect(runtime.collapse).toHaveBeenCalledWith(true)
  })

  it('preserves direct route event payload and active href', async () => {
    const user = userEvent.setup()
    renderWithTheme(<SidebarMenuUI {...props()} />)
    const home = screen.getByRole('link', { name: 'Home' })
    expect(home).toHaveAttribute('href', '/home')
    expect(home).toHaveAttribute('aria-current', 'page')
    // redesign 5.1: the active state is aria-current (checked above) painted by .odc-nav-item; btn-primary and od-button are gone
    expect(home).toHaveClass('odc-nav-item')
    expect(home).not.toHaveClass('btn-primary')
    await user.click(home)
    expect(runtime.emit).toHaveBeenCalledOnce()
    expect(runtime.emit).toHaveBeenCalledWith('go_to_page', { page: 'home' })
  })

  // main Logs audit is a direct link now, so it is no root to keep open; a leaf closes its own root
  it('lets a leaf close its own root, and Logs audit is a link, not a root', async () => {
    const user = userEvent.setup()
    renderWithTheme(<SidebarMenuUI {...props()} />)
    const orders = screen.getByRole('button', { name: 'Orders' })
    const home = screen.getByRole('link', { name: 'Home' })
    expect(screen.queryByRole('button', { name: 'Logs audit' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Logs audit' })).toHaveAttribute('href', '/settings/logs')
    await user.click(orders)
    expect(orders).toHaveAttribute('aria-expanded', 'true')

    runtime.emit.mockClear()
    await user.click(home)
    expect(orders).toHaveAttribute('aria-expanded', 'false')
    expect(runtime.emit).toHaveBeenCalledOnce()
    expect(runtime.emit).toHaveBeenCalledWith('go_to_page', { page: 'home' })
  })

  it('makes a closed nav inert and restores the last connected external opener', async () => {
    const external = document.createElement('button')
    external.textContent = 'External menu opener'
    document.body.appendChild(external)
    const rendered = renderWithTheme(<SidebarMenuUI {...props()} />)
    external.focus()
    screen.getByRole('button', { name: 'Orders' }).focus()

    runtime.isCollapse = true
    rendered.rerender(<ThemeProvider theme={dashboardTheme}><SidebarMenuUI {...props()} /></ThemeProvider>)
    const nav = document.querySelector('[data-slot="sidebar-navigation"]')
    expect(nav).toHaveAttribute('inert')
    expect(nav).toHaveAttribute('aria-hidden', 'true')
    await waitFor(() => expect(external).toHaveFocus())
    external.remove()
  })

  // redesign 5.1 audit (H4): the page's menu button unmounts while the menu is open, so on close the remembered opener is gone
  describe('closing when the remembered opener is no longer in the page', () => {
    const added = []
    const append = element => { document.body.appendChild(element); added.push(element); return element }
    const el = (tag, id, { visible = true } = {}) => {
      const element = document.createElement(tag)
      element.id = id
      element.textContent = id
      // jsdom has no layout: a box is what makes an element "visible"
      element.getClientRects = () => (visible ? [{ width: 1, height: 1 }] : [])
      return append(element)
    }
    const closeWithGoneOpener = () => {
      const external = el('button', 'external-opener')
      const rendered = renderWithTheme(<SidebarMenuUI {...props()} />)
      external.focus()
      screen.getByRole('button', { name: 'Orders' }).focus()
      external.remove()
      runtime.isCollapse = true
      rendered.rerender(<ThemeProvider theme={dashboardTheme}><SidebarMenuUI {...props()} /></ThemeProvider>)
    }
    afterEach(() => { added.splice(0).forEach(element => element.remove()) })

    it('focuses the first visible h1, giving it a temporary tabindex', () => {
      el('h1', 'hidden-title', { visible: false })
      const title = el('h1', 'page-title')
      el('h1', 'second-title')
      closeWithGoneOpener()
      expect(title).toHaveFocus()
      expect(title).toHaveAttribute('tabindex', '-1')
      title.blur()
      expect(title).not.toHaveAttribute('tabindex')
    })

    it('falls back to the main container when the page has no visible h1', () => {
      el('h1', 'hidden-title', { visible: false })
      const main = el('main', 'page-main')
      closeWithGoneOpener()
      expect(main).toHaveFocus()
    })

    it('does not move the focus on a first load that collapses below 1024px (nothing was remembered)', () => {
      runtime.width = 800
      const title = el('h1', 'page-title')
      renderWithTheme(<SidebarMenuUI {...props()} />)
      expect(title).not.toHaveFocus()
      expect(document.body).toHaveFocus()
    })
  })

  // (#79 = W1-QC1-13, #68 b): every page paints its «Open menu» button only while the menu is collapsed, so opening
  // the menu unmounts the button the focus came from and closing it mounts another one with the same name.
  describe('the page header «Open menu» button comes and goes with the menu (#79, #68 b)', () => {
    const added = []
    const visible = node => { if (node) node.getClientRects = () => [{ width: 1, height: 1 }] }
    const Page = ({ openerBox = true }) => (
      <>
        {runtime.isCollapse && <button type='button' aria-label='Open menu' ref={openerBox ? visible : undefined}>Open menu</button>}
      </>
    )
    const tree = options => (
      <ThemeProvider theme={dashboardTheme}>
        <Page {...options} />
        <SidebarMenuUI {...{ productsState: { apps: [] }, getBillingToken: vi.fn(), billingUrl: 'https://billing.test', setShowBillingPayment: vi.fn() }} />
      </ThemeProvider>
    )
    const title = () => {
      const h1 = document.createElement('h1')
      h1.textContent = 'Page title'
      h1.getClientRects = () => [{ width: 1, height: 1 }]
      document.body.append(h1)
      added.push(h1)
      return h1
    }
    afterEach(() => { added.splice(0).forEach(element => element.remove()) })

    it('between 768 and 1023px, opening the menu from collapsed moves the focus to its Close button, not to <body> (#68 b)', () => {
      runtime.width = 900
      runtime.isCollapse = true
      const view = render(tree())
      const opener = screen.getByRole('button', { name: 'Open menu' })
      opener.focus()
      runtime.isCollapse = false
      view.rerender(tree())
      expect(opener.isConnected).toBe(false)
      expect(document.getElementById('side_bar')).not.toHaveAttribute('data-drawer')
      expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    })

    it('on closing, the focus goes to the «Open menu» button that was mounted in its place, not to the page title (#79)', () => {
      runtime.width = 500
      runtime.isCollapse = true
      const h1 = title()
      const view = render(tree())
      const first = screen.getByRole('button', { name: 'Open menu' })
      first.focus()
      runtime.isCollapse = false
      view.rerender(tree())
      expect(first.isConnected).toBe(false)
      expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
      runtime.isCollapse = true
      view.rerender(tree())
      const second = screen.getByRole('button', { name: 'Open menu' })
      expect(second).not.toBe(first)
      expect(second).toHaveFocus()
      expect(h1).not.toHaveFocus()
    })

    it('keeps today\'s fallback (the page title) when the new button is not on screen', () => {
      runtime.width = 500
      runtime.isCollapse = true
      const h1 = title()
      const view = render(tree())
      screen.getByRole('button', { name: 'Open menu' }).focus()
      runtime.isCollapse = false
      view.rerender(tree())
      runtime.isCollapse = true
      view.rerender(tree({ openerBox: false }))
      expect(h1).toHaveFocus()
    })

    // bugs H review R-4: a name repeated on the page (a «More actions» per row) cannot say which element it was
    it('keeps today\'s fallback when two visible elements carry the remembered name', () => {
      runtime.width = 500
      runtime.isCollapse = true
      const h1 = title()
      const view = render(tree())
      screen.getByRole('button', { name: 'Open menu' }).focus()
      runtime.isCollapse = false
      view.rerender(tree())
      const twin = document.createElement('button')
      twin.setAttribute('aria-label', 'Open menu')
      twin.getClientRects = () => [{ width: 1, height: 1 }]
      document.body.append(twin)
      added.push(twin)
      runtime.isCollapse = true
      view.rerender(tree())
      expect(twin).not.toHaveFocus()
      expect(h1).toHaveFocus()
    })

    // (row 17, O-2): between 768 and 1023px the open menu covers the page; Escape closes it and gives the focus back
    it('between 768 and 1023px, Escape collapses the menu and the focus goes back to the «Open menu» button', async () => {
      const user = userEvent.setup()
      runtime.width = 900
      runtime.isCollapse = true
      const view = render(tree())
      screen.getByRole('button', { name: 'Open menu' }).focus()
      runtime.isCollapse = false
      view.rerender(tree())
      expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
      runtime.collapse.mockClear()
      await user.keyboard('{Escape}')
      expect(runtime.collapse).toHaveBeenCalledTimes(1)
      expect(runtime.collapse).toHaveBeenCalledWith(true)
      runtime.isCollapse = true
      view.rerender(tree())
      expect(screen.getByRole('button', { name: 'Open menu' })).toHaveFocus()
    })

    it('at 1024px or more, Escape does not collapse the menu', async () => {
      const user = userEvent.setup()
      runtime.width = 1280
      render(tree())
      runtime.collapse.mockClear()
      await user.keyboard('{Escape}')
      expect(runtime.collapse).not.toHaveBeenCalled()
    })

    // (row 20a): on the phone the page repaints when a page is chosen, so the focus cannot go back to the opener
    // (it is replaced) nor stay on <body>: it goes to the title of the new page.
    it('below 768px, choosing a page in the menu leaves the focus on the title of the page, not on <body>', async () => {
      const user = userEvent.setup()
      runtime.width = 600
      runtime.isCollapse = true
      const h1 = title()
      const view = render(tree())
      screen.getByRole('button', { name: 'Open menu' }).focus()
      runtime.isCollapse = false
      view.rerender(tree())
      await user.click(screen.getByRole('link', { name: 'Home' }))
      expect(runtime.collapse).toHaveBeenCalledWith(true)
      runtime.isCollapse = true
      view.rerender(tree())
      await waitFor(() => expect(h1).toHaveFocus())
      expect(document.body).not.toHaveFocus()
    })

    // (row 20a, second pass): pages loaded with React.lazy/Suspense paint a skeleton first, so at the second frame the
    // title is not there yet (or the focus lands on a skeleton element that then unmounts). The focus is claimed for a bounded
    // window, as soon as the title of the new page shows, and only while the person has not acted.
    describe('below 768px, when the title of the chosen page shows late (lazy page behind a skeleton)', () => {
      const choosePage = async user => {
        runtime.width = 600
        runtime.isCollapse = true
        const view = render(tree())
        screen.getByRole('button', { name: 'Open menu' }).focus()
        runtime.isCollapse = false
        view.rerender(tree())
        await user.click(screen.getByRole('link', { name: 'Home' }))
        runtime.isCollapse = true
        view.rerender(tree())
        return view
      }
      const lateTitle = delay => new Promise(resolve => setTimeout(() => resolve(title()), delay))

      it('leaves the focus on the title that mounts 300 ms after the menu closed, not on <body>', async () => {
        const user = userEvent.setup()
        await choosePage(user)
        const h1 = await lateTitle(300)
        await waitFor(() => expect(h1).toHaveFocus())
        expect(document.body).not.toHaveFocus()
      })

      it('recovers the focus when it fell on a skeleton element that unmounted before the title mounted', async () => {
        const user = userEvent.setup()
        const skeleton = title()
        skeleton.textContent = 'Loading'
        await choosePage(user)
        await waitFor(() => expect(skeleton).toHaveFocus())
        skeleton.remove()
        expect(document.body).toHaveFocus()
        const h1 = await lateTitle(200)
        await waitFor(() => expect(h1).toHaveFocus())
      })

      it('does not take the focus from a person who pressed a key before the title mounted', async () => {
        const user = userEvent.setup()
        await choosePage(user)
        await user.keyboard('a')
        const h1 = await lateTitle(300)
        await new Promise(resolve => setTimeout(resolve, 150))
        expect(h1).not.toHaveFocus()
      })
    })

    it('below 768px, closing the menu without choosing a page still gives the focus back to the «Open menu» button', async () => {
      const user = userEvent.setup()
      runtime.width = 600
      runtime.isCollapse = true
      const h1 = title()
      const view = render(tree())
      screen.getByRole('button', { name: 'Open menu' }).focus()
      runtime.isCollapse = false
      view.rerender(tree())
      await user.click(screen.getByRole('button', { name: 'Close' }))
      runtime.isCollapse = true
      view.rerender(tree())
      expect(screen.getByRole('button', { name: 'Open menu' })).toHaveFocus()
      expect(h1).not.toHaveFocus()
    })

    it('between 768 and 1023px, choosing a page does not collapse the menu nor change where the focus goes', async () => {
      const user = userEvent.setup()
      runtime.width = 900
      runtime.isCollapse = false
      const h1 = title()
      render(tree())
      runtime.collapse.mockClear()
      await user.click(screen.getByRole('link', { name: 'Home' }))
      expect(runtime.collapse).not.toHaveBeenCalled()
      expect(h1).not.toHaveFocus()
    })

    it('does not take the focus when the width opens the menu again at 1024px or more', () => {
      runtime.width = 900
      runtime.isCollapse = true
      const view = render(tree())
      screen.getByRole('button', { name: 'Open menu' }).focus()
      runtime.width = 1280
      runtime.isCollapse = false
      view.rerender(tree())
      expect(screen.getByRole('button', { name: 'Collapse sidebar' })).not.toHaveFocus()
    })
  })

  // (#5): on /assistant the panel is never drawn (AssistantPanel hides it there), so the «Mia» row must not flip it.
  describe('the assistant entry on /assistant (#5)', () => {
    const assistantEntry = () => screen.getByRole('button', { name: 'Mia' })

    it('is not pressed and does not toggle the panel that /assistant never shows', async () => {
      const user = userEvent.setup()
      runtime.pathname = '/assistant'
      runtime.assistant = { isAvailable: true, isOpen: true, setOpen: vi.fn() }
      renderWithTheme(<SidebarMenuUI {...props()} />)
      expect(assistantEntry()).toHaveAttribute('aria-pressed', 'false')
      expect(assistantEntry()).not.toHaveAttribute('data-active')
      await user.click(assistantEntry())
      expect(runtime.assistant.setOpen).not.toHaveBeenCalled()
      expect(assistantEntry()).toBeInTheDocument()
    })

    it('keeps toggling the panel on any other page', async () => {
      const user = userEvent.setup()
      runtime.assistant = { isAvailable: true, isOpen: true, setOpen: vi.fn() }
      renderWithTheme(<SidebarMenuUI {...props()} />)
      expect(assistantEntry()).toHaveAttribute('aria-pressed', 'true')
      await user.click(assistantEntry())
      expect(runtime.assistant.setOpen).toHaveBeenCalledOnce()
    })
  })

  it('preserves level gates and controller wiring', () => {
    runtime.session = { user: { level: 5, name: 'Driver', lastname: 'Manager' } }
    const rendered = renderWithTheme(<SidebarMenuUI {...props()} />)
    expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Orders' })).toBeInTheDocument()
    rendered.unmount()
    renderWithTheme(<SidebarMenu marker='menu' />)
    expect(runtime.menuControllerProps).toMatchObject({ marker: 'menu', UIComponent: SidebarMenuUI })
  })
})

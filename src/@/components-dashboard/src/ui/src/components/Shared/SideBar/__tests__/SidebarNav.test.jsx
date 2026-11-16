/* eslint-disable import/first */
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ logout: vi.fn() }))

vi.mock('../../../../../../index', () => ({
  LogoutAction: ({ UIComponent, ...props }) => <UIComponent {...props} handleLogoutClick={runtime.logout} />
}))
vi.mock('../../UI/LanguageSelector', () => ({
  LanguageSelector: () => <button type='button'>Language selector</button>
}))

import { CommandPaletteProvider } from '../../../../contexts/CommandPaletteContext'
import { SidebarNav } from '../SidebarNav'

const t = (_key, fallback) => fallback

const link = (key, label, url, page, current = false, extra = {}) => ({ kind: 'link', key, label, url, page, current, ...extra })

const makeGroups = ({ currentPage = 'orders' } = {}) => [
  {
    key: 'operate',
    label: 'Operate',
    items: [
      link('home', 'Home', '/home', 'home', false, { icon: 'House' }),
      {
        kind: 'section',
        key: 'orders',
        label: 'Orders',
        icon: 'ListChecks',
        containsCurrent: currentPage === 'orders',
        items: [
          link('orders', 'Orders list', '/orders', 'orders', currentPage === 'orders'),
          link('appointments', 'Appointments', '/appointments', 'appointments')
        ]
      },
      {
        kind: 'section',
        key: 'delivery',
        label: 'Delivery',
        icon: 'Truck',
        containsCurrent: false,
        items: [link('drivers', 'Drivers', '/delivery/drivers-list', 'drivers')]
      }
    ]
  },
  {
    key: 'catalog',
    label: 'Catalog',
    items: [
      {
        kind: 'section',
        key: 'website',
        label: 'My website',
        icon: 'ExternalLink',
        containsCurrent: false,
        items: [{ kind: 'external', key: 'website-live', label: 'Live website', href: 'https://shop.example.com' }]
      },
      {
        kind: 'section',
        key: 'myProducts',
        label: 'My products',
        icon: 'ShoppingBag',
        containsCurrent: false,
        items: [link('app-7', 'Kiosk app', '/my-products?id=7', 'products', false, { search: '?id=7', state: { productId: 7, type: 'kiosk' } })]
      }
    ]
  },
  {
    key: 'grow',
    label: 'Grow',
    items: [{ kind: 'action', key: 'aiAgents', action: 'aiAgents', label: 'AI agents', icon: 'Workflow', external: true }]
  },
  {
    key: 'platform',
    label: 'Platform',
    items: [
      link('settings', 'Settings', '/settings', 'settings', false, { icon: 'Settings' }),
      { kind: 'action', key: 'billing', action: 'billing', label: 'Billing', icon: 'Banknote' },
      { kind: 'action', key: 'upgrade', action: 'upgrade', label: 'Upgrade to Pro', icon: 'Star' },
      {
        kind: 'section',
        key: 'logs',
        label: 'Logs audit',
        icon: 'FileText',
        independent: true,
        containsCurrent: false,
        items: [link('logs', 'Audit log', '/settings/logs', 'logs')]
      }
    ]
  }
]

const account = [
  link('profile', 'Profile', '/profile', 'profile', false, { icon: 'UserRound' }),
  link('free_products', 'Free downloads', '/free-downloads', 'free_products', false, { icon: 'Download' }),
  { kind: 'external', key: 'share_ideas', label: 'Share ideas', icon: 'Lightbulb', href: 'https://tally.so/r/WO4pdJ' },
  { kind: 'external', key: 'help', label: 'Help', icon: 'CircleHelp', href: 'https://docs.ordering.co' }
]

const handlers = () => ({
  onHome: vi.fn(),
  onToggle: vi.fn(),
  onNavigate: vi.fn(event => event?.preventDefault?.()),
  onBilling: vi.fn(),
  onUpgrade: vi.fn(),
  onAiAgents: vi.fn(),
  onCloseDrawer: vi.fn()
})

const setup = ({ page = null, ...props } = {}) => {
  const fns = handlers()
  const view = render(
    <CommandPaletteProvider enabled>
      {page}
      <SidebarNav
        t={t}
        groups={makeGroups()}
        account={account}
        showLanguage
        mode='expanded'
        logoSrc='/tenant-logo.svg'
        toggleLabel='Collapse sidebar'
        user={{ name: 'Ada', lastname: 'Admin', email: 'ada@example.com', photo: '' }}
        project='orderingplus'
        assistant={{ isAvailable: false, isOpen: false, toggle: vi.fn() }}
        {...fns}
        {...props}
      />
    </CommandPaletteProvider>
  )
  return { fns, ...view }
}

const nav = () => screen.getByRole('navigation', { name: 'Menu' })
const sectionButton = name => screen.getByRole('button', { name })
const panelOf = button => document.getElementById(button.getAttribute('aria-controls'))

beforeEach(() => {
  runtime.logout.mockClear()
})

describe('SidebarNav · structure and the one current entry', () => {
  it('is a navigation named Menu that keeps the hooks e2e and shell tests use', () => {
    setup()
    expect(nav()).toHaveAttribute('id', 'side_bar')
    expect(nav()).toHaveAttribute('data-slot', 'sidebar-navigation')
    expect(nav()).not.toHaveAttribute('data-collapsed')
    expect(nav()).not.toHaveAttribute('inert')
    expect(screen.getByTestId('sidebar-scroll-content')).toBeInTheDocument()
    expect(document.getElementById('user_info')).toContainElement(screen.getByRole('button', { name: 'Account: Ada Admin' }))
  })

  it('labels each group with its visible name', () => {
    setup()
    for (const name of ['Operate', 'Catalog', 'Grow', 'Platform']) {
      const group = screen.getByRole('group', { name })
      expect(within(group).getByText(name)).toBeVisible()
    }
  })

  it('marks exactly one entry with aria-current and never the parent that contains it', () => {
    setup()
    const current = document.querySelectorAll('[aria-current="page"]')
    expect(current).toHaveLength(1)
    expect(current[0]).toBe(screen.getByRole('link', { name: 'Orders list' }))
    expect(sectionButton('Orders')).not.toHaveAttribute('aria-current')
    expect(sectionButton('Orders')).toHaveAttribute('data-contains-current')
    expect(sectionButton('Delivery')).not.toHaveAttribute('data-contains-current')
  })
})

// (T10, decision X-3): a page of a section whose entry the menu does not show (/my-products/ordering-website with
// web_franchises_x on) still gets the one active state: the section header carries it, and nothing else does
describe('SidebarNav · the current page has no visible entry', () => {
  const withHiddenCurrent = () => makeGroups().map(group => ({
    ...group,
    items: group.items.map(item => {
      if (item.kind === 'link') return { ...item, current: false }
      if (item.kind !== 'section') return item
      return {
        ...item,
        containsCurrent: item.key === 'myProducts',
        items: item.items.map(child => ({ ...child, current: false }))
      }
    })
  }))

  it('marks the section header as the one current entry', () => {
    setup({ groups: withHiddenCurrent() })
    const current = document.querySelectorAll('[aria-current]')
    expect(current).toHaveLength(1)
    expect(current[0]).toBe(sectionButton('My products'))
    expect(current[0]).toHaveAttribute('aria-current', 'page')
  })

  it('in the rail the section button carries it, as the one current entry (review)', () => {
    setup({ groups: withHiddenCurrent(), mode: 'rail', toggleLabel: 'Expand sidebar' })
    const current = document.querySelectorAll('[aria-current]')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveAttribute('aria-label', 'My products')
    expect(current[0]).toHaveAttribute('data-contains-current')
  })

  it('leaves the header alone when a child is the current entry', () => {
    setup()
    expect(sectionButton('Orders')).not.toHaveAttribute('aria-current')
  })
})

describe('SidebarNav · disclosures', () => {
  it('opens the section that contains the current page on arrival', () => {
    setup()
    expect(sectionButton('Orders')).toHaveAttribute('aria-expanded', 'true')
    expect(sectionButton('Delivery')).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens one panel at a time and leaves the closed one hidden and inert', async () => {
    const user = userEvent.setup()
    setup()
    const orders = sectionButton('Orders')
    const delivery = sectionButton('Delivery')
    const ordersPanel = panelOf(orders)
    expect(ordersPanel).not.toHaveAttribute('inert')
    await user.click(delivery)
    expect(delivery).toHaveAttribute('aria-expanded', 'true')
    expect(orders).toHaveAttribute('aria-expanded', 'false')
    expect(ordersPanel).toHaveAttribute('inert')
    expect(ordersPanel).toHaveAttribute('hidden')
    expect(panelOf(delivery)).not.toHaveAttribute('hidden')
    await user.click(delivery)
    expect(delivery).toHaveAttribute('aria-expanded', 'false')
  })

  it('keeps an independent section (Logs audit) open while the others change', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(sectionButton('Logs audit'))
    await user.click(sectionButton('Delivery'))
    expect(sectionButton('Logs audit')).toHaveAttribute('aria-expanded', 'true')
    expect(sectionButton('Orders')).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes the open panel when a first-level link is pressed, but not the independent one', async () => {
    const user = userEvent.setup()
    const { fns } = setup()
    await user.click(sectionButton('Logs audit'))
    expect(sectionButton('Orders')).toHaveAttribute('aria-expanded', 'true')
    await user.click(screen.getByRole('link', { name: 'Home' }))
    expect(sectionButton('Orders')).toHaveAttribute('aria-expanded', 'false')
    expect(sectionButton('Logs audit')).toHaveAttribute('aria-expanded', 'true')
    expect(fns.onNavigate).toHaveBeenCalledOnce()
    expect(fns.onNavigate).toHaveBeenCalledWith(expect.objectContaining({ type: 'click' }), { page: 'home' })
  })

  it('navigates from a child link with its payload, including state for product apps', async () => {
    const user = userEvent.setup()
    const { fns } = setup()
    await user.click(screen.getByRole('link', { name: 'Appointments' }))
    expect(fns.onNavigate).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'click' }), { page: 'appointments' })
    await user.click(sectionButton('My products'))
    const app = screen.getByRole('link', { name: 'Kiosk app' })
    expect(app).toHaveAttribute('href', '/my-products?id=7')
    await user.click(app)
    expect(fns.onNavigate).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'click' }), { page: 'products', search: '?id=7', state: { productId: 7, type: 'kiosk' } })
  })

  it('disables a section that is not ready (disabled) instead of hiding it', () => {
    const groups = makeGroups()
    groups[1].items[0] = { ...groups[1].items[0], disabled: true, items: [] }
    setup({ groups })
    expect(sectionButton('My website')).toBeDisabled()
  })
})

describe('SidebarNav · actions and external links', () => {
  it('runs billing, upgrade and AI agents through their own handlers, not as navigation', async () => {
    const user = userEvent.setup()
    const { fns } = setup()
    await user.click(screen.getByRole('button', { name: 'Billing' }))
    await user.click(screen.getByRole('button', { name: 'Upgrade to Pro' }))
    await user.click(screen.getByRole('button', { name: 'AI agents' }))
    expect(fns.onBilling).toHaveBeenCalledOnce()
    expect(fns.onUpgrade).toHaveBeenCalledOnce()
    expect(fns.onAiAgents).toHaveBeenCalledOnce()
    expect(fns.onNavigate).not.toHaveBeenCalled()
  })

  it('opens an external link in a new tab, safely, and says so without changing its name', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(sectionButton('My website'))
    const live = screen.getByRole('link', { name: 'Live website' })
    expect(live).toHaveAttribute('href', 'https://shop.example.com')
    expect(live).toHaveAttribute('target', '_blank')
    expect(live).toHaveAttribute('rel', 'noopener noreferrer')
    expect(live).toHaveAccessibleDescription('opens in a new tab')
    expect(within(live).getByText('opens in a new tab')).toBeInTheDocument()
    const agents = screen.getByRole('button', { name: 'AI agents' })
    expect(agents).toHaveAccessibleDescription('opens in a new tab')
    // redesign 5.1 audit (H12): ExternalLink is directional, so it mirrors in RTL
    expect(live.querySelector('.odc-nav-ext')).toHaveClass('odc-icon-flip')
    expect(agents.querySelector('.odc-nav-ext')).toHaveClass('odc-icon-flip')
    expect(sectionButton('My website').querySelector('svg')).toHaveClass('odc-icon-flip')
  })
})

describe('SidebarNav · header, tools and assistant', () => {
  it('shows the logo as a Home button and the header toggle with the label it is given', async () => {
    const user = userEvent.setup()
    const { fns } = setup()
    const logo = screen.getByRole('button', { name: 'Home' })
    expect(logo.querySelector('img')).toHaveAttribute('src', '/tenant-logo.svg')
    expect(logo.querySelector('img')).toHaveAttribute('alt', '')
    await user.click(logo)
    expect(fns.onHome).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(fns.onToggle).toHaveBeenCalledOnce()
  })

  it('offers the command palette as a search field button with its shortcut', () => {
    setup()
    const search = screen.getByRole('button', { name: /Search/ })
    expect(search).toHaveAttribute('aria-haspopup', 'dialog')
    expect(search).toHaveAttribute('aria-keyshortcuts')
    expect(search.querySelector('kbd').closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('does not paint the search when the palette is unavailable', () => {
    render(<SidebarNav t={t} groups={[]} account={[]} mode='expanded' toggleLabel='Collapse sidebar' user={{}} {...handlers()} />)
    expect(screen.queryByRole('button', { name: /Search/ })).not.toBeInTheDocument()
  })

  it('paints the assistant as a plain row that toggles independently and shows its stage', async () => {
    const user = userEvent.setup()
    const toggle = vi.fn()
    setup({ assistant: { isAvailable: true, isOpen: true, toggle } })
    const button = screen.getByRole('button', { name: 'Mia' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveAttribute('aria-keyshortcuts', 'Meta+J Control+J')
    expect(button).toHaveAttribute('title', expect.stringContaining('⌘J / Ctrl+J'))
    expect(within(button).getByText('Beta')).toHaveAttribute('aria-hidden', 'true')
    await user.click(button)
    expect(toggle).toHaveBeenCalledOnce()
  })
})

describe('SidebarNav · modes', () => {
  it('hides a collapsed menu from everything: inert, aria-hidden and data-collapsed', () => {
    setup({ mode: 'collapsed' })
    const root = document.getElementById('side_bar')
    expect(root).toHaveAttribute('data-collapsed')
    expect(root).toHaveAttribute('inert')
    expect(root).toHaveAttribute('aria-hidden', 'true')
  })

  it('is a drawer below 768px: scrim click and Escape close it', async () => {
    const user = userEvent.setup()
    const { fns } = setup({ mode: 'drawer' })
    const root = document.getElementById('side_bar')
    expect(root).toHaveAttribute('data-drawer')
    await user.click(document.querySelector('[data-slot="sidebar-scrim"]'))
    expect(fns.onCloseDrawer).toHaveBeenCalledTimes(1)
    await user.keyboard('{Escape}')
    expect(fns.onCloseDrawer).toHaveBeenCalledTimes(2)
  })

  it('does not close on Escape or paint a scrim when it is not a drawer', async () => {
    const user = userEvent.setup()
    const { fns } = setup({ mode: 'expanded' })
    expect(document.querySelector('[data-slot="sidebar-scrim"]')).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(fns.onCloseDrawer).not.toHaveBeenCalled()
  })

  // (#68 b): between 768 and 1023px the open menu is `expanded`, not a drawer, and the page's «Open menu» button
  // unmounts when it opens; without this the focus fell to <body>.
  describe('opening from collapsed below 1024px (focusToggleOnOpen)', () => {
    const tree = (mode, extra = {}) => (
      <CommandPaletteProvider enabled>
        <SidebarNav
          t={t}
          groups={makeGroups()}
          account={account}
          mode={mode}
          logoSrc='/tenant-logo.svg'
          toggleLabel='Close'
          {...handlers()}
          {...extra}
        />
      </CommandPaletteProvider>
    )

    it('moves the focus to the Close button when the menu goes from collapsed to expanded', () => {
      const view = render(tree('collapsed', { focusToggleOnOpen: true }))
      expect(document.body).toHaveFocus()
      view.rerender(tree('expanded', { focusToggleOnOpen: true }))
      expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    })

    it('does not take the focus on first render, nor when it was not opened from collapsed, nor without the prop', () => {
      const first = render(tree('expanded', { focusToggleOnOpen: true }))
      expect(document.body).toHaveFocus()
      first.unmount()
      const wide = render(tree('collapsed'))
      wide.rerender(tree('expanded'))
      expect(document.body).toHaveFocus()
    })

    it('still does not close on Escape when it is not a drawer', async () => {
      const user = userEvent.setup()
      const onCloseDrawer = vi.fn()
      const view = render(tree('collapsed', { focusToggleOnOpen: true, onCloseDrawer }))
      view.rerender(tree('expanded', { focusToggleOnOpen: true, onCloseDrawer }))
      await user.keyboard('{Escape}')
      expect(onCloseDrawer).not.toHaveBeenCalled()
    })

    // (row 17, O-2): the menu opened between 768 and 1023px is `expanded` and covers the page like a drawer, so with
    // closeOnEscape (the shell passes it below 1024px) Escape closes it too.
    it('closes on Escape, once, when closeOnEscape is on and the menu is expanded', async () => {
      const user = userEvent.setup()
      const onCloseDrawer = vi.fn()
      render(tree('expanded', { focusToggleOnOpen: true, closeOnEscape: true, onCloseDrawer }))
      await user.keyboard('{Escape}')
      expect(onCloseDrawer).toHaveBeenCalledTimes(1)
    })

    it('does not close on Escape with closeOnEscape when the menu is a rail or collapsed', async () => {
      const user = userEvent.setup()
      const onCloseDrawer = vi.fn()
      const view = render(tree('rail', { closeOnEscape: true, onCloseDrawer }))
      await user.keyboard('{Escape}')
      view.rerender(tree('collapsed', { closeOnEscape: true, onCloseDrawer }))
      await user.keyboard('{Escape}')
      expect(onCloseDrawer).not.toHaveBeenCalled()
    })

    it('does not close on Escape with closeOnEscape when the key was already handled', async () => {
      const user = userEvent.setup()
      const onCloseDrawer = vi.fn()
      render(tree('expanded', { closeOnEscape: true, onCloseDrawer }))
      const stop = event => event.preventDefault()
      document.body.addEventListener('keydown', stop)
      await user.keyboard('{Escape}')
      document.body.removeEventListener('keydown', stop)
      expect(onCloseDrawer).not.toHaveBeenCalled()
    })

    // (row 17, review fix): the menu opened between 768 and 1023px does not own Escape while the user works in the page.
    describe('with closeOnEscape and the focus outside the sidebar', () => {
      const withPage = (mode, extra, page) => (
        <>
          {page}
          {tree(mode, extra)}
        </>
      )

      it('does not close when Escape is pressed in a text field of the page', async () => {
        const user = userEvent.setup()
        const onCloseDrawer = vi.fn()
        render(withPage('expanded', { closeOnEscape: true, onCloseDrawer }, <input aria-label='Page search' />))
        await user.click(screen.getByRole('textbox', { name: 'Page search' }))
        await user.keyboard('{Escape}')
        expect(onCloseDrawer).not.toHaveBeenCalled()
      })

      it.each([
        ['a textarea', () => <textarea aria-label='Page field' />],
        ['a select', () => <select aria-label='Page field'><option>A</option></select>],
        ['a contenteditable', () => <div role='textbox' aria-label='Page field' contentEditable suppressContentEditableWarning tabIndex={0} />]
      ])('does not close when Escape is pressed in %s of the page', async (_name, Field) => {
        const user = userEvent.setup()
        const onCloseDrawer = vi.fn()
        render(withPage('expanded', { closeOnEscape: true, onCloseDrawer }, <Field />))
        screen.getByLabelText('Page field').focus()
        await user.keyboard('{Escape}')
        expect(onCloseDrawer).not.toHaveBeenCalled()
      })

      it.each(['dialog', 'alertdialog', 'menu', 'listbox'])('does not close when Escape is pressed inside a page %s', async role => {
        const user = userEvent.setup()
        const onCloseDrawer = vi.fn()
        render(withPage('expanded', { closeOnEscape: true, onCloseDrawer }, (
          <div role={role} aria-label='Page layer'><button type='button'>Inside layer</button></div>
        )))
        screen.getByRole('button', { name: 'Inside layer' }).focus()
        await user.keyboard('{Escape}')
        expect(onCloseDrawer).not.toHaveBeenCalled()
      })

      it('closes when the focus is on a plain control of the page or on <body>', async () => {
        const user = userEvent.setup()
        const onCloseDrawer = vi.fn()
        render(withPage('expanded', { closeOnEscape: true, onCloseDrawer }, <button type='button'>Page action</button>))
        await user.keyboard('{Escape}')
        expect(onCloseDrawer).toHaveBeenCalledTimes(1)
        screen.getByRole('button', { name: 'Page action' }).focus()
        await user.keyboard('{Escape}')
        expect(onCloseDrawer).toHaveBeenCalledTimes(2)
      })

      it('closes when the focus is inside the sidebar, on the toggle included', async () => {
        const user = userEvent.setup()
        const onCloseDrawer = vi.fn()
        render(withPage('expanded', { closeOnEscape: true, focusToggleOnOpen: true, onCloseDrawer }, <input aria-label='Page search' />))
        screen.getByRole('button', { name: 'Close' }).focus()
        await user.keyboard('{Escape}')
        expect(onCloseDrawer).toHaveBeenCalledTimes(1)
        screen.getByRole('link', { name: /orders/i }).focus()
        await user.keyboard('{Escape}')
        expect(onCloseDrawer).toHaveBeenCalledTimes(2)
      })

      it('keeps closing the drawer from a text field of the page, as before', () => {
        const onCloseDrawer = vi.fn()
        render(withPage('drawer', { onCloseDrawer }, <input aria-label='Page search' />))
        fireEvent.keyDown(screen.getByLabelText('Page search', { selector: 'input' }), { key: 'Escape' })
        expect(onCloseDrawer).toHaveBeenCalled()
      })
    })
  })

  it('gives every rail link and action its own accessible name and a visible label', () => {
    setup({ mode: 'rail', toggleLabel: 'Expand sidebar' })
    expect(document.getElementById('side_bar')).toHaveAttribute('data-rail')
    // redesign 5.1 audit (H7): the name is aria-label; the tip beside the control replaces title, which never shows on focus
    for (const name of ['Home', 'Settings']) {
      const entry = screen.getByRole('link', { name })
      expect(entry).toHaveAttribute('aria-label', name)
      expect(entry.parentElement.querySelector('.odc-rail-tip')).toHaveTextContent(name)
    }
    for (const name of ['Billing', 'Upgrade to Pro', 'AI agents']) {
      const entry = screen.getByRole('button', { name })
      expect(entry).toHaveAttribute('aria-label', name)
      expect(entry.parentElement.querySelector('.odc-rail-tip')).toHaveTextContent(name)
    }
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()
    // The logo gives way to the expand button in the rail.
    expect(screen.queryByRole('button', { name: 'Home' })).not.toBeInTheDocument()
  })

  it('turns each section into a menu in the rail and navigates with the same payload', async () => {
    const user = userEvent.setup()
    const { fns } = setup({ mode: 'rail', toggleLabel: 'Expand sidebar' })
    const orders = screen.getByRole('button', { name: 'Orders' })
    expect(orders).toHaveAttribute('aria-haspopup', 'menu')
    expect(orders).not.toHaveAttribute('aria-expanded', 'true')
    await user.click(orders)
    const menu = await screen.findByRole('menu')
    expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Orders list', 'Appointments'])
    await user.click(within(menu).getByRole('menuitem', { name: 'Appointments' }))
    expect(fns.onNavigate).toHaveBeenCalledWith(null, { page: 'appointments' })
  })

  // redesign fix-qa E8: the rail only shows an icon, so the popover says which section it opens (a label, not an item).
  it('names the section at the top of its rail menu, without making it an item', async () => {
    const user = userEvent.setup()
    setup({ mode: 'rail', toggleLabel: 'Expand sidebar' })
    await user.click(screen.getByRole('button', { name: 'Orders' }))
    const menu = await screen.findByRole('menu')
    expect(menu).toHaveAttribute('data-title', 'Orders')
    expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Orders list', 'Appointments'])
    expect(within(menu).queryByRole('menuitem', { name: 'Orders' })).toBeNull()
  })

  it('opens an external destination from a rail menu in a safe new tab', async () => {
    const user = userEvent.setup()
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    try {
      setup({ mode: 'rail', toggleLabel: 'Expand sidebar' })
      await user.click(screen.getByRole('button', { name: 'My website' }))
      await user.click(await screen.findByRole('menuitem', { name: 'Live website' }))
      expect(open).toHaveBeenCalledExactlyOnceWith('https://shop.example.com', '_blank', 'noopener,noreferrer')
    } finally {
      open.mockRestore()
    }
  })

  it('shows only the avatar as the account trigger in the rail, still named', () => {
    setup({ mode: 'rail', toggleLabel: 'Expand sidebar' })
    const trigger = screen.getByRole('button', { name: 'Account: Ada Admin' })
    expect(within(trigger).queryByText('Ada Admin')).not.toBeInTheDocument()
  })
})

describe('SidebarNav · the more-below fade', () => {
  const metrics = (element, { scrollHeight, clientHeight, scrollTop }) => {
    Object.defineProperty(element, 'scrollHeight', { configurable: true, value: scrollHeight })
    Object.defineProperty(element, 'clientHeight', { configurable: true, value: clientHeight })
    Object.defineProperty(element, 'scrollTop', { configurable: true, writable: true, value: scrollTop })
  }

  it('marks the scroll area while there is content below and clears it at the end', () => {
    setup()
    const scroll = screen.getByTestId('sidebar-scroll-content')
    expect(scroll).not.toHaveAttribute('data-more')
    metrics(scroll, { scrollHeight: 900, clientHeight: 400, scrollTop: 0 })
    act(() => { fireEvent.scroll(scroll) })
    expect(scroll).toHaveAttribute('data-more')
    scroll.scrollTop = 498
    act(() => { fireEvent.scroll(scroll) })
    expect(scroll).toHaveAttribute('data-more')
    scroll.scrollTop = 499
    act(() => { fireEvent.scroll(scroll) })
    expect(scroll).not.toHaveAttribute('data-more')
  })
})

// redesign 5.1 audit fixes (H2, H3, H6, H9)
describe('SidebarNav · rail: the section that holds the current page (H2)', () => {
  it('says so programmatically on the trigger, from a hidden text with the page name', async () => {
    setup({ mode: 'rail', toggleLabel: 'Expand sidebar' })
    const orders = screen.getByRole('button', { name: 'Orders' })
    expect(orders).toHaveAttribute('data-contains-current')
    expect(orders).toHaveAccessibleDescription('Current page: Orders list')
    expect(screen.getByRole('button', { name: 'Delivery' })).not.toHaveAttribute('aria-describedby')
  })

  it('marks the current page inside the rail menu with the indicator', async () => {
    const user = userEvent.setup()
    setup({ mode: 'rail', toggleLabel: 'Expand sidebar' })
    await user.click(screen.getByRole('button', { name: 'Orders' }))
    const menu = await screen.findByRole('menu')
    const current = within(menu).getByRole('menuitem', { name: 'Orders list' })
    expect(current.querySelector('[data-current]')).not.toBeNull()
    expect(within(menu).getByRole('menuitem', { name: 'Appointments' }).querySelector('[data-current]')).toBeNull()
  })

  it('wraps each rail control in a visible-on-focus label that is hidden from assistive tech', () => {
    setup({ mode: 'rail', toggleLabel: 'Expand sidebar' })
    const home = screen.getByRole('link', { name: 'Home' })
    const tip = home.parentElement.querySelector('.odc-rail-tip')
    expect(tip).toHaveTextContent('Home')
    expect(tip).toHaveAttribute('aria-hidden', 'true')
    expect(home).not.toHaveAttribute('title')
  })
})

describe('SidebarNav · the drawer is modal (H3)', () => {
  const page = <main data-testid='page'><button type='button'>Page button</button></main>

  it('is a named, modal dialog inside the Menu landmark, and only in drawer mode', () => {
    setup({ mode: 'drawer', page })
    const dialog = screen.getByRole('dialog', { name: 'Menu' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(nav()).toContainElement(dialog)
    expect(dialog).toContainElement(screen.getByRole('button', { name: 'Account: Ada Admin' }))
  })

  it('has no dialog semantics when expanded or in the rail', () => {
    const first = setup({ mode: 'expanded' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    first.unmount()
    setup({ mode: 'rail', toggleLabel: 'Expand sidebar' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('traps Tab and Shift+Tab inside the panel', async () => {
    const user = userEvent.setup()
    setup({ mode: 'drawer', page })
    const first = screen.getByRole('button', { name: 'Home' })
    const last = screen.getByRole('button', { name: 'Account: Ada Admin' })
    last.focus()
    await user.tab()
    expect(first).toHaveFocus()
    await user.tab({ shift: true })
    expect(last).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Page button' })).not.toHaveFocus()
  })

  it('makes the rest of the page inert while open and gives it back on close', () => {
    const view = setup({ mode: 'drawer', page })
    expect(screen.getByTestId('page')).toHaveAttribute('inert')
    expect(nav()).not.toHaveAttribute('inert')
    expect(view.container).not.toHaveAttribute('inert')
    view.rerender(
      <CommandPaletteProvider enabled>
        {page}
        <SidebarNav t={t} groups={makeGroups()} account={account} mode='expanded' toggleLabel='Collapse sidebar' user={{}} {...handlers()} />
      </CommandPaletteProvider>
    )
    expect(screen.getByTestId('page')).not.toHaveAttribute('inert')
  })

  it('leaves inert what was inert already', () => {
    const stale = document.createElement('div')
    stale.setAttribute('inert', '')
    document.body.appendChild(stale)
    const view = setup({ mode: 'drawer', page })
    view.unmount()
    expect(stale).toHaveAttribute('inert')
    stale.remove()
  })

  it('locks the body scroll and restores it', () => {
    document.body.style.overflow = 'auto'
    const view = setup({ mode: 'drawer', page })
    expect(document.body.style.overflow).toBe('hidden')
    view.unmount()
    expect(document.body.style.overflow).toBe('auto')
    document.body.style.overflow = ''
  })
})

describe('SidebarNav · the current entry on arrival (H6)', () => {
  it('scrolls the current entry into view on mount and on a route change, not on every render', () => {
    const original = Element.prototype.scrollIntoView
    const calls = []
    Element.prototype.scrollIntoView = vi.fn(function (options) { calls.push({ el: this, options }) })
    try {
      const view = setup()
      expect(calls).toHaveLength(1)
      expect(calls[0].el).toBe(screen.getByRole('link', { name: 'Orders list' }))
      expect(calls[0].options).toEqual({ block: 'nearest' })
      const rerender = groups => view.rerender(
        <CommandPaletteProvider enabled>
          <SidebarNav t={t} groups={groups} account={account} mode='expanded' toggleLabel='Collapse sidebar' user={{}} {...handlers()} />
        </CommandPaletteProvider>
      )
      rerender(makeGroups())
      expect(calls).toHaveLength(1)
      const groups = makeGroups({ currentPage: 'none' })
      groups[0].items[0] = { ...groups[0].items[0], current: true }
      rerender(groups)
      expect(calls).toHaveLength(2)
      expect(calls[1].el).toBe(screen.getByRole('link', { name: 'Home' }))
    } finally {
      Element.prototype.scrollIntoView = original
    }
  })
})

// redesign fix-qa E8: scrolling the current item into view moved Chromium's Tab starting point after it, so the first Tab on
// arrival skipped the Skip to content link and the top of the menu. The arrival puts the starting point back at the document start.
describe('SidebarNav · the Tab starting point on arrival (E8)', () => {
  const withScroll = run => {
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = vi.fn()
    try { run() } finally { Element.prototype.scrollIntoView = original }
  }

  it('focuses the body (the document start) once the current entry is scrolled into view, when nothing was focused', () => {
    withScroll(() => {
      const focus = vi.spyOn(document.body, 'focus')
      setup()
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1)
      expect(focus).toHaveBeenCalledTimes(1)
      expect(focus).toHaveBeenCalledWith({ preventScroll: true })
      expect(document.body).not.toHaveAttribute('tabindex')
      focus.mockRestore()
    })
  })

  it('leaves the focus alone when something already has it, and keeps a tabindex the body had', () => {
    withScroll(() => {
      const input = document.createElement('input')
      document.body.append(input)
      input.focus()
      const focus = vi.spyOn(document.body, 'focus')
      setup()
      expect(focus).not.toHaveBeenCalled()
      expect(input).toHaveFocus()
      input.remove()
      focus.mockRestore()
      document.body.setAttribute('tabindex', '0')
      const again = vi.spyOn(document.body, 'focus')
      setup()
      expect(document.body).toHaveAttribute('tabindex', '0')
      again.mockRestore()
      document.body.removeAttribute('tabindex')
    })
  })
})

describe('SidebarNav · account menu', () => {
  it('names the trigger with the user, shows project and email, and opens a dialog', async () => {
    const user = userEvent.setup()
    setup()
    const trigger = screen.getByRole('button', { name: 'Account: Ada Admin' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    // project and email are two pieces now (see the structure test below); the text a reader gets is the same.
    expect(trigger.querySelector('.odc-account-sub')).toHaveTextContent('orderingplus · ada@example.com')
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const dialog = await screen.findByRole('dialog', { name: 'Ada Admin' })
    expect(within(dialog).getByText('ada@example.com')).toBeInTheDocument()
  })

  it('lists profile, downloads and an external Help, and navigates from the menu', async () => {
    const user = userEvent.setup()
    const { fns } = setup()
    await user.click(screen.getByRole('button', { name: 'Account: Ada Admin' }))
    const dialog = await screen.findByRole('dialog')
    const help = within(dialog).getByRole('link', { name: 'Help' })
    expect(help).toHaveAttribute('target', '_blank')
    expect(help).toHaveAttribute('rel', 'noopener noreferrer')
    expect(help).toHaveAccessibleDescription('opens in a new tab')
    await user.click(within(dialog).getByRole('link', { name: 'Free downloads' }))
    expect(fns.onNavigate).toHaveBeenCalledWith(expect.objectContaining({ type: 'click' }), { page: 'free_products' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('offers the language selector only when showLanguage is true', async () => {
    const user = userEvent.setup()
    const first = setup({ showLanguage: false })
    await user.click(screen.getByRole('button', { name: 'Account: Ada Admin' }))
    await screen.findByRole('dialog')
    expect(screen.queryByRole('button', { name: 'Language selector' })).not.toBeInTheDocument()
    first.unmount()
    setup({ showLanguage: true })
    await user.click(screen.getByRole('button', { name: 'Account: Ada Admin' }))
    expect(await screen.findByRole('button', { name: 'Language selector' })).toBeInTheDocument()
  })

  it('logs out through the controller handler', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Account: Ada Admin' }))
    await user.click(await screen.findByRole('button', { name: 'Log out' }))
    expect(runtime.logout).toHaveBeenCalledOnce()
  })

  it('adds the Canny link only when there is one', async () => {
    const user = userEvent.setup()
    const first = setup()
    await user.click(screen.getByRole('button', { name: 'Account: Ada Admin' }))
    await screen.findByRole('dialog')
    expect(screen.queryByRole('link', { name: 'Request features' })).not.toBeInTheDocument()
    first.unmount()
    setup({ cannyLink: 'https://orderingplus.canny.io/x' })
    await user.click(screen.getByRole('button', { name: 'Account: Ada Admin' }))
    const canny = await screen.findByRole('link', { name: 'Request features' })
    expect(canny).toHaveAttribute('href', 'https://orderingplus.canny.io/x')
    expect(canny).toHaveAttribute('rel', 'noopener noreferrer')
    expect(canny).toHaveAttribute('data-canny-link')
  })

  it('closes the menu on Escape without closing the drawer', async () => {
    const user = userEvent.setup()
    const { fns } = setup({ mode: 'drawer' })
    await user.click(screen.getByRole('button', { name: 'Account: Ada Admin' }))
    // redesign 5.1 audit (H3): the drawer is itself a dialog, so the popover is found by its name
    await screen.findByRole('dialog', { name: 'Ada Admin' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Ada Admin' })).not.toBeInTheDocument())
    expect(fns.onCloseDrawer).not.toHaveBeenCalled()
  })

  // (row 17): the guard holds for the expanded menu closed by Escape too
  it('closes the account popover on Escape without closing the expanded menu that has closeOnEscape', async () => {
    const user = userEvent.setup()
    const { fns } = setup({ mode: 'expanded', closeOnEscape: true })
    await user.click(screen.getByRole('button', { name: 'Account: Ada Admin' }))
    await screen.findByRole('dialog', { name: 'Ada Admin' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Ada Admin' })).not.toBeInTheDocument())
    expect(fns.onCloseDrawer).not.toHaveBeenCalled()
  })

  // redesign 5.1 audit (H9, H12): external rows in the menu say so like the navigation does
  it('marks Help and Share ideas as new-tab links with the trailing icon, mirrored in RTL', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Account: Ada Admin' }))
    const dialog = await screen.findByRole('dialog')
    for (const name of ['Help', 'Share ideas']) {
      const row = within(dialog).getByRole('link', { name })
      expect(row).toHaveAccessibleDescription('opens in a new tab')
      expect(within(row).getByText('opens in a new tab')).toBeInTheDocument()
      const icon = row.querySelector('.odc-nav-ext')
      expect(icon).not.toBeNull()
      expect(icon).toHaveClass('odc-icon-flip')
    }
  })

  it('names the language selector Language and puts the first focus on it', async () => {
    const user = userEvent.setup()
    setup({ showLanguage: true })
    await user.click(screen.getByRole('button', { name: 'Account: Ada Admin' }))
    const dialog = await screen.findByRole('dialog')
    const group = within(dialog).getByRole('group', { name: 'Language' })
    expect(within(group).getByRole('button', { name: 'Language selector' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Language selector' })).toHaveFocus())
  })
})

describe('SidebarNav · upgrade offer card', () => {
  const upgradeOffer = (overrides = {}) => ({
    title: 'Upgrade your plan',
    subtitle: 'Save 50% · 12 days left',
    ctaLabel: 'See offer',
    railLabel: 'Upgrade your plan · Save 50%',
    fraction: 0.4,
    onOpen: vi.fn(),
    ...overrides
  })

  it('renders nothing when there is no offer', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'See offer' })).not.toBeInTheDocument()
    expect(document.querySelector('.odc-upgrade-card')).toBeNull()
  })

  it('shows the card above the account row, with its title, subtitle and a working CTA', async () => {
    const user = userEvent.setup()
    const offer = upgradeOffer()
    setup({ upgradeOffer: offer })
    expect(screen.getByText('Upgrade your plan')).toBeInTheDocument()
    expect(screen.getByText('Save 50% · 12 days left')).toBeInTheDocument()
    const foot = document.getElementById('user_info')
    const card = foot.querySelector('.odc-upgrade-card')
    expect(card).not.toBeNull()
    // The card comes before the account trigger in the footer.
    expect(card.compareDocumentPosition(screen.getByRole('button', { name: 'Account: Ada Admin' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'See offer' }))
    expect(offer.onOpen).toHaveBeenCalledOnce()
  })

  it('renders nothing extra when there is no offer in the rail', () => {
    setup({ mode: 'rail', toggleLabel: 'Expand sidebar' })
    expect(screen.queryByRole('button', { name: /Upgrade your plan/ })).not.toBeInTheDocument()
  })

  it('shows one compact icon button in the rail, named by railLabel, instead of the full card', async () => {
    const user = userEvent.setup()
    const offer = upgradeOffer()
    setup({ mode: 'rail', toggleLabel: 'Expand sidebar', upgradeOffer: offer })
    expect(document.querySelector('.odc-upgrade-card')).toBeNull()
    const button = screen.getByRole('button', { name: 'Upgrade your plan · Save 50%' })
    await user.click(button)
    expect(offer.onOpen).toHaveBeenCalledOnce()
  })
})

describe('RailItem label (N1, N3)', () => {
  it('sits at the measured centre of its control and Esc dismisses it until the focus leaves', async () => {
    const { RailItem } = await import('../AccountMenu')
    const { getByRole, container } = render(<RailItem label='Billing'><button type='button' aria-label='Billing'>B</button></RailItem>)
    const item = container.querySelector('.odc-rail-item')
    item.getBoundingClientRect = () => ({ top: 475, height: 32, left: 0, width: 44, right: 44, bottom: 507 })
    fireEvent.focus(getByRole('button', { name: 'Billing' }))
    expect(item.style.getPropertyValue('--odc-tip-y')).toBe('491px')
    fireEvent.keyDown(getByRole('button', { name: 'Billing' }), { key: 'Escape' })
    expect(item).toHaveAttribute('data-tip-dismissed')
    fireEvent.blur(getByRole('button', { name: 'Billing' }))
    expect(item).not.toHaveAttribute('data-tip-dismissed')
  })
})

const sidebarCss = readFileSync(path.join(__dirname, '..', 'sidebar.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const cssRule = selector => {
  const escaped = selector.replace(/[.[\]()*+?^$|]/g, '\\$&')
  const match = sidebarCss.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm'))
  expect(match, selector).not.toBeNull()
  return match[1]
}

// the collapse/expand button is the same element in both modes, so the focus stays on it.
describe('SidebarNav · the focus stays on the collapse / expand button', () => {
  const Harness = ({ mode, label }) => (
    <CommandPaletteProvider enabled>
      <SidebarNav
        t={t}
        groups={makeGroups()}
        account={account}
        mode={mode}
        toggleLabel={label}
        user={{ name: 'Ada', lastname: 'Admin', email: 'ada@example.com' }}
        project='orderingplus'
        {...handlers()}
      />
    </CommandPaletteProvider>
  )

  it('keeps the same node, and its focus, when the menu folds into the rail and unfolds again', () => {
    const { rerender } = render(<Harness mode='expanded' label='Collapse sidebar' />)
    const button = screen.getByRole('button', { name: 'Collapse sidebar' })
    button.focus()
    expect(button).toHaveFocus()

    rerender(<Harness mode='rail' label='Expand sidebar' />)
    expect(button.isConnected).toBe(true)
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBe(button)
    expect(button).toHaveFocus()

    rerender(<Harness mode='expanded' label='Collapse sidebar' />)
    expect(button.isConnected).toBe(true)
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBe(button)
    expect(button).toHaveFocus()
  })

  it('draws the rail label only in the rail and leaves the expanded header without a tip', () => {
    const { rerender } = render(<Harness mode='expanded' label='Collapse sidebar' />)
    const head = () => document.querySelector('.odc-sidebar-head')
    expect(head().querySelector('.odc-rail-tip')).toBeNull()
    rerender(<Harness mode='rail' label='Expand sidebar' />)
    expect(head().querySelector('.odc-rail-tip')).toHaveTextContent('Expand sidebar')
  })

  it('places the focused Skip to content link past the rail, so it never covers the expand button', () => {
    const rule = cssRule('.odc-skip-link:focus')
    expect(rule).toMatch(/inset-inline-start:\s*calc\(var\(--od-x-rail\) \+ var\(--od-space-2\)\)/)
  })
})

// the project code is never cut; the email is the piece that gets the ellipsis, in LTR and RTL.
describe('SidebarNav · the account subtitle keeps the project code whole', () => {
  it('draws project and email as two pieces, the email as its own LTR run', () => {
    setup()
    const sub = document.querySelector('.odc-account-sub')
    expect(sub).toHaveTextContent('orderingplus · ada@example.com')
    const project = sub.querySelector('.odc-account-project')
    const mail = sub.querySelector('.odc-account-mail')
    expect(project).toHaveTextContent(/^orderingplus$/)
    expect(mail).toHaveTextContent(/^ada@example\.com$/)
    expect(mail).toHaveAttribute('dir', 'ltr')
    expect(project.closest('.odc-account-sub')).toBe(sub)
  })

  it('keeps one piece when the project or the email is missing', () => {
    setup({ project: undefined })
    const sub = document.querySelector('.odc-account-sub')
    expect(sub).toHaveTextContent(/^ada@example\.com$/)
    expect(sub.querySelector('.odc-account-project')).toBeNull()
  })

  it('the project does not shrink and only the email takes the ellipsis', () => {
    expect(cssRule('.odc-account-sub')).not.toMatch(/text-overflow/)
    expect(cssRule('.odc-account-sub')).toMatch(/display:\s*flex/)
    expect(cssRule('.odc-account-project')).toMatch(/flex:\s*none/)
    const mail = cssRule('.odc-account-mail')
    expect(mail).toMatch(/min-inline-size:\s*0/)
    expect(mail).toMatch(/overflow:\s*hidden/)
    expect(mail).toMatch(/text-overflow:\s*ellipsis/)
  })
})

// a shell notice (past due, socket down, trial offer) takes room above the menu; the menu is the rest of the window.
describe('SidebarNav · the menu fits below the shell notices', () => {
  const observers = []
  class FakeResizeObserver {
    constructor (callback) { this.callback = callback; this.targets = []; observers.push(this) }
    observe (node) { this.targets.push(node) }
    unobserve () {}
    disconnect () { this.targets = [] }
  }

  it('starts below the notice stack and is as tall as the window minus everything above the layout', () => {
    const rule = cssRule('.odc-sidebar')
    expect(rule).toMatch(/inset-block-start:\s*var\(--odc-shell-banner-block, 0dvh\)/)
    expect(rule).toMatch(/block-size:\s*calc\(100dvh - var\(--odc-shell-notice-block, 0dvh\)\)/)
    const phone = sidebarCss.slice(sidebarCss.indexOf('@media (max-width: 767px)'))
    // The phone has no notice offset: the menu is fixed and the drawer covers the notices.
    expect(phone.slice(0, phone.indexOf('}\n}'))).toMatch(/\.odc-sidebar\s*\{[^}]*block-size:\s*100dvh/)
    expect(cssRule('.odc-sidebar[data-drawer]')).toMatch(/block-size:\s*100dvh/)
    expect(cssRule('.odc-sidebar[data-drawer]')).toMatch(/inset-block:\s*0/)
  })

  it('publishes how much room sits above the layout and updates it when the page changes', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    let top = 63
    const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const y = this.id === 'shell-layout' ? top : 0
      return { top: y, bottom: y, left: 0, right: 0, width: 0, height: 0, x: 0, y }
    })
    try {
      render(
        <div id='shell-layout'>
          <CommandPaletteProvider enabled>
            <SidebarNav t={t} groups={makeGroups()} account={account} mode='expanded' toggleLabel='Collapse sidebar' user={{}} {...handlers()} />
          </CommandPaletteProvider>
        </div>
      )
      const sidebar = document.getElementById('side_bar')
      // CommandPaletteProvider adds no DOM, so the layout is the sidebar's parent.
      expect(sidebar.parentElement.id).toBe('shell-layout')
      expect(sidebar.style.getPropertyValue('--odc-shell-notice-block')).toBe('63px')
      // The layout carries it too, for the pages that fill the window (the Settings hub).
      expect(sidebar.parentElement.style.getPropertyValue('--odc-shell-notice-block')).toBe('63px')

      top = 126
      act(() => { observers.forEach(observer => observer.callback([])) })
      expect(sidebar.style.getPropertyValue('--odc-shell-notice-block')).toBe('126px')
      expect(sidebar.parentElement.style.getPropertyValue('--odc-shell-notice-block')).toBe('126px')
    } finally {
      spy.mockRestore()
      vi.unstubAllGlobals()
    }
  })
})

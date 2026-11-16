/* eslint-disable import/first */
import React from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useHistory } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../@/components-dashboard/src/index', () => ({
  LogoutAction: ({ UIComponent, ...props }) => <UIComponent {...props} handleLogoutClick={() => {}} />
}))

import { ThemeProvider, useTheme } from '../../@/components-dashboard/src/ui/src/contexts/ThemeContext'
import { ColorModeProvider, COLOR_MODE_STORAGE_KEY } from '../../@/components-dashboard/src/ui/src/contexts/ColorModeContext'
import { AccountMenu } from '../../@/components-dashboard/src/ui/src/components/Shared/SideBar/AccountMenu'
import { createDashboardTheme } from '../adapter'
import { variables } from '../ordering.tokens.generated'
import darkRoutes from '../darkRoutes.json'
import theme from '../../theme.json'

// the dark mode is behind `dashboard_dark_mode` (off by default). Off, nothing changes; on, the account menu offers
// System / Light / Dark, the choice is kept in this browser, System follows the OS, and routes without a dark variant stay light.

const t = (_key, fallback) => fallback
// Any route listed in darkRoutes.json; /support has no form that reaches a light-only file.
const DARK_ROUTE = '/support'
const LIGHT_ONLY_ROUTE = '/orders'

let systemDark = false
let schemeListeners = []
const installMatchMedia = () => {
  window.matchMedia = vi.fn(query => ({
    get matches () { return query === '(prefers-color-scheme: dark)' && systemDark },
    media: query,
    addEventListener: (_type, listener) => { if (query === '(prefers-color-scheme: dark)') schemeListeners.push(listener) },
    removeEventListener: (_type, listener) => { schemeListeners = schemeListeners.filter(item => item !== listener) },
    addListener: () => {},
    removeListener: () => {}
  }))
}
const setSystemDark = value => act(() => {
  systemDark = value
  schemeListeners.forEach(listener => listener({ matches: value }))
})

let history
const HistoryProbe = () => { history = useHistory(); return null }
const ModeProbe = () => {
  const [current] = useTheme()
  return <output data-testid='mode' data-bg={current.ordering.css['--od-bg']}>{current.ordering.mode}</output>
}

const tree = ({ enabled, route = DARK_ROUTE, withProvider = true }) => {
  const menu = <AccountMenu t={t} user={{ name: 'Ada', email: 'ada@example.com' }} project='demo' />
  return (
    <MemoryRouter initialEntries={[route]}>
      <HistoryProbe />
      <ThemeProvider theme={createDashboardTheme(theme)}>
        {withProvider ? <ColorModeProvider enabled={enabled}>{menu}<ModeProbe /></ColorModeProvider> : <>{menu}<ModeProbe /></>}
      </ThemeProvider>
    </MemoryRouter>
  )
}

const openMenu = () => fireEvent.click(screen.getByRole('button', { name: /Account: Ada/ }))
const appearance = () => screen.getByRole('group', { name: 'Appearance' })
const html = document.documentElement
// jsdom gets no styled-components stylesheet here, so the page is compared by its DOM, the root attributes and the theme.
// React numbers its ids per render (`:r2:` then `:r8:`), so they are normalized.
const snapshot = () => ({ body: document.body.innerHTML.replace(/:r[0-9a-z]+:/g, ':id:'), attributes: html.getAttributeNames().sort() })

beforeEach(() => {
  systemDark = false
  schemeListeners = []
  installMatchMedia()
  window.localStorage.clear()
})
afterEach(() => cleanup())

describe('flag off (dashboard_dark_mode: false)', () => {
  it('renders the same DOM as without the provider, even with a stored dark choice and a dark OS', () => {
    const { container: before } = render(tree({ withProvider: false }))
    openMenu()
    const expected = snapshot()
    expect(before.innerHTML).not.toBe('')
    cleanup()

    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, 'dark')
    systemDark = true
    render(tree({ enabled: false }))
    openMenu()
    expect(snapshot()).toEqual(expected)
    expect(screen.queryByRole('group', { name: 'Appearance' })).toBeNull()
    expect(screen.getByTestId('mode').textContent).toBe('light')
  })
})

describe('flag on', () => {
  it('offers System, Light and Dark in the account menu, with System chosen by default', () => {
    render(tree({ enabled: true }))
    openMenu()
    const group = appearance()
    expect(within(group).getByRole('button', { name: 'System' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(group).getByRole('button', { name: 'Light' }).getAttribute('aria-pressed')).toBe('false')
    expect(within(group).getByRole('button', { name: 'Dark' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('Dark paints the dark tokens without a reload and keeps the choice in this browser', () => {
    render(tree({ enabled: true }))
    openMenu()
    fireEvent.click(within(appearance()).getByRole('button', { name: 'Dark' }))
    expect(screen.getByTestId('mode').textContent).toBe('dark')
    expect(html.getAttribute('data-od-theme')).toBe('dark')
    expect(html.hasAttribute('data-ordering-brand')).toBe(true)
    expect(screen.getByTestId('mode').dataset.bg).toBe(variables.dark['--od-bg'])
    expect(window.localStorage.getItem(COLOR_MODE_STORAGE_KEY)).toBe('dark')
    expect(within(appearance()).getByRole('button', { name: 'Dark' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('remembers the stored choice at boot', () => {
    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, 'dark')
    render(tree({ enabled: true }))
    expect(screen.getByTestId('mode').textContent).toBe('dark')
  })

  it('Light stays light on a dark OS and leaves the root untouched', () => {
    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, 'light')
    systemDark = true
    render(tree({ enabled: true }))
    expect(screen.getByTestId('mode').textContent).toBe('light')
    expect(html.hasAttribute('data-od-theme')).toBe(false)
  })

  it('System follows prefers-color-scheme and reacts when the OS changes, without a reload', () => {
    render(tree({ enabled: true }))
    expect(screen.getByTestId('mode').textContent).toBe('light')
    setSystemDark(true)
    expect(screen.getByTestId('mode').textContent).toBe('dark')
    expect(html.getAttribute('data-od-theme')).toBe('dark')
    setSystemDark(false)
    expect(screen.getByTestId('mode').textContent).toBe('light')
    expect(html.hasAttribute('data-od-theme')).toBe(false)
  })

  it('forces routes without a dark variant to light, and goes back to dark on a dark-ready route', () => {
    expect(darkRoutes.routes).toContain(DARK_ROUTE)
    expect(darkRoutes.routes).not.toContain(LIGHT_ONLY_ROUTE)
    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, 'dark')
    render(tree({ enabled: true, route: LIGHT_ONLY_ROUTE }))
    expect(screen.getByTestId('mode').textContent).toBe('light')
    expect(html.hasAttribute('data-od-theme')).toBe(false)
    act(() => history.push(DARK_ROUTE))
    expect(screen.getByTestId('mode').textContent).toBe('dark')
    act(() => history.push(LIGHT_ONLY_ROUTE))
    expect(screen.getByTestId('mode').textContent).toBe('light')
  })

  it('works when the browser blocks storage', () => {
    const getItem = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    const setItem = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    render(tree({ enabled: true }))
    openMenu()
    fireEvent.click(within(appearance()).getByRole('button', { name: 'Dark' }))
    expect(screen.getByTestId('mode').textContent).toBe('dark')
    getItem.mockRestore()
    setItem.mockRestore()
  })
})

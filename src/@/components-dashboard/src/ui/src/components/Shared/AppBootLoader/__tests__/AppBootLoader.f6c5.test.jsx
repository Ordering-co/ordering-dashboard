// redesign F6c-5 (Q2-09): on a reload of /orders the boot loader showed the Home skeleton (welcome block, chart, service
// cards) for ~700ms before the list's own. The Home content is for Home only; any other route gets the shell alone.
// redesign F6d (Q2-09, rest): the skeleton's sidebar was 240px and the real one is 248px (--od-x-sidebar), so the columns moved
// ~500ms later. styles.js `width: 248px` is the preservation boot-layout-afce4cf5 of scripts/brand-system/migration-rules.json.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { AppBootLoader, resolveBootScreen } from '../index'

describe('F6c-5 · boot loader by route (Q2-09)', () => {
  afterEach(() => { window.history.pushState({}, '', '/') })

  it.each([
    ['/', 'home'],
    ['/home', 'home'],
    ['/home/', 'home'],
    ['', 'home'],
    ['/orders', 'shell'],
    ['/orders/', 'shell'],
    ['/connect/whatsapp-bots', 'whatsapp-bots'],
    ['/stores/business', 'shell'],
    ['/settings', 'shell'],
    ['/homework', 'shell']
  ])('%s is the %s screen', (pathname, expected) => {
    expect(resolveBootScreen(pathname)).toBe(expected)
  })

  it('draws only the shell (sidebar and a title place) on /orders, with no Home content', () => {
    window.history.pushState({}, '', '/orders?status=pending')
    renderWithProviders(<AppBootLoader variant='home' density='full' />)
    expect(screen.getByTestId('boot-home')).toHaveAttribute('data-screen', 'shell')
    expect(screen.getByTestId('boot-sidebar')).toBeInTheDocument()
    ;['boot-welcome', 'boot-chart', 'boot-tiles', 'boot-lower', 'boot-metrics'].forEach(id => expect(screen.queryByTestId(id)).toBeNull())
  })

  it('shell={false} draws no sidebar column and keeps the content; without the prop the sidebar is drawn (W0-10b)', () => {
    const { unmount } = renderWithProviders(<AppBootLoader variant='home' density='full' route='/orders' shell={false} />)
    expect(screen.getByTestId('boot-home')).toHaveAttribute('data-screen', 'shell')
    ;['boot-sidebar', 'boot-sidebar-nav', 'boot-sidebar-footer'].forEach(id => expect(screen.queryByTestId(id)).toBeNull())
    // bugs H #76a: the content stays, as a div (the shell's <main id='main-content'> holds it)
    expect(screen.getByTestId('boot-content').tagName).toBe('DIV')
    unmount()
    renderWithProviders(<AppBootLoader variant='home' density='full' route='/orders' />)
    expect(screen.getByTestId('boot-sidebar')).toBeInTheDocument()
  })

  it('draws the Home content on Home, as before', () => {
    window.history.pushState({}, '', '/home')
    renderWithProviders(<AppBootLoader variant='home' density='full' />)
    expect(screen.getByTestId('boot-home')).toHaveAttribute('data-screen', 'home')
    expect(screen.getByTestId('boot-welcome')).toBeInTheDocument()
    expect(screen.getByTestId('boot-chart')).toBeInTheDocument()
  })

  it('draws a full WhatsApp bots list skeleton for the lazy route fallback', () => {
    renderWithProviders(
      <AppBootLoader variant='home' density='full' route='/connect/whatsapp-bots' shell={false} />
    )

    expect(screen.getByTestId('boot-home')).toHaveAttribute('data-screen', 'whatsapp-bots')
    expect(screen.getByTestId('boot-whatsapp-header')).toBeInTheDocument()
    expect(screen.getByTestId('boot-whatsapp-table')).toBeInTheDocument()
    expect(screen.getAllByTestId('boot-whatsapp-row')).toHaveLength(4)
    expect(screen.queryByTestId('boot-sidebar')).toBeNull()
  })

  it('a route can be given by the caller, and it wins over the address bar', () => {
    window.history.pushState({}, '', '/home')
    renderWithProviders(<AppBootLoader variant='home' density='light' route='/orders' />)
    expect(screen.getByTestId('boot-home')).toHaveAttribute('data-screen', 'shell')
    expect(screen.queryByTestId('boot-metrics')).toBeNull()
  })

  it('keeps announcing itself as a busy status', () => {
    window.history.pushState({}, '', '/orders')
    renderWithProviders(<AppBootLoader variant='home' density='full' />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(status).toHaveAttribute('aria-live', 'polite')
  })

  // redesign F6d (Q2-09): the same width as the sidebar that replaces it, so nothing moves when the shell arrives
  it('the skeleton sidebar is as wide as the real one (--od-x-sidebar)', () => {
    const candidates = readFileSync(resolve(__dirname, '../../../../../../../../../brand/candidates.css'), 'utf8')
    const real = candidates.match(/--od-x-sidebar:\s*(\d+)px/)
    expect(real).not.toBeNull()
    window.history.pushState({}, '', '/orders')
    renderWithProviders(<AppBootLoader variant='home' density='full' />)
    expect(screen.getByTestId('boot-sidebar')).toHaveStyle({ width: `${real[1]}px` })
    expect(real[1]).toBe('248')
  })
})

/* eslint-disable import/first */
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ user: { level: 0 }, configs: {}, history: null, exportProps: null }))

vi.mock('../../../../../../index', () => ({
  useConfig: () => [{ configs: runtime.configs }],
  useSession: () => [{ user: runtime.user }],
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback]
}))
// redesign 5.6: the «+» of the phone head opens the form the way the command palette does, through the
// router; the history is the one the test hands in.
vi.mock('react-router-dom', () => ({ useHistory: () => runtime.history }))
vi.mock('../../CreateCustomOrder', () => ({ CreateCustomOrder: () => <button type='button' data-testid='legacy-create'>Create custom order</button> }))
vi.mock('../../OrdersExportCSV', () => ({ OrdersExportCSV: (props) => { runtime.exportProps = props; return <button type='button'>Export</button> } }))
vi.mock('../../OrderDelete', () => ({ OrderDelete: () => <button type='button'>Delete</button> }))
vi.mock('../../OrderStatusTypeSelector', () => ({ OrderStatusTypeSelector: () => <div data-testid='bulk-status' /> }))

import { OrdersDashboardControls } from '..'
// User decision 5 (2026-10-06): the export trigger reads «Export», not «CSV»; only the name looked up changed.

// The default variant keeps the legacy bulk-status wrapper, which reads theme.colors.
const view = (ui) => <ThemeProvider theme={{ colors: {} }}>{ui}</ThemeProvider>

describe('OrdersDashboardControls', () => {
  beforeEach(() => { runtime.user = { level: 0 }; runtime.configs = {}; runtime.history = null; runtime.exportProps = null })

  it('variant header: only New order and Export, never the bulk actions, even with a selection', () => {
    render(view(<OrdersDashboardControls variant='header' selectedOrderNumber={3} />))
    expect(screen.getByRole('button', { name: 'Create custom order' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('bulk-status')).not.toBeInTheDocument()
  })

  it('variant header: Export comes before New order, so the primary action is last', () => {
    render(view(<OrdersDashboardControls variant='header' />))
    const names = screen.getAllByRole('button').map(button => button.textContent)
    expect(names).toEqual(['Export', 'Create custom order'])
  })

  // redesign 5.2 audit-1 (C4): one primary visible. With the order panel open its footer owns it.
  it('variant header: New order is the primary action, and steps back to secondary while an order is open', () => {
    const { container, rerender } = render(view(<OrdersDashboardControls variant='header' />))
    expect(container.querySelector('[data-action="create"]')).not.toHaveAttribute('data-emphasis')
    rerender(view(<OrdersDashboardControls variant='header' isOpenOrderDetail />))
    expect(container.querySelector('[data-action="create"]')).toHaveAttribute('data-emphasis', 'secondary')
    expect(container.querySelector('[data-action="export"]')).not.toHaveAttribute('data-emphasis')
    expect(screen.getByRole('button', { name: 'Create custom order' })).toBeInTheDocument()
    rerender(view(<OrdersDashboardControls variant='header' isOpenOrderDetail={false} />))
    expect(container.querySelector('[data-action="create"]')).not.toHaveAttribute('data-emphasis')
  })

  it('the stylesheet gives the primary look to New order only while it has not stepped back', () => {
    const css = readFileSync(resolve(__dirname, '../../OrdersContentHeader/content-header.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({ selector, body }))
    const primary = rules.filter(({ selector, body }) => selector.includes("[data-action='create']") && /var\(--od-action\b/.test(body))
    expect(primary.length).toBeGreaterThan(0)
    primary.forEach(({ selector }) => {
      selector.split(',').forEach(part => expect(part).toContain(":not([data-emphasis='secondary'])"))
    })
  })

  it('default variant (all-in-one) keeps the bulk actions when there is a selection', () => {
    render(view(<OrdersDashboardControls selectedOrderNumber={2} />))
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(screen.getByTestId('bulk-status')).toBeInTheDocument()
  })

  it('default variant without a selection draws no bulk actions', () => {
    render(view(<OrdersDashboardControls selectedOrderNumber={0} />))
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('bulk-status')).not.toBeInTheDocument()
  })

  it('default variant keeps the level-5 rules: no delete, bulk status only when the config allows it', () => {
    runtime.user = { level: 5 }
    const { rerender } = render(view(<OrdersDashboardControls selectedOrderNumber={2} />))
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('bulk-status')).not.toBeInTheDocument()
    runtime.configs = { allow_driver_manager_batch_update_order_status: { value: '1' } }
    rerender(view(<OrdersDashboardControls selectedOrderNumber={2} />))
    expect(screen.getByTestId('bulk-status')).toBeInTheDocument()
  })
})

// redesign 5.6-B: below 768px of viewport the head's actions are a «+» and the «More actions» menu (the
// Export options and the Learn articles). Same handlers and dialogs: the form is still CreateCustomOrder, opened
// with `?add=custom_order` as the command palette does, and the menu is OrdersExportCSV in its `more` variant.
describe('OrdersDashboardControls · variant header on phones (5.6-B)', () => {
  const LEARN = [
    { value: 'overview', name: 'Orders list', url: 'https://help.ordering.co/orders' },
    { value: 'details', name: 'Order details', url: 'https://help.ordering.co/details' }
  ]
  const setViewport = (phone) => {
    window.matchMedia = vi.fn((query) => ({
      matches: phone && query === '(max-width: 767px)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {}
    }))
  }
  const headerView = (props) => render(view(<OrdersDashboardControls variant='header' learnOptions={LEARN} {...props} />))

  beforeEach(() => {
    runtime.user = { level: 0 }
    runtime.configs = {}
    runtime.history = { replace: vi.fn(), location: { pathname: '/orders' } }
    window.history.replaceState({}, '', '/orders')
    setViewport(true)
  })
  afterEach(() => { delete window.matchMedia })

  it('draws a «+» icon button named Create custom order, then the More menu, in one row', () => {
    const { container } = headerView()
    const plus = screen.getByRole('button', { name: 'Create custom order' })
    expect(plus).toHaveAttribute('data-icon-only')
    expect(plus).toHaveAttribute('data-variant', 'primary')
    expect(plus.querySelector('svg')).not.toBeNull()
    expect(container.querySelector('.odc-header-actions')).toHaveAttribute('data-phone')
    const names = screen.getAllByRole('button').map(button => button.textContent || button.getAttribute('aria-label'))
    expect(names).toEqual(['Create custom order', 'Export'])
  })

  it('gives the export menu the more variant and the Learn articles as extra items, in the same order', () => {
    headerView()
    expect(runtime.exportProps.variant).toBe('more')
    expect(runtime.exportProps.extraItems.map(item => item.label)).toEqual(['Orders list', 'Order details'])
  })

  it('without Learn options the menu is only the export options', () => {
    headerView({ learnOptions: undefined })
    expect(runtime.exportProps.variant).toBe('more')
    expect(runtime.exportProps.extraItems ?? []).toEqual([])
  })

  it('Learn is for level zero only: another level gets no articles and no «+»', () => {
    runtime.user = { level: 2 }
    headerView()
    expect(runtime.exportProps.extraItems ?? []).toEqual([])
    expect(screen.queryByRole('button', { name: 'Create custom order' })).not.toBeInTheDocument()
  })

  it('the «+» opens the same form as the header button: the router gets ?add=custom_order, keeping the other params', async () => {
    window.history.replaceState({}, '', '/orders?status=pending')
    headerView()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Create custom order' }))
    expect(runtime.history.replace).toHaveBeenCalledTimes(1)
    expect(runtime.history.replace).toHaveBeenCalledWith({ pathname: '/orders', search: '?status=pending&add=custom_order' })
  })

  it('keeps CreateCustomOrder mounted (its sheet and its ?add listener), with its own button out of the way', () => {
    const { container } = headerView()
    const legacy = screen.getByTestId('legacy-create')
    expect(legacy.closest('[hidden]')).not.toBeNull()
    expect(container.contains(legacy)).toBe(true)
  })

  // redesign page-bugs Y (F2): /all-in-one below 1024px draws the bulk actions in its sticky bar and takes them out of the row
  it('hideBulk leaves the bulk actions out of the row and keeps Create custom order and Export', () => {
    render(view(<OrdersDashboardControls selectedOrderNumber={2} hideBulk />))
    expect(screen.getByRole('button', { name: 'Create custom order' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('bulk-status')).not.toBeInTheDocument()
  })

  it('variant bulk: only Change status and Delete, each group named with how many orders it acts on', () => {
    const handlers = { handleChangeMultiOrdersStatus: () => {}, handleDeleteMultiOrders: () => {} }
    render(view(<OrdersDashboardControls variant='bulk' selectedOrderNumber={3} {...handlers} />))
    expect(screen.getByRole('group', { name: 'Change status of 3 orders' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Delete 3 orders' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create custom order' })).not.toBeInTheDocument()
  })

  it('variant bulk keeps the level-5 rules and needs the handlers', () => {
    const handlers = { handleChangeMultiOrdersStatus: () => {}, handleDeleteMultiOrders: () => {} }
    runtime.user = { level: 5 }
    const { rerender } = render(view(<OrdersDashboardControls variant='bulk' selectedOrderNumber={1} {...handlers} />))
    expect(screen.queryByRole('group', { name: 'Delete 1 order' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('bulk-status')).not.toBeInTheDocument()
    runtime.configs = { allow_driver_manager_batch_update_order_status: { value: '1' } }
    rerender(view(<OrdersDashboardControls variant='bulk' selectedOrderNumber={1} {...handlers} />))
    expect(screen.getByRole('group', { name: 'Change status of 1 order' })).toBeInTheDocument()
    rerender(view(<OrdersDashboardControls variant='bulk' selectedOrderNumber={1} />))
    expect(screen.queryByTestId('bulk-status')).not.toBeInTheDocument()
  })

  it('wraps the phone buttons outside [data-action], so the legacy dress of the desktop buttons does not reach them', () => {
    const { container } = headerView()
    expect(container.querySelector('[data-action]')).toBeNull()
    expect(container.querySelector('[data-phone-action="create"] [data-icon-only]')).not.toBeNull()
    expect(container.querySelector('[data-phone-action="export"]')).not.toBeNull()
  })

  it('desktop widths keep Export and the legacy create button, with no «+» and no phone mark', () => {
    setViewport(false)
    const { container } = headerView()
    expect(runtime.exportProps.variant).toBeUndefined()
    expect(runtime.exportProps.extraItems).toBeUndefined()
    expect(container.querySelector('.odc-header-actions')).not.toHaveAttribute('data-phone')
    expect(container.querySelector('[data-icon-only]')).toBeNull()
    expect(screen.getByTestId('legacy-create').closest('[hidden]')).toBeNull()
  })

  it('without matchMedia (tests, old engines) it reads as desktop', () => {
    delete window.matchMedia
    const { container } = headerView()
    expect(container.querySelector('.odc-header-actions')).not.toHaveAttribute('data-phone')
  })

  it('the default variant (/all-in-one) is the same on phones: full controls, no «+»', () => {
    const { container } = render(view(<OrdersDashboardControls selectedOrderNumber={2} />))
    expect(container.querySelector('[data-icon-only]')).toBeNull()
    expect(runtime.exportProps.variant).toBeUndefined()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })
})

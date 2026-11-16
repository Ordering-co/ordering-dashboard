/* eslint-disable import/first */
// The navigation of ⌘K and Mia: a destination on the page already shown remounts the route (many panels read their query only on
// mount), except the pages that follow every URL change. redesign stores 1.C, G1-25: /stores/list follows `?id=`
// (the list) and `?section=` / `?tab=` (the store editor), so opening a store or one of its sections from there keeps the filters,
// the search, the page and the selection. Every other query of /stores/list still remounts.
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({ remountRoute: vi.fn(), setOpen: vi.fn(), discardReturnFocus: vi.fn(), handleMenuCollapse: vi.fn(), width: 1440, requestUpgrade: vi.fn() }))

vi.mock('../../contexts/CommandPaletteContext', () => ({
  useCommandPalette: () => ({ setOpen: mockState.setOpen, remountRoute: mockState.remountRoute, discardReturnFocus: mockState.discardReturnFocus })
}))
vi.mock('../../contexts/LegacyPlanUpgradeContext', () => ({
  useLegacyPlanUpgrade: () => ({ requestUpgrade: mockState.requestUpgrade })
}))
vi.mock('../../contexts/InfoShareContext', () => ({ useInfoShare: () => [{}, { handleMenuCollapse: mockState.handleMenuCollapse }] }))
vi.mock('../useWindowSize', () => ({ useWindowSize: () => ({ width: mockState.width }) }))

import { useDashboardNavigation } from '../useDashboardNavigation'
import { registerRouteLeaveGuard } from '../../utils/routeLeaveGuard'

// The address of the window is what the hook compares with (addQueryToUrl keeps it current; the router may not know `?id=`)
const setup = (url, windowUrl = url, options = { closeCommandPalette: true }) => {
  window.history.replaceState(null, '', windowUrl)
  const ref = {}
  const Probe = () => {
    ref.navigate = useDashboardNavigation(options)
    ref.location = useLocation()
    return null
  }
  render(<MemoryRouter initialEntries={[url]}><Probe /></MemoryRouter>)
  return ref
}

beforeEach(() => { vi.clearAllMocks(); mockState.requestUpgrade.mockReturnValue(false) })

describe('legacy plan destinations in search', () => {
  it.each([
    '/builder/apps?add=1',
    '/connect/delivery-services?id=34',
    '/settings?group=orders&category=store_reservation&focus=reservation_enabled'
  ])('requests an upgrade without leaving the page for %s', path => {
    mockState.requestUpgrade.mockReturnValue(true)
    const ref = setup('/orders')
    act(() => ref.navigate(path))
    expect(mockState.requestUpgrade).toHaveBeenCalledTimes(1)
    expect(ref.location.pathname).toBe('/orders')
    expect(mockState.remountRoute).not.toHaveBeenCalled()
    expect(mockState.setOpen).toHaveBeenCalledWith(false)
  })

  it('closes the mobile drawer before the upgrade dialog takes focus from search', () => {
    mockState.width = 390
    mockState.requestUpgrade.mockReturnValue(true)
    const ref = setup('/orders')
    act(() => ref.navigate('/appointments'))
    expect(mockState.handleMenuCollapse).toHaveBeenCalledWith(true)
    expect(mockState.setOpen).toHaveBeenCalledWith(false)
    expect(ref.location.pathname).toBe('/orders')
    mockState.width = 1440
  })

  it('leaves the equivalent Settings group and store Sales channels outside the offer', () => {
    mockState.requestUpgrade.mockReturnValue(true)
    const ref = setup('/orders')
    act(() => ref.navigate('/settings?group=website&category=sites'))
    expect(ref.location.pathname).toBe('/settings')
    act(() => ref.navigate('/stores/list?id=4&section=sales_channels'))
    expect(ref.location.pathname).toBe('/stores/list')
    expect(mockState.requestUpgrade).not.toHaveBeenCalled()
  })
})

describe('useDashboardNavigation · remount on the same page', () => {
  it.each([
    ['a store', '/stores/list?id=4'],
    ['a store and a section', '/stores/list?id=4&section=schedule'],
    ['a store, a section and its tab', '/stores/list?id=4&section=ordering_channels&tab=widgets']
  ])('does not remount /stores/list to open %s', (_name, path) => {
    const ref = setup('/stores/list?active=true&page=2')
    act(() => ref.navigate(path))
    expect(mockState.remountRoute).not.toHaveBeenCalled()
    expect(ref.location.pathname + ref.location.search).toBe(path)
    expect(mockState.setOpen).toHaveBeenCalledWith(false)
  })

  // redesign bugs F row 22 (F5 of stores 3.A; review R-3): a list filtered by type (?type=) or searched (?q=) remounted,
  // which dropped the filter, the search and the page; the list keeps both in its address, so it follows the store like the others
  it.each([
    ['filtered by type', '/stores/list?type=1&active=true&page=2&pageSize=10'],
    ['searched', '/stores/list?q=fast&active=true&page=1&pageSize=10']
  ])('does not remount a list %s to open a store', (_name, current) => {
    const ref = setup(current)
    act(() => ref.navigate('/stores/list?id=4'))
    expect(mockState.remountRoute).not.toHaveBeenCalled()
  })

  it('opens another store from an open one, also when the router does not know the open store (row click)', () => {
    const ref = setup('/stores/list?active=true', '/stores/list?active=true&page=2&pageSize=10&id=4&section=schedule')
    act(() => ref.navigate('/stores/list?id=6'))
    expect(mockState.remountRoute).not.toHaveBeenCalled()
  })

  it.each([
    ['the same store', '/stores/list?id=4'],
    ['the same store at another tab of its section', '/stores/list?id=4&section=store_details&tab=images']
  ])('remounts /stores/list for %s, as before, so the editor reads its section and tab again', (_name, path) => {
    const ref = setup('/stores/list?id=4&section=store_details&tab=location&active=true')
    act(() => ref.navigate(path))
    expect(mockState.remountRoute).toHaveBeenCalledTimes(1)
  })

  it('remounts /stores/list while a side bar of the page is open (?header=), which only a remount closes', () => {
    const ref = setup('/stores/list?header=sync&tab=deliverect')
    act(() => ref.navigate('/stores/list?id=4'))
    expect(mockState.remountRoute).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['the importers', '/stores/list?header=importers'],
    ['a sync tab', '/stores/list?header=sync&tab=deliverect'],
    ['the inactive tab', '/stores/list?active=false'],
    ['a tab with no store', '/stores/list?tab=widgets'],
    ['a store with another key', '/stores/list?id=4&header=sync'],
    ['the page itself', '/stores/list']
  ])('still remounts /stores/list for %s', (_name, path) => {
    const ref = setup('/stores/list')
    act(() => ref.navigate(path))
    expect(mockState.remountRoute).toHaveBeenCalledTimes(1)
  })

  it('keeps the rest as it was: other pages remount, /settings never, another page never', () => {
    const ref = setup('/orders')
    act(() => ref.navigate('/orders?id=9'))
    expect(mockState.remountRoute).toHaveBeenCalledTimes(1)

    const settings = setup('/settings')
    act(() => settings.navigate('/settings?group=payments'))
    expect(mockState.remountRoute).toHaveBeenCalledTimes(1)

    const other = setup('/orders')
    act(() => other.navigate('/stores/list?id=4'))
    expect(mockState.remountRoute).toHaveBeenCalledTimes(1)
  })

  // redesign reports FC (D1, D4): ⌘K opens another report (?id=) without a remount, which would drop the shared period and filters
  it('/intelligence/reports follows ?id= without a remount', () => {
    const ref = setup('/intelligence/reports')
    act(() => ref.navigate('/intelligence/reports?id=14'))
    expect(mockState.remountRoute).not.toHaveBeenCalled()
  })

  // redesign invoice R2 (r1 M1, D2): ⌘K to another kind or section of the invoice keeps what was typed (no remount)
  it('/intelligence/invoice follows ?invoice= and ?tab= without a remount', () => {
    const ref = setup('/intelligence/invoice')
    act(() => ref.navigate('/intelligence/invoice?invoice=driver'))
    act(() => ref.navigate('/intelligence/invoice?invoice=business&tab=payment_methods'))
    expect(mockState.remountRoute).not.toHaveBeenCalled()
  })

  // redesign DS-R1-01 (review r1): ⌘K `integration:delivery:<id>` from the page opens that provider through the page's own
  // `?id=` effect (and its draft guard); a remount would drop the draft of the panel and the search without asking
  it('/connect/delivery-services follows ?id= and ?tab= without a remount, so the page\'s guard sees the change', () => {
    const ref = setup('/connect/delivery-services?id=67&tab=businesses')
    act(() => ref.navigate('/connect/delivery-services?id=34'))
    expect(mockState.remountRoute).not.toHaveBeenCalled()
    expect(ref.location.pathname + ref.location.search).toBe('/connect/delivery-services?id=34')
    expect(mockState.setOpen).toHaveBeenCalledWith(false)
    // from another page it is a plain navigation, as always
    const other = setup('/orders')
    act(() => other.navigate('/connect/delivery-services?id=34'))
    expect(mockState.remountRoute).not.toHaveBeenCalled()
  })

  it('an explicit remount still remounts /connect/delivery-services', () => {
    const ref = setup('/connect/delivery-services?id=67')
    act(() => ref.navigate('/connect/delivery-services?id=34', { remount: true }))
    expect(mockState.remountRoute).toHaveBeenCalledTimes(1)
  })

  it('an explicit remount still remounts /stores/list', () => {
    const ref = setup('/stores/list')
    act(() => ref.navigate('/stores/list?id=4', { remount: true }))
    expect(mockState.remountRoute).toHaveBeenCalledTimes(1)
  })
})

// redesign stores 2.A (review F3-R1): an open editor with unsaved changes asks before the remount or the move
describe('useDashboardNavigation · route leave guard', () => {
  it('a guard that keeps the user stops the remount and the move; one that lets go goes on', () => {
    const ref = setup('/stores/list?id=4&section=layout&active=true')
    let keep = true
    const guard = vi.fn(proceed => { if (!keep) proceed() })
    const unregister = registerRouteLeaveGuard(guard)
    act(() => ref.navigate('/stores/list?id=4&section=webhooks'))
    expect(guard).toHaveBeenCalledTimes(1)
    expect(mockState.remountRoute).not.toHaveBeenCalled()
    expect(ref.location.search).toBe('?id=4&section=layout&active=true')
    keep = false
    act(() => ref.navigate('/stores/list?id=4&section=webhooks'))
    expect(mockState.remountRoute).toHaveBeenCalledTimes(1)
    expect(ref.location.search).toBe('?id=4&section=webhooks')
    unregister()
    act(() => ref.navigate('/orders'))
    expect(guard).toHaveBeenCalledTimes(2)
    expect(ref.location.pathname).toBe('/orders')
  })
})

// (part 1): ⌘K to a page left the focus on <body>. The palette's input unmounts with the dialog and the opener is discarded, so
// the start of the new page (its h1, painted late because the page is lazy) takes the focus, like the phone drawer does. A destination that
// opens a panel or a form already puts the focus inside: that one stays.
describe('useDashboardNavigation · focus after the palette navigates', () => {
  const added = []
  const add = (tag, text = '') => {
    const element = document.createElement(tag)
    element.textContent = text
    element.getClientRects = () => [{ width: 1, height: 1 }]
    document.body.appendChild(element)
    added.push(element)
    return element
  }
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
  afterEach(() => {
    added.splice(0).forEach(element => element.remove())
    mockState.width = 1440
  })

  it.each([1440, 390])('moves the focus to the title of the new page once the lazy page paints (%s px)', async (width) => {
    mockState.width = width
    const ref = setup('/home')
    const searchInput = add('input')
    searchInput.focus()
    act(() => ref.navigate('/delivery/drivers-list'))
    searchInput.remove()
    expect(document.activeElement).toBe(document.body)
    // the skeleton of the lazy page has no title yet: nothing to claim, nothing fails
    await wait(300)
    expect(document.activeElement).toBe(document.body)
    const title = add('h1', 'Drivers')
    await waitFor(() => expect(document.activeElement).toBe(title))
  })

  it('does not take the focus from a panel or a form the destination opened by itself', async () => {
    const ref = setup('/home')
    const searchInput = add('input')
    searchInput.focus()
    act(() => ref.navigate('/orders?id=9'))
    searchInput.remove()
    const panelField = add('input')
    panelField.focus()
    await wait(300)
    add('h1', 'Orders')
    await wait(400)
    expect(document.activeElement).toBe(panelField)
  })

  it('leaves the focus alone for Mia, which keeps its own chat open', async () => {
    const ref = setup('/home', '/home', { closeCommandPalette: false })
    act(() => ref.navigate('/delivery/drivers-list'))
    await wait(300)
    add('h1', 'Drivers')
    await wait(400)
    expect(document.activeElement).toBe(document.body)
  })
})

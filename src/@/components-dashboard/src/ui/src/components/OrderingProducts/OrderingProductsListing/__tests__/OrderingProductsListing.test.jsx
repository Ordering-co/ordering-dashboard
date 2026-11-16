/* eslint-disable import/first */
// redesign (lot B): the /ordering-products route on Product with a stand-in controller (it gives the state the real SitesList
// gives: sitesListState, getSites, paginationProps, onSearch, handleSuccessUpdateSites) and a stand-in for lot C's OrderingProductDetails
// (it paints its props and has buttons for onRequestClose, onClose, onTabChange, a save that renames the site and a form that is dirty).
// Covered: the header (count, visible help, no ⓘ, one «Add product»), OP-01 (the new product is a form of its own and takes id and tab
// out of the address), OP-15 (a new product opens on General), the address (?id=, ?tab=), closing, the load error with «Try again»,
// the search (400 ms, Enter), the leave guard (✕ asks, onClose does not), and the open site following the list.
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useHistory } from 'react-router-dom'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const probe = vi.hoisted(() => ({
  sites: [],
  loading: false,
  error: null,
  pagination: {},
  mounts: [],
  onSearch: null,
  getSites: null,
  isCollapse: false,
  collapse: null
}))

vi.mock('../../../../../../index', async () => {
  const React = await import('react')
  const SitesList = ({ UIComponent, ...props }) => {
    const [sites, setSites] = React.useState(probe.sites)
    const [pagination, setPagination] = React.useState(probe.pagination)
    return (
      <UIComponent
        {...props}
        sitesListState={{ loading: probe.loading, sites, error: probe.error }}
        paginationProps={pagination}
        setPaginationProps={setPagination}
        searchValue={null}
        onSearch={probe.onSearch}
        getSites={probe.getSites}
        handleSuccessUpdateSites={setSites}
      />
    )
  }
  return { SitesList, useLanguage: () => [{}, (_key, fallback) => fallback] }
})
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: probe.isCollapse }, { handleMenuCollapse: probe.collapse }]
}))
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1440, height: 900 }) }))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => false }))
vi.mock('../../OrderingProductDetails', async () => {
  const React = await import('react')
  const { useLeaveGuard } = await import('../../../Shared/Product')
  const OrderingProductDetails = (props) => {
    const [dirty, setDirty] = React.useState(false)
    React.useEffect(() => { probe.mounts.push({ id: props.site?.id ?? null, initialTab: props.initialTab }) }, [])
    useLeaveGuard({ dirty, count: 1, save: async () => ({ ok: true }), discard: () => setDirty(false) })
    // N-04: a second form that names its tab, as General and Theme do
    const [themeDirty, setThemeDirty] = React.useState(false)
    useLeaveGuard({ dirty: themeDirty, label: 'Theme', save: async () => ({ ok: true }), discard: () => setThemeDirty(false) })
    const [generalDirty, setGeneralDirty] = React.useState(false)
    useLeaveGuard({ dirty: generalDirty, label: 'General', save: async () => ({ ok: true }), discard: () => setGeneralDirty(false) })
    const { site, sitesList, handleSuccessUpdateSites } = props
    return (
      <div data-testid='details' data-site-id={site?.id ?? 'none'} data-tab={props.initialTab} data-expanded={String(props.expanded)}>
        <span>{site ? `site: ${site.name}` : 'site: null'}</span>
        <button type='button' onClick={props.onRequestClose}>request close</button>
        <button type='button' onClick={props.onClose}>close directly</button>
        <button type='button' onClick={() => props.onTabChange('theme')}>go to theme</button>
        <button type='button' onClick={props.onToggleExpanded}>toggle expanded</button>
        <button type='button' onClick={() => setDirty(true)}>make dirty</button>
        <button type='button' onClick={() => setThemeDirty(true)}>make theme dirty</button>
        <button type='button' onClick={() => setGeneralDirty(true)}>make general dirty</button>
        <button type='button' onClick={() => handleSuccessUpdateSites(sitesList.map(item => (item.id === site.id ? { ...item, name: 'Renamed' } : item)))}>save renamed</button>
        <button type='button' onClick={() => handleSuccessUpdateSites(sitesList.filter(item => item.id !== site.id))}>delete from list</button>
        <button type='button' onClick={() => handleSuccessUpdateSites([...sitesList, { id: 300, name: 'Created', code: 'created' }])}>create into list</button>
        <button type='button' onClick={() => { handleSuccessUpdateSites([...sitesList, { id: 300, name: 'Created', code: 'created' }]); props.onSiteAdded?.({ id: 300, name: 'Created', code: 'created' }) }}>site added</button>
      </div>
    )
  }
  return { OrderingProductDetails }
})

import { OrderingProductsListing } from '../index'

const WEBSITE = { id: 232, name: 'Marketplace', code: 'website', description: 'The main site', url: 'https://shop.example.com' }
const OTHER = { id: 233, name: 'Kiosk', code: 'kiosk', description: null, url: null }

const pagination = (totalItems) => ({ currentPage: 1, pageSize: 10, totalPages: 1, totalItems, from: 1, to: totalItems })

let user
const renderRoute = (search = '') => {
  window.history.replaceState(null, '', `/ordering-products${search}`)
  renderWithProviders(<OrderingProductsListing isUseQuery enableAutoFillFromWebsite />, { initialEntries: [`/ordering-products${search}`] })
}
const details = () => screen.getByTestId('details')

beforeEach(() => {
  // a wide window: the list stays beside the panel (split), so its buttons can be used
  vi.stubGlobal('matchMedia', (query) => ({ matches: query.includes('min-width'), addEventListener () {}, removeEventListener () {} }))
  probe.sites = [WEBSITE, OTHER]
  probe.loading = false
  probe.error = null
  probe.pagination = pagination(2)
  probe.mounts = []
  probe.onSearch = vi.fn()
  probe.getSites = vi.fn()
  probe.isCollapse = false
  probe.collapse = vi.fn()
  user = userEvent.setup()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('OrderingProductsListing · the page', () => {
  it('heads the page with the title, the count and one «Add product»', () => {
    renderRoute()
    expect(screen.getByRole('heading', { level: 1, name: 'Ordering products' })).toBeInTheDocument()
    expect(screen.getByText('2 products')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Add product' })).toHaveLength(1)
  })

  // the opener is PageHeader's `leading`, the first child of the lead block
  it('puts «Open menu» first in the header block when the sidebar is collapsed, and opens the menu', async () => {
    probe.isCollapse = true
    renderRoute()
    const opener = screen.getByRole('button', { name: 'Open menu' })
    expect(opener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(opener)
    await user.click(opener)
    expect(probe.collapse).toHaveBeenCalledExactlyOnceWith(false)
  })

  it('draws no «Open menu» when the sidebar is not collapsed', () => {
    renderRoute()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
  })

  it('says «1 product» for one site', () => {
    probe.sites = [WEBSITE]
    probe.pagination = pagination(1)
    renderRoute()
    expect(screen.getByText('1 product')).toBeInTheDocument()
  })

  it('shows the help text and has no ⓘ button (OP-10)', () => {
    renderRoute()
    expect(screen.getByText(/Select your site and customize it/)).toBeVisible()
    expect(screen.queryByRole('button', { name: /info/i })).toBeNull()
    // the only buttons of the list are Add product, the names, the search clear and the pagination ones: none without a name
    screen.getAllByRole('button').forEach(button => expect(button).toHaveAccessibleName())
  })

  it('lists the sites with their code and url', () => {
    renderRoute()
    expect(screen.getByRole('table', { name: 'Ordering products' })).toBeInTheDocument()
    expect(screen.getByText('website')).toBeInTheDocument()
    expect(screen.getByText('https://shop.example.com')).toBeInTheDocument()
  })

  it('paints the table loading while the controller loads', () => {
    probe.loading = true
    probe.sites = []
    probe.pagination = { ...pagination(0), totalItems: null }
    renderRoute()
    expect(document.body.querySelectorAll('tr[data-skeleton]')).toHaveLength(10)
  })
})

describe('OrderingProductsListing · opening and closing', () => {
  it('opens a site: the panel gets it, ?id= is written and the tab stays as it is', async () => {
    renderRoute('?tab=theme')
    await user.click(screen.getByRole('button', { name: 'Marketplace, View details' }))
    expect(details()).toHaveAttribute('data-site-id', '232')
    expect(details()).toHaveAttribute('data-tab', 'theme')
    expect(new URLSearchParams(window.location.search).get('id')).toBe('232')
    expect(new URLSearchParams(window.location.search).get('tab')).toBe('theme')
  })

  it('opens the same site only once: a second click mounts nothing new', async () => {
    renderRoute()
    await user.click(screen.getByRole('button', { name: 'Marketplace, View details' }))
    await user.click(screen.getByRole('button', { name: 'Marketplace, View details' }))
    expect(probe.mounts).toHaveLength(1)
  })

  it('«Add product» with a site open mounts a new panel with site=null, on General, and takes id and tab out of the address (OP-01, OP-15)', async () => {
    renderRoute('?id=232&tab=theme')
    expect(details()).toHaveAttribute('data-site-id', '232')
    expect(probe.mounts).toEqual([{ id: 232, initialTab: 'theme' }])
    await user.click(screen.getByRole('button', { name: 'Add product' }))
    expect(details()).toHaveAttribute('data-site-id', 'none')
    expect(details()).toHaveAttribute('data-tab', 'general')
    expect(within(details()).getByText('site: null')).toBeInTheDocument()
    // a new mount (the key changed), not the same form with other props
    expect(probe.mounts).toEqual([{ id: 232, initialTab: 'theme' }, { id: null, initialTab: 'general' }])
    const params = new URLSearchParams(window.location.search)
    expect(params.has('id')).toBe(false)
    expect(params.has('tab')).toBe(false)
  })

  it('opens ?id=232&tab=theme on that site with initialTab theme', () => {
    renderRoute('?id=232&tab=theme')
    expect(details()).toHaveAttribute('data-site-id', '232')
    expect(details()).toHaveAttribute('data-tab', 'theme')
    expect(probe.mounts).toEqual([{ id: 232, initialTab: 'theme' }])
  })

  it('reads an unknown ?tab= as general', () => {
    renderRoute('?id=232&tab=bogus')
    expect(details()).toHaveAttribute('data-tab', 'general')
  })

  it('opens nothing when ?id= is not in the loaded page', () => {
    renderRoute('?id=999')
    expect(screen.queryByTestId('details')).toBeNull()
  })

  it('writes ?tab= when the panel changes tab', async () => {
    renderRoute('?id=232')
    await user.click(screen.getByRole('button', { name: 'go to theme' }))
    expect(new URLSearchParams(window.location.search).get('tab')).toBe('theme')
  })

  it('does not write ?tab= for a new product', async () => {
    renderRoute()
    await user.click(screen.getByRole('button', { name: 'Add product' }))
    await user.click(screen.getByRole('button', { name: 'go to theme' }))
    expect(new URLSearchParams(window.location.search).has('tab')).toBe(false)
  })

  it('closes with id and tab out of the address', async () => {
    renderRoute('?id=232&tab=theme')
    await user.click(screen.getByRole('button', { name: 'request close' }))
    expect(screen.queryByTestId('details')).toBeNull()
    const params = new URLSearchParams(window.location.search)
    expect(params.has('id')).toBe(false)
    expect(params.has('tab')).toBe(false)
  })

  it('opens as a page and goes back to the split view', async () => {
    renderRoute('?id=232')
    expect(details()).toHaveAttribute('data-expanded', 'false')
    await user.click(screen.getByRole('button', { name: 'toggle expanded' }))
    expect(details()).toHaveAttribute('data-expanded', 'true')
    await user.click(screen.getByRole('button', { name: 'toggle expanded' }))
    expect(details()).toHaveAttribute('data-expanded', 'false')
  })

  it('names the panel by the site, and by «Add product» for a new one', async () => {
    renderRoute('?id=232')
    expect(screen.getByRole('complementary', { name: 'Marketplace' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add product' }))
    expect(screen.getByRole('complementary', { name: 'Add product' })).toBeInTheDocument()
  })
})

describe('OrderingProductsListing · the open site follows the list', () => {
  it('shows the saved site (a new object in the list) in the panel', async () => {
    renderRoute('?id=232')
    expect(within(details()).getByText('site: Marketplace')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'save renamed' }))
    expect(within(details()).getByText('site: Renamed')).toBeInTheDocument()
  })

  // redesign (live check): a list change alone never closes the panel. A save may hand back the site under another id
  // (the synthetic API does); a delete closes it through `onClose`, which the controller calls once the site is gone.
  it('a change of the list alone keeps the panel open; the delete closes it through onClose', async () => {
    renderRoute('?id=232')
    await user.click(screen.getByRole('button', { name: 'delete from list' }))
    expect(screen.getByTestId('details')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'close directly' }))
    expect(screen.queryByTestId('details')).toBeNull()
    expect(new URLSearchParams(window.location.search).has('id')).toBe(false)
  })
})

describe('OrderingProductsListing · the leave guard', () => {
  it('the ✕ (onRequestClose) asks before leaving unsaved work', async () => {
    renderRoute('?id=232')
    await user.click(screen.getByRole('button', { name: 'make dirty' }))
    await user.click(screen.getByRole('button', { name: 'request close' }))
    expect(screen.getByRole('alertdialog', { name: 'Save your changes?' })).toBeInTheDocument()
    expect(screen.getByRole('alertdialog')).toHaveTextContent('You have unsaved changes in Ordering products.')
    expect(screen.getByTestId('details')).toBeInTheDocument()
  })

  // redesign (N-04, of ): the dialog names the tab with the unsaved changes, not the page
  it('names the tab whose form is dirty', async () => {
    renderRoute('?id=232')
    await user.click(screen.getByRole('button', { name: 'make theme dirty' }))
    await user.click(screen.getByRole('button', { name: 'request close' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('You have unsaved changes in Theme.')
  })

  it('names every dirty tab as a list in the app language', async () => {
    renderRoute('?id=232')
    await user.click(screen.getByRole('button', { name: 'make theme dirty' }))
    await user.click(screen.getByRole('button', { name: 'make general dirty' }))
    await user.click(screen.getByRole('button', { name: 'request close' }))
    // registration order (Theme, then General), joined by Intl.ListFormat, not a fixed comma
    expect(screen.getByRole('alertdialog')).toHaveTextContent('You have unsaved changes in Theme and General.')
  })

  it('changing site asks too, and Discard goes on', async () => {
    renderRoute('?id=232')
    await user.click(screen.getByRole('button', { name: 'make dirty' }))
    await user.click(screen.getByRole('button', { name: 'Kiosk, View details' }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(details()).toHaveAttribute('data-site-id', '232')
    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(details()).toHaveAttribute('data-site-id', '233')
  })

  it('onClose (after a success) closes with no discard dialog', async () => {
    renderRoute('?id=232')
    await user.click(screen.getByRole('button', { name: 'make dirty' }))
    await user.click(screen.getByRole('button', { name: 'close directly' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByTestId('details')).toBeNull()
  })

  it('«Add product» asks too when the open form is dirty', async () => {
    renderRoute('?id=232')
    await user.click(screen.getByRole('button', { name: 'make dirty' }))
    await user.click(screen.getByRole('button', { name: 'Add product' }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(details()).toHaveAttribute('data-site-id', '232')
  })
})

// redesign (review r1, Q-04): a create or a delete changes the count and the range, not only the rows
describe('OrderingProductsListing · the count follows a create or a delete (Q-04)', () => {
  it('a delete takes one off the count, the range and the rows', async () => {
    renderRoute('?id=232')
    expect(screen.getByText('2 products')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'delete from list' }))
    expect(screen.getByText('1 product')).toBeInTheDocument()
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 1–1 of 1')
    expect(screen.queryByRole('button', { name: 'Marketplace, View details' })).toBeNull()
  })

  it('a create adds one to the count and the range', async () => {
    renderRoute('?id=232')
    await user.click(screen.getByRole('button', { name: 'create into list' }))
    expect(screen.getByText('3 products')).toBeInTheDocument()
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 1–3 of 3')
    expect(screen.getByRole('button', { name: 'Created, View details' })).toBeInTheDocument()
  })

  // redesign J5 row 47 (ordering-products P-1, ): after a create the new site stays open, on Theme, to give it a theme
  it('a created site opens in the panel on Theme, with its id and tab in the address', async () => {
    renderRoute()
    await user.click(screen.getByRole('button', { name: 'Add product' }))
    await user.click(screen.getByRole('button', { name: 'site added' }))
    expect(details()).toHaveAttribute('data-site-id', '300')
    expect(details()).toHaveAttribute('data-tab', 'theme')
    expect(screen.queryByRole('dialog', { name: /unsaved/i })).toBeNull()
    expect(window.location.search).toContain('id=300')
    expect(window.location.search).toContain('tab=theme')
  })

  it('a save that keeps the same rows leaves the count alone', async () => {
    renderRoute('?id=232')
    await user.click(screen.getByRole('button', { name: 'save renamed' }))
    expect(screen.getByText('2 products')).toBeInTheDocument()
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 1–2 of 2')
  })
})

// redesign (review r1, Q-05): the focus never falls to <body> when the panel closes
describe('OrderingProductsListing · the focus when the panel closes (Q-05)', () => {
  it('after Discard in the leave dialog the focus is back on the row that opened the panel', async () => {
    renderRoute()
    await user.click(screen.getByRole('button', { name: 'Kiosk, View details' }))
    await user.click(screen.getByRole('button', { name: 'make dirty' }))
    await user.click(screen.getByRole('button', { name: 'request close' }))
    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(screen.queryByTestId('details')).toBeNull()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Kiosk, View details' })).toHaveFocus())
  })

  it('after a delete the row is gone, so the focus goes to «Add product» in the header', async () => {
    renderRoute()
    await user.click(screen.getByRole('button', { name: 'Kiosk, View details' }))
    await user.click(screen.getByRole('button', { name: 'delete from list' }))
    await user.click(screen.getByRole('button', { name: 'close directly' }))
    expect(screen.queryByTestId('details')).toBeNull()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add product' })).toHaveFocus())
  })

  it('after a create the focus is on «Add product», which opened the form', async () => {
    renderRoute()
    await user.click(screen.getByRole('button', { name: 'Add product' }))
    await user.click(screen.getByRole('button', { name: 'create into list' }))
    await user.click(screen.getByRole('button', { name: 'close directly' }))
    expect(screen.queryByTestId('details')).toBeNull()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add product' })).toHaveFocus())
  })

  it('a panel the address opened has no opener: when it closes the focus goes to «Add product»', async () => {
    renderRoute('?id=232')
    await user.click(screen.getByRole('button', { name: 'make dirty' }))
    await user.click(screen.getByRole('button', { name: 'request close' }))
    await user.click(screen.getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add product' })).toHaveFocus())
  })

  it('keeping the form (Keep editing) does not move the focus to the list', async () => {
    renderRoute()
    await user.click(screen.getByRole('button', { name: 'Kiosk, View details' }))
    await user.click(screen.getByRole('button', { name: 'make dirty' }))
    await user.click(screen.getByRole('button', { name: 'request close' }))
    await user.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.getByTestId('details')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kiosk, View details' })).not.toHaveFocus()
    expect(screen.getByRole('button', { name: 'Add product' })).not.toHaveFocus()
  })
})

describe('OrderingProductsListing · a failed load', () => {
  it('says why in a notice, with «Try again» that asks again, and no Alert', async () => {
    probe.sites = []
    probe.error = ['Not allowed']
    probe.pagination = { ...pagination(0), totalItems: null }
    renderRoute()
    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent('Not allowed')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await user.click(within(notice).getByRole('button', { name: 'Try again' }))
    expect(probe.getSites).toHaveBeenCalledTimes(1)
    expect(probe.getSites).toHaveBeenCalledWith(1, 10)
  })

  it('falls back to a sentence of its own when the API gives no text', () => {
    probe.sites = []
    probe.error = [{}]
    probe.pagination = { ...pagination(0), totalItems: null }
    renderRoute()
    expect(screen.getByRole('status')).toHaveTextContent("We couldn't load the products.")
  })
})

describe('OrderingProductsListing · the search', () => {
  it('sends the word once, 400 ms after the last key', () => {
    vi.useFakeTimers()
    renderRoute()
    const input = screen.getByRole('searchbox', { name: 'Search' })
    expect(input).toHaveAttribute('placeholder', 'Search by name or description')
    act(() => { input.focus() })
    // typing by events: user-event needs real timers, the keys are set by hand
    ;['p', 'pi', 'piz'].forEach(value => {
      act(() => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
        setter.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
      act(() => { vi.advanceTimersByTime(300) })
    })
    expect(probe.onSearch).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(400) })
    expect(probe.onSearch).toHaveBeenCalledTimes(1)
    expect(probe.onSearch).toHaveBeenCalledWith('piz')
  })

  it('sends at once with Enter, and does not send the same word again after the delay', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const typist = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderRoute()
    await typist.type(screen.getByRole('searchbox', { name: 'Search' }), 'pizza{Enter}')
    expect(probe.onSearch).toHaveBeenCalledTimes(1)
    expect(probe.onSearch).toHaveBeenCalledWith('pizza')
    act(() => { vi.advanceTimersByTime(1000) })
    expect(probe.onSearch).toHaveBeenCalledTimes(1)
  })

  it('sends at once when the search is cleared', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const typist = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderRoute()
    await typist.type(screen.getByRole('searchbox', { name: 'Search' }), 'pizza{Enter}')
    probe.onSearch.mockClear()
    await typist.click(screen.getByRole('button', { name: 'Clear' }))
    expect(probe.onSearch).toHaveBeenCalledTimes(1)
    expect(probe.onSearch).toHaveBeenCalledWith('')
  })
})

describe('OrderingProductsListing · the pages', () => {
  it('asks for the next page with the page size, and for page 1 when the size changes', async () => {
    probe.sites = [WEBSITE, OTHER]
    probe.pagination = { currentPage: 1, pageSize: 10, totalPages: 3, totalItems: 25, from: 1, to: 10 }
    renderRoute()
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(probe.getSites).toHaveBeenLastCalledWith(2, 10)
    await user.click(screen.getByRole('button', { name: /Items per page/ }))
    await user.click(await screen.findByRole('menuitemradio', { name: '25' }))
    expect(probe.getSites).toHaveBeenLastCalledWith(1, 25)
  })

  // redesign (review r1, Q-08): `main` kept the position: the page that holds the first row on screen, with the new size
  it('changing the page size goes to the page that holds the first row on screen, as main did (Q-08)', async () => {
    probe.pagination = { currentPage: 2, pageSize: 25, totalPages: 3, totalItems: 60, from: 26, to: 50 }
    renderRoute()
    await user.click(screen.getByRole('button', { name: /Items per page/ }))
    await user.click(await screen.findByRole('menuitemradio', { name: '10' }))
    // row 26 of 60 is on page 3 of 10 rows
    expect(probe.getSites).toHaveBeenLastCalledWith(3, 10)
  })

  it('writes ?page and ?pageSize after a load', () => {
    probe.pagination = { currentPage: 2, pageSize: 25, totalPages: 3, totalItems: 60, from: 26, to: 50 }
    renderRoute()
    const params = new URLSearchParams(window.location.search)
    expect(params.get('page')).toBe('2')
    expect(params.get('pageSize')).toBe('25')
  })
})

// redesign (bugs H): the route is a way out too. With unsaved work, the sidebar, links and back/forward (a route change to
// another pathname) ask through the same dialog; the same pathname with another ?section= passes; a clean page is never held.
describe('OrderingProductsListing · leaving by route', () => {
  let history
  const HistoryProbe = () => {
    history = useHistory()
    return null
  }
  const renderRouted = async () => {
    window.history.replaceState(null, '', '/ordering-products?id=232')
    renderWithProviders(
      <>
        <HistoryProbe />
        <OrderingProductsListing isUseQuery enableAutoFillFromWebsite />
      </>,
      { initialEntries: ['/ordering-products'] }
    )
  }
  const where = () => `${history.location.pathname}${history.location.search}`

  it('a clean page navigates away without asking', async () => {
    await renderRouted()
    act(() => history.push('/other'))
    expect(where()).toBe('/other')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('unsaved work: a push to another pathname opens the dialog and keeps the route', async () => {
    await renderRouted()
    await user.click(screen.getByRole('button', { name: 'make dirty' }))
    act(() => history.push('/other'))
    expect(await screen.findByRole('alertdialog', { name: 'Save your changes?' })).toBeInTheDocument()
    expect(where()).toBe('/ordering-products')
    expect(details()).toBeInTheDocument()
  })

  it('Discard navigates, and it does not ask a second time', async () => {
    await renderRouted()
    await user.click(screen.getByRole('button', { name: 'make dirty' }))
    act(() => history.push('/other'))
    await user.click(await screen.findByRole('button', { name: 'Discard' }))
    expect(where()).toBe('/other')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('Keep editing stays on the route with the form untouched', async () => {
    await renderRouted()
    await user.click(screen.getByRole('button', { name: 'make dirty' }))
    act(() => history.push('/other'))
    await user.click(await screen.findByRole('button', { name: 'Keep editing' }))
    expect(where()).toBe('/ordering-products')
    expect(details()).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('the same pathname with another ?section= passes without asking', async () => {
    await renderRouted()
    await user.click(screen.getByRole('button', { name: 'make dirty' }))
    act(() => history.push('/ordering-products?section=theme'))
    expect(where()).toBe('/ordering-products?section=theme')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('after Discard the page is clean: closing the panel then leaving does not ask again', async () => {
    await renderRouted()
    await user.click(screen.getByRole('button', { name: 'make dirty' }))
    act(() => history.push('/other'))
    await user.click(await screen.findByRole('button', { name: 'Discard' }))
    act(() => history.push('/another'))
    expect(where()).toBe('/another')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

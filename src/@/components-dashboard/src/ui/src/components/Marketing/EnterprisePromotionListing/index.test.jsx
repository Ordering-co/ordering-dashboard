import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// redesign PE-B2: the controller is played by the test (`ctl.props` are what it hands the UI); the editor and the Quick view are stubs that
// record what the page gives them. The header, tabs, search, SplitView, table (through the real EnterprisePromotionList adapter) and
// dialogs are the real ones.
const ctl = vi.hoisted(() => ({ props: {}, seen: { details: null, quick: null } }))
const infoShare = vi.hoisted(() => ({ isCollapse: false, handleMenuCollapse: vi.fn() }))

vi.mock('../../../../../index', () => ({
  EnterprisePromotionList: props => {
    const Component = props.UIComponent
    return (
      <Component
        {...props}
        promotionListState={{ promotions: [], loading: false, error: null }}
        sitesState={{ sites: [], loading: false }}
        paymethodsState={{ paymethods: [], loading: false }}
        businessesList={{ businesses: [], loading: false }}
        businessesPaginationProps={{ currentPage: 1, totalPages: 1 }}
        paginationProps={{ currentPage: 1, totalPages: 1 }}
        getPromotions={vi.fn()}
        loadAllJourneyBusinesses={vi.fn().mockResolvedValue([])}
        {...ctl.props}
      />
    )
  },
  useConfig: () => [{ configs: {} }],
  useLanguage: () => [{ language: { code: 'en' } }, (key, fallback) => fallback || key],
  useSession: () => [{ user: { level: 0 } }],
  useUtils: () => [{ parseDate: value => String(value ?? ''), parsePrice: value => String(value), optimizeImage: value => value }]
}))

vi.mock('../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: infoShare.isCollapse }, { handleMenuCollapse: infoShare.handleMenuCollapse }]
}))

vi.mock('../../Shared', () => ({
  LearnDropDown: () => <button type='button'>Learn</button>
}))

vi.mock('../PromotionJourneysListing', async () => {
  const actual = await vi.importActual('../PromotionJourneysListing/journeyUtils')
  return {
    PromotionJourneysListingUI: (props) => {
      ctl.seen.quick = props
      return (
        <div data-testid='journeys-content'>
          Journeys content
          <button type='button' onClick={() => props.onOpenAdvancedPromotion?.({ id: 42 })}>Edit excluded promotion</button>
          <button type='button' onClick={() => props.onSearch?.('from quick')}>Quick search</button>
        </div>
      )
    },
    ...actual
  }
})

// the adapter is the real one (the table, the pager, the effects); the marker keeps the routing tests' «Advanced content»
vi.mock('../EnterprisePromotionList', async () => {
  const actual = await vi.importActual('../EnterprisePromotionList')
  return {
    EnterprisePromotionList: props => (
      <>
        <div data-testid='advanced-offers-content'>Advanced content</div>
        <actual.EnterprisePromotionList {...props} />
      </>
    )
  }
})

vi.mock('../EnterprisePromotionDetails', () => ({
  EnterprisePromotionDetails: props => {
    ctl.seen.details = props
    return (
      <div data-testid='advanced-panel'>
        <span data-testid='advanced-promotion-id'>{props.promotionId}</span>
        <button type='button' onClick={props.onClose}>Close panel</button>
        <button type='button' onClick={() => props.onExpandedChange(!props.expanded)}>Expand panel</button>
        <button type='button' onClick={() => props.onDirtyChange(true)}>Make dirty</button>
        <button type='button' onClick={() => props.onDirtyChange(false)}>Make clean</button>
      </div>
    )
  }
}))

import { EnterprisePromotionListing } from './index'

const theme = {
  colors: {
    primary: '#266DF0',
    lightPrimary: '#EAF1FE',
    backgroundPage: '#FFFFFF',
    headingColor: '#0B0C0D',
    borderColor: '#DEE0E3'
  }
}

const renderWorkspace = (initialEntry, props = {}) => render(
  <ThemeProvider theme={theme}>
    <MemoryRouter initialEntries={[initialEntry]}>
      <EnterprisePromotionListing {...props} />
    </MemoryRouter>
  </ThemeProvider>
)

// jsdom answers matchMedia with `matches: false`: the split view reads (min|max)-width queries, so one is installed that evaluates them
// against a width (1440: the split mode, the panel sits beside the list)
const installViewport = (width) => {
  const original = { matchMedia: window.matchMedia, innerWidth: window.innerWidth }
  const matches = query => query.split(/\s+and\s+/).every(part => {
    const [, kind, value] = part.match(/\(\s*(min|max)-width:\s*(\d+)px\s*\)/) || []
    if (!kind) return false
    return kind === 'min' ? width >= Number(value) : width <= Number(value)
  })
  window.matchMedia = query => ({
    media: query,
    get matches () { return matches(query) },
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {}
  })
  window.innerWidth = width
  return () => Object.assign(window, original)
}

let restoreViewport
beforeEach(() => {
  restoreViewport = installViewport(1440)
  ctl.props = {}
  ctl.seen = { details: null, quick: null }
  infoShare.isCollapse = false
  infoShare.handleMenuCollapse.mockClear()
})
afterEach(() => {
  restoreViewport()
  vi.useRealTimers()
  window.history.replaceState(null, '', '/')
})

describe('EnterprisePromotionListing workspace', () => {
  // bugs H review R-1 (#76a): the shell's <main id='main-content'> holds every page, so the page root is no landmark
  test('draws no main landmark of its own', () => {
    renderWorkspace('/marketing/promotions-enterprise')
    expect(screen.getByTestId('promotion-workspace').tagName).toBe('DIV')
    expect(screen.queryByRole('main')).not.toBeInTheDocument()
  })

  test('opens Quick offers by default and switches tabs without a blank state', () => {
    renderWorkspace('/marketing/promotions-enterprise')

    expect(screen.getByTestId('journeys-content')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Quick offers' })).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(screen.getByRole('tab', { name: 'Advanced offers' }))
    expect(screen.getByTestId('advanced-offers-content')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Advanced offers' })).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(screen.getByRole('tab', { name: 'Quick offers' }))
    expect(screen.getByTestId('journeys-content')).toBeInTheDocument()
  })

  // Owner decision 22 B (2026-10-21, T-1): Quick offers lends the tabs its builder's guard too, so leaving for Advanced asks first
  test('leaving Quick offers goes through the guard the Quick view registers (owner decision 22)', () => {
    renderWorkspace('/marketing/promotions-enterprise')
    expect(typeof ctl.seen.quick.registerLeaveGuard).toBe('function')
    let pending = null
    act(() => { ctl.seen.quick.registerLeaveGuard(proceed => { pending = proceed }) })

    fireEvent.click(screen.getByRole('tab', { name: 'Advanced offers' }))
    expect(screen.getByTestId('journeys-content')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Edit excluded promotion' }))
    expect(screen.getByTestId('journeys-content')).toBeInTheDocument()
    expect(typeof pending).toBe('function')

    act(() => { pending() })
    expect(screen.getByTestId('advanced-offers-content')).toBeInTheDocument()
  })

  test('preserves legacy promotion deep links by opening Advanced offers', () => {
    renderWorkspace('/marketing/promotions-enterprise?id=42')

    expect(screen.getByTestId('advanced-offers-content')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Advanced offers' })).toHaveAttribute('aria-selected', 'true')
  })

  test('an explicit Quick offers view wins over a stale promotion id', () => {
    renderWorkspace('/marketing/promotions-enterprise?view=journeys&id=42')

    expect(screen.getByTestId('journeys-content')).toBeInTheDocument()
    expect(screen.queryByTestId('advanced-offers-content')).not.toBeInTheDocument()
  })

  test('routes unsupported Quick offer edits to the matching Advanced promotion', () => {
    renderWorkspace('/marketing/promotions-enterprise?view=journeys')

    fireEvent.click(screen.getByRole('button', { name: 'Edit excluded promotion' }))

    expect(screen.getByTestId('advanced-offers-content')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Advanced offers' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('advanced-promotion-id')).toHaveTextContent('42')
  })
})

// ---- redesign PE-B2 ----

const ADVANCED = '/marketing/promotions-enterprise?view=advanced_offers'
const QUICK = '/marketing/promotions-enterprise?view=journeys'

const promo = (id, extra = {}) => ({ id, name: `Promo ${id}`, enabled: true, rank: id, target: 1, type: 1, auto: true, rate_type: 1, rate: 10, start: '2020-01-01 00:00:00', end: null, ...extra })
const ROWS = [promo(1), promo(2), promo(3)]

const loaded = (overrides = {}) => ({
  promotionListState: { promotions: ROWS, loading: false, error: null },
  paginationProps: { currentPage: 1, pageSize: 10, totalItems: 42, totalPages: 5, from: 1, to: 3 },
  getPromotions: vi.fn(),
  onSearch: vi.fn(),
  searchValue: '',
  handleEnablePromotion: vi.fn(() => Promise.resolve({ ok: true })),
  handleDeletePromotionFromList: vi.fn(() => Promise.resolve({ ok: true })),
  handleSuccessDeletePromotion: vi.fn(),
  handleDragStart: vi.fn(),
  handleAllowDrop: vi.fn(),
  handleDrop: vi.fn(),
  handleDragEnd: vi.fn(),
  ...overrides
})

const renderAdvanced = (overrides = {}, entry = ADVANCED, props = {}) => {
  window.history.replaceState(null, '', entry)
  ctl.props = loaded(overrides)
  const element = () => (
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[entry]}>
        <EnterprisePromotionListing {...props} />
      </MemoryRouter>
    </ThemeProvider>
  )
  const view = render(element())
  return {
    ...view,
    // the controller answers with new props (a new list, the end of a load)
    update: (changes) => {
      Object.assign(ctl.props, changes)
      view.rerender(element())
    }
  }
}

describe('PE-B2 header', () => {
  test('Advanced: the title, the count of promotions, Learn and «Add promotion»', () => {
    renderAdvanced()

    expect(screen.getByRole('heading', { level: 1, name: 'Promotions' })).toBeInTheDocument()
    expect(screen.getByText('42 promotions')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Learn' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add promotion' })).toBeInTheDocument()
  })

  test('one promotion reads «1 promotion»', () => {
    renderAdvanced({ paginationProps: { currentPage: 1, pageSize: 10, totalItems: 1, totalPages: 1, from: 1, to: 1 } })
    expect(screen.getByText('1 promotion')).toBeInTheDocument()
  })

  test('Quick: Learn and the count stay, «Add promotion» does not (the templates are its way in)', () => {
    renderAdvanced({}, QUICK)

    expect(screen.getByTestId('journeys-content')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Learn' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add promotion' })).not.toBeInTheDocument()
  })

  // the opener is PageHeader's `leading`, the first child of the lead block, before the title
  test('with the sidebar collapsed the menu button opens it', async () => {
    infoShare.isCollapse = true
    renderAdvanced()

    const opener = screen.getByRole('button', { name: 'Open menu' })
    expect(opener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(opener)
    await userEvent.click(opener)
    expect(infoShare.handleMenuCollapse).toHaveBeenCalledWith(false)
  })

  test('without the sidebar collapsed there is no menu button', () => {
    infoShare.isCollapse = false
    renderAdvanced()

    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument()
  })

  test('the two views are tabs: role=tab, aria-selected, and the tablist is named', () => {
    renderAdvanced()

    expect(screen.getByRole('tablist', { name: 'Promotion workspace' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Advanced offers' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Quick offers' })).toHaveAttribute('aria-selected', 'false')
  })
})

describe('PE-B2 search', () => {
  test('Advanced: one onSearch call after the pause, not one per key', () => {
    vi.useFakeTimers()
    renderAdvanced()
    const field = screen.getByRole('searchbox', { name: 'Search promotions' })

    fireEvent.change(field, { target: { value: 's' } })
    fireEvent.change(field, { target: { value: 'sp' } })
    fireEvent.change(field, { target: { value: 'spring' } })
    expect(ctl.props.onSearch).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(749) })
    expect(ctl.props.onSearch).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })

    expect(ctl.props.onSearch).toHaveBeenCalledTimes(1)
    expect(ctl.props.onSearch).toHaveBeenCalledWith('spring')
  })

  test('Enter sends the search at once and «Clear search» empties it', () => {
    vi.useFakeTimers()
    renderAdvanced({ searchValue: 'old' })
    const field = screen.getByRole('searchbox', { name: 'Search promotions' })
    expect(field).toHaveValue('old')

    fireEvent.change(field, { target: { value: 'new' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(ctl.props.onSearch).toHaveBeenCalledWith('new')

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(ctl.props.onSearch).toHaveBeenLastCalledWith('')
  })

  test('Quick: the search state of the controller reaches the Quick list as props (one search for both views)', () => {
    renderAdvanced({ searchValue: 'abc' }, QUICK)

    expect(ctl.seen.quick.searchValue).toBe('abc')
    fireEvent.click(screen.getByRole('button', { name: 'Quick search' }))
    expect(ctl.props.onSearch).toHaveBeenCalledWith('from quick')
  })
})

describe('PE-B2 Advanced: the list and the panel', () => {
  test('the table gets the controller list, the toggle and the drag handlers', async () => {
    renderAdvanced()

    expect(screen.getByRole('table', { name: 'Promotions' })).toBeInTheDocument()
    expect(screen.getByText('Promo 2')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('switch', { name: 'Enable Promo 2' }))
    expect(ctl.props.handleEnablePromotion).toHaveBeenCalledWith(2, false)
  })

  test('opening a row opens the panel beside the list and writes ?id=', async () => {
    renderAdvanced()
    expect(screen.queryByTestId('advanced-panel')).not.toBeInTheDocument()

    await userEvent.click(screen.getByText('Promo 2'))

    expect(screen.getByTestId('advanced-panel')).toBeInTheDocument()
    expect(screen.getByTestId('advanced-promotion-id')).toHaveTextContent('2')
    expect(new URLSearchParams(window.location.search).get('id')).toBe('2')
    expect(ctl.seen.details.promotion).toMatchObject({ id: 2 })
    expect(typeof ctl.seen.details.onClose).toBe('function')
    expect(typeof ctl.seen.details.onExpandedChange).toBe('function')
    expect(typeof ctl.seen.details.onDirtyChange).toBe('function')
  })

  test('closing the panel takes ?id= out of the URL', async () => {
    renderAdvanced()
    await userEvent.click(screen.getByText('Promo 2'))
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }))

    expect(screen.queryByTestId('advanced-panel')).not.toBeInTheDocument()
    expect(new URLSearchParams(window.location.search).get('id')).toBeNull()
  })

  test('?id= opens that promotion once the list has loaded', () => {
    const view = renderAdvanced({ promotionListState: { promotions: [], loading: true, error: null } }, `${ADVANCED}&id=3`)
    expect(screen.queryByTestId('advanced-panel')).not.toBeInTheDocument()

    view.update({ promotionListState: { promotions: ROWS, loading: false, error: null } })

    expect(screen.getByTestId('advanced-promotion-id')).toHaveTextContent('3')
    expect(ctl.seen.details.promotion).toMatchObject({ id: 3, name: 'Promo 3' })
  })

  test('?id= of a promotion that is not on the page still opens it (the panel loads it)', () => {
    renderAdvanced({}, `${ADVANCED}&id=99`)

    expect(screen.getByTestId('advanced-promotion-id')).toHaveTextContent('99')
    expect(ctl.seen.details.promotion).toEqual({})
  })

  test('«Add promotion» (header) and «Add new promotion» (below the table) open the add panel', async () => {
    renderAdvanced()

    await userEvent.click(screen.getByRole('button', { name: 'Add promotion' }))
    expect(screen.getByTestId('advanced-panel')).toBeInTheDocument()
    expect(ctl.seen.details.promotionId).toBeUndefined()
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }))

    await userEvent.click(screen.getByRole('button', { name: 'Add new promotion' }))
    expect(screen.getByTestId('advanced-panel')).toBeInTheDocument()
    expect(ctl.seen.details.promotionId).toBeUndefined()
  })

  test('?add=1 opens the add panel only after the first load has finished, and only once', () => {
    const view = renderAdvanced({ promotionListState: { promotions: [], loading: true, error: null } }, `${ADVANCED}&add=1`)
    expect(screen.queryByTestId('advanced-panel')).not.toBeInTheDocument()

    view.update({ promotionListState: { promotions: ROWS, loading: false, error: null } })

    expect(screen.getByTestId('advanced-panel')).toBeInTheDocument()
    expect(ctl.seen.details.promotionId).toBeUndefined()
    expect(new URLSearchParams(window.location.search).has('add')).toBe(false)
  })

  test('the panel is named after the promotion, and «Open as page» is handed down', async () => {
    renderAdvanced()
    await userEvent.click(screen.getByText('Promo 1'))

    expect(screen.getByRole('complementary', { name: 'Promo 1' })).toBeInTheDocument()
    expect(ctl.seen.details.expanded).toBe(false)
    await userEvent.click(screen.getByRole('button', { name: 'Expand panel' }))
    expect(ctl.seen.details.expanded).toBe(true)
  })

  test('another row while the panel has unsaved changes asks first; Keep editing stays, Discard goes', async () => {
    renderAdvanced()
    await userEvent.click(screen.getByText('Promo 1'))
    await userEvent.click(screen.getByRole('button', { name: 'Make dirty' }))

    await userEvent.click(screen.getByText('Promo 2'))
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText('Discard your changes?')).toBeInTheDocument()
    expect(screen.getByTestId('advanced-promotion-id')).toHaveTextContent('1')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    expect(screen.getByTestId('advanced-promotion-id')).toHaveTextContent('1')

    await userEvent.click(screen.getByText('Promo 2'))
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    expect(screen.getByTestId('advanced-promotion-id')).toHaveTextContent('2')
  })
})

// redesign (row 81, review r1 R9): two gaps of PE-15 and PE-16
describe('PE-B2 Advanced: search on a failed list, tab change with a dirty panel (R9)', () => {
  test('a list error keeps the search box, so a failed search can be changed and not only retried', () => {
    renderAdvanced({
      promotionListState: { promotions: [], loading: false, error: ['Offers are not available'] },
      paginationProps: { currentPage: 1, pageSize: 10, totalItems: null, totalPages: null }
    })
    expect(screen.getByText("We couldn't load promotions.")).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search promotions' })).toBeInTheDocument()
  })

  test('changing the tab while the panel has unsaved changes asks first; Keep editing stays, Discard goes', async () => {
    renderAdvanced()
    await userEvent.click(screen.getByText('Promo 1'))
    await userEvent.click(screen.getByRole('button', { name: 'Make dirty' }))

    await userEvent.click(screen.getByRole('tab', { name: 'Quick offers' }))
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText('Discard your changes?')).toBeInTheDocument()
    expect(screen.queryByTestId('journeys-content')).toBeNull()
    expect(screen.getByTestId('promotion-workspace')).toHaveAttribute('data-view', 'advanced_offers')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    expect(screen.getByTestId('advanced-promotion-id')).toHaveTextContent('1')
    // review F-5: the focus goes back to the tab that is still selected, not to the one that was pressed
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Advanced offers' })).toHaveFocus())

    await userEvent.click(screen.getByRole('tab', { name: 'Quick offers' }))
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    expect(screen.getByTestId('journeys-content')).toBeInTheDocument()
  })

  test('a clean panel changes the tab without a question', async () => {
    renderAdvanced()
    await userEvent.click(screen.getByText('Promo 1'))
    await userEvent.click(screen.getByRole('tab', { name: 'Quick offers' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByTestId('journeys-content')).toBeInTheDocument()
  })
})

describe('PE-B2 Advanced: delete from the row menu', () => {
  const openDeleteFor = async (name) => {
    await userEvent.click(screen.getByRole('button', { name: `Actions for ${name}` }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))
  }

  test('asks with the name and calls the controller on confirm', async () => {
    renderAdvanced()
    await openDeleteFor('Promo 2')

    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText('Delete "Promo 2"?')).toBeInTheDocument()
    expect(ctl.props.handleDeletePromotionFromList).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete promotion' }))

    expect(ctl.props.handleDeletePromotionFromList).toHaveBeenCalledTimes(1)
    expect(ctl.props.handleDeletePromotionFromList).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    // the menu click did not open the row
    expect(screen.queryByTestId('advanced-panel')).not.toBeInTheDocument()
  })

  test('Cancel sends nothing', async () => {
    renderAdvanced()
    await openDeleteFor('Promo 1')
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))

    expect(ctl.props.handleDeletePromotionFromList).not.toHaveBeenCalled()
  })

  test('a failure stays inside the confirmation with its reason, and the dialog stays open', async () => {
    renderAdvanced({ handleDeletePromotionFromList: vi.fn(() => Promise.resolve({ ok: false, error: ['This offer is in use'] })) })
    await openDeleteFor('Promo 3')
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete promotion' }))

    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByRole('alert')).toHaveTextContent('This offer is in use')
  })

  test('deleting the promotion that is open closes its panel', async () => {
    renderAdvanced()
    await userEvent.click(screen.getByText('Promo 2'))
    expect(screen.getByTestId('advanced-panel')).toBeInTheDocument()

    await openDeleteFor('Promo 2')
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete promotion' }))

    expect(screen.queryByTestId('advanced-panel')).not.toBeInTheDocument()
  })
})

// redesign (row 20b): the row that opened the panel or the menu goes away with a delete, and an add opened by `?add=1` has no
// opener; the focus used to fall to <body>
describe('Advanced: where the focus goes after a delete or an add (row 20b)', () => {
  const rowOfFocus = () => document.activeElement?.closest?.('[data-row-id]')?.getAttribute('data-row-id')
  const without = id => ({ promotionListState: { promotions: ROWS.filter(row => row.id !== id), loading: false, error: null } })
  const deleteFromMenu = async (name) => {
    await userEvent.click(screen.getByRole('button', { name: `Actions for ${name}` }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete promotion' }))
  }

  test('deleting from the row menu puts the focus on the row that took its place', async () => {
    const view = renderAdvanced()
    await deleteFromMenu('Promo 2')
    act(() => view.update(without(2)))

    await waitFor(() => expect(rowOfFocus()).toBe('3'))
  })

  test('deleting the last row puts the focus on the one above', async () => {
    const view = renderAdvanced()
    await deleteFromMenu('Promo 3')
    act(() => view.update(without(3)))

    await waitFor(() => expect(rowOfFocus()).toBe('2'))
  })

  test('deleting the only row puts the focus on «Add promotion»', async () => {
    const view = renderAdvanced({ promotionListState: { promotions: [promo(1)], loading: false, error: null } })
    await deleteFromMenu('Promo 1')
    act(() => view.update({ promotionListState: { promotions: [], loading: false, error: null } }))

    // the empty state has an «Add promotion» of its own: the focus goes to the header's
    await waitFor(() => expect(document.querySelector('.odc-promo-head').querySelector('button[title="Add promotion"]')).toHaveFocus())
  })

  test('deleting from the open panel (the controller tells the list, then closes the panel) lands on the next row, not <body>', async () => {
    const view = renderAdvanced()
    await userEvent.click(screen.getByText('Promo 2'))
    expect(screen.getByTestId('advanced-panel')).toBeInTheDocument()

    act(() => {
      ctl.seen.details.handleSuccessDeletePromotion(2)
      ctl.seen.details.onClose()
      view.update(without(2))
    })

    await waitFor(() => expect(rowOfFocus()).toBe('3'))
    expect(screen.queryByTestId('advanced-panel')).not.toBeInTheDocument()
  })

  test('an add opened with ?add=1 (no opener) lands on «Add promotion» once the panel closes', async () => {
    renderAdvanced({}, `${ADVANCED}&add=1`)
    await screen.findByTestId('advanced-panel')
    expect(document.activeElement === document.body || !document.activeElement).toBe(false)

    act(() => {
      document.activeElement?.blur?.()
      ctl.seen.details.handleSuccessAddPromotion({ id: 9 })
      ctl.seen.details.onClose()
    })

    await waitFor(() => expect(document.querySelector('.odc-promo-head').querySelector('button[title="Add promotion"]')).toHaveFocus())
  })

  test('a focus the person already moved elsewhere is left alone', async () => {
    const view = renderAdvanced()
    await deleteFromMenu('Promo 2')
    const learn = screen.getByRole('button', { name: 'Learn' })
    act(() => {
      learn.focus()
      view.update(without(2))
    })

    await new Promise(resolve => setTimeout(resolve, 150))
    expect(learn).toHaveFocus()
  })
})

describe('PE-B2 Advanced: pages, errors, loading', () => {
  test('the pager asks the controller for the page with the size it has', async () => {
    renderAdvanced()
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))

    expect(ctl.props.getPromotions).toHaveBeenCalledWith(2, 10)
  })

  test('a page left empty goes back one page (the last page after deleting its only row)', () => {
    renderAdvanced({
      promotionListState: { promotions: [], loading: false, error: null },
      paginationProps: { currentPage: 3, pageSize: 10, totalItems: 20, totalPages: 3, from: 21, to: 20 }
    })

    expect(ctl.props.getPromotions).toHaveBeenCalledWith(2, 10)
  })

  test('?page and ?pageSize follow the list when the page uses the query', () => {
    renderAdvanced({}, ADVANCED, { isUseQuery: true })

    const params = new URLSearchParams(window.location.search)
    expect(params.get('page')).toBe('1')
    expect(params.get('pageSize')).toBe('10')
  })

  test('a list error shows «Retry» that asks for the current page again, and Add stays usable', async () => {
    renderAdvanced({
      promotionListState: { promotions: [], loading: false, error: ['Offers are not available'] },
      paginationProps: { currentPage: 2, pageSize: 25, totalItems: null, totalPages: null }
    })

    expect(screen.getByText("We couldn't load promotions.")).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(ctl.props.getPromotions).toHaveBeenCalledWith(2, 25)

    expect(screen.getByRole('button', { name: 'Add promotion' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Add promotion' }))
    expect(screen.getByTestId('advanced-panel')).toBeInTheDocument()
  })

  test('there is no «Ordering» alert any more: an error does not open a dialog', () => {
    renderAdvanced({ promotionListState: { promotions: [], loading: false, error: ['Offers are not available'] } })

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

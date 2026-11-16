/* eslint-disable import/first */
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({
  collapse: false,
  handleMenuCollapse: vi.fn(),
  width: 1280,
  filterBarProps: null,
  websocketProps: null
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: runtime.collapse }, { handleMenuCollapse: runtime.handleMenuCollapse }]
}))
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: runtime.width }) }))
vi.mock('../../../../styles', () => ({
  IconButton: ({ children, ...props }) => <button type='button' {...props}>{children}</button>
}))
vi.mock('../../../Shared', () => ({ LearnDropDown: () => <button type='button'>Learn</button> }))
vi.mock('../../GoogleMapsApiKeySettingButton', () => ({ GoogleMapsApiKeySettingButton: () => <button type='button'>Maps key</button> }))
vi.mock('../../WebsocketStatus', () => ({
  WebsocketStatus: (props) => { runtime.websocketProps = props; return <span role='status'>Live</span> }
}))
// redesign 5.2: the filter bar is built by 5.2-B in parallel; this suite only checks what the header hands to it.
vi.mock('../../OrdersFilterBar', () => ({
  OrdersFilterBar: (props) => { runtime.filterBarProps = props; return <div data-testid='filter-bar' /> }
}))

import { OrdersContentHeader } from '..'

const baseProps = {
  title: 'Orders list',
  hideTour: true,
  learnOptions: [],
  searchValue: 'ana',
  driverGroupList: { groups: [] },
  assignableDriverGroupList: { groups: [] },
  driversList: { drivers: [] },
  citiesList: { cities: [] },
  paymethodsList: { paymethods: [] },
  businessesList: { businesses: [] },
  adminsList: { admins: [] },
  filterValues: { cities: [1] },
  handleChangeSearch: vi.fn(),
  handleChangeFilterValues: vi.fn(),
  filterModalOpen: false,
  setFilterModalOpen: vi.fn(),
  setTimeStatus: vi.fn(),
  setSlaSettingTime: vi.fn(),
  ordersStatusGroup: 'pending',
  selectedSubOrderStatus: { pending: [0] },
  handleSelectedSubOrderStatus: vi.fn()
}

describe('OrdersContentHeader · title line', () => {
  beforeEach(() => {
    runtime.collapse = false
    runtime.width = 1280
    runtime.filterBarProps = null
    runtime.websocketProps = null
    runtime.handleMenuCollapse.mockClear()
  })

  // redesign 5.2 audit-3: Learn, the maps key button and the page actions are one group, so they wrap
  // together and stay aligned to the end instead of Learn staying alone on the first line.
  it('one line: h1 title, live status, then one end-aligned group with Learn first and the page actions last', () => {
    render(<OrdersContentHeader {...baseProps} isShowMapsKeySettingButton headerActions={<button type='button'>New order</button>} />)
    const title = screen.getByRole('heading', { level: 1, name: 'Orders list' })
    const line = title.parentElement
    const order = [...line.children].map(node => node.textContent).filter(Boolean)
    expect(order).toEqual(['Orders list', 'Live', 'LearnMaps keyNew order'])
    const group = line.querySelector('.odc-page-actions')
    expect(group).not.toBeNull()
    expect([...group.children].map(node => node.textContent)).toEqual(['Learn', 'Maps key', 'New order'])
  })

  it('has no menu button while the menu is open', () => {
    render(<OrdersContentHeader {...baseProps} />)
    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument()
  })

  it('collapsed menu: a named Open menu button that expands it', async () => {
    runtime.collapse = true
    render(<OrdersContentHeader {...baseProps} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Open menu' }))
    expect(runtime.handleMenuCollapse).toHaveBeenCalledWith(false)
  })

  it('the menu button comes before the title', () => {
    runtime.collapse = true
    render(<OrdersContentHeader {...baseProps} />)
    const menu = screen.getByRole('button', { name: 'Open menu' })
    const title = screen.getByRole('heading', { level: 1 })
    expect(menu.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  // redesign fix-qa E7 (main: OrdersContentHeader:116-124): the embedded lists (customer, driver, business) have no
  // title line, but the connection indicator stays: a list that may be out of date has to say so.
  it('isDisableTitle hides the title line but keeps the filter bar and the connection indicator', () => {
    render(<OrdersContentHeader {...baseProps} isDisableTitle headerActions={<button type='button'>New order</button>} />)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Learn' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New order' })).not.toBeInTheDocument()
    expect(screen.getByTestId('filter-bar')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Live')
  })

  it('the embedded indicator sits above the filter bar and hands the notice slot on', () => {
    const renderConnectionNotice = vi.fn()
    render(<OrdersContentHeader {...baseProps} isDisableTitle renderConnectionNotice={renderConnectionNotice} />)
    const live = screen.getByRole('status')
    expect(live.compareDocumentPosition(screen.getByTestId('filter-bar')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(runtime.websocketProps.renderNotice).toBe(renderConnectionNotice)
  })

  it('draws the indicator once: in the title line when there is one', () => {
    render(<OrdersContentHeader {...baseProps} />)
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })

  it('keeps the tutorial button (named, only wide, only when not hidden) and the maps key button', async () => {
    const handleOpenTour = vi.fn()
    const { rerender } = render(
      <OrdersContentHeader {...baseProps} hideTour={false} selectedOrderIds={[]} handleOpenTour={handleOpenTour} isShowMapsKeySettingButton />
    )
    expect(screen.getByRole('button', { name: 'Maps key' })).toBeInTheDocument()
    const tour = document.querySelector('.tour_btn')
    expect(tour).not.toBeNull()
    await userEvent.setup().click(tour)
    expect(handleOpenTour).toHaveBeenCalled()

    runtime.width = 700
    rerender(<OrdersContentHeader {...baseProps} hideTour={false} selectedOrderIds={[]} handleOpenTour={handleOpenTour} />)
    expect(document.querySelector('.tour_btn')).toBeNull()
  })

  it('passes the connection notice slot to the live status', () => {
    const renderConnectionNotice = vi.fn()
    render(<OrdersContentHeader {...baseProps} renderConnectionNotice={renderConnectionNotice} />)
    expect(runtime.websocketProps.renderNotice).toBe(renderConnectionNotice)
  })
})

describe('OrdersContentHeader · layout rules (css)', () => {
  const css = readFileSync(path.join(__dirname, '../content-header.css'), 'utf8')

  // redesign F6b (D-18): it used to wrap under the title when the list narrowed beside the order panel, and
  // that pushed the table 40px; now the head is one row (OrdersContentHeader.stableLayout.test.jsx) and the group
  // is one non-wrapping item at the end of it.
  it('the actions group is one item that ends the line', () => {
    expect(css).toMatch(/\.odc-page-actions\s*{[^}]*flex-wrap:\s*nowrap/)
    expect(css).toMatch(/\.odc-page-actions\s*{[^}]*justify-content:\s*flex-end/)
    expect(css).toMatch(/\.odc-page-actions\s*{[^}]*margin-inline-start:\s*auto/)
    expect(css).toMatch(/\.odc-page-head\s*{[^}]*container-type:\s*inline-size/)
  })

  // redesign audit-4: Learn is a Product Menu now; its text sits in `.od-learn-label` (it was the
  // FirstSelect's `.place-holder`) and the trigger needs no legacy dress.
  it('below ~700px of head Learn keeps only its icon and its accessible name', () => {
    const block = css.match(/@container\s*\(max-width:\s*699px\)\s*{([\s\S]*?)\n}/)
    expect(block).not.toBeNull()
    expect(block[1]).toMatch(/\.learn-drop-down\s+\.od-learn-label\s*{[^}]*clip-path:\s*inset\(50%\)/)
    expect(css).not.toMatch(/od-first-select|place-holder/)
    // Visually hidden, not removed: display none or visibility hidden would drop the name.
    expect(block[1]).not.toMatch(/display:\s*none|visibility:\s*hidden/)
  })

  // redesign audit-4: the trigger is the Product ghost button, so the head only sets its height.
  // redesign fix-qa E8: the 44px also answers to the phone width (below 768px), where a mouse measured 32px.
  it('Learn takes the control height in the head and 44px with a coarse pointer or on a phone, with no margin', () => {
    expect(css).toMatch(/\.odc-page-head\s+\.od-ui\.od-learn-menu\s+\.learn-drop-down\s*{[^}]*margin:\s*0;[^}]*min-block-size:\s*var\(--od-x-control-height\)/)
    const coarse = css.match(/@media\s*\(pointer:\s*coarse\),\s*\(max-width:\s*767px\)\s*{([\s\S]*?)\n}/)[1]
    expect(coarse).toMatch(/\.learn-drop-down\s*{[^}]*min-block-size:\s*var\(--od-x-target-coarse\)/)
  })

  // Base UI puts focus guards (span) before the trigger while its popup is open, so the trigger is no
  // longer the first child: the dress must match the first button, not the first child.
  it('dresses each action trigger as the first button, never the first child', () => {
    expect(css).not.toMatch(/button:first-child/)
    expect(css).toMatch(/> div:first-child > button:first-of-type/)
    expect(css).toMatch(/\[data-action\] > button:first-of-type/)
  })

  it('the export wrapper no longer carries a legacy size for its trigger', () => {
    const styles = readFileSync(path.join(__dirname, '../../OrdersExportCSV/styles.js'), 'utf8')
    const container = styles.match(/export const ExportContainer = styled\.div`([\s\S]*?)`/)[1]
    expect(container).not.toMatch(/>\s*button/)
    expect(container).not.toMatch(/height/)
    expect(container).not.toMatch(/margin-inline-end/)
  })
})

describe('OrdersContentHeader · filter bar', () => {
  beforeEach(() => { runtime.filterBarProps = null })

  it('draws the filter bar under the title line and hands it every filter prop plus the status ones', () => {
    render(<OrdersContentHeader {...baseProps} toolsSlot isLateralBar isSelectedOrders={false} disableSocketRoomDriver />)
    const bar = screen.getByTestId('filter-bar')
    const title = screen.getByRole('heading', { level: 1 })
    expect(title.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(runtime.filterBarProps).toMatchObject({
      searchValue: 'ana',
      driverGroupList: baseProps.driverGroupList,
      assignableDriverGroupList: baseProps.assignableDriverGroupList,
      driversList: baseProps.driversList,
      citiesList: baseProps.citiesList,
      paymethodsList: baseProps.paymethodsList,
      businessesList: baseProps.businessesList,
      adminsList: baseProps.adminsList,
      filterValues: baseProps.filterValues,
      handleChangeSearch: baseProps.handleChangeSearch,
      handleChangeFilterValues: baseProps.handleChangeFilterValues,
      filterModalOpen: false,
      setFilterModalOpen: baseProps.setFilterModalOpen,
      setTimeStatus: baseProps.setTimeStatus,
      setSlaSettingTime: baseProps.setSlaSettingTime,
      ordersStatusGroup: 'pending',
      selectedSubOrderStatus: { pending: [0] },
      handleSelectedSubOrderStatus: baseProps.handleSelectedSubOrderStatus,
      isLateralBar: true,
      isSelectedOrders: false,
      disableSocketRoomDriver: true,
      toolsSlot: true
    })
  })

  it('toolsSlot is off unless the page asks for it', () => {
    render(<OrdersContentHeader {...baseProps} />)
    expect(runtime.filterBarProps.toolsSlot).toBeFalsy()
  })

  it('renderBelowTitle puts the page’s own composition (tabs, notices) around the filter bar', () => {
    render(
      <OrdersContentHeader
        {...baseProps}
        renderBelowTitle={filterBar => (
          <section data-testid='below'>
            <div role='tablist' aria-label='tabs' />
            {filterBar}
          </section>
        )}
      />
    )
    const below = screen.getByTestId('below')
    expect(within(below).getByRole('tablist')).toBeInTheDocument()
    expect(within(below).getByTestId('filter-bar')).toBeInTheDocument()
  })
})

// redesign 5.6-B: below 768px of viewport the head is one row: menu, title, live status, then the page's own
// actions (the «+» and the «More actions» menu, which already hold Learn). Learn is not drawn twice.
describe('OrdersContentHeader · phone row (5.6-B)', () => {
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
  beforeEach(() => {
    runtime.collapse = false
    runtime.width = 390
    runtime.filterBarProps = null
    setViewport(true)
  })
  afterEach(() => { delete window.matchMedia })

  it('one row: menu button, title, live status, then the page actions with no Learn of its own', () => {
    runtime.collapse = true
    render(<OrdersContentHeader {...baseProps} headerActions={<button type='button'>Page actions</button>} />)
    const title = screen.getByRole('heading', { level: 1, name: 'Orders list' })
    const row = title.parentElement
    expect(row).toHaveAttribute('data-phone')
    expect([...row.children].map(node => node.getAttribute('aria-label') || node.textContent).filter(Boolean))
      .toEqual(['Open menu', 'Orders list', 'Live', 'Page actions'])
    expect(screen.queryByRole('button', { name: 'Learn' })).not.toBeInTheDocument()
  })

  it('the title carries its full text as title, since the row truncates it on narrow phones', () => {
    render(<OrdersContentHeader {...baseProps} headerActions={<button type='button'>Page actions</button>} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('title', 'Orders list')
  })

  it('a page without its own actions keeps Learn on phones (/deliveries, /messages, /all-in-one)', () => {
    render(<OrdersContentHeader {...baseProps} />)
    expect(screen.getByRole('button', { name: 'Learn' })).toBeInTheDocument()
  })

  it('the maps key button stays on phones', () => {
    render(<OrdersContentHeader {...baseProps} isShowMapsKeySettingButton headerActions={<button type='button'>Page actions</button>} />)
    expect(screen.getByRole('button', { name: 'Maps key' })).toBeInTheDocument()
  })

  it('from 768px up the head is exactly as before: Learn first, then the page actions, no phone mark', () => {
    setViewport(false)
    runtime.width = 1280
    render(<OrdersContentHeader {...baseProps} headerActions={<button type='button'>Page actions</button>} />)
    const title = screen.getByRole('heading', { level: 1 })
    expect(title.parentElement).not.toHaveAttribute('data-phone')
    // F6b (D-18): the title also truncates beside the order panel, so it carries its full text at any width
    expect(title).toHaveAttribute('title', 'Orders list')
    expect([...title.parentElement.querySelector('.odc-page-actions').children].map(node => node.textContent)).toEqual(['Learn', 'Page actions'])
  })

  it('without matchMedia it reads as a wide screen', () => {
    delete window.matchMedia
    render(<OrdersContentHeader {...baseProps} headerActions={<button type='button'>Page actions</button>} />)
    expect(screen.getByRole('button', { name: 'Learn' })).toBeInTheDocument()
  })

  describe('stylesheet', () => {
    const css = readFileSync(path.join(__dirname, '../content-header.css'), 'utf8')
    const phone = css

    it('the row does not wrap: the title takes what is left and truncates, the actions keep their size', () => {
      expect(phone).toMatch(/\.odc-page-head\[data-phone\]\s*{[^}]*flex-wrap:\s*nowrap/)
      expect(phone).toMatch(/\.odc-page-head\[data-phone\]\s+\.odc-page-title\s*{[^}]*flex:\s*1 1 0/)
      expect(phone).toMatch(/\.odc-page-head\[data-phone\]\s+\.odc-page-title\s*{[^}]*min-inline-size:\s*0/)
      expect(phone).toMatch(/\.odc-page-head\[data-phone\]\s+\.odc-page-title\s*{[^}]*text-overflow:\s*ellipsis/)
      expect(phone).toMatch(/\.odc-page-head\[data-phone\]\s+\.odc-page-actions\s*{[^}]*flex:\s*none/)
      expect(phone).toMatch(/\.odc-page-head\[data-phone\]\s+\.odc-page-spacer\s*{[^}]*display:\s*none/)
    })

    // AC-F L2 (locales audit § 2b): at 390px the h1 of /orders and /deliveries was cut with an ellipsis on one line in da, de, el, fr,
    // it, tr, nl («Tableau de bord des livraisons»). Like PageHeader's title (page-header.css), it wraps by words to two lines and
    // only then clamps. 2 lines of the section size on their title leading are 43.2px: inside the 44px of the actions, so the head
    // stays as tall and the buttons do not move. Wide heads keep the one-line title.
    it('on a phone the title wraps to two lines and only then is cut, without growing the head or moving the actions', () => {
      const title = css.match(/\.odc-page-head\[data-phone\]\s+\.odc-page-title\s*{([^}]*)}/)[1]
      expect(title).toMatch(/white-space:\s*normal/)
      expect(title).toMatch(/overflow-wrap:\s*anywhere/)
      expect(title).toMatch(/display:\s*-webkit-box/)
      expect(title).toMatch(/-webkit-box-orient:\s*vertical/)
      expect(title).toMatch(/-webkit-line-clamp:\s*2/)
      expect(title).toMatch(/(?:^|[\s;])line-clamp:\s*2/)
      expect(title).toMatch(/overflow:\s*hidden/)
      expect(title).toMatch(/flex:\s*1 1 0/)
      expect(title).toMatch(/min-inline-size:\s*0/)
      expect(title).toMatch(/font-size:\s*var\(--od-x-type-section-size\)/)
      expect(css).toMatch(/\.odc-page-head\s*{[^}]*align-items:\s*center/)
      // 2 × 18px × 1.2 = 43.2px < 44px (the actions' target on a phone)
      const brand = file => readFileSync(path.join(__dirname, ...Array(9).fill('..'), 'brand', file), 'utf8')
      expect(brand('candidates.css')).toMatch(/--od-x-type-section-size:\s*var\(--od-font-size-4\)/)
      const section = parseFloat(brand('ordering.tokens.generated.css').match(/--od-font-size-4:\s*([\d.]+)rem/)[1]) * 16
      const leading = parseFloat(brand('candidates.css').match(/--od-x-leading-title:\s*([\d.]+)/)[1])
      expect(section).toBe(18)
      expect(2 * section * leading).toBeLessThanOrEqual(44)
    })

    it('from 768px the title is still one line: the wrap is only inside the phone rule', () => {
      const wide = css.match(/\n\.odc-page-title\s*{([^}]*)}/)[1]
      expect(wide).toMatch(/white-space:\s*nowrap/)
      expect(wide).toMatch(/text-overflow:\s*ellipsis/)
      expect(wide).not.toMatch(/line-clamp|-webkit-box|white-space:\s*normal/)
    })

    it('on a very narrow row the live status keeps only its dot and its name, like Learn does', () => {
      const block = css.match(/@container\s*\(max-width:\s*319px\)\s*{([\s\S]*?)\n}/)
      expect(block).not.toBeNull()
      expect(block[1]).toMatch(/\.odc-live-btn\.odc-btn\s*{[^}]*font-size:\s*0/)
      expect(block[1]).not.toMatch(/display:\s*none|visibility:\s*hidden/)
    })

    it('the phone cluster is one row of 44px targets, with a gap and no wrap', () => {
      expect(css).toMatch(/\.odc-header-actions\[data-phone\]\s*{[^}]*flex-wrap:\s*nowrap/)
      expect(css).toMatch(/\.odc-header-actions\[data-phone\]\s*{[^}]*gap:\s*var\(--od-space-1\)/)
    })
  })
})

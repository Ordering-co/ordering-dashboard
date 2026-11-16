/* eslint-disable import/first */
// redesign business-payments F-C1 (; D1-D4, D6, D7, D9-D11): the store side of /intelligence/business-payments. It works
// against a FAKE controller with the shape of `specs/00-common.md` (the real one is batch A's): the store picker, the payment
// history, the invoices as a table and as cards, and the legacy reports. Nothing here fetches; the only network-shaped thing is
// the business list, which is a mocked `DashboardBusinessList` that counts its mounts.
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The state the mocks share (a mock factory is hoisted above the imports)
const state = vi.hoisted(() => ({ phone: false, mounts: 0, listProps: null, parseDateCalls: [], dictionary: {} }))

vi.mock('../../../../../../index', async () => {
  const ReactModule = await import('react')
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  // parseDate as the project's default paints a day: «31 Aug 2026» (DD MMM YYYY), whatever the API sent
  const parseDate = (value, options) => {
    state.parseDateCalls.push({ value, options })
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
    return match ? `${match[3]} ${MONTHS[Number(match[2]) - 1]} ${match[1]}` : 'invalid format'
  }
  const BUSINESSES = [
    { id: 5, name: 'Alpha Pizza', slug: 'alpha', logo: null, city: { name: 'Miami' }, external_id: 'ext-5' },
    { id: 6, name: 'Beta Burgers', slug: 'beta', logo: null, city: { name: 'Austin' }, external_id: null }
  ]
  return {
    useLanguage: () => [{ language: { code: 'en' }, dictionary: {} }, (key, text) => state.dictionary[key] ?? text],
    useSession: () => [{ user: { level: 0 } }],
    useConfig: () => [{ configs: {} }],
    useEvent: () => [{ emit: () => {} }],
    useUtils: () => [{
      parseDate,
      parsePrice: (value) => `$ ${Number(value).toFixed(2)}`,
      optimizeImage: (url) => url
    }],
    DashboardBusinessList: (props) => {
      ReactModule.useEffect(() => { state.mounts += 1 }, [])
      state.listProps = props
      const { UIComponent, ...rest } = props
      return ReactModule.createElement(UIComponent, {
        ...rest,
        businessList: { loading: false, error: null, businesses: BUSINESSES },
        pagination: { currentPage: 1, pageSize: 6, totalPages: 1, total: 2 },
        searchValue: null,
        onSearch: () => {},
        getPageBusinesses: () => {}
      })
    }
  }
})

// (`C/utils/businessPayments.js`, batch A's pure utilities, is used as it is: it exists in the worktree)
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => state.phone }))

import { StoreReports } from '../StoreReports'

const BUSINESS = { id: 5, name: 'Alpha Pizza', external_id: 'ext-5', logo: null, city: { name: 'Miami' } }

const invoice = (over = {}) => ({
  id: 859,
  period_start: '2026-08-31 05:00:00',
  period_end: '2026-09-07 05:00:00',
  paymethod: 'stripe',
  status: 'pending',
  order_total: '120.5',
  total_charges: '15',
  deposit_amount: '-34.25',
  ...over
})

const props = (over = {}) => ({
  view: 'business',
  plugin: { checked: true, installed: false },
  business: { selected: BUSINESS, select: vi.fn(), restoring: false },
  invoices: { loading: false, error: null, items: [invoice(), invoice({ id: 858, status: 'paid' })], retry: vi.fn() },
  history: { from: null, to: null, preset: null, setPreset: vi.fn(), setRange: vi.fn(), download: vi.fn(), loading: false, error: null },
  legacy: {
    available: false,
    tab: 'platform',
    setTab: vi.fn(),
    importing: false,
    importError: null,
    list: { loading: false, reports: [], error: null, pagination: null },
    page: 1,
    pageSize: 10,
    setPage: vi.fn(),
    setPageSize: vi.fn()
  },
  detail: { invoiceId: null, open: vi.fn(), close: vi.fn() },
  legacyDetail: { reportId: null, open: vi.fn(), close: vi.fn() },
  ...over
})

const legacyReport = (over = {}) => ({
  id: 31,
  start_date: '2026-07-01 00:00:00',
  end_date: '2026-07-07 00:00:00',
  num_orders: 12,
  order_total: '300',
  commission: '30',
  total_charges: '45',
  deposit_amount: '255',
  ...over
})

const legacyProps = (over = {}, listOver = {}) => props({
  plugin: { checked: true, installed: true },
  legacy: {
    available: true,
    tab: 'eatstreet',
    setTab: vi.fn(),
    importing: false,
    importError: null,
    list: { loading: false, reports: [legacyReport(), legacyReport({ id: 32 })], error: null, pagination: { total_pages: 1 }, ...listOver },
    page: 1,
    pageSize: 10,
    setPage: vi.fn(),
    setPageSize: vi.fn(),
    ...over
  }
})

let fetchSpy

beforeEach(() => {
  vi.clearAllMocks()
  state.phone = false
  state.mounts = 0
  state.listProps = null
  state.parseDateCalls.length = 0
  state.dictionary = {}
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
})
afterEach(() => {
  vi.unstubAllGlobals()
  document.getElementById('app-modals')?.remove()
})

const EXIT = { timeout: 4000 }
const headers = () => screen.getAllByRole('columnheader').map(header => header.textContent)

describe('StoreReports · no store (D9)', () => {
  it('says to select a business, asks nothing and does not mount the business list', () => {
    render(<StoreReports {...props({ business: { selected: null, select: vi.fn(), restoring: false }, invoices: { loading: false, error: null, items: [], retry: vi.fn() } })} />)
    expect(screen.getByText('Select a business to view invoices')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(state.mounts).toBe(0)
    // the pill says what to do, and the payment history does not exist without a store
    expect(screen.getByRole('button', { name: 'Business Select business' })).toBeInTheDocument()
    expect(screen.queryByText('Payment history')).toBeNull()
  })

  it('while the store of the URL is being restored it is not asked to pick one: the list is loading', () => {
    render(<StoreReports {...props({ business: { selected: null, select: vi.fn(), restoring: true } })} />)
    expect(screen.queryByText('Select a business to view invoices')).toBeNull()
    expect(screen.getByRole('table', { name: 'Payment invoices' })).toHaveAttribute('aria-busy', 'true')
  })
})

describe('StorePicker (D2, D10)', () => {
  it('does not mount DashboardBusinessList until the popover opens, with the props of BusinessSelectHeader', async () => {
    const user = userEvent.setup()
    render(<StoreReports {...props({ business: { selected: null, select: vi.fn(), restoring: false } })} />)
    expect(state.mounts).toBe(0)
    await user.click(screen.getByRole('button', { name: 'Business Select business' }))
    await screen.findByRole('dialog', { name: 'Business' })
    expect(state.mounts).toBe(1)
    const list = state.listProps
    expect(list.asDashboard).toBe(true)
    expect(list.loadMorePageSize).toBe(6)
    expect(list.paginationSettings).toEqual({ pageSize: 6 })
    expect(list.isSearchByBusinessName).toBe(true)
    expect(list.isSearchByBusinessEmail).toBe(true)
    expect(list.isSearchByBusinessPhone).toBe(true)
    expect(list.propsToFetch).toEqual(['name', 'slug', 'logo', 'city', 'external_id'])
  })

  it('lists the stores with their city, and choosing one hands business.select the whole object, external_id included', async () => {
    const user = userEvent.setup()
    const select = vi.fn()
    render(<StoreReports {...props({ business: { selected: null, select, restoring: false } })} />)
    await user.click(screen.getByRole('button', { name: 'Business Select business' }))
    const popup = await screen.findByRole('dialog', { name: 'Business' })
    const alpha = within(popup).getByRole('radio', { name: 'Alpha Pizza' })
    expect(alpha).toHaveAccessibleDescription('Miami')
    await user.click(alpha)
    expect(select).toHaveBeenCalledTimes(1)
    expect(select.mock.calls[0][0]).toMatchObject({ id: 5, name: 'Alpha Pizza', external_id: 'ext-5' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Business' })).toBeNull(), EXIT)
  })

  it('shows the store chosen, and no «Add new store» anywhere (D10)', async () => {
    const user = userEvent.setup()
    render(<StoreReports {...props()} />)
    expect(screen.getByRole('button', { name: 'Business Alpha Pizza' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Business Alpha Pizza' }))
    await screen.findByRole('dialog', { name: 'Business' })
    expect(screen.queryByText('Add new store')).toBeNull()
  })
})

describe('PaymentHistory (D6)', () => {
  it('has no download button without the two dates, and the pill asks to choose dates', () => {
    render(<StoreReports {...props()} />)
    const pill = screen.getByRole('button', { name: /Payment history/ })
    expect(pill).toHaveTextContent('Choose dates')
    expect(pill).toHaveAccessibleDescription('Download a consolidated PDF of payment invoices for the selected date range')
    expect(screen.queryByRole('button', { name: 'Download payment history' })).toBeNull()
  })

  it('a preset goes to history.setPreset', async () => {
    const user = userEvent.setup()
    const model = props()
    render(<StoreReports {...model} />)
    await user.click(screen.getByRole('button', { name: /Payment history/ }))
    const popup = await screen.findByRole('dialog', { name: 'Select a date' })
    expect(within(popup).getAllByRole('button', { pressed: false }).map(button => button.textContent)).toEqual(
      expect.arrayContaining(['This month', 'Last month', 'Last 3 months', 'This year'])
    )
    await user.click(within(popup).getByRole('button', { name: 'Last month' }))
    expect(model.history.setPreset).toHaveBeenCalledTimes(1)
    expect(model.history.setPreset).toHaveBeenCalledWith('last_month')
  })

  it('with both dates it says the range in the project format and the button calls history.download', async () => {
    const user = userEvent.setup()
    const model = props({ history: { ...props().history, from: '2026-08-01', to: '2026-08-31', preset: 'last_month' } })
    render(<StoreReports {...model} />)
    expect(screen.getByRole('button', { name: /Payment history/ })).toHaveTextContent('01 Aug 2026 – 31 Aug 2026')
    expect(screen.getByRole('button', { name: /Payment history/ }).textContent).not.toMatch(/2026-08/)
    // D11 (coordinator's correction): the range is read as local days, never converted as UTC
    const calls = state.parseDateCalls.filter(call => /^2026-08-(01|31) /.test(call.value))
    expect(calls.length).toBeGreaterThan(0)
    calls.forEach(call => expect(call.options).toMatchObject({ dateOnly: true, utc: false }))
    await user.click(screen.getByRole('button', { name: 'Download payment history' }))
    expect(model.history.download).toHaveBeenCalledTimes(1)
  })

  it('while it downloads the button says so and is busy', () => {
    render(<StoreReports {...props({ history: { ...props().history, from: '2026-08-01', to: '2026-08-31', loading: true } })} />)
    const button = screen.getByRole('button', { name: 'Downloading...' })
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('a failure is said in a danger notice, not in the table', () => {
    render(<StoreReports {...props({ history: { ...props().history, from: '2026-08-01', to: '2026-08-31', error: ['No invoices in that period'] } })} />)
    const notice = screen.getByText('No invoices in that period').closest('.odc-notice')
    expect(notice).toHaveAttribute('data-tone', 'danger')
  })

  // redesign a request that never reached the server rejects with the browser's text («Failed to fetch»); that is not for a person
  it.each(['Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed'])('a network failure («%s») says the fallback, not the browser text', (message) => {
    render(<StoreReports {...props({ history: { ...props().history, from: '2026-08-01', to: '2026-08-31', error: message } })} />)
    expect(screen.queryByText(message)).toBeNull()
    expect(screen.getByText("We couldn't download the payment history.").closest('.odc-notice')).toHaveAttribute('data-tone', 'danger')
  })

  it('does not exist in the legacy tab', () => {
    render(<StoreReports {...legacyProps()} />)
    expect(screen.queryByRole('button', { name: /Payment history/ })).toBeNull()
  })

  it('a day alone is a range of one day (so the download is never silently missing)', async () => {
    const user = userEvent.setup()
    const model = props()
    render(<StoreReports {...model} />)
    await user.click(screen.getByRole('button', { name: /Payment history/ }))
    const popup = await screen.findByRole('dialog', { name: 'Select a date' })
    const day = within(popup).getAllByRole('button').find(button => button.textContent === '15' && /15/.test(button.getAttribute('aria-label') || '15'))
    await user.click(day)
    await user.click(within(popup).getByRole('button', { name: 'Done' }))
    expect(model.history.setRange).toHaveBeenCalledTimes(1)
    const range = model.history.setRange.mock.calls[0][0]
    expect(range.from).toBeTruthy()
    expect(range.to).toBe(range.from)
  })
})

describe('InvoicesTable (D3, D4, D9, D11)', () => {
  it('has the columns in order, «Orders total» in the header, and #859 first when it comes first', () => {
    render(<StoreReports {...props()} />)
    expect(headers()).toEqual(['ID', 'Period', 'Method', 'Status', 'Orders total', 'Total charges', 'Transfer amount'])
    expect(screen.queryByText('Prepaid total')).toBeNull()
    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('#859')).toBeInTheDocument()
    expect(within(rows[1]).getByText('#858')).toBeInTheDocument()
  })

  it('paints the method in capitals, the status with its family and the amounts as figures', () => {
    render(<StoreReports {...props()} />)
    const first = screen.getAllByRole('row')[1]
    expect(within(first).getByText('STRIPE')).toBeInTheDocument()
    const status = within(first).getByText('Pending').closest('.odc-status')
    expect(status).toHaveAttribute('data-family', 'pending')
    expect(within(screen.getAllByRole('row')[2]).getByText('Paid').closest('.odc-status')).toHaveAttribute('data-family', 'done')
    const amount = within(first).getByText('$ 120.50')
    expect(amount).toHaveClass('odc-figure')
    expect(within(first).getByText('-$ 34.25')).toHaveClass('odc-figure')
    // the amount to transfer is the one in bold
    expect(within(first).getByText('-$ 34.25').closest('td')).toHaveClass('odc-bp-transfer')
  })

  it('a missing amount is 0 as main, an unknown status keeps its text, no status is a dash', () => {
    render(<StoreReports {...props({ invoices: { loading: false, error: null, retry: vi.fn(), items: [invoice({ id: 1, order_total: null, status: 'on_hold' }), invoice({ id: 2, status: null, paymethod: null })] } })} />)
    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('$ 0.00')).toBeInTheDocument()
    expect(within(rows[0]).getByText('on_hold').closest('.odc-status')).toHaveAttribute('data-family', 'review')
    expect(within(rows[1]).queryByText('Pending')).toBeNull()
    expect(rows[1].querySelectorAll('.odc-status')).toHaveLength(0)
    expect(within(rows[1]).getAllByText('—').length).toBeGreaterThanOrEqual(2)
  })

  it('Enter on a row and a click open the invoice with detail.open(id)', async () => {
    const user = userEvent.setup()
    const model = props()
    render(<StoreReports {...model} />)
    const row = screen.getAllByRole('row')[1]
    row.focus()
    await user.keyboard('{Enter}')
    expect(model.detail.open).toHaveBeenCalledTimes(1)
    expect(model.detail.open).toHaveBeenCalledWith(859)
    await user.click(screen.getAllByRole('row')[2])
    expect(model.detail.open).toHaveBeenLastCalledWith(858)
  })

  it('the open invoice is the current row, even when the URL gave its id as text', () => {
    render(<StoreReports {...props({ detail: { invoiceId: '858', open: vi.fn(), close: vi.fn() } })} />)
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[0]).not.toHaveAttribute('aria-current')
    expect(rows[1]).toHaveAttribute('aria-current', 'true')
  })

  // D3 and review r1 H1: with the panel beside the list, Method, Status and Orders total give their place (in `main` the panel covered
  // them); by width alone only Method and Status do, so the five columns of `main` stay whenever the panel is closed
  it('with the panel open, Method, Status and Orders total give their place; ID, Period and Transfer amount stay', () => {
    render(<StoreReports {...props({ detail: { invoiceId: 859, open: vi.fn(), close: vi.fn() } })} />)
    expect(headers()).toEqual(['ID', 'Period', 'Total charges', 'Transfer amount'])
  })

  it('by width alone, Orders total never steps aside (only Method and Status have a threshold)', () => {
    render(<StoreReports {...props()} />)
    const table = screen.getByRole('table', { name: 'Payment invoices' })
    expect(table).toBeInTheDocument()
    expect(headers()).toContain('Orders total')
  })

  it('an error says so and «Try again» calls invoices.retry (BP-07)', async () => {
    const user = userEvent.setup()
    const model = props({ invoices: { loading: false, error: ['Server error'], items: [], retry: vi.fn() } })
    render(<StoreReports {...model} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Server error')
    expect(screen.queryByRole('table')).toBeNull()
    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(model.invoices.retry).toHaveBeenCalledTimes(1)
  })

  // redesign the project dictionary has TOTAL_CHARGES and TRANSFER_AMOUNT in title case; the table has keys of its own, in sentence case
  it('the amount headers are sentence case even when the shared keys say «Total Charges» and «Transfer Amount»', () => {
    state.dictionary = { TOTAL_CHARGES: 'Total Charges', TRANSFER_AMOUNT: 'Transfer Amount' }
    render(<StoreReports {...props()} />)
    expect(headers()).toEqual(['ID', 'Period', 'Method', 'Status', 'Orders total', 'Total charges', 'Transfer amount'])
  })

  it('the cards of a phone say the same sentence case', () => {
    state.phone = true
    state.dictionary = { TOTAL_CHARGES: 'Total Charges', TRANSFER_AMOUNT: 'Transfer Amount' }
    render(<StoreReports {...props()} />)
    expect(screen.queryByText('Total Charges')).toBeNull()
    expect(screen.queryByText('Transfer Amount')).toBeNull()
    expect(screen.getAllByText('Total charges').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Transfer amount').length).toBeGreaterThan(0)
  })

  // redesign «Try again» removes the button that had the focus; the focus must not fall to <body>
  it('after «Try again» the focus goes to the invoices when they arrive, and not before', async () => {
    const user = userEvent.setup()
    const model = props({ invoices: { loading: false, error: ['Server error'], items: [], retry: vi.fn() } })
    const view = render(<StoreReports {...model} />)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    view.rerender(<StoreReports {...props({ invoices: { loading: true, error: null, items: [], retry: model.invoices.retry } })} />)
    expect(document.activeElement).toBe(document.body)
    view.rerender(<StoreReports {...props()} />)
    expect(screen.getByRole('group', { name: 'Payment invoices' })).toHaveFocus()
  })

  it('after «Try again» that fails again the focus goes to the invoices too, not to <body>', async () => {
    const user = userEvent.setup()
    const retry = vi.fn()
    const view = render(<StoreReports {...props({ invoices: { loading: false, error: ['Server error'], items: [], retry } })} />)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    view.rerender(<StoreReports {...props({ invoices: { loading: true, error: null, items: [], retry } })} />)
    view.rerender(<StoreReports {...props({ invoices: { loading: false, error: ['Server error'], items: [], retry } })} />)
    expect(screen.getByRole('group', { name: 'Payment invoices' })).toHaveFocus()
  })

  it('a list that loads by itself never takes the focus', () => {
    const view = render(<StoreReports {...props({ invoices: { loading: true, error: null, items: [], retry: vi.fn() } })} />)
    view.rerender(<StoreReports {...props()} />)
    expect(document.activeElement).toBe(document.body)
  })

  it('loading draws skeleton rows with the final columns, and an empty list says «No invoices found»', () => {
    const { rerender } = render(<StoreReports {...props({ invoices: { loading: true, error: null, items: [], retry: vi.fn() } })} />)
    expect(screen.getByRole('table', { name: 'Payment invoices' })).toHaveAttribute('aria-busy', 'true')
    expect(headers()).toHaveLength(7)
    rerender(<StoreReports {...props({ invoices: { loading: false, error: null, items: [], retry: vi.fn() } })} />)
    expect(screen.getByText('No invoices found')).toBeInTheDocument()
  })

  it('reads the dates with parseDate and the day only, never with the engine (D11)', () => {
    render(<StoreReports {...props({ invoices: { loading: false, error: null, retry: vi.fn(), items: [invoice({ period_start: '2026-08-31 05:00:00', period_end: '2026-09-07 05:00:00' })] } })} />)
    const row = screen.getAllByRole('row')[1]
    expect(within(row).getByText('31 Aug 2026 – 07 Sep 2026')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/08\/31\/2026|2026-08-31/)
    const calls = state.parseDateCalls.filter(call => call.value === '2026-08-31 05:00:00')
    expect(calls.length).toBeGreaterThan(0)
    // the API's day is painted as it comes: no conversion to the browser's zone
    calls.forEach(call => expect(call.options).toEqual({ dateOnly: true, utc: false }))
  })
})

describe('InvoiceCardList (D7)', () => {
  it('under 768 px every invoice is a card (a button) with ID, status, period, method and the three figures', async () => {
    state.phone = true
    const user = userEvent.setup()
    const model = props()
    render(<StoreReports {...model} />)
    expect(screen.queryByRole('table')).toBeNull()
    const list = screen.getByRole('list', { name: 'Payment invoices' })
    const cards = within(list).getAllByRole('button')
    expect(cards).toHaveLength(2)
    const first = cards[0]
    expect(first).toHaveAttribute('type', 'button')
    expect(first).toHaveAccessibleName('Invoice #859, 31 Aug 2026 – 07 Sep 2026')
    expect(within(first).getByText('#859')).toBeInTheDocument()
    expect(within(first).getByText('Pending')).toBeInTheDocument()
    expect(within(first).getByText('STRIPE')).toBeInTheDocument()
    expect(within(first).getByText('Orders total')).toBeInTheDocument()
    expect(within(first).getByText('Total charges')).toBeInTheDocument()
    expect(within(first).getByText('Transfer amount')).toBeInTheDocument()
    expect(within(first).getByText('$ 120.50')).toHaveClass('odc-figure')
    expect(within(first).getByText('$ 15.00')).toHaveClass('odc-figure')
    expect(within(first).getByText('-$ 34.25')).toHaveClass('odc-figure')
    await user.click(first)
    expect(model.detail.open).toHaveBeenCalledWith(859)
  })

  it('marks the open one with aria-current, and loads with skeletons the card is made of', () => {
    state.phone = true
    const { rerender } = render(<StoreReports {...props({ detail: { invoiceId: '858', open: vi.fn(), close: vi.fn() } })} />)
    const cards = within(screen.getByRole('list', { name: 'Payment invoices' })).getAllByRole('button')
    expect(cards[0]).not.toHaveAttribute('aria-current')
    expect(cards[1]).toHaveAttribute('aria-current', 'true')
    rerender(<StoreReports {...props({ invoices: { loading: true, error: null, items: [], retry: vi.fn() } })} />)
    const busy = screen.getByRole('list', { name: 'Payment invoices' })
    expect(busy).toHaveAttribute('aria-busy', 'true')
    expect(busy.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    expect(within(busy).queryAllByRole('button')).toHaveLength(0)
  })

  it('keeps the states that are not rows on a phone too', async () => {
    state.phone = true
    const user = userEvent.setup()
    const model = props({ invoices: { loading: false, error: ['Server error'], items: [], retry: vi.fn() } })
    const { rerender } = render(<StoreReports {...model} />)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(model.invoices.retry).toHaveBeenCalledTimes(1)
    rerender(<StoreReports {...props({ invoices: { loading: false, error: null, items: [], retry: vi.fn() } })} />)
    expect(screen.getByText('No invoices found')).toBeInTheDocument()
  })
})

describe('Tabs and LegacyReportsTable', () => {
  it('without the plugin or the external id there are no tabs', () => {
    render(<StoreReports {...props()} />)
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('with legacy reports there are two tabs and the second asks for the legacy side', async () => {
    const user = userEvent.setup()
    const model = legacyProps({ tab: 'platform' })
    model.invoices = props().invoices
    render(<StoreReports {...model} />)
    const tabs = screen.getByRole('tablist', { name: 'Report source' })
    expect(within(tabs).getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Reports', 'Legacy Reports'])
    expect(within(tabs).getByRole('tab', { name: 'Reports' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('table', { name: 'Payment invoices' })).toBeInTheDocument()
    await user.click(within(tabs).getByRole('tab', { name: 'Legacy Reports' }))
    expect(model.legacy.setTab).toHaveBeenCalledWith('eatstreet')
  })

  it('while syncing it says «Syncing reports...» and draws no rows', () => {
    const { rerender } = render(<StoreReports {...legacyProps({ importing: true })} />)
    expect(screen.getByText('Syncing reports...')).toBeInTheDocument()
    rerender(<StoreReports {...legacyProps({}, { loading: true })} />)
    expect(screen.getByText('Syncing reports...')).toBeInTheDocument()
    expect(screen.queryByText('#31')).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })

  it('keeps the columns of main with their keys, in figures, and opens a report with legacyDetail.open(id)', async () => {
    const user = userEvent.setup()
    const model = legacyProps()
    render(<StoreReports {...model} />)
    expect(headers()).toEqual(['Period', 'Orders', 'Prepaid total', 'Commission', 'Total charges', 'Deposit amount'])
    const row = screen.getAllByRole('row')[1]
    expect(within(row).getByText('01 Jul 2026 – 07 Jul 2026')).toBeInTheDocument()
    expect(within(row).getByText('12')).toHaveClass('odc-figure')
    expect(within(row).getByText('$ 300.00')).toHaveClass('odc-figure')
    expect(within(row).getByText('$ 255.00')).toHaveClass('odc-figure')
    expect(document.body.textContent).not.toMatch(/07\/01\/2026/)
    // D11 (coordinator's correction): the day of the API is painted as it comes, parseDate is told not to read it as UTC
    const calls = state.parseDateCalls.filter(call => call.value === '2026-07-01 00:00:00')
    expect(calls.length).toBeGreaterThan(0)
    calls.forEach(call => expect(call.options).toEqual({ dateOnly: true, utc: false }))
    await user.click(row)
    expect(model.legacyDetail.open).toHaveBeenCalledWith(31)
    row.focus()
    await user.keyboard('{Enter}')
    expect(model.legacyDetail.open).toHaveBeenCalledTimes(2)
  })

  it('the open report is the current row', () => {
    const model = legacyProps()
    model.legacyDetail = { reportId: '32', open: vi.fn(), close: vi.fn() }
    render(<StoreReports {...model} />)
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[0]).not.toHaveAttribute('aria-current')
    expect(rows[1]).toHaveAttribute('aria-current', 'true')
  })

  it('pages only when there is more than one page, with the sizes of main', async () => {
    const user = userEvent.setup()
    const one = render(<StoreReports {...legacyProps({}, { pagination: { total_pages: 1 } })} />)
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
    one.unmount()
    const model = legacyProps({}, { pagination: { total_pages: 3 } })
    render(<StoreReports {...model} />)
    const pager = screen.getByRole('navigation', { name: 'Pagination' })
    await user.click(within(pager).getByRole('button', { name: 'Next page' }))
    expect(model.legacy.setPage).toHaveBeenCalledWith(2)
    await user.click(within(pager).getByRole('button', { name: 'Items per page 10' }))
    expect(within(await screen.findByRole('menu')).getAllByRole('menuitemradio').map(item => item.textContent)).toEqual(['10', '25', '50'])
    await user.click(screen.getByRole('menuitemradio', { name: '25' }))
    expect(model.legacy.setPageSize).toHaveBeenCalledWith(25)
  })

  // R5: main's legacy table jumped straight to a page, with or without the total of the API
  it.each([
    ['without the total', { total_pages: 4 }],
    ['with the total', { total_pages: 4, total: 37 }]
  ])('has a page field %s, and the range never shows an invented total', async (_name, pagination) => {
    const user = userEvent.setup()
    const model = legacyProps({}, { pagination })
    render(<StoreReports {...model} />)
    const pager = screen.getByRole('navigation', { name: 'Pagination' })
    const field = within(pager).getByRole('textbox', { name: 'Page' })
    expect(pager).toHaveTextContent('of 4')
    if (pagination.total == null) expect(pager).not.toHaveTextContent(/Showing/)
    else expect(pager).toHaveTextContent('of 37')
    await user.clear(field)
    await user.type(field, '4{Enter}')
    expect(model.legacy.setPage).toHaveBeenCalledWith(4)
  })

  it('an import or list failure is said, translated; otherwise «No reports found»', () => {
    const { rerender } = render(<StoreReports {...legacyProps({ importError: ['Import failed'] }, { reports: [] })} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Import failed')
    rerender(<StoreReports {...legacyProps({}, { reports: [], error: 'List failed' })} />)
    expect(screen.getByRole('alert')).toHaveTextContent('List failed')
    rerender(<StoreReports {...legacyProps({}, { reports: [] })} />)
    expect(screen.getByText('No reports found')).toBeInTheDocument()
  })

  it('on a phone the legacy table keeps all its columns and scrolls (D7 only changes the invoices)', () => {
    state.phone = true
    render(<StoreReports {...legacyProps()} />)
    expect(headers()).toHaveLength(6)
  })
})

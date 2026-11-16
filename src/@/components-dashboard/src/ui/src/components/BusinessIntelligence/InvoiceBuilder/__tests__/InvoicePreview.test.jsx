/* eslint-disable import/first */
// redesign invoice FC2 (D3, D4, D6, D9, D13; IV-01, IV-05; auditor 2, 9, 12): the preview of the invoice. It is a component of its own that reads
// the SAME `invoice` that the hidden PDF reads (D3). What is under test: the rows of the totals are the rows of the PDF of the kind, in the same
// order and under the same conditions, with the same amounts (auditor 2); and the states of the card (empty, first load, updating, error,
// truncated), the list of orders (search by number, 10 per page, «The PDF lists all N») and the sheet of the preview.
import React from 'react'
import moment from 'moment'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scanSource } from '../../../../../../../../../../scripts/product-ui/literal-guard.mjs'

const runtime = vi.hoisted(() => ({ dictionary: {}, parseDate: null, remountRoute: null }))

// redesign invoice R2 (M1, P1): the hook of ⌘K and the page are mounted in the tests at the end of this file, with the contexts they read stood in
vi.mock('../../../../contexts/CommandPaletteContext', () => ({
  useCommandPalette: () => ({ setOpen: () => {}, remountRoute: (...args) => runtime.remountRoute(...args), discardReturnFocus: () => {} })
}))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: () => {} }]
}))
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1440 }) }))
vi.mock('../../../Shared/LearnDropDown', () => ({ LearnDropDown: () => null }))
vi.mock('../../../../../../components/InvoiceBuilder', () => ({ InvoiceBuilder: () => null }))
vi.mock('../InvoiceKindView', () => ({ InvoiceKindView: () => null }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: runtime.dictionary, language: { code: 'en' } }, (_key, text) => text],
  useUtils: () => [{
    parsePrice: value => `$${Number(value).toFixed(2)}`,
    parseNumber: value => String(value),
    parseDate: (date, options = {}) => {
      runtime.parseDate?.(date, options)
      const instant = (options.utc ?? true) ? moment.utc(date, options.inputFormat || ['YYYY-MM-DD HH:mm:ss']).local() : moment(date, options.inputFormat || ['YYYY-MM-DD HH:mm:ss'])
      return instant.format('D MMM YYYY')
    }
  }]
}))

import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'
import { InvoiceBusinessPdf } from '../../InvoiceBusinessPdf'
import { InvoiceDriverPdf } from '../../InvoiceDriverPdf'
import { InvoicePreview } from '../InvoicePreview'
import { escapeNotes } from '../../../../../../utils/invoiceMath'
import { InvoiceManager } from '../index'
import { PartyPicker } from '../../AnalyticsKit/PartyPicker'
import { LIVE_QUERY_PATHS, useDashboardNavigation } from '../../../../hooks/useDashboardNavigation'

const orderRows = (count) => Array.from({ length: count }, (_, index) => ({
  id: 1000 + index,
  status: 11,
  delivery_datetime: '2026-09-03 12:00:00',
  sub: 10 + index,
  tot: 12 + index
}))
const getSubtotal = order => order.sub
const getTotal = order => order.tot

const sum = (orders, key) => orders.reduce((total, order) => total + order[key], 0)

const businessInvoice = (extra = {}, orders = orderRows(2)) => ({
  from: '2026-09-01',
  to: '2026-09-30',
  type: 'charge',
  orders,
  percentage_fee: 10,
  fixed_fee: 1,
  tax: 5,
  misc_amount: 0,
  misc_description: '',
  inlcude_discounts: false,
  tax_products: 0,
  discounts: 0,
  orders_subtotal: sum(orders, 'sub'),
  orders_total: sum(orders, 'tot'),
  notes: '',
  percentage_fee_total: 2.3,
  fixed_fee_total: 2,
  subtotal: 4.3,
  tax_total: 0.22,
  total: 4.52,
  business: { id: 7, name: 'Pizza Place' },
  ...extra
})

const driverInvoice = (extra = {}, orders = orderRows(3)) => ({
  from: '2026-09-01',
  to: '2026-09-30',
  orders,
  percentage_fee: 5,
  fixed_fee: 2,
  tax: 8,
  misc_amount: 3,
  misc_description: 'Bonus',
  orders_subtotal: sum(orders, 'sub'),
  orders_total: sum(orders, 'tot'),
  discounts: 1.5,
  percentage_delivery_price: 20,
  percentage_delivery_price_total: 4,
  percentage_driver_tip: 50,
  percentage_driver_tip_total: 6,
  notes: '',
  percentage_fee_total: 1.8,
  fixed_fee_total: 6,
  subtotal: 21.3,
  tax_total: 1.7,
  total: 23,
  driver: { id: 9, name: 'Dana Driver' },
  ...extra
})

const baseProps = (kind = 'business', extra = {}) => ({
  kind,
  form: { from: '2026-09-01', to: '2026-09-30', type: 'charge' },
  party: { kind, selected: kind === 'business' ? { id: 7, name: 'Pizza Place' } : { id: 9, name: 'Dana Driver' } },
  orders: { status: 'ready', error: null, retry: vi.fn(), raw: [], truncated: null, blocked: null },
  invoice: kind === 'business' ? businessInvoice() : driverInvoice(),
  updating: false,
  getSubtotal,
  getTotal,
  download: { onClick: vi.fn(), disabled: false, busy: false },
  ...extra
})

const renderPreview = (props) => render(
  <ConfigFileContext.Provider value={[{ app_internal_name: 'app' }, vi.fn()]}>
    <InvoicePreview {...props} />
  </ConfigFileContext.Provider>
)

const normalize = text => text.replace(/\s+/g, ' ').trim()

// a text with figures in it is split in nodes: the deepest element whose whole text is this one
const byText = (text) => screen.getByText((_content, node) => node.textContent === text && ![...node.children].some(child => child.textContent === text))

/** The rows of the «Totals» table of the PDF: [label, amount], the body and then the foot. */
const pdfTotals = (container) => {
  const table = container.querySelectorAll('table')[1]
  return [...table.querySelectorAll('tbody tr'), ...table.querySelectorAll('tfoot tr')].map(row => {
    const cells = row.querySelectorAll('td')
    return [normalize(cells[0].textContent), normalize(cells[cells.length - 1].textContent)]
  })
}

/** The same rows of the preview, from its markup. */
const previewTotals = (container) => [...container.querySelectorAll('[data-totals] [data-row]')].map(row => [
  normalize(row.querySelector('[data-label]').textContent),
  normalize(row.querySelector('.odc-figure[data-amount]').textContent)
])

beforeEach(() => {
  runtime.dictionary = {}
  runtime.parseDate = null
  runtime.remountRoute = vi.fn()
})

describe('InvoicePreview: the rows are the rows of the PDF (D3, auditor 2)', () => {
  const cases = [
    ['business, charge', 'business', businessInvoice(), InvoiceBusinessPdf],
    ['business, payout with discounts, products tax and misc', 'business', businessInvoice({
      type: 'payout', inlcude_discounts: true, discounts: 3.5, tax_products: 1.25, misc_amount: -2, misc_description: 'Fee'
    }), InvoiceBusinessPdf],
    ['business, charge with misc and a fee of 0%', 'business', businessInvoice({ misc_amount: 4, misc_description: '', percentage_fee: 0 }), InvoiceBusinessPdf],
    ['driver', 'driver', driverInvoice(), InvoiceDriverPdf],
    ['driver with 0 misc', 'driver', driverInvoice({ misc_amount: 0, misc_description: '' }), InvoiceDriverPdf]
  ]

  it.each(cases)('%s: same labels, same order and same amounts as the PDF', (_name, kind, invoice, Pdf) => {
    const { container } = renderPreview(baseProps(kind, { invoice }))
    const pdf = render(
      <ConfigFileContext.Provider value={[{ app_internal_name: 'app' }, vi.fn()]}>
        <Pdf exportInvoiceList={{ invoice }} getSubtotal={getSubtotal} getTotal={getTotal} logoSrc={null} />
      </ConfigFileContext.Provider>
    )
    const expected = pdfTotals(pdf.container)
    expect(expected.length).toBeGreaterThanOrEqual(5)
    expect(previewTotals(container)).toEqual(expected)
  })

  // the driver card says, like its PDF, that «Orders (Subtotal)» and «Discount» are not added to the subtotal
  it('driver: «Orders (Subtotal)» and «Discount» are marked as for reference', () => {
    const { container } = renderPreview(baseProps('driver', { invoice: driverInvoice() }))
    const labels = previewTotals(container).map(([label]) => label)
    expect(labels.slice(0, 2)).toEqual(['Orders (Subtotal) (for reference, not added)', 'Discount (for reference, not added)'])
    expect(labels.filter(label => /not added/.test(label))).toHaveLength(2)
  })

  it.each(cases)('%s: the count, the subtotal, the tax and the total of the PDF are the ones of the preview', (_name, kind, invoice, Pdf) => {
    const { container } = renderPreview(baseProps(kind, { invoice }))
    const pdf = render(
      <ConfigFileContext.Provider value={[{ app_internal_name: 'app' }, vi.fn()]}>
        <Pdf exportInvoiceList={{ invoice }} getSubtotal={getSubtotal} getTotal={getTotal} logoSrc={null} />
      </ConfigFileContext.Provider>
    )
    const pdfCount = pdf.container.textContent.match(/Amount to orders: (\d+)/)[1]
    const pdfFoot = [...pdf.container.querySelectorAll('table')[1].querySelectorAll('tfoot tr')].map(row => normalize(row.querySelectorAll('td')[1].textContent))
    const pdfOrders = [...pdf.container.querySelectorAll('table')[0].querySelectorAll('tfoot tr')].map(row => normalize(row.querySelectorAll('td')[1].textContent))

    expect(within(container.querySelector('[data-metric="orders"]')).getByText(pdfCount)).toBeTruthy()
    const amount = key => normalize(container.querySelector(`[data-row="${key}"] .odc-figure[data-amount]`).textContent)
    expect([amount('subtotal'), amount('tax'), amount('total')]).toEqual(pdfFoot)
    // «Orders total» of the header is the total of the orders table of the PDF
    expect(normalize(container.querySelector('[data-metric="orders-total"] .odc-figure').textContent)).toBe(pdfOrders[1])
    // «Total due» is the Total of the PDF
    expect(normalize(container.querySelector('[data-metric="total-due"] .odc-figure').textContent)).toBe(pdfFoot[2])
  })

  it('the PDF lists the same orders: one row per order, with the number, the status and the amounts', () => {
    const invoice = businessInvoice({}, orderRows(3))
    renderPreview(baseProps('business', { invoice }))
    const table = screen.getByRole('table', { name: 'Orders in the invoice' })
    expect(within(table).getAllByRole('row')).toHaveLength(4) // header + 3
    const first = within(table).getAllByRole('row')[1]
    expect(first.textContent).toContain('1000')
    expect(first.textContent).toContain('3 Sep 2026')
    expect(first.textContent).toContain('Delivery completed by driver')
    expect(first.textContent).toContain('$10.00')
    expect(first.textContent).toContain('$12.00')
  })

  it('writes the status with the dictionary of the project, as the PDF of the business does', () => {
    runtime.dictionary = { APP_DELIVERY_COMPLETED_BY_DRIVER: 'Entregado' }
    renderPreview(baseProps('business'))
    expect(screen.getAllByText('Entregado').length).toBeGreaterThan(0)
  })
})

describe('InvoicePreview: the header (D4, D10)', () => {
  it('names the business, the kind and the period with the date of the project', () => {
    renderPreview(baseProps('business'))
    expect(screen.getByRole('heading', { name: 'Pizza Place' })).toBeTruthy()
    expect(screen.getByText(/Business invoice/)).toBeTruthy()
    expect(screen.getByText(/Charge/)).toBeTruthy()
    expect(screen.getByText('1 Sep 2026 – 30 Sep 2026')).toBeTruthy()
    expect(screen.queryByText(/2026-09-01/)).toBeNull()
  })

  it('reads the days of the period as dates of the day, not as instants (utc false, dateOnly, YYYY-MM-DD)', () => {
    const calls = []
    runtime.parseDate = (date, options) => calls.push([date, options])
    renderPreview(baseProps('business'))
    expect(calls).toContainEqual(['2026-09-01', { utc: false, dateOnly: true, inputFormat: 'YYYY-MM-DD' }])
    expect(calls).toContainEqual(['2026-09-30', { utc: false, dateOnly: true, inputFormat: 'YYYY-MM-DD' }])
  })

  it('says «All dates» with no period, and the kind of a payout', () => {
    renderPreview(baseProps('business', { form: { from: '', to: '', type: 'payout' }, invoice: businessInvoice({ type: 'payout', from: '', to: '' }) }))
    expect(screen.getByText('All dates')).toBeTruthy()
    expect(screen.getByText(/Payout/)).toBeTruthy()
  })

  it('paints the three figures of the header', () => {
    const { container } = renderPreview(baseProps('business'))
    expect(within(container.querySelector('[data-metric="orders"]')).getByText('Orders')).toBeTruthy()
    expect(normalize(container.querySelector('[data-metric="orders"] .odc-figure').textContent)).toBe('2')
    expect(normalize(container.querySelector('[data-metric="orders-total"] .odc-figure').textContent)).toBe('$25.00')
    expect(within(container.querySelector('[data-metric="total-due"]')).getByText('Total due')).toBeTruthy()
    expect(normalize(container.querySelector('[data-metric="total-due"] .odc-figure').textContent)).toBe('$4.52')
  })

  it('puts every amount in an isolated figure node (decision 11)', () => {
    const { container } = renderPreview(baseProps('business'))
    container.querySelectorAll('.odc-figure').forEach(node => {
      expect(node.querySelector('bdi') || node.tagName === 'BDI').toBeTruthy()
    })
    expect(container.querySelectorAll('[data-row] .odc-figure[data-amount]').length).toBeGreaterThanOrEqual(5)
  })

  it('the total is in a polite live region', () => {
    const { container } = renderPreview(baseProps('business'))
    const live = container.querySelector('[aria-live="polite"]')
    expect(live).toBeTruthy()
    expect(live.textContent).toBe('$4.52')
  })

  it('explains the minus of a payout, and only in a payout', () => {
    const payout = renderPreview(baseProps('business', { invoice: businessInvoice({ type: 'payout' }) }))
    expect(screen.getByText('In a payout, fees are subtracted from what the business is paid')).toBeTruthy()
    payout.unmount()
    renderPreview(baseProps('business'))
    expect(screen.queryByText('In a payout, fees are subtracted from what the business is paid')).toBeNull()
  })

  it('has a Download PDF button with its accessible name, that follows the state it is given', async () => {
    const props = baseProps('business')
    renderPreview(props)
    const button = screen.getByRole('button', { name: 'Download PDF' })
    expect(button.disabled).toBe(false)
    await userEvent.click(button)
    expect(props.download.onClick).toHaveBeenCalledTimes(1)
  })

  it('disables it while the state says so', () => {
    renderPreview(baseProps('business', { download: { onClick: vi.fn(), disabled: true, busy: false } }))
    expect(screen.getByRole('button', { name: 'Download PDF' }).disabled).toBe(true)
  })

  it('draws no button when the page puts it in the dock (phone)', () => {
    renderPreview(baseProps('business', { download: null }))
    expect(screen.queryByRole('button', { name: 'Download PDF' })).toBeNull()
  })
})

describe('InvoicePreview: states (D6, D13; auditor 4, 12)', () => {
  it('without a business, says what is missing', () => {
    renderPreview(baseProps('business', { party: { kind: 'business', selected: null }, invoice: null, orders: { status: 'idle', blocked: 'no_party', retry: vi.fn(), truncated: null } }))
    expect(screen.getByText('Choose a business to see its invoice')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Download PDF' })).toBeNull()
  })

  it('without a driver, says what is missing', () => {
    renderPreview(baseProps('driver', { party: { kind: 'driver', selected: null }, invoice: null, orders: { status: 'idle', blocked: 'no_party', retry: vi.fn(), truncated: null } }))
    expect(screen.getByText('Choose a driver to see their invoice')).toBeTruthy()
  })

  it('on the first load it paints a skeleton with a hidden label, and no amount', () => {
    const { container } = renderPreview(baseProps('business', { invoice: null, orders: { status: 'loading', error: null, retry: vi.fn(), raw: [], truncated: null, blocked: null } }))
    expect(screen.getByText('Loading the invoice')).toBeTruthy()
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(container.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    expect(container.querySelector('[data-row]')).toBeNull()
  })

  it('while the setup is blocked it is a skeleton too', () => {
    const { container } = renderPreview(baseProps('business', { orders: { status: 'idle', error: null, retry: vi.fn(), raw: [], truncated: null, blocked: 'setup' } }))
    expect(container.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    expect(container.querySelector('[data-row]')).toBeNull()
  })

  it('while it updates it says so and keeps the previous figures, marked busy', () => {
    const { container } = renderPreview(baseProps('business', { updating: true }))
    expect(screen.getByText('Updating…')).toBeTruthy()
    const busy = container.querySelector('[data-figures][aria-busy="true"]')
    expect(busy).toBeTruthy()
    expect(within(busy).getByText('$4.52')).toBeTruthy()
  })

  it('says nothing is updating when it is not', () => {
    const { container } = renderPreview(baseProps('business'))
    expect(screen.queryByText('Updating…')).toBeNull()
    expect(container.querySelector('[data-figures][aria-busy="true"]')).toBeNull()
  })

  it('on an error it says so with «Try again», that retries, and keeps the last invoice', async () => {
    const props = baseProps('business', { orders: { status: 'error', error: 'boom', retry: vi.fn(), raw: [], truncated: null, blocked: null } })
    renderPreview(props)
    expect(screen.getByText('The orders could not be read.')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(props.orders.retry).toHaveBeenCalledTimes(1)
    expect(screen.getAllByText('$4.52').length).toBeGreaterThan(0)
  })

  it('an error with no invoice yet paints the notice and no figures', () => {
    const { container } = renderPreview(baseProps('business', { invoice: null, orders: { status: 'error', error: 'boom', retry: vi.fn(), raw: [], truncated: null, blocked: null } }))
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    expect(container.querySelector('[data-row]')).toBeNull()
  })

  it('warns when only a part of the orders was read', () => {
    renderPreview(baseProps('business', { orders: { status: 'ready', error: null, retry: vi.fn(), raw: [], truncated: { received: 500, total: 1200 }, blocked: null } }))
    expect(byText('Only 500 of 1200 orders were read; the totals may be incomplete.')).toBeTruthy()
  })

  it('does not warn when everything was read', () => {
    renderPreview(baseProps('business'))
    expect(screen.queryByText(/orders were read/)).toBeNull()
  })

  it('tells why with no order types selected', () => {
    renderPreview(baseProps('business', { orders: { status: 'idle', error: null, retry: vi.fn(), raw: [], truncated: null, blocked: 'no_order_types' }, invoice: businessInvoice({}, []) }))
    expect(screen.getByText('No order types selected')).toBeTruthy()
  })

  it('an invoice with 0 orders still paints its totals, and an empty list', () => {
    const { container } = renderPreview(baseProps('business', { invoice: businessInvoice({ percentage_fee_total: 0, fixed_fee_total: 0, subtotal: 0, tax_total: 0, total: 0 }, []) }))
    expect(container.querySelector('[data-row="total"]')).toBeTruthy()
    expect(screen.getByText('No orders in this period')).toBeTruthy()
  })
})

describe('InvoicePreview: the list of orders (D4)', () => {
  const many = (count) => baseProps('business', { invoice: businessInvoice({}, orderRows(count)) })

  it('shows 10 per page and pages with Pagination', async () => {
    renderPreview(many(25))
    const table = screen.getByRole('table', { name: 'Orders in the invoice' })
    expect(within(table).getAllByRole('row')).toHaveLength(11)
    expect(within(table).queryByText('1010')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(within(table).getByText('1010')).toBeTruthy()
    expect(within(table).queryByText('1000')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(within(table).getAllByRole('row')).toHaveLength(6) // header + 5
  })

  it('has no pagination when everything fits in a page', () => {
    renderPreview(many(8))
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })

  it('says the PDF lists all of them, not only the page', () => {
    renderPreview(many(25))
    expect(byText('The PDF lists all 25 orders')).toBeTruthy()
  })

  it('says it in the singular for one order', () => {
    renderPreview(many(1))
    expect(screen.getByText('The PDF lists the only order')).toBeTruthy()
  })

  it('searches by order number, back to page 1, and the PDF line does not change', async () => {
    renderPreview(many(25))
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search by order number' }), '1007')
    const table = screen.getByRole('table', { name: 'Orders in the invoice' })
    expect(within(table).getAllByRole('row')).toHaveLength(2)
    expect(within(table).getByText('1007')).toBeTruthy()
    expect(byText('The PDF lists all 25 orders')).toBeTruthy()
  })

  it('says so when the search finds nothing', async () => {
    renderPreview(many(25))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search by order number' }), '99999')
    expect(screen.getByText('No results found')).toBeTruthy()
  })

  it('has no search with no orders', () => {
    renderPreview(baseProps('business', { invoice: businessInvoice({}, []) }))
    expect(screen.queryByRole('searchbox')).toBeNull()
  })
})

describe('invoice-builder.css', () => {
  const file = path.join(__dirname, '..', 'invoice-builder.css')
  const read = () => readFileSync(file, 'utf8')
  const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')

  it('has no literal color, size, weight, duration or z-index', () => {
    expect(scanSource(read(), file)).toEqual([])
  })

  it('has no physical direction property (RTL)', () => {
    expect(strip(read()).match(/(?:^|[\s;{])(?:margin|padding|border)-(?:left|right|top|bottom)\s*:|(?:^|[\s;{])(?:left|right|top|bottom|(?:min-|max-)?width|(?:min-|max-)?height)\s*:|text-align\s*:\s*(?:left|right)/gm) ?? []).toEqual([])
  })

  it('only uses the odc-iv prefix for its own classes', () => {
    const own = (strip(read()).match(/\.[a-z][\w-]*/g) ?? []).filter(name => !name.startsWith('.odc-iv-'))
    expect(own).toEqual([])
  })

  it('has its breakpoints on the numbers of the dashboard: phone below 768, two columns from 1024', () => {
    const widths = [...strip(read()).matchAll(/\((?:min|max)-width:\s*(\d+)px\)/g)].map(match => Number(match[1]))
    expect(widths.length).toBeGreaterThan(0)
    widths.forEach(width => expect([767, 768, 1024]).toContain(width))
  })

  it('only the head of the preview and the dock of the phone are sticky (auditor 9), the head only from 1024', () => {
    const css = strip(read())
    const sticky = [...css.matchAll(/([^{}]+)\{[^{}]*position:\s*sticky/g)].map(match => match[1].trim())
    expect(sticky).toEqual(['.odc-iv-dock', '.odc-iv-preview-head'])
    expect(css).toMatch(/@media \(min-width: 1024px\)\s*\{[^@]*\.odc-iv-preview-head\s*\{[^}]*position:\s*sticky/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// redesign invoice R2 (review r1): M1, M2, M3, P1, P2, P3, P4, P6. Each block fails against the code before R2.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const Provider = ({ children }) => <ConfigFileContext.Provider value={[{ app_internal_name: 'app' }, vi.fn()]}>{children}</ConfigFileContext.Provider>
// the tree of `renderPreview`, to `rerender` it with other props (a different wrapper would mount the preview again)
const sameTree = (props) => (
  <ConfigFileContext.Provider value={[{ app_internal_name: 'app' }, vi.fn()]}>
    <InvoicePreview {...props} />
  </ConfigFileContext.Provider>
)
const stripCss = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const readSource = (name) => readFileSync(path.join(__dirname, '..', name), 'utf8')

describe('R2 M1: ⌘K on the page itself does not mount it again (D2)', () => {
  const setup = (url) => {
    const ref = {}
    const Probe = () => {
      ref.navigate = useDashboardNavigation({ closeCommandPalette: true })
      ref.location = useLocation()
      return null
    }
    render(<MemoryRouter initialEntries={[url]}><Probe /></MemoryRouter>)
    return ref
  }

  it('lists /intelligence/invoice among the pages that follow their own address', () => {
    expect(LIVE_QUERY_PATHS).toContain('/intelligence/invoice')
    expect(LIVE_QUERY_PATHS).toContain('/intelligence/reports')
  })

  it.each([
    ['the driver invoice', '/intelligence/invoice?invoice=driver'],
    ['the payment methods of the store invoice', '/intelligence/invoice?invoice=business&tab=payment_methods'],
    ['the order types of the store invoice', '/intelligence/invoice?invoice=business&tab=order_type']
  ])('goes to %s without a remount, so what was typed is kept', (_name, target) => {
    const ref = setup('/intelligence/invoice')
    act(() => ref.navigate(target))
    expect(runtime.remountRoute).not.toHaveBeenCalled()
    expect(ref.location.pathname + ref.location.search).toBe(target)
  })

  it('an explicit remount still remounts it', () => {
    const ref = setup('/intelligence/invoice')
    act(() => ref.navigate('/intelligence/invoice?invoice=driver', { remount: true }))
    expect(runtime.remountRoute).toHaveBeenCalledTimes(1)
  })
})

describe('R2 M2: the base of the commission and the notes are in the preview (D3)', () => {
  /** The two rows of the foot of the orders table of the PDF: [label, amount]. */
  const pdfOrdersFoot = (container) => [...container.querySelectorAll('table')[0].querySelectorAll('tfoot tr')].map(row => {
    const cells = row.querySelectorAll('td')
    return [normalize(cells[0].textContent), normalize(cells[cells.length - 1].textContent)]
  })
  const previewOrdersFoot = (container) => [...container.querySelectorAll('[data-orders-foot] [data-foot]')].map(row => [
    normalize(row.querySelector('dt').textContent),
    normalize(row.querySelector('dd .odc-figure[data-amount]').textContent)
  ])

  it.each([
    ['business, charge', 'business', businessInvoice(), InvoiceBusinessPdf],
    ['business, payout', 'business', businessInvoice({ type: 'payout' }, orderRows(4)), InvoiceBusinessPdf],
    ['driver', 'driver', driverInvoice(), InvoiceDriverPdf]
  ])('%s: the foot of the list is the foot of the orders table of the PDF (Subtotal, Total)', (_name, kind, invoice, Pdf) => {
    const { container } = renderPreview(baseProps(kind, { invoice }))
    const pdf = render(
      <Provider><Pdf exportInvoiceList={{ invoice }} getSubtotal={getSubtotal} getTotal={getTotal} logoSrc={null} /></Provider>
    )
    const expected = pdfOrdersFoot(pdf.container)
    expect(expected.map(([label]) => label)).toEqual(['Subtotal', 'Total'])
    expect(previewOrdersFoot(container)).toEqual(expected)
    expect(previewOrdersFoot(container)[0][1]).toBe(`$${invoice.orders_subtotal.toFixed(2)}`)
  })

  it('the foot is of all the orders: it stays the same when the list is searched or on another page', async () => {
    const invoice = businessInvoice({}, orderRows(25))
    const { container } = renderPreview(baseProps('business', { invoice }))
    const before = previewOrdersFoot(container)
    expect(before).toHaveLength(2)
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(previewOrdersFoot(container)).toEqual(before)
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search by order number' }), '1007')
    expect(within(screen.getByRole('table', { name: 'Orders in the invoice' })).getAllByRole('row')).toHaveLength(2)
    expect(previewOrdersFoot(container)).toEqual(before)
  })

  it('shows the notes at the end of the preview, as text with its line breaks and not as markup', () => {
    const { container } = renderPreview(baseProps('business', { invoice: businessInvoice({ notes: 'Pay in 30 days<br>Ask for &lt;b&gt;Ana&lt;/b&gt; &amp; Co' }) }))
    const block = container.querySelector('[data-notes]')
    expect(block).toBeTruthy()
    expect(within(block).getByRole('heading', { name: 'Notes' })).toBeTruthy()
    expect(block.querySelector('.odc-iv-notes-text').textContent).toBe('Pay in 30 days\nAsk for <b>Ana</b> & Co')
    expect(block.querySelector('b')).toBeNull()
    expect(block.querySelector('br')).toBeNull()
    // at the end: after the list of orders
    expect(container.querySelector('.odc-iv-orders').compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('what the person typed is what the preview reads back (escapeNotes round trip)', () => {
    const typed = '1 < 2 & "q" \'x\' &lt;b&gt;\nline two\n\nline four'
    const { container } = renderPreview(baseProps('business', { invoice: businessInvoice({ notes: escapeNotes(typed) }) }))
    expect(container.querySelector('[data-notes] .odc-iv-notes-text').textContent).toBe(typed)
  })

  it('has no notes block with no notes, for both kinds', () => {
    const business = renderPreview(baseProps('business'))
    expect(business.container.querySelector('[data-notes]')).toBeNull()
    business.unmount()
    const driver = renderPreview(baseProps('driver'))
    expect(driver.container.querySelector('[data-notes]')).toBeNull()
  })

  it('draws the notes of the driver invoice too', () => {
    const { container } = renderPreview(baseProps('driver', { invoice: driverInvoice({ notes: 'Weekly<br>route' }) }))
    expect(container.querySelector('[data-notes] .odc-iv-notes-text').textContent).toBe('Weekly\nroute')
  })

  it('never writes the notes as HTML (the source has no dangerouslySetInnerHTML) and keeps their breaks with CSS', () => {
    expect(readSource('InvoicePreview.jsx')).not.toMatch(/dangerouslySetInnerHTML/)
    const css = stripCss(readSource('invoice-form.css'))
    expect(css).toMatch(/\.odc-iv-notes-text\s*\{[^}]*white-space:\s*pre-line/)
  })
})

describe('R2 M3: on a phone the orders list keeps the number, the subtotal and the total', () => {
  // jsdom has no layout: the width of the table's scroller is simulated (DataTable hides the columns whose `hideBelow` is above it)
  let observers = []
  class FakeResizeObserver {
    constructor (callback) { this.callback = callback }
    observe () { observers.push(this) }
    unobserve () {}
    disconnect () { observers = observers.filter(observer => observer !== this) }
  }
  const resizeTo = (width) => act(() => { observers.forEach(observer => observer.callback([{ contentRect: { width } }])) })
  const headers = () => within(screen.getByRole('table', { name: 'Orders in the invoice' })).getAllByRole('columnheader').map(header => header.textContent)

  beforeEach(() => {
    observers = []
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('at the width of a phone, Date and Status give way and the amounts stay', () => {
    renderPreview(baseProps('business'))
    resizeTo(340)
    expect(headers()).toEqual(['Order number', 'Subtotal', 'Total'])
  })

  it('with room (a desktop column) all five columns are there', () => {
    renderPreview(baseProps('business'))
    resizeTo(700)
    expect(headers()).toEqual(['Order number', 'Date', 'Status', 'Subtotal', 'Total'])
  })

  it('Status goes first: with a little less room the Date is still there', () => {
    renderPreview(baseProps('business'))
    resizeTo(520)
    expect(headers()).toEqual(['Order number', 'Date', 'Subtotal', 'Total'])
  })
})

describe('R2 P1: the two controls do not share a name', () => {
  it('the segmented control of the page is «Invoice for»; «Invoice type» is the Charge/Payout group only', () => {
    const { container } = render(<MemoryRouter initialEntries={['/intelligence/invoice']}><InvoiceManager /></MemoryRouter>)
    expect(container.querySelectorAll('[aria-label="Invoice for"]').length).toBeGreaterThan(0)
    expect(container.querySelector('[aria-label="Invoice type"]')).toBeNull()
  })

  it('uses the new key and no longer the one of the radios', () => {
    const source = readSource('index.jsx')
    expect(source).toContain("t('INVOICE_MANAGER_INVOICE_FOR', 'Invoice for')")
    expect(source).not.toContain('INVOICE_MANAGER_KIND\'')
    expect(readSource('InvoiceForm.jsx')).toContain("t('INVOICE_MANAGER_INVOICE_TYPE', 'Invoice type')")
  })
})

describe('R2 P2: while it loads, the head, the list and the totals are of the same invoice', () => {
  it('names the business of the invoice on screen, not the one just chosen', () => {
    renderPreview(baseProps('business', { party: { kind: 'business', selected: { id: 8, name: 'Burger Barn' } }, updating: true }))
    expect(screen.getByRole('heading', { name: 'Pizza Place' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Burger Barn' })).toBeNull()
  })

  it('names the driver of the invoice on screen too', () => {
    renderPreview(baseProps('driver', { party: { kind: 'driver', selected: { id: 10, name: 'Eli Other' } }, updating: true }))
    expect(screen.getByRole('heading', { name: 'Dana Driver' })).toBeTruthy()
  })

  it('names the one chosen while there is no invoice yet', () => {
    renderPreview(baseProps('business', { invoice: null, orders: { status: 'loading', error: null, retry: vi.fn(), raw: [], truncated: null, blocked: null } }))
    expect(screen.getByRole('heading', { name: 'Pizza Place' })).toBeTruthy()
  })

  it('dims the list of orders and the totals while updating, and not otherwise', () => {
    const updating = renderPreview(baseProps('business', { updating: true }))
    expect(updating.container.querySelector('.odc-iv-orders').hasAttribute('data-stale')).toBe(true)
    expect(updating.container.querySelector('.odc-iv-totals-wrap').hasAttribute('data-stale')).toBe(true)
    expect(updating.container.querySelector('.odc-iv-orders').getAttribute('aria-busy')).toBe('true')
    updating.unmount()
    const still = renderPreview(baseProps('business'))
    expect(still.container.querySelector('.odc-iv-orders').hasAttribute('data-stale')).toBe(false)
    expect(still.container.querySelector('.odc-iv-orders').hasAttribute('aria-busy')).toBe(false)
  })

  it('dims the foot of the list with it (it is of the invoice that is about to change)', () => {
    const css = stripCss(readSource('invoice-form.css'))
    expect(css).toMatch(/\.odc-iv-orders\[data-stale\]\s*\{[^}]*opacity/)
  })

  it('empties the search of orders when the business changes', async () => {
    const props = baseProps('business', { invoice: businessInvoice({}, orderRows(25)) })
    const view = renderPreview(props)
    const box = screen.getByRole('searchbox', { name: 'Search by order number' })
    await userEvent.type(box, '1007')
    expect(box.value).toBe('1007')
    view.rerender(sameTree({ ...props, party: { kind: 'business', selected: { id: 8, name: 'Burger Barn' } }, updating: true }))
    expect(screen.getByRole('searchbox', { name: 'Search by order number' }).value).toBe('')
    expect(within(screen.getByRole('table', { name: 'Orders in the invoice' })).getAllByRole('row')).toHaveLength(11)
  })

  it('keeps the search while the same business is only recalculated', async () => {
    const props = baseProps('business', { invoice: businessInvoice({}, orderRows(25)) })
    const view = renderPreview(props)
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search by order number' }), '1007')
    view.rerender(sameTree({ ...props, updating: true }))
    expect(screen.getByRole('searchbox', { name: 'Search by order number' }).value).toBe('1007')
  })

  it('empties the search when the driver changes', async () => {
    const props = baseProps('driver', { invoice: driverInvoice({}, orderRows(25)) })
    const view = renderPreview(props)
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search by order number' }), '1007')
    view.rerender(sameTree({ ...props, party: { kind: 'driver', selected: { id: 10, name: 'Eli Other' } }, updating: true }))
    expect(screen.getByRole('searchbox', { name: 'Search by order number' }).value).toBe('')
  })
})

describe('R2 P3: an empty list says why', () => {
  const empty = (extra = {}) => baseProps('business', { invoice: businessInvoice({}, []), ...extra })
  const pay = (checked) => ({ loading: false, error: null, retry: vi.fn(), items: [{ id: 1, name: 'Cash', gateway: 'cash', checked: true }, { id: 2, name: 'Card', gateway: 'stripe', checked }] })
  const types = (checked) => ({ items: [{ value: 1, name: 'Delivery', checked: true }, { value: 2, name: 'Pickup', checked }] })

  it('with a payment method left out: «No orders match these filters»', () => {
    renderPreview(empty({ payMethods: pay(false), orderTypes: types(true) }))
    expect(screen.getByText('No orders match these filters')).toBeTruthy()
    expect(screen.queryByText('No orders in this period')).toBeNull()
  })

  it('with an order type left out: «No orders match these filters»', () => {
    renderPreview(empty({ payMethods: pay(true), orderTypes: types(false) }))
    expect(screen.getByText('No orders match these filters')).toBeTruthy()
  })

  it('with no order type at all (blocked no_order_types) it says so too', () => {
    renderPreview(empty({ payMethods: pay(true), orderTypes: types(true), orders: { status: 'idle', error: null, retry: vi.fn(), raw: [], truncated: null, blocked: 'no_order_types' } }))
    expect(screen.getByText('No orders match these filters')).toBeTruthy()
  })

  it('with every method and type on, the empty list is the period', () => {
    renderPreview(empty({ payMethods: pay(true), orderTypes: types(true) }))
    expect(screen.getByText('No orders in this period')).toBeTruthy()
    expect(screen.queryByText('No orders match these filters')).toBeNull()
  })

  it('a driver invoice (no order types) with a method left out says it too', () => {
    renderPreview(baseProps('driver', { invoice: driverInvoice({}, []), payMethods: pay(false), orderTypes: null }))
    expect(screen.getByText('No orders match these filters')).toBeTruthy()
  })

  it('with orders but a search that finds nothing, it is still «No results found»', async () => {
    renderPreview(baseProps('business', { invoice: businessInvoice({}, orderRows(5)), payMethods: pay(false), orderTypes: types(false) }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search by order number' }), '99999')
    expect(screen.getByText('No results found')).toBeTruthy()
  })
})

describe('R2 P4: the payment methods that failed are said in the preview, with a way to try again', () => {
  const failed = (extra = {}) => baseProps('business', {
    invoice: null,
    payMethods: { loading: false, error: ['boom'], retry: vi.fn(), items: [] },
    orders: { status: 'idle', error: null, retry: vi.fn(), raw: [], truncated: null, blocked: 'setup' },
    ...extra
  })

  it('shows the notice and not the endless skeleton', () => {
    const { container } = renderPreview(failed())
    expect(screen.getByText('The payment methods could not be loaded.')).toBeTruthy()
    expect(screen.queryByText('Loading the invoice')).toBeNull()
    expect(container.querySelector('.odc-skeleton')).toBeNull()
    expect(container.querySelector('[data-row]')).toBeNull()
  })

  it('«Try again» asks the payment methods again', async () => {
    const props = failed()
    renderPreview(props)
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(props.payMethods.retry).toHaveBeenCalledTimes(1)
    expect(props.orders.retry).not.toHaveBeenCalled()
  })

  it('the same for a driver', () => {
    renderPreview(failed({ kind: 'driver', party: { kind: 'driver', selected: { id: 9, name: 'Dana Driver' } } }))
    expect(screen.getByText('The payment methods could not be loaded.')).toBeTruthy()
  })

  it('without an error, a blocked setup is still the skeleton', () => {
    const { container } = renderPreview(failed({ payMethods: { loading: true, error: null, retry: vi.fn(), items: [] } }))
    expect(screen.queryByText('The payment methods could not be loaded.')).toBeNull()
    expect(screen.getByText('Loading the invoice')).toBeTruthy()
    expect(container.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
  })

  it('with the error but no longer blocked (the methods came back) the notice goes away', () => {
    renderPreview(baseProps('business', { payMethods: { loading: false, error: ['boom'], retry: vi.fn(), items: [] } }))
    expect(screen.queryByText('The payment methods could not be loaded.')).toBeNull()
  })
})

describe('R2 P6: the business or the driver is a field with its label', () => {
  const party = (kind, selected = null) => ({
    kind,
    items: [{ id: 1, name: 'Alpha Pizza' }],
    loading: false,
    error: null,
    page: 1,
    totalPages: 1,
    search: '',
    setSearch: vi.fn(),
    goToPage: vi.fn(),
    selected,
    select: vi.fn()
  })

  it.each([
    ['business', 'Business'],
    ['driver', 'Driver']
  ])('%s: a visible label over the pill, and the group is named by it', (kind, label) => {
    const { container } = render(<PartyPicker party={party(kind)} />)
    const text = container.querySelector('.odc-iv-party-label')
    expect(text).toBeTruthy()
    expect(text.textContent).toBe(label)
    expect(text.id).toBeTruthy()
    const group = container.querySelector('.odc-iv-party')
    expect(group.getAttribute('role')).toBe('group')
    expect(group.getAttribute('aria-labelledby')).toBe(text.id)
    expect(screen.getByRole('group', { name: label })).toBe(group)
    // the label is over the pill, in the order of the page
    expect(text.compareDocumentPosition(group.querySelector('button')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('the pill keeps its name and its chosen value', () => {
    render(<PartyPicker party={party('business', { id: 1, name: 'Alpha Pizza' })} />)
    expect(screen.getByRole('button', { name: /Business/ })).toHaveAccessibleName('Business Alpha Pizza')
  })

  it('two pickers on a page do not share the id of their label', () => {
    const { container } = render(<><PartyPicker party={party('business')} /><PartyPicker party={party('driver')} /></>)
    const ids = [...container.querySelectorAll('.odc-iv-party-label')].map(node => node.id)
    expect(new Set(ids).size).toBe(2)
  })

  it('the pill takes the whole width of its column and the label has the tokens of a field label', () => {
    // the rules of the picker moved with it to the kit (AnalyticsKit/party-picker.css), same selectors and values
    const css = stripCss(readFileSync(path.join(__dirname, '..', '..', 'AnalyticsKit', 'party-picker.css'), 'utf8'))
    expect(css).toMatch(/\.odc-iv-party\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/)
    expect(css).toMatch(/\.odc-iv-party-anchor\s*\{[^}]*inline-size:\s*100%/)
    expect(css).toMatch(/\.odc-iv-party \.odc-pill\s*\{[^}]*inline-size:\s*100%/)
    expect(css).toMatch(/\.odc-iv-party-label\s*\{[^}]*font-weight:\s*var\(--od-font-weight-medium\)/)
  })
})

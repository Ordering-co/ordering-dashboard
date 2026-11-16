/* eslint-disable import/first */
// redesign business-payments FD (D8, D9, D11): the panels of an invoice and of a legacy report, and the three changes
// of the documents they hold (dates by parseDate, the Product button, loading and error states). The documents are the
// real components; the SDK (language, session, api, utils) is a stub, so parseDate is a spy whose calls are pinned.
import React from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import moment from 'moment'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ logo: { status: 'ready', src: null }, parseDateCalls: [], translations: {} }))

vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: {} }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (key, text) => mocks.translations[key] ?? text],
  useSession: () => [{ token: 'token-1' }],
  useApi: () => [{ root: 'https://api.test/v400/ordering', project: 'ordering' }],
  useConfig: () => [{ configs: {} }],
  useEvent: () => [{ emit: () => {} }],
  useUtils: () => [{
    parsePrice: amount => `$${Number(amount).toFixed(2)}`,
    // Stands for the project's parseDate: reads `YYYY-MM-DD HH:mm:ss` as text and paints «DD MMM YYYY» / «HH:mm»
    parseDate: (value, options = {}) => {
      mocks.parseDateCalls.push([value, options])
      const date = moment(value, 'YYYY-MM-DD HH:mm:ss')
      if (options.outputFormat) return date.format(options.outputFormat)
      return date.format(options.timeOnly ? 'HH:mm' : 'DD MMM YYYY')
    }
  }]
}))
vi.mock('../../invoicePdfLogo', () => ({
  useInvoicePdfLogo: () => mocks.logo
}))

import { BusinessPaymentInvoiceDetail } from '../../BusinessPaymentInvoiceDetail'
import { EatStreetReportDetail } from '../../EatStreetReportDetail'
import { InvoicePanel } from '../InvoicePanel'
import { LegacyReportPanel } from '../LegacyReportPanel'

const theme = { colors: {}, images: {} }
const inTheme = node => <ThemeProvider theme={theme}>{node}</ThemeProvider>

const order = (id, createdAt) => ({
  order_id: id,
  created_at: createdAt,
  delivery_type: 1,
  tip: 0,
  order_total: 10,
  fees: []
})

const invoiceResult = (overrides = {}, orders = [order(101, '2026-02-24T06:50:00Z')]) => ({
  invoice: {
    id: 12,
    business: { name: 'Panera' },
    paymethod: 'stripe',
    period_start: '2026-02-23 05:00:00',
    period_end: '2026-03-01 05:00:00',
    timezone: 'America/New_York',
    ...overrides
  },
  totals: { prepaid_total: 10, total_charges: 2, deposit_amount: 8 },
  order_summary: null,
  fee_details: {},
  order_details: orders
})

const answer = body => Promise.resolve({ json: () => Promise.resolve(body), text: () => Promise.resolve(body) })
const never = () => new Promise(() => {})

let fetchMock
beforeEach(() => {
  mocks.logo = { status: 'ready', src: null }
  mocks.parseDateCalls = []
  mocks.translations = {}
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.body.style.overflow = ''
})

describe('InvoicePanel', () => {
  it('names the invoice with its number as a figure and calls onClose from Close', async () => {
    fetchMock.mockReturnValue(never())
    const onClose = vi.fn()
    render(inTheme(<InvoicePanel invoiceId={12} onClose={onClose} expanded={false} onExpandedChange={vi.fn()} />))

    const title = screen.getByRole('heading', { level: 2 })
    expect(title).toHaveTextContent('Invoice #12')
    expect(title.querySelector('.odc-figure')).toHaveTextContent('12')

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Expand asks the shell to expand, and says Collapse once expanded', async () => {
    fetchMock.mockReturnValue(never())
    const onExpandedChange = vi.fn()
    const view = render(inTheme(<InvoicePanel invoiceId={12} onClose={vi.fn()} expanded={false} onExpandedChange={onExpandedChange} />))

    await userEvent.click(screen.getByRole('button', { name: 'Expand' }))
    expect(onExpandedChange).toHaveBeenLastCalledWith(true)

    view.rerender(inTheme(<InvoicePanel invoiceId={12} onClose={vi.fn()} expanded onExpandedChange={onExpandedChange} />))
    await userEvent.click(screen.getByRole('button', { name: 'Collapse' }))
    expect(onExpandedChange).toHaveBeenLastCalledWith(false)
  })

  it('loads the invoice of the panel and shows a skeleton with the box of the document meanwhile', () => {
    fetchMock.mockReturnValue(never())
    render(inTheme(<InvoicePanel invoiceId={12} onClose={vi.fn()} />))

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/v400/ordering/business_payment_invoices/12/detail')
    expect(document.querySelector('.bpp-skeleton[role="status"][aria-busy="true"]')).not.toBeNull()
  })
})

describe('LegacyReportPanel', () => {
  it('names the panel «Legacy Reports», expands and closes', async () => {
    fetchMock.mockReturnValue(never())
    const onClose = vi.fn()
    const onExpandedChange = vi.fn()
    render(inTheme(<LegacyReportPanel reportId={7} onClose={onClose} expanded={false} onExpandedChange={onExpandedChange} />))

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Legacy Reports')
    expect(fetchMock.mock.calls[0][0]).toBe('https://eatstreet-payment-reports.plugins.orderingplus.com/api/reports/html-proxy/7')

    await userEvent.click(screen.getByRole('button', { name: 'Expand' }))
    expect(onExpandedChange).toHaveBeenLastCalledWith(true)
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('BusinessPaymentInvoiceDetail dates', () => {
  it('paints the period by parseDate, reading the API text as it comes, and never as 02/23/2026', async () => {
    fetchMock.mockReturnValue(answer({ error: false, result: invoiceResult() }))
    render(inTheme(<BusinessPaymentInvoiceDetail invoiceId={12} />))

    expect(await screen.findByText('23 Feb 2026')).toBeInTheDocument()
    expect(screen.getByText('01 Mar 2026')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('02/23/2026')
    expect(document.body.textContent).not.toMatch(/\d{2}\/\d{2}\/\d{4}/)
    // The API text goes in untouched and is not moved to the zone of the browser (decision 13, D11)
    expect(mocks.parseDateCalls).toContainEqual(['2026-02-23 05:00:00', { dateOnly: true, utc: false }])
  })

  it('puts an order on the day and at the hour of the wall clock of the invoice zone', async () => {
    // 06:50Z is 01:50 on the 24th in New York (UTC-5 in February); 04:30Z is still 23:30 on the 23rd
    fetchMock.mockReturnValue(answer({
      error: false,
      result: invoiceResult({}, [order(102, '2026-02-24T06:50:00Z'), order(101, '2026-02-24T04:30:00Z')])
    }))
    render(inTheme(<BusinessPaymentInvoiceDetail invoiceId={12} />))

    expect(await screen.findByText('Tuesday, 24 Feb 2026')).toBeInTheDocument()
    expect(screen.getByText('Monday, 23 Feb 2026')).toBeInTheDocument()
    expect(screen.getByText('01:50')).toBeInTheDocument()
    expect(screen.getByText('23:30')).toBeInTheDocument()
    expect(mocks.parseDateCalls).toContainEqual(['2026-02-24 01:50:00', { timeOnly: true, utc: false }])
    // the older day comes first
    const days = [...document.querySelectorAll('h3, h4, div')].filter(node => /^(Monday|Tuesday), /.test(node.textContent) && node.children.length === 0)
    expect(days.map(node => node.textContent)).toEqual(['Monday, 23 Feb 2026', 'Tuesday, 24 Feb 2026'])
  })

  it('without a timezone the invoice is read in UTC', async () => {
    fetchMock.mockReturnValue(answer({
      error: false,
      result: invoiceResult({ timezone: undefined }, [order(101, '2026-02-24T06:50:00Z')])
    }))
    render(inTheme(<BusinessPaymentInvoiceDetail invoiceId={12} />))

    expect(await screen.findByText('Tuesday, 24 Feb 2026')).toBeInTheDocument()
    expect(screen.getByText('06:50')).toBeInTheDocument()
  })
})

describe('BusinessPaymentInvoiceDetail download', () => {
  it('«Download PDF» is a button, disabled while the logo loads', async () => {
    mocks.logo = { status: 'loading', src: null }
    fetchMock.mockReturnValue(answer({ error: false, result: invoiceResult() }))
    const view = render(inTheme(<BusinessPaymentInvoiceDetail invoiceId={12} />))

    const button = await screen.findByRole('button', { name: 'Download PDF' })
    expect(button).toBeDisabled()
    expect(button).toHaveClass('odc-btn')
    expect(button).toHaveAttribute('data-variant', 'secondary')

    mocks.logo = { status: 'ready', src: null }
    view.rerender(inTheme(<BusinessPaymentInvoiceDetail invoiceId={12} />))
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeEnabled()
  })
})

describe('BusinessPaymentInvoiceDetail errors', () => {
  it('a failed detail is announced and «Try again» asks for it again', async () => {
    fetchMock
      .mockReturnValueOnce(answer({ error: true, result: ['Invoice not found'] }))
      .mockReturnValueOnce(answer({ error: false, result: invoiceResult() }))
    render(inTheme(<BusinessPaymentInvoiceDetail invoiceId={12} />))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Invoice not found')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toBe(fetchMock.mock.calls[0][0])
    expect(await screen.findByText('23 Feb 2026')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a network failure also offers «Try again»', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Failed to fetch'))
    render(inTheme(<BusinessPaymentInvoiceDetail invoiceId={12} />))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

// redesign the API answers some errors by key («API_ERROR_NOT_FOUND»); a key the dictionary does not know is not for a person
describe('BusinessPaymentInvoiceDetail errors by key', () => {
  const failWith = async (messages) => {
    fetchMock.mockReturnValueOnce(answer({ error: true, result: messages }))
    render(inTheme(<BusinessPaymentInvoiceDetail invoiceId={99999} />))
    return screen.findByRole('alert')
  }

  it('NOT_FOUND says the invoice does not exist, keeps the title and «Try again»', async () => {
    const alert = await failWith(['API_ERROR_NOT_FOUND'])
    expect(alert).toHaveTextContent("We couldn't load this invoice.")
    expect(alert).toHaveTextContent("This invoice doesn't exist.")
    expect(alert.textContent).not.toMatch(/API_ERROR_NOT_FOUND/)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('a key the dictionary has is translated: the dictionary wins over the fallback', async () => {
    mocks.translations = { API_ERROR_NOT_FOUND: 'Factura no encontrada' }
    const alert = await failWith(['API_ERROR_NOT_FOUND'])
    expect(alert).toHaveTextContent('Factura no encontrada')
    expect(alert.textContent).not.toMatch(/doesn't exist/)
  })

  it('any other key without text is the generic message, never the key', async () => {
    const alert = await failWith(['API_ERROR_SOMETHING_ELSE', 'INTERNAL_ERROR'])
    expect(alert.textContent).not.toMatch(/[A-Z]+_[A-Z_]+/)
    expect(alert).toHaveTextContent('Something went wrong.')
  })

  it('a message in words is shown as the API wrote it', async () => {
    const alert = await failWith(['Invoice not found'])
    expect(alert).toHaveTextContent('Invoice not found')
  })

  it('a network failure does not show the browser text', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    render(inTheme(<BusinessPaymentInvoiceDetail invoiceId={12} />))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).not.toMatch(/Failed to fetch/)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

// redesign seven columns do not fit a 390 px panel; the table scrolls inside its own region and the panel does not
describe('BusinessPaymentInvoiceDetail order summary', () => {
  const withSummary = () => {
    const line = { count: 2, subtotal: 20, tax: 2, delivery_price: 3, tip: 1, total: 26 }
    return { ...invoiceResult(), order_summary: { card_orders: line, cash_orders: line, total: line } }
  }
  const scrollOf = async () => {
    fetchMock.mockReturnValue(answer({ error: false, result: withSummary() }))
    render(inTheme(<BusinessPaymentInvoiceDetail invoiceId={12} />))
    const title = await screen.findByText('Order summary')
    return title.nextElementSibling
  }

  it('the table is inside its own scroll container, after the title', async () => {
    const scroll = await scrollOf()
    expect(scroll.querySelector('table')).not.toBeNull()
    expect(getComputedStyle(scroll).overflowX).toBe('auto')
  })

  it('while it fits there is nothing to focus', async () => {
    const scroll = await scrollOf()
    expect(scroll).not.toHaveAttribute('tabindex')
    expect(scroll).not.toHaveAttribute('role')
  })

  it('when it scrolls it is a named region with a tab stop, so the keyboard can reach the last column', async () => {
    const proto = HTMLElement.prototype
    const originalScroll = Object.getOwnPropertyDescriptor(proto, 'scrollWidth')
    const originalClient = Object.getOwnPropertyDescriptor(proto, 'clientWidth')
    Object.defineProperty(proto, 'scrollWidth', { configurable: true, get () { return this.tagName === 'DIV' ? 700 : 0 } })
    Object.defineProperty(proto, 'clientWidth', { configurable: true, get () { return this.tagName === 'DIV' ? 300 : 0 } })
    try {
      const scroll = await scrollOf()
      await waitFor(() => expect(scroll).toHaveAttribute('tabindex', '0'))
      expect(screen.getByRole('region', { name: 'Order summary' })).toBe(scroll)
    } finally {
      if (originalScroll) Object.defineProperty(proto, 'scrollWidth', originalScroll)
      else delete proto.scrollWidth
      if (originalClient) Object.defineProperty(proto, 'clientWidth', originalClient)
      else delete proto.clientWidth
    }
  })
})

describe('EatStreetReportDetail', () => {
  const html = '<html><body><p>Report</p></body></html>'

  it('does not lock the scroll of the body: in a SplitView the panel has its own (D8)', async () => {
    document.body.style.overflow = ''
    fetchMock.mockReturnValue(answer(html))
    const view = render(inTheme(<EatStreetReportDetail reportId={7} />))

    expect(document.body.style.overflow).toBe('')
    await waitFor(() => expect(document.querySelector('iframe')).not.toBeNull())
    expect(document.body.style.overflow).toBe('')
    view.unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('keeps the iframe of main as it is: same srcDoc and no sandbox (decision 37, )', async () => {
    // Parity test, not an endorsement: the report is third-party HTML in an unsandboxed iframe. (Product Team)
    // fixes it; until then this pins that the redesign did not change the iframe, so the ticket stays about one thing.
    fetchMock.mockReturnValue(answer(html))
    render(inTheme(<EatStreetReportDetail reportId={7} />))

    const iframe = await waitFor(() => {
      const found = document.querySelector('iframe')
      expect(found).not.toBeNull()
      return found
    })
    expect(iframe).not.toHaveAttribute('sandbox')
    expect(iframe).toHaveAttribute('srcdoc', html)
    expect(iframe).toHaveAttribute('title', 'Report')
  })

  it('«Download PDF» is the Product secondary button', async () => {
    fetchMock.mockReturnValue(answer(html))
    render(inTheme(<EatStreetReportDetail reportId={7} />))

    const button = await screen.findByRole('button', { name: 'Download PDF' })
    expect(button).toHaveClass('odc-btn')
    expect(button).toHaveAttribute('data-variant', 'secondary')
  })

  it('a failed report offers «Try again», which asks for the report again', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockReturnValueOnce(answer(html))
    render(inTheme(<EatStreetReportDetail reportId={7} />))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(document.querySelector('iframe')).not.toBeNull())
  })
})

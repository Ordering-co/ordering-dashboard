/* eslint-disable import/first */
// redesign invoice FC2 (D1, D2, D3, D4, D6, D9, D13; IV-01, IV-02, IV-05; auditor 2, 4, 5, 9, 12): the page /intelligence/invoice.
// The controller of the data (`InvoiceBuilder` of `C/components`, lote A) is a stand-in that mounts its UIComponent with fixed props and counts
// how many times it was mounted; the form (`InvoiceForm`, lote C1) is a stand-in too. What is under test is the page: the type that comes from the
// URL on every change, the controller that stays mounted, `?tab=` as a focus target, the hidden PDF as the source of the file, the download and
// the dock of the phone. The real `InvoiceBusinessPdf` and `InvoiceDriverPdf` are mounted.
import React from 'react'
import moment from 'moment'
import { MemoryRouter, useHistory, useLocation } from 'react-router-dom'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({
  collapsed: false,
  collapse: null,
  learn: null,
  mounts: { business: 0, driver: 0 },
  builderProps: [],
  formProps: [],
  props: {},
  download: null,
  request: null,
  toast: null,
  logo: { status: 'ready', src: 'data:image/png;base64,AAAA' },
  history: null,
  search: ''
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {}, language: { code: 'en' } }, (_key, text) => text],
  useUtils: () => [{
    parsePrice: value => `$${Number(value).toFixed(2)}`,
    parseNumber: value => String(value),
    parseDate: (date, options = {}) => {
      const instant = (options.utc ?? true) ? moment.utc(date, options.inputFormat || ['YYYY-MM-DD HH:mm:ss']).local() : moment(date, options.inputFormat || ['YYYY-MM-DD HH:mm:ss'])
      return instant.format('D MMM YYYY')
    }
  }],
  useConfig: () => [{ configs: {} }],
  useSession: () => [{ token: 'tok-1' }],
  useApi: () => [{ root: 'https://api.test/v4' }],
  useToast: () => [null, { showToast: (...args) => runtime.toast(...args) }],
  ToastType: { Error: 'error', Success: 'success' }
}))
vi.mock('../../../../../../components/InvoiceBuilder', async () => {
  const react = await import('react')
  function Builder ({ UIComponent, ...rest }) {
    react.useEffect(() => { runtime.mounts[rest.kind] += 1 }, [])
    runtime.builderProps.push({ ...rest, UIComponent })
    return react.createElement(UIComponent, { ...rest, ...runtime.props[rest.kind] })
  }
  return { InvoiceBuilder: Builder }
})
vi.mock('../InvoiceForm', async () => {
  const react = await import('react')
  return {
    InvoiceForm: function InvoiceForm (props) {
      runtime.formProps.push(props)
      return react.createElement('div', { 'data-testid': `form-${props.kind}`, 'data-focus': props.focusTarget ?? '' },
        react.createElement('button', { type: 'button', onClick: () => props.onFocusDone?.() }, `focus done ${props.kind}`),
        props.onBatch && react.createElement('button', { type: 'button', onClick: () => props.onBatch() }, `batch ${props.kind}`))
    }
  }
})
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: runtime.collapsed }, { handleMenuCollapse: (...args) => runtime.collapse(...args) }]
}))
vi.mock('../../../Shared/LearnDropDown', () => ({
  LearnDropDown: ({ learnOptions }) => {
    runtime.learn = learnOptions
    return <button type='button'>Learn</button>
  }
}))
vi.mock('../../downloadInvoicePdf', () => ({
  downloadInvoicePdfFromHtml: (...args) => runtime.download(...args),
  requestInvoicePdf: (...args) => runtime.request(...args),
  saveInvoicePdfBlob: vi.fn()
}))
vi.mock('../../invoicePdfLogo', async (importOriginal) => ({
  ...(await importOriginal()),
  useInvoicePdfLogo: () => runtime.logo
}))

import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'
import { InvoiceManager } from '../index'

const orderRows = (count) => Array.from({ length: count }, (_, index) => ({
  id: 1000 + index, status: 11, delivery_datetime: '2026-09-03 12:00:00', sub: 10 + index, tot: 12 + index
}))
const getSubtotal = order => order.sub
const getTotal = order => order.tot

const businessInvoice = () => ({
  from: '2026-09-01',
  to: '2026-09-30',
  type: 'charge',
  orders: orderRows(2),
  percentage_fee: 10,
  fixed_fee: 1,
  tax: 5,
  misc_amount: 0,
  misc_description: '',
  inlcude_discounts: false,
  tax_products: 0,
  discounts: 0,
  orders_subtotal: 21,
  orders_total: 25,
  notes: 'Pay in 30 days',
  percentage_fee_total: 2.3,
  fixed_fee_total: 2,
  subtotal: 4.3,
  tax_total: 0.22,
  total: 4.52,
  business: { id: 7, name: 'Pizza Place' }
})

const driverInvoice = () => ({
  from: '',
  to: '',
  orders: orderRows(3),
  percentage_fee: 5,
  fixed_fee: 2,
  tax: 8,
  misc_amount: 3,
  misc_description: 'Bonus',
  orders_subtotal: 33,
  orders_total: 39,
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
  driver: { id: 9, name: 'Dana Driver' }
})

const controllerProps = (kind, extra = {}) => ({
  kind,
  form: kind === 'business' ? { type: 'charge', from: '2026-09-01', to: '2026-09-30' } : { from: '', to: '' },
  setField: vi.fn(),
  setPeriod: vi.fn(),
  party: { kind, selected: kind === 'business' ? { id: 7, name: 'Pizza Place' } : { id: 9, name: 'Dana Driver' } },
  payMethods: { loading: false, error: null, items: [] },
  orderTypes: kind === 'business' ? { items: [] } : undefined,
  orders: { status: 'ready', error: null, retry: vi.fn(), raw: [], truncated: null, blocked: null },
  invoice: kind === 'business' ? businessInvoice() : driverInvoice(),
  updating: false,
  canDownload: true,
  getSubtotal,
  getTotal,
  ...extra
})

const setPhone = (matches) => {
  window.matchMedia = vi.fn().mockImplementation(query => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn()
  }))
}

const Probe = () => {
  runtime.history = useHistory()
  runtime.search = useLocation().search
  return null
}

const renderPage = (url = '/intelligence/invoice') => render(
  <ConfigFileContext.Provider value={[{ app_internal_name: 'app' }, vi.fn()]}>
    <MemoryRouter initialEntries={[url]}>
      <InvoiceManager />
      <Probe />
    </MemoryRouter>
  </ConfigFileContext.Provider>
)

const visibleForm = () => ['business', 'driver'].filter(kind => {
  const node = screen.queryByTestId(`form-${kind}`)
  return node && !node.closest('[hidden]')
})

beforeEach(() => {
  runtime.collapsed = false
  runtime.collapse = vi.fn()
  runtime.learn = null
  runtime.mounts = { business: 0, driver: 0 }
  runtime.builderProps = []
  runtime.formProps = []
  runtime.props = { business: controllerProps('business'), driver: controllerProps('driver') }
  runtime.download = vi.fn().mockResolvedValue(undefined)
  runtime.request = vi.fn().mockResolvedValue({ blob: new Blob(['%PDF']), filename: 'invoice_1.pdf' })
  runtime.toast = vi.fn()
  runtime.logo = { status: 'ready', src: 'data:image/png;base64,AAAA' }
  setPhone(false)
})

afterEach(() => {
  delete window.matchMedia
})

describe('InvoiceManager: the header (D1, D2)', () => {
  it('has the title, the subtitle that says what the page does and Learn', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Invoice manager' })).toBeTruthy()
    expect(screen.getByText('Build an invoice from the orders of a business or a driver and download it as a PDF.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Learn' })).toBeTruthy()
    expect(runtime.learn).toBeTruthy()
  })

  it('has the button of the menu only when the menu is collapsed', async () => {
    const closed = renderPage()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
    closed.unmount()
    runtime.collapsed = true
    renderPage()
    const opener = screen.getByRole('button', { name: 'Open menu' })
    // the opener is PageHeader's `leading`, the first child of the title block
    expect(opener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(opener)
    await userEvent.click(opener)
    expect(runtime.collapse).toHaveBeenCalledWith(false)
  })

  it('does not paint the cards of the old catalog nor the text that named Orderingplus', () => {
    renderPage()
    expect(screen.queryByText(/Orderingplus/)).toBeNull()
  })

  it('has the two kinds in a segmented control with the titles of main, the one of the URL pressed', () => {
    renderPage('/intelligence/invoice?invoice=driver')
    expect(screen.getByRole('button', { name: 'Driver invoice' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Business invoice' }).getAttribute('aria-pressed')).toBe('false')
  })
})

describe('InvoiceManager: the kind comes from ?invoice= on every change (D2, auditor 5)', () => {
  it('without a parameter, or with another value, it is the business invoice', () => {
    const none = renderPage()
    expect(visibleForm()).toEqual(['business'])
    expect(runtime.mounts).toEqual({ business: 1, driver: 0 })
    none.unmount()
    runtime.mounts = { business: 0, driver: 0 }
    renderPage('/intelligence/invoice?invoice=pizza')
    expect(visibleForm()).toEqual(['business'])
    expect(runtime.mounts).toEqual({ business: 1, driver: 0 })
  })

  it('?invoice=driver opens the driver, and a push to ?invoice=business changes it without a reload', () => {
    renderPage('/intelligence/invoice?invoice=driver')
    expect(visibleForm()).toEqual(['driver'])
    expect(runtime.mounts).toEqual({ business: 0, driver: 1 })
    act(() => { runtime.history.push('/intelligence/invoice?invoice=business') })
    expect(visibleForm()).toEqual(['business'])
    expect(runtime.mounts).toEqual({ business: 1, driver: 1 })
  })

  it('⌘K from the page itself: a navigation to the other kind is seen', () => {
    renderPage()
    expect(visibleForm()).toEqual(['business'])
    act(() => { runtime.history.push('/intelligence/invoice?invoice=driver&tab=payment_methods') })
    expect(visibleForm()).toEqual(['driver'])
    expect(screen.getByTestId('form-driver').getAttribute('data-focus')).toBe('payment_methods')
  })

  it('choosing the other kind pushes ?invoice= to the history (the router sees it)', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Driver invoice' }))
    expect(runtime.history.action).toBe('PUSH')
    expect(new URLSearchParams(runtime.search).get('invoice')).toBe('driver')
    expect(visibleForm()).toEqual(['driver'])
    await userEvent.click(screen.getByRole('button', { name: 'Business invoice' }))
    expect(runtime.history.action).toBe('PUSH')
    expect(new URLSearchParams(runtime.search).get('invoice')).toBe('business')
    expect(visibleForm()).toEqual(['business'])
  })

  it('keeps the other parameters when it changes the kind', async () => {
    renderPage('/intelligence/invoice?foo=1')
    await userEvent.click(screen.getByRole('button', { name: 'Driver invoice' }))
    const params = new URLSearchParams(runtime.search)
    expect(params.get('foo')).toBe('1')
    expect(params.get('invoice')).toBe('driver')
  })

  it('each kind mounts its controller once, the first time it is chosen, and keeps it mounted (D2)', async () => {
    renderPage()
    expect(runtime.mounts).toEqual({ business: 1, driver: 0 })
    await userEvent.click(screen.getByRole('button', { name: 'Driver invoice' }))
    expect(runtime.mounts).toEqual({ business: 1, driver: 1 })
    await userEvent.click(screen.getByRole('button', { name: 'Business invoice' }))
    await userEvent.click(screen.getByRole('button', { name: 'Driver invoice' }))
    expect(runtime.mounts).toEqual({ business: 1, driver: 1 })
    // the kind that is not shown is hidden, not unmounted
    expect(screen.getByTestId('form-business').closest('[hidden]')).toBeTruthy()
  })

  it('wires each controller with its kind and the UIComponent of the page', () => {
    renderPage()
    const business = runtime.builderProps.find(props => props.kind === 'business')
    expect(typeof business.UIComponent).toBe('function')
    expect(business.UIComponent.name).toBe('InvoiceKindView')
  })

  it('keeps the same UIComponent on every render, so a re-render never remounts the form', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Driver invoice' }))
    const components = new Set(runtime.builderProps.map(props => props.UIComponent))
    expect(components.size).toBe(1)
  })
})

describe('InvoiceManager: ?tab= is a focus target (D2)', () => {
  it('passes ?tab=payment_methods to the form as focusTarget and removes it from the URL when the form is done', async () => {
    renderPage('/intelligence/invoice?invoice=business&tab=payment_methods')
    expect(screen.getByTestId('form-business').getAttribute('data-focus')).toBe('payment_methods')
    await userEvent.click(screen.getByRole('button', { name: 'focus done business' }))
    expect(runtime.history.action).toBe('REPLACE')
    const params = new URLSearchParams(runtime.search)
    expect(params.has('tab')).toBe(false)
    expect(params.get('invoice')).toBe('business')
    expect(screen.getByTestId('form-business').getAttribute('data-focus')).toBe('')
  })

  it.each(['order_type', 'general'])('passes ?tab=%s too', (tab) => {
    renderPage(`/intelligence/invoice?tab=${tab}`)
    expect(screen.getByTestId('form-business').getAttribute('data-focus')).toBe(tab)
  })

  it('gives the focus target to the kind that is shown, not to the other', () => {
    renderPage('/intelligence/invoice?invoice=driver&tab=payment_methods')
    expect(screen.getByTestId('form-driver').getAttribute('data-focus')).toBe('payment_methods')
    act(() => { runtime.history.push('/intelligence/invoice?invoice=business') })
    expect(screen.getByTestId('form-business').getAttribute('data-focus')).toBe('')
  })

  it('a destination the kind does not have (order types of a driver) or an unknown one is dropped from the URL', async () => {
    renderPage('/intelligence/invoice?invoice=driver&tab=order_type')
    expect(screen.getByTestId('form-driver').getAttribute('data-focus')).toBe('')
    await waitFor(() => expect(new URLSearchParams(runtime.search).has('tab')).toBe(false))
    expect(new URLSearchParams(runtime.search).get('invoice')).toBe('driver')
  })
})

describe('InvoiceManager: the page of a kind (D1, D4)', () => {
  it('has the form and the preview, and passes the controller props to both', () => {
    renderPage()
    const form = runtime.formProps.find(props => props.kind === 'business')
    expect(form.form).toEqual(runtime.props.business.form)
    expect(form.setField).toBe(runtime.props.business.setField)
    expect(screen.getByRole('heading', { name: 'Pizza Place' })).toBeTruthy()
    expect(screen.getByText('Total due')).toBeTruthy()
  })

  it('the preview of the driver names the driver', async () => {
    renderPage('/intelligence/invoice?invoice=driver')
    expect(screen.getByRole('heading', { name: 'Dana Driver' })).toBeTruthy()
    expect(screen.getByText('All dates')).toBeTruthy()
  })
})

describe('InvoiceManager: the PDF is hidden and is the source of the file (D3)', () => {
  const pdfNode = (container) => container.querySelector('[data-pdf-source]')

  it('is a hidden node with no class and no style of the brand', () => {
    const { container } = renderPage()
    const node = pdfNode(container)
    expect(node).toBeTruthy()
    expect(node.hasAttribute('hidden')).toBe(true)
    expect(node.getAttribute('class')).toBeNull()
    expect(node.getAttribute('style')).toBeNull()
    expect(node.innerHTML).toContain('Pizza Place')
    expect(node.innerHTML).not.toContain('var(--od')
    expect(node.innerHTML).not.toContain('odc-')
  })

  it('gives the PDF of the kind: the invoice of the business, the one of the driver', () => {
    const { container } = renderPage('/intelligence/invoice?invoice=driver')
    const node = pdfNode(container)
    expect(node.textContent).toContain('Dana Driver')
    expect(node.textContent).not.toContain('Pizza Place')
  })

  it('downloads with the innerHTML of that node, the logo, the API root and the token', async () => {
    const { container } = renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }))
    expect(runtime.download).toHaveBeenCalledTimes(1)
    const call = runtime.download.mock.calls[0][0]
    expect(call.html).toBe(pdfNode(container).innerHTML)
    expect(call.html).not.toContain('var(--od')
    expect(call.html).not.toContain('odc-')
    expect(call.logoSrc).toBe('data:image/png;base64,AAAA')
    expect(call.root).toBe('https://api.test/v4')
    expect(call.token).toBe('tok-1')
  })

  it('does not download when the controller says the figures are not of the form (canDownload false, auditor 4)', async () => {
    runtime.props.business = controllerProps('business', { canDownload: false })
    renderPage()
    const button = screen.getByRole('button', { name: 'Download PDF' })
    expect(button.disabled).toBe(true)
    await userEvent.click(button)
    expect(runtime.download).not.toHaveBeenCalled()
  })

  it('does not download while the logo loads', () => {
    runtime.logo = { status: 'loading', src: null }
    renderPage()
    expect(screen.getByRole('button', { name: 'Download PDF' }).disabled).toBe(true)
  })

  it('does not download with no invoice', () => {
    runtime.props.business = controllerProps('business', { invoice: null, canDownload: true, orders: { status: 'loading', error: null, retry: vi.fn(), raw: [], truncated: null, blocked: null } })
    renderPage()
    expect(screen.getByRole('button', { name: 'Download PDF' }).disabled).toBe(true)
  })

  it('blocks a second download while one is running', async () => {
    let finish
    runtime.download = vi.fn(() => new Promise(resolve => { finish = resolve }))
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }))
    expect(screen.getByRole('button', { name: 'Download PDF' }).getAttribute('aria-busy')).toBe('true')
    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }))
    expect(runtime.download).toHaveBeenCalledTimes(1)
    await act(async () => { finish() })
    expect(screen.getByRole('button', { name: 'Download PDF' }).getAttribute('aria-busy')).toBeNull()
  })

  it('on an error it shows a translated toast, not the raw message of the server (D13)', async () => {
    runtime.download = vi.fn().mockRejectedValue(new Error('Invalid response format'))
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }))
    await waitFor(() => expect(runtime.toast).toHaveBeenCalledTimes(1))
    expect(runtime.toast).toHaveBeenCalledWith('error', 'The PDF could not be created. Try again.')
    expect(screen.getByRole('button', { name: 'Download PDF' }).getAttribute('aria-busy')).toBeNull()
  })

  it('downloads the PDF of the driver with the driver invoice', async () => {
    renderPage('/intelligence/invoice?invoice=driver')
    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }))
    expect(runtime.download.mock.calls[0][0].html).toContain('Dana Driver')
  })
})

describe('InvoiceManager: the dock of the phone (D4, D13)', () => {
  it('has no dock on a wide screen, where the button is in the preview', () => {
    const { container } = renderPage()
    expect(container.querySelector('[data-dock]')).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Download PDF' })).toHaveLength(1)
  })

  it('on a phone it has a dock with the total, the count and Download PDF, and only one button', async () => {
    setPhone(true)
    const { container } = renderPage()
    const dock = container.querySelector('[data-dock]')
    expect(dock).toBeTruthy()
    expect(within(dock).getByText(/Total due/)).toBeTruthy()
    expect(dock.textContent).toContain('$4.52')
    expect(dock.textContent).toMatch(/2\s*orders/)
    expect(screen.getAllByRole('button', { name: 'Download PDF' })).toHaveLength(1)
    await userEvent.click(within(dock).getByRole('button', { name: 'Download PDF' }))
    expect(runtime.download).toHaveBeenCalledTimes(1)
  })

  it('says «1 order» in the singular', () => {
    setPhone(true)
    runtime.props.business = controllerProps('business', { invoice: { ...businessInvoice(), orders: orderRows(1) } })
    const { container } = renderPage()
    expect(container.querySelector('[data-dock]').textContent).toMatch(/1\s*order(?!s)/)
  })

  it('is disabled while the figures update, and says so', () => {
    setPhone(true)
    runtime.props.business = controllerProps('business', { updating: true, canDownload: false })
    const { container } = renderPage()
    const dock = container.querySelector('[data-dock]')
    expect(within(dock).getByText('Updating…')).toBeTruthy()
    expect(within(dock).getByRole('button', { name: 'Download PDF' }).disabled).toBe(true)
  })

  it('has no dock with no business chosen', () => {
    setPhone(true)
    runtime.props.business = controllerProps('business', { party: { kind: 'business', selected: null }, invoice: null, orders: { status: 'idle', error: null, retry: vi.fn(), raw: [], truncated: null, blocked: 'no_party' } })
    const { container } = renderPage()
    expect(container.querySelector('[data-dock]')).toBeNull()
    expect(screen.getByText('Choose a business to see its invoice')).toBeTruthy()
  })
})

// each PDF of a batch is made by the same component and the same request as the single download
describe('InvoiceManager: the PDFs of a batch', () => {
  const batchOf = (extra = {}) => ({
    limit: 50,
    selected: [{ id: 8, name: 'Burger Barn' }],
    toggle: vi.fn(),
    selectAll: vi.fn(),
    clear: vi.fn(),
    items: [],
    running: false,
    blocked: null,
    run: vi.fn(),
    retry: vi.fn(),
    cancel: vi.fn(),
    ...extra
  })

  it('the form opens the dialog only when the controller has a batch', () => {
    renderPage()
    expect(screen.queryByRole('button', { name: 'batch business' })).toBeNull()
  })

  it('paints the invoice of each party in its own hidden node and posts that HTML, with the logo, the root, the token and the signal', async () => {
    const batch = batchOf()
    runtime.props.business = controllerProps('business', { batch, party: { kind: 'business', items: [], selected: null } })
    const { container } = renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'batch business' }))
    await userEvent.click(screen.getByRole('button', { name: 'Create 1 invoice' }))
    expect(batch.run).toHaveBeenCalledTimes(1)
    const makePdf = batch.run.mock.calls[0][0]

    const invoice = { ...businessInvoice(), business: { id: 8, name: 'Burger Barn' } }
    const signal = new AbortController().signal
    let result
    await act(async () => { result = await makePdf(invoice, { id: 8, name: 'Burger Barn' }, signal) })

    const node = container.querySelector('[data-pdf-batch-source]')
    expect(node.hasAttribute('hidden')).toBe(true)
    expect(node.getAttribute('class')).toBeNull()
    expect(runtime.request).toHaveBeenCalledTimes(1)
    const call = runtime.request.mock.calls[0][0]
    expect(call.html).toBe(node.innerHTML)
    expect(call.html).toContain('Burger Barn')
    expect(call.html).not.toContain('odc-')
    expect(call).toMatchObject({ logoSrc: 'data:image/png;base64,AAAA', root: 'https://api.test/v4', token: 'tok-1', signal })
    expect(result.filename).toBe('invoice-burger-barn-8-2026-09-01_2026-09-30.pdf')
    // the single download keeps its own node and its own invoice
    expect(container.querySelector('[data-pdf-source]').textContent).not.toContain('Burger Barn')
  })

  // flushSync and the read of innerHTML happen in one synchronous step; an await between them would let the second party's
  // invoice paint over the first one's before it is read. Two calls at once must each post their own party.
  it('two PDFs made at once each post the HTML of their own party', async () => {
    const batch = batchOf({ selected: [{ id: 8, name: 'Burger Barn' }, { id: 9, name: 'Taco Town' }] })
    runtime.props.business = controllerProps('business', { batch, party: { kind: 'business', items: [], selected: null } })
    let release
    const gate = new Promise(resolve => { release = resolve })
    runtime.request = vi.fn(() => gate.then(() => ({ blob: new Blob(['%PDF']), filename: 'x.pdf' })))
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'batch business' }))
    await userEvent.click(screen.getByRole('button', { name: 'Create 2 invoices' }))
    const makePdf = batch.run.mock.calls[0][0]
    const signal = new AbortController().signal
    const invoiceOf = (business) => ({ ...businessInvoice(), business })

    let both
    await act(async () => {
      both = Promise.all([
        makePdf(invoiceOf({ id: 8, name: 'Burger Barn' }), { id: 8, name: 'Burger Barn' }, signal),
        makePdf(invoiceOf({ id: 9, name: 'Taco Town' }), { id: 9, name: 'Taco Town' }, signal)
      ])
    })
    expect(runtime.request).toHaveBeenCalledTimes(2)
    const [first, second] = runtime.request.mock.calls.map(([call]) => call.html)
    expect(first).toContain('Burger Barn')
    expect(first).not.toContain('Taco Town')
    expect(second).toContain('Taco Town')
    expect(second).not.toContain('Burger Barn')
    release()
    await act(async () => { await both })
  })
})

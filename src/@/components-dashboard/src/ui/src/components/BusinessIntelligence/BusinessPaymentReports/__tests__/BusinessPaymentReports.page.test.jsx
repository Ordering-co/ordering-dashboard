/* eslint-disable import/first */
// redesign business-payments FC2 (; D1, D8): the shell of /intelligence/business-payment-reports. The controller of the data
// (`C/components/BusinessPaymentReports`, lote A) is a stand-in that mounts its UIComponent with fixed props. The store side (`StoreReports`,
// lote C1) and the two panels (`InvoicePanel`, `LegacyReportPanel`, lote D) are stand-ins too: what is under test is the page: the header, the two views
// as tabs, the single panel at a time in the SplitView, and the wiring of the controller to this UI.
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({
  collapsed: false,
  collapse: null,
  props: {},
  controllerProps: [],
  store: [],
  general: [],
  invoicePanel: [],
  legacyPanel: [],
  rowIds: [],
  cards: false
}))

vi.mock('../../../../../../index', () => ({
  useSession: () => [{ user: { level: 0 } }],
  useConfig: () => [{ configs: {} }],
  useEvent: () => [{ emit: () => {} }],
  useLanguage: () => [{ dictionary: {}, language: { code: 'en' } }, (_key, text) => text],
  useUtils: () => [{ parseDate: date => String(date), parseTime: time => String(time), parsePrice: value => `$${value}` }]
}))
vi.mock('../../../../../../components/BusinessPaymentReports', async () => {
  const react = await import('react')
  function Controller ({ UIComponent, ...rest }) {
    runtime.controllerProps.push({ ...rest, UIComponent })
    return react.createElement(UIComponent, { ...rest, ...runtime.props })
  }
  return { BusinessPaymentReports: Controller }
})
vi.mock('../StoreReports', async () => {
  const react = await import('react')
  const { InvoiceCardList } = await import('../InvoiceCardList')
  return {
    StoreReports: function StoreReports (props) {
      runtime.store.push(props)
      // redesign under 768 px the invoices are the REAL cards, so the test sees the attributes the focus looks for
      if (runtime.cards) {
        const items = runtime.rowIds.map(id => ({ id, title: `#${id}`, label: `Invoice #${id}`, period: 'period', method: 'method', status: 'status', ordersTotal: '1', charges: '2', transfer: '3' }))
        const labels = { list: 'Payment invoices', ordersTotal: 'Orders total', charges: 'Total charges', transfer: 'Transfer amount' }
        return react.createElement('div', { 'data-testid': 'store-reports', 'data-panel-open': String(Boolean(props.panelOpen)) },
          react.createElement(InvoiceCardList, { items, labels, onOpen: () => {} }))
      }
      return react.createElement('div', { 'data-testid': 'store-reports', 'data-panel-open': String(Boolean(props.panelOpen)) },
        runtime.rowIds.map(id => react.createElement('button', { key: id, type: 'button', 'data-row-id': String(id) }, `row ${id}`)))
    }
  }
})
vi.mock('../GeneralReport', async () => {
  const react = await import('react')
  return {
    GeneralReport: function GeneralReport (props) {
      runtime.general.push(props)
      return react.createElement('div', { 'data-testid': 'general-report' })
    }
  }
})
vi.mock('../InvoicePanel', async () => {
  const react = await import('react')
  return {
    InvoicePanel: function InvoicePanel (props) {
      runtime.invoicePanel.push(props)
      return react.createElement('div', { 'data-testid': 'invoice-panel', 'data-expanded': String(Boolean(props.expanded)) },
        react.createElement('button', { type: 'button', onClick: () => props.onClose() }, 'close invoice'),
        react.createElement('button', { type: 'button', onClick: () => props.onExpandedChange(!props.expanded) }, 'expand invoice'))
    }
  }
})
vi.mock('../LegacyReportPanel', async () => {
  const react = await import('react')
  return {
    LegacyReportPanel: function LegacyReportPanel (props) {
      runtime.legacyPanel.push(props)
      return react.createElement('div', { 'data-testid': 'legacy-panel' },
        react.createElement('button', { type: 'button', onClick: () => props.onClose() }, 'close legacy'))
    }
  }
})
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: runtime.collapsed }, { handleMenuCollapse: (...args) => runtime.collapse(...args) }]
}))

import { BusinessPaymentReports, BusinessPaymentReportsUI } from '../index'

const WIDTH = 1440

// the window is wide: the panel opens beside the list (split) and the list stays visible
const setWindow = (width) => {
  window.innerWidth = width
  window.matchMedia = vi.fn().mockImplementation(query => {
    const min = /min-width:\s*(\d+)px/.exec(query)
    const max = /max-width:\s*(\d+)px/.exec(query)
    const matches = (min ? width >= Number(min[1]) : true) && (max ? width <= Number(max[1]) : true)
    return { matches, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }
  })
}

const uiProps = (extra = {}) => ({
  view: 'business',
  setView: vi.fn(),
  plugin: { checked: true, installed: false },
  business: { selected: null, select: vi.fn(), restoring: false },
  invoices: { loading: false, error: null, items: [], retry: vi.fn() },
  history: { from: null, to: null, preset: null, setPreset: vi.fn(), setRange: vi.fn(), download: vi.fn(), loading: false, error: null },
  legacy: { available: false, tab: 'platform', setTab: vi.fn(), importing: false, importError: null, list: { loading: false, reports: [], error: null, pagination: null }, page: 1, pageSize: 10, setPage: vi.fn(), setPageSize: vi.fn() },
  detail: { invoiceId: null, open: vi.fn(), close: vi.fn() },
  legacyDetail: { reportId: null, open: vi.fn(), close: vi.fn() },
  methods: { loading: false, error: null, items: [], retry: vi.fn() },
  method: null,
  selectMethod: vi.fn(),
  periods: [],
  report: { download: vi.fn(), loadingKey: null, error: null, errorKey: null },
  ...extra
})

const renderPage = () => render(<BusinessPaymentReports />)

const lastStoreProps = () => runtime.store[runtime.store.length - 1]

beforeEach(() => {
  runtime.collapsed = false
  runtime.collapse = vi.fn()
  runtime.props = uiProps()
  runtime.controllerProps = []
  runtime.store = []
  runtime.general = []
  runtime.invoicePanel = []
  runtime.legacyPanel = []
  runtime.rowIds = []
  runtime.cards = false
  setWindow(WIDTH)
})

afterEach(() => {
  delete window.matchMedia
})

describe('BusinessPaymentReports: the wiring of the controller (D1)', () => {
  it('mounts the controller of the data with the UI of this page as its UIComponent', () => {
    renderPage()
    expect(runtime.controllerProps).toHaveLength(1)
    expect(runtime.controllerProps[0].UIComponent).toBe(BusinessPaymentReportsUI)
    expect(BusinessPaymentReportsUI.name).toBe('BusinessPaymentReportsUI')
  })

  it('keeps the same UIComponent on every render, so a re-render never remounts the page', () => {
    const { rerender } = renderPage()
    rerender(<BusinessPaymentReports />)
    expect(new Set(runtime.controllerProps.map(props => props.UIComponent)).size).toBe(1)
  })

  // redesign business-payments integration: the page passes no props and `main` read none, so nothing is forwarded (a spread would be
  // read by the l6-b3 guard of this file as a colour it cannot resolve)
  it('mounts the controller with its UI and nothing else', () => {
    render(<BusinessPaymentReports foo='bar' />)
    expect(Object.keys(runtime.controllerProps[0])).toEqual(['UIComponent'])
  })
})

describe('BusinessPaymentReports: the header and the two views (D1)', () => {
  it('has the h1, what the page does and the two views as tabs, «Reports by business» active', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Payment reports' })).toBeTruthy()
    expect(screen.getByText('What each store is paid per billing period, and the payout files.')).toBeTruthy()
    expect(screen.getByRole('tablist', { name: 'View' })).toBeTruthy()
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map(tab => tab.textContent)).toEqual(['Reports by business', 'General report'])
    expect(screen.getByRole('tab', { name: 'Reports by business' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'General report' }).getAttribute('aria-selected')).toBe('false')
  })

  it('says what the active view does, with the line of main, under the tabs', () => {
    renderPage()
    expect(screen.getByText('View invoices per business')).toBeTruthy()
    expect(screen.queryByText('Download report for all businesses')).toBeNull()
  })

  it('changing the tab asks the controller for the other view', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: 'General report' }))
    expect(runtime.props.setView).toHaveBeenCalledWith('general')
  })

  it('shows the store side in «business» and not the general report', () => {
    renderPage()
    expect(screen.getByTestId('store-reports')).toBeTruthy()
    expect(screen.queryByTestId('general-report')).toBeNull()
  })

  it('shows the general report in «general», with the method, the periods and the report of the controller', () => {
    runtime.props = uiProps({ view: 'general', method: { gateway: 'stripe' }, periods: [{ key: 'a' }] })
    renderPage()
    expect(screen.getByRole('tab', { name: 'General report' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('Download report for all businesses')).toBeTruthy()
    expect(screen.getByTestId('general-report')).toBeTruthy()
    expect(screen.queryByTestId('store-reports')).toBeNull()
    const general = runtime.general[runtime.general.length - 1]
    expect(general.methods).toBe(runtime.props.methods)
    expect(general.method).toBe(runtime.props.method)
    expect(general.selectMethod).toBe(runtime.props.selectMethod)
    expect(general.periods).toBe(runtime.props.periods)
    expect(general.report).toBe(runtime.props.report)
  })

  it('gives the store side the whole state of the controller', () => {
    renderPage()
    const store = lastStoreProps()
    expect(store.business).toBe(runtime.props.business)
    expect(store.invoices).toBe(runtime.props.invoices)
    expect(store.history).toBe(runtime.props.history)
    expect(store.legacy).toBe(runtime.props.legacy)
    expect(store.plugin).toBe(runtime.props.plugin)
  })

  it('has the button of the menu only when the menu is collapsed', async () => {
    const closed = renderPage()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
    closed.unmount()
    runtime.collapsed = true
    renderPage()
    // the opener is PageHeader's `leading`, the first child of the lead block
    const opener = screen.getByRole('button', { name: 'Open menu' })
    expect(opener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(opener)
    await userEvent.click(opener)
    expect(runtime.collapse).toHaveBeenCalledWith(false)
  })
})

describe('BusinessPaymentReports: one panel at a time in the split view (D8)', () => {
  it('without an open document there is no panel at all', () => {
    renderPage()
    expect(screen.queryByTestId('invoice-panel')).toBeNull()
    expect(screen.queryByTestId('legacy-panel')).toBeNull()
    expect(document.querySelector('aside')).toBeNull()
    expect(lastStoreProps().panelOpen).toBe(false)
    expect(screen.getByTestId('store-reports').getAttribute('data-panel-open')).toBe('false')
  })

  it('with detail.invoiceId the InvoicePanel is mounted in the split view, named «Invoice #id»', () => {
    runtime.props = uiProps({ detail: { invoiceId: 42, open: vi.fn(), close: vi.fn() } })
    renderPage()
    const aside = screen.getByRole('complementary', { name: 'Invoice #42' })
    expect(within(aside).getByTestId('invoice-panel')).toBeTruthy()
    expect(screen.queryByTestId('legacy-panel')).toBeNull()
    const panel = runtime.invoicePanel[runtime.invoicePanel.length - 1]
    expect(panel.invoiceId).toBe(42)
    expect(panel.expanded).toBe(false)
    expect(screen.getByTestId('store-reports').getAttribute('data-panel-open')).toBe('true')
  })

  it('closing the invoice panel calls detail.close', async () => {
    runtime.props = uiProps({ detail: { invoiceId: 42, open: vi.fn(), close: vi.fn() } })
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'close invoice' }))
    expect(runtime.props.detail.close).toHaveBeenCalledTimes(1)
    expect(runtime.props.legacyDetail.close).not.toHaveBeenCalled()
  })

  it('Escape closes the open panel through detail.close, as the split view does', async () => {
    runtime.props = uiProps({ detail: { invoiceId: 42, open: vi.fn(), close: vi.fn() } })
    renderPage()
    await userEvent.keyboard('{Escape}')
    expect(runtime.props.detail.close).toHaveBeenCalledTimes(1)
  })

  it('with legacyDetail.reportId the LegacyReportPanel is mounted, named «Legacy Reports», and closing it calls legacyDetail.close', async () => {
    runtime.props = uiProps({ legacyDetail: { reportId: 7, open: vi.fn(), close: vi.fn() } })
    renderPage()
    const aside = screen.getByRole('complementary', { name: 'Legacy Reports' })
    expect(within(aside).getByTestId('legacy-panel')).toBeTruthy()
    expect(screen.queryByTestId('invoice-panel')).toBeNull()
    expect(runtime.legacyPanel[runtime.legacyPanel.length - 1].reportId).toBe(7)
    await userEvent.click(screen.getByRole('button', { name: 'close legacy' }))
    expect(runtime.props.legacyDetail.close).toHaveBeenCalledTimes(1)
    expect(runtime.props.detail.close).not.toHaveBeenCalled()
  })

  it('opening a legacy report with an invoice open closes the invoice first', () => {
    const order = []
    const detail = { invoiceId: 42, open: vi.fn(), close: vi.fn(() => order.push('invoice closed')) }
    const legacyDetail = { reportId: null, open: vi.fn(() => order.push('legacy opened')), close: vi.fn() }
    runtime.props = uiProps({ detail, legacyDetail })
    renderPage()
    // the store side opens the report through what it was given
    lastStoreProps().legacyDetail.open(9)
    expect(order).toEqual(['invoice closed', 'legacy opened'])
    expect(legacyDetail.open).toHaveBeenCalledWith(9)
  })

  it('opening an invoice with a legacy report open closes the report first', () => {
    const order = []
    const detail = { invoiceId: null, open: vi.fn(() => order.push('invoice opened')), close: vi.fn() }
    const legacyDetail = { reportId: 7, open: vi.fn(), close: vi.fn(() => order.push('legacy closed')) }
    runtime.props = uiProps({ detail, legacyDetail })
    renderPage()
    lastStoreProps().detail.open(5)
    expect(order).toEqual(['legacy closed', 'invoice opened'])
    expect(detail.open).toHaveBeenCalledWith(5)
  })

  it('opening an invoice with nothing else open does not close anything else', () => {
    runtime.props = uiProps()
    renderPage()
    lastStoreProps().detail.open(5)
    expect(runtime.props.detail.open).toHaveBeenCalledWith(5)
    expect(runtime.props.legacyDetail.close).not.toHaveBeenCalled()
  })

  it('if the URL brought both documents, the invoice wins and the report is closed (one panel at a time)', async () => {
    runtime.props = uiProps({
      detail: { invoiceId: 42, open: vi.fn(), close: vi.fn() },
      legacyDetail: { reportId: 7, open: vi.fn(), close: vi.fn() }
    })
    renderPage()
    expect(screen.getByTestId('invoice-panel')).toBeTruthy()
    expect(screen.queryByTestId('legacy-panel')).toBeNull()
    await waitFor(() => expect(runtime.props.legacyDetail.close).toHaveBeenCalledTimes(1))
    expect(runtime.props.detail.close).not.toHaveBeenCalled()
  })

  it('«expanded» is local: the panel can ask for it, and it is off again when the panel closes', async () => {
    const detail = { invoiceId: 42, open: vi.fn(), close: vi.fn() }
    runtime.props = uiProps({ detail })
    const { rerender } = renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'expand invoice' }))
    expect(screen.getByTestId('invoice-panel').getAttribute('data-expanded')).toBe('true')
    // closing: the panel goes away (the controller clears the id) and, opened again, it starts not expanded
    runtime.props = uiProps({ detail: { ...detail, invoiceId: null } })
    rerender(<BusinessPaymentReports />)
    expect(screen.queryByTestId('invoice-panel')).toBeNull()
    runtime.props = uiProps({ detail: { ...detail, invoiceId: 43 } })
    rerender(<BusinessPaymentReports />)
    expect(screen.getByTestId('invoice-panel').getAttribute('data-expanded')).toBe('false')
  })

  it('the close of the panel turns «expanded» off before it asks the controller to close', async () => {
    const detail = { invoiceId: 42, open: vi.fn(), close: vi.fn() }
    runtime.props = uiProps({ detail })
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'expand invoice' }))
    expect(screen.getByTestId('invoice-panel').getAttribute('data-expanded')).toBe('true')
    await userEvent.click(screen.getByRole('button', { name: 'close invoice' }))
    expect(detail.close).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('invoice-panel').getAttribute('data-expanded')).toBe('false')
  })
})

// redesign a panel opened from the URL has no opener, so closing it left the focus on <body>. The focus goes to the row of
// that document if it is in the list, else to the list (the table's region).
describe('BusinessPaymentReports: the focus when the panel closes', () => {
  // the controller closes by clearing the id; the stand-in does the same and draws again
  const closing = (key, idKey, id) => {
    const mounted = {}
    const model = { open: vi.fn(), [idKey]: id, close: vi.fn() }
    model.close = vi.fn(() => {
      runtime.props = uiProps()
      mounted.view.rerender(<BusinessPaymentReports />)
    })
    runtime.props = uiProps({ [key]: model })
    mounted.view = renderPage()
    return model
  }

  it('Escape on an invoice that came from the URL leaves the focus on its row', async () => {
    runtime.rowIds = [826, 825]
    const model = closing('detail', 'invoiceId', '826')
    expect(document.querySelector('aside')).not.toBeNull()
    await userEvent.keyboard('{Escape}')
    expect(model.close).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByRole('button', { name: 'row 826' })).toHaveFocus())
  })

  it('the same with the panel expanded', async () => {
    runtime.rowIds = [826]
    closing('detail', 'invoiceId', '826')
    await userEvent.click(screen.getByRole('button', { name: 'expand invoice' }))
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.getByRole('button', { name: 'row 826' })).toHaveFocus())
  })

  it('an invoice that is not in the list leaves the focus in the page, not on <body>', async () => {
    runtime.rowIds = [825]
    closing('detail', 'invoiceId', '826')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(document.activeElement).not.toBe(document.body))
    expect(document.querySelector('.odc-bpr-page').contains(document.activeElement)).toBe(true)
  })

  // at 390 the invoices are cards, not a table: the card carries the same `data-row-id` as the row, and the focus lands on its button
  // (a thing with a name), not on the whole list
  it('Escape on an invoice from the URL, in the phone cards, leaves the focus on the card of that invoice', async () => {
    runtime.cards = true
    runtime.rowIds = [860, 859]
    closing('detail', 'invoiceId', '859')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Invoice #859' })).toHaveFocus())
    expect(document.activeElement.tagName).toBe('BUTTON')
    expect(document.activeElement.closest('ul.odc-bp-cards')).not.toBe(document.activeElement)
  })

  it('Escape on a legacy report from the URL leaves the focus on its row', async () => {
    runtime.rowIds = [501]
    closing('legacyDetail', 'reportId', '501')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.getByRole('button', { name: 'row 501' })).toHaveFocus())
  })

  it('a panel opened from a row keeps the focus where the split view put it: on that row', async () => {
    runtime.rowIds = [826, 825]
    const view = renderPage()
    const row = screen.getByRole('button', { name: 'row 825' })
    row.focus()
    runtime.props = uiProps({ detail: { invoiceId: '825', open: vi.fn(), close: vi.fn() } })
    view.rerender(<BusinessPaymentReports />)
    runtime.props = uiProps()
    view.rerender(<BusinessPaymentReports />)
    await waitFor(() => expect(row).toHaveFocus())
  })
})

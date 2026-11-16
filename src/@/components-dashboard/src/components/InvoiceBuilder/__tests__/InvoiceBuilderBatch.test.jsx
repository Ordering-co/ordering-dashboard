/* eslint-disable import/first */
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// the batch of /intelligence/invoice. Several businesses or drivers, one invoice each, with the form, the orders
// request and the arithmetic of the single invoice, at most 2 at a time, cancellable, and a retry of the failed ones.

const session = vi.hoisted(() => ({ value: null }))
const ordering = vi.hoisted(() => ({ value: null }))
const configState = vi.hoisted(() => ({ value: null }))
const translate = vi.hoisted(() => (key, fallback) => fallback)

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [session.value] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [ordering.value] }))
vi.mock('../../../contexts/ConfigContext', () => ({ useConfig: () => [{ configs: configState.value }] }))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, translate] }))

import { INVOICE_BATCH_CONCURRENCY, INVOICE_BATCH_LIMIT, InvoiceBuilder, MAX_ORDER_PAGES } from '..'
import { CONFIGS, ORDERS, PAYMETHODS_API, ROOT } from '../../../utils/__tests__/fixtures/invoiceOrders'

const BUSINESSES = [{ id: 7, name: 'Pizza Palace' }, { id: 8, name: 'Burger Barn' }, { id: 9, name: 'Taco Town' }]
const DRIVERS = [{ id: 21, name: 'Dana Driver' }, { id: 22, name: 'Eli Rider' }, { id: 23, name: 'Fay Wheels' }]

const state = { ordersAnswer: null, calls: [] }

const okOrders = (result) => ({ content: { error: false, result, pagination: { total: result.length } } })
const partyOf = (where) => where.find(item => item.attribute === 'business_id' || item.attribute === 'driver_id').value
// Each party has its own orders, so a batch that mixed them up would not pass the comparison
const ordersOf = (id) => ORDERS.slice(0, 1 + (id % 3))

const deferred = () => {
  let resolve
  const promise = new Promise((_resolve) => { resolve = _resolve })
  return { promise, resolve }
}

const makeOrdersChain = () => {
  const chain = {
    asDashboard: () => chain,
    where: (where) => {
      chain.recordedWhere = where
      return chain
    },
    get: (options) => {
      const call = { where: chain.recordedWhere, options, cancel: vi.fn() }
      if (options?.cancelToken && typeof options.cancelToken === 'object') options.cancelToken.cancel = call.cancel
      state.calls.push(call)
      return Promise.resolve(state.ordersAnswer(call))
    }
  }
  return chain
}

const makeUsersChain = () => {
  const chain = {
    asDashboard: () => chain,
    select: () => chain,
    where: () => chain,
    get: async () => ({ content: { error: false, result: DRIVERS, pagination: { total: 3 } } })
  }
  return chain
}

const json = (body) => Promise.resolve({ json: async () => body })
const fetchMock = (url) => {
  if (url.includes('/backoffice/businesses')) return json({ error: false, result: BUSINESSES, pagination: { current_page: 1, page_size: 10, total_pages: 1, total: 3 } })
  if (url.endsWith('/paymethods')) return json({ error: false, result: PAYMETHODS_API })
  return json({ error: true, result: ['unexpected url ' + url] })
}

const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0) })
const advance = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const run = (fn) => act(async () => { fn() })

const mount = async (kind = 'business') => {
  const ui = { current: null }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  render(<InvoiceBuilder kind={kind} UIComponent={UIComponent} />)
  await flush()
  await run(() => ui.current.setPeriod('', ''))
  await run(() => ui.current.setField('percentage_fee', '10'))
  await run(() => ui.current.setField('tax', '7'))
  return ui
}

/** The single path: choose each party, wait for its orders, keep its invoice. */
const oneByOne = async (ui, parties) => {
  const invoices = []
  for (const party of parties) {
    await run(() => ui.current.party.select(party))
    await advance(400)
    await flush()
    invoices.push(ui.current.invoice)
  }
  await run(() => ui.current.party.select(null))
  return invoices
}

const pdfMaker = () => vi.fn(async (invoice, party) => ({ blob: new Blob(['%PDF']), filename: `invoice-${party.id}.pdf` }))

const statuses = (ui) => ui.current.batch.items.map(item => [item.id, item.status])

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 20, 12))
  state.calls = []
  state.ordersAnswer = (call) => okOrders(ordersOf(partyOf(call.where)))
  session.value = { token: 'token-1', loading: false, user: { id: 1, level: 0 } }
  ordering.value = { root: ROOT, orders: makeOrdersChain, users: makeUsersChain }
  configState.value = CONFIGS
  vi.stubGlobal('fetch', vi.fn(fetchMock))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe.each([
  ['business', BUSINESSES],
  ['driver', DRIVERS]
])('InvoiceBuilder batch: %s', (kind, parties) => {
  it('three chosen give three PDFs with the same invoices as one by one', async () => {
    const ui = await mount(kind)
    const single = await oneByOne(ui, parties)
    expect(single.every(invoice => invoice?.orders?.length > 0)).toBe(true)

    state.calls = []
    await run(() => ui.current.batch.selectAll(parties))
    expect(ui.current.batch.selected).toEqual(parties)
    const makePdf = pdfMaker()
    await run(() => ui.current.batch.run(makePdf))
    await flush()

    expect(statuses(ui)).toEqual(parties.map(party => [party.id, 'done']))
    expect(ui.current.batch.items.map(item => item.invoice)).toEqual(single)
    expect(makePdf.mock.calls.map(([invoice, party]) => [invoice, party])).toEqual(single.map((invoice, i) => [invoice, parties[i]]))
    expect(ui.current.batch.items.map(item => item.pdf.filename)).toEqual(parties.map(party => `invoice-${party.id}.pdf`))
    // the same where as the single path: one request per party
    expect(state.calls.map(call => partyOf(call.where))).toEqual(parties.map(party => party.id))
    expect(ui.current.batch.running).toBe(false)
  })

  it('a party with no orders in the period is «empty» and no PDF is made for it', async () => {
    state.ordersAnswer = (call) => okOrders(partyOf(call.where) === parties[1].id ? [] : ordersOf(partyOf(call.where)))
    const ui = await mount(kind)
    await run(() => ui.current.batch.selectAll(parties))
    const makePdf = pdfMaker()
    await run(() => ui.current.batch.run(makePdf))
    await flush()
    expect(statuses(ui)).toEqual([[parties[0].id, 'done'], [parties[1].id, 'empty'], [parties[2].id, 'done']])
    expect(makePdf).toHaveBeenCalledTimes(2)
    expect(ui.current.batch.items[1].pdf).toBeNull()
  })

  it('one that fails lets the others finish, keeps its reason and can be retried alone', async () => {
    let failing = true
    state.ordersAnswer = (call) => (failing && partyOf(call.where) === parties[1].id)
      ? { content: { error: true, result: ['The server is busy'] } }
      : okOrders(ordersOf(partyOf(call.where)))
    const ui = await mount(kind)
    await run(() => ui.current.batch.selectAll(parties))
    const makePdf = pdfMaker()
    await run(() => ui.current.batch.run(makePdf))
    await flush()
    expect(statuses(ui)).toEqual([[parties[0].id, 'done'], [parties[1].id, 'error'], [parties[2].id, 'done']])
    expect(ui.current.batch.items[1].error).toEqual(['The server is busy'])

    failing = false
    state.calls = []
    makePdf.mockClear()
    await run(() => ui.current.batch.retry(makePdf))
    await flush()
    expect(state.calls.map(call => partyOf(call.where))).toEqual([parties[1].id])
    expect(makePdf).toHaveBeenCalledTimes(1)
    expect(statuses(ui)).toEqual(parties.map(party => [party.id, 'done']))
  })

  it('a PDF that fails is an error of that party too', async () => {
    const ui = await mount(kind)
    await run(() => ui.current.batch.selectAll(parties))
    const makePdf = vi.fn(async (invoice, party) => {
      if (party.id === parties[2].id) throw new Error('Download failed')
      return { blob: new Blob(['%PDF']), filename: 'x.pdf' }
    })
    await run(() => ui.current.batch.run(makePdf))
    await flush()
    expect(statuses(ui)).toEqual([[parties[0].id, 'done'], [parties[1].id, 'done'], [parties[2].id, 'error']])
    expect(ui.current.batch.items[2].error).toEqual([new Error('Download failed')])
  })
})

describe('InvoiceBuilder batch: requests and cancel', () => {
  it(`asks at most ${INVOICE_BATCH_CONCURRENCY} at a time and the progress is per party`, async () => {
    const answers = []
    state.ordersAnswer = (call) => {
      const next = deferred()
      answers.push({ call, next })
      return next.promise
    }
    const ui = await mount()
    await run(() => ui.current.batch.selectAll(BUSINESSES))
    const makePdf = pdfMaker()
    await run(() => ui.current.batch.run(makePdf))
    await flush()
    expect(INVOICE_BATCH_CONCURRENCY).toBe(2)
    expect(answers).toHaveLength(2)
    expect(statuses(ui)).toEqual([[7, 'running'], [8, 'running'], [9, 'queued']])
    expect(ui.current.batch.running).toBe(true)

    await act(async () => answers[0].next.resolve(okOrders(ordersOf(7))))
    await flush()
    expect(answers).toHaveLength(3)
    expect(statuses(ui)).toEqual([[7, 'done'], [8, 'running'], [9, 'running']])
    await act(async () => {
      answers[1].next.resolve(okOrders(ordersOf(8)))
      answers[2].next.resolve(okOrders(ordersOf(9)))
    })
    await flush()
    expect(statuses(ui)).toEqual([[7, 'done'], [8, 'done'], [9, 'done']])
    expect(ui.current.batch.running).toBe(false)
  })

  it('cancel stops the ones in flight and the ones waiting; retry takes them up again', async () => {
    const answers = []
    state.ordersAnswer = (call) => {
      const next = deferred()
      answers.push({ call, next })
      return next.promise
    }
    const ui = await mount()
    await run(() => ui.current.batch.selectAll(BUSINESSES))
    const makePdf = pdfMaker()
    await run(() => ui.current.batch.run(makePdf))
    await flush()
    await act(async () => answers[0].next.resolve(okOrders(ordersOf(7))))
    await flush()
    await run(() => ui.current.batch.cancel())
    await flush()
    expect(answers[1].call.cancel).toHaveBeenCalled()
    expect(answers[2].call.cancel).toHaveBeenCalled()
    // a late answer of a cancelled request changes nothing
    await act(async () => answers[1].next.resolve(okOrders(ordersOf(8))))
    await flush()
    expect(statuses(ui)).toEqual([[7, 'done'], [8, 'cancelled'], [9, 'cancelled']])
    expect(ui.current.batch.running).toBe(false)
    expect(makePdf).toHaveBeenCalledTimes(1)

    state.ordersAnswer = (call) => okOrders(ordersOf(partyOf(call.where)))
    await run(() => ui.current.batch.retry(makePdf))
    await flush()
    expect(statuses(ui)).toEqual([[7, 'done'], [8, 'done'], [9, 'done']])
    expect(makePdf).toHaveBeenCalledTimes(3)
  })

  it('cancel while a PDF is being made aborts it through the signal', async () => {
    const ui = await mount()
    await run(() => ui.current.batch.selectAll([BUSINESSES[0]]))
    let signal
    const makePdf = vi.fn((invoice, party, given) => {
      signal = given
      return new Promise((resolve, reject) => given.addEventListener('abort', () => reject(new Error('aborted'))))
    })
    await run(() => ui.current.batch.run(makePdf))
    await flush()
    expect(statuses(ui)).toEqual([[7, 'running']])
    await run(() => ui.current.batch.cancel())
    await flush()
    expect(signal.aborted).toBe(true)
    expect(statuses(ui)).toEqual([[7, 'cancelled']])
  })

  it(`the selection takes at most ${INVOICE_BATCH_LIMIT}; toggle and clear change it`, async () => {
    const many = Array.from({ length: INVOICE_BATCH_LIMIT + 5 }, (_, i) => ({ id: 100 + i, name: `Store ${i}` }))
    const ui = await mount()
    expect(INVOICE_BATCH_LIMIT).toBe(50)
    await run(() => ui.current.batch.selectAll(many))
    expect(ui.current.batch.selected).toHaveLength(INVOICE_BATCH_LIMIT)
    await run(() => ui.current.batch.toggle(many[INVOICE_BATCH_LIMIT + 1], true))
    expect(ui.current.batch.selected).toHaveLength(INVOICE_BATCH_LIMIT)
    await run(() => ui.current.batch.toggle(many[0], false))
    expect(ui.current.batch.selected.map(party => party.id)).not.toContain(100)
    await run(() => ui.current.batch.clear())
    expect(ui.current.batch.selected).toEqual([])
  })

  it('with no order type checked the batch is blocked and asks nothing', async () => {
    const ui = await mount()
    await run(() => ui.current.orderTypes.setAll(false))
    await run(() => ui.current.batch.selectAll(BUSINESSES))
    expect(ui.current.batch.blocked).toBe('no_order_types')
    await run(() => ui.current.batch.run(pdfMaker()))
    await flush()
    expect(state.calls).toHaveLength(0)
    expect(ui.current.batch.items).toEqual([])
  })
})

// review: one GET /orders read only the first page, so an invoice with more orders than the page size came out short
// (only «truncated» said so). Both flows now read every page; the first request is the one of today, the next ones add `page`.
const pageOf = (call) => call.options?.query?.page ?? 1
const paged = (rows, pageSize) => (call) => {
  const page = pageOf(call)
  return {
    content: {
      error: false,
      result: rows.slice((page - 1) * pageSize, page * pageSize),
      pagination: { current_page: page, page_size: pageSize, total: rows.length, total_pages: Math.ceil(rows.length / pageSize) }
    }
  }
}

describe('InvoiceBuilder: GET /orders by pages', () => {
  it('the single invoice and the batch read the 3 pages and get the invoice of all the orders, with no «truncated»', async () => {
    const ui = await mount()
    state.ordersAnswer = () => okOrders(ORDERS)
    await run(() => ui.current.party.select(BUSINESSES[0]))
    await advance(400)
    await flush()
    const whole = ui.current.invoice
    expect(whole.orders.length).toBeGreaterThan(4)

    state.ordersAnswer = paged(ORDERS, 4)
    state.calls = []
    await run(() => ui.current.orders.retry())
    await flush()
    expect(state.calls.map(call => call.options)).toEqual([
      { cancelToken: expect.any(Object) },
      { cancelToken: expect.any(Object), query: { page: 2 } },
      { cancelToken: expect.any(Object), query: { page: 3 } }
    ])
    expect(ui.current.invoice).toEqual(whole)
    expect(ui.current.orders.truncated).toBeNull()

    state.calls = []
    await run(() => ui.current.batch.selectAll([BUSINESSES[0]]))
    await run(() => ui.current.batch.run(pdfMaker()))
    await flush()
    expect(state.calls.map(pageOf)).toEqual([1, 2, 3])
    expect(ui.current.batch.items[0]).toMatchObject({ status: 'done', invoice: whole, truncated: null })
  })

  it('cancelling the batch while a page is in flight asks no next page', async () => {
    const answers = []
    const answer = paged(ORDERS, 4)
    state.ordersAnswer = (call) => {
      if (pageOf(call) === 1) return answer(call)
      const next = deferred()
      answers.push({ call, next })
      return next.promise
    }
    const ui = await mount()
    await run(() => ui.current.batch.selectAll([BUSINESSES[0]]))
    await run(() => ui.current.batch.run(pdfMaker()))
    await flush()
    expect(state.calls.map(pageOf)).toEqual([1, 2])
    await run(() => ui.current.batch.cancel())
    expect(answers[0].call.cancel).toHaveBeenCalled()
    await act(async () => answers[0].next.resolve(answer(answers[0].call)))
    await flush()
    expect(state.calls.map(pageOf)).toEqual([1, 2])
    expect(statuses(ui)).toEqual([[7, 'cancelled']])
  })

  it('a single invoice whose party changes while a page is in flight asks no next page for the old party', async () => {
    const answers = []
    const answer = paged(ORDERS, 4)
    state.ordersAnswer = (call) => {
      if (pageOf(call) === 1 || partyOf(call.where) !== BUSINESSES[0].id) return answer(call)
      const next = deferred()
      answers.push({ call, next })
      return next.promise
    }
    const ui = await mount()
    await run(() => ui.current.party.select(BUSINESSES[0]))
    await advance(400)
    await flush()
    await run(() => ui.current.party.select(BUSINESSES[1]))
    await advance(400)
    await flush()
    await act(async () => answers[0].next.resolve(answer(answers[0].call)))
    await flush()
    const old = state.calls.filter(call => partyOf(call.where) === BUSINESSES[0].id)
    expect(old.map(pageOf)).toEqual([1, 2])
    expect(ui.current.invoice.business).toEqual(BUSINESSES[1])
  })

  it(`stops at ${MAX_ORDER_PAGES} pages and says the invoice is incomplete`, async () => {
    const rows = Array.from({ length: MAX_ORDER_PAGES + 10 }, (_, i) => ({ ...ORDERS[0], id: 5000 + i }))
    state.ordersAnswer = paged(rows, 1)
    const ui = await mount()
    expect(MAX_ORDER_PAGES).toBe(50)
    await run(() => ui.current.party.select(BUSINESSES[0]))
    await advance(400)
    await flush()
    expect(state.calls).toHaveLength(MAX_ORDER_PAGES)
    expect(ui.current.orders.truncated).toEqual({ received: MAX_ORDER_PAGES, total: MAX_ORDER_PAGES + 10 })
  })

  it('an error on a later page is an error of the invoice, not a short invoice', async () => {
    const answer = paged(ORDERS, 4)
    state.ordersAnswer = (call) => pageOf(call) === 2 ? { content: { error: true, result: ['The server is busy'] } } : answer(call)
    const ui = await mount()
    await run(() => ui.current.batch.selectAll([BUSINESSES[0]]))
    await run(() => ui.current.batch.run(pdfMaker()))
    await flush()
    expect(ui.current.batch.items[0]).toMatchObject({ status: 'error', error: ['The server is busy'] })
    await run(() => ui.current.party.select(BUSINESSES[0]))
    await advance(400)
    await flush()
    expect(ui.current.orders).toMatchObject({ status: 'error', error: ['The server is busy'] })
  })
})

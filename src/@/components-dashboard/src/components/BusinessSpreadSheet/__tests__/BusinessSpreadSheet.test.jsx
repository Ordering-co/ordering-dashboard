/* eslint-disable import/first */
// redesign D-9 (owner, 2026-10-19): the products spreadsheet asks before it deletes. Removing saved rows (the
// context-menu «Remove row» or emptying name, price and description) is held back: nothing is deleted until
// `confirmRemoval()`, `cancelRemoval()` deletes nothing and restores the grid, and rows that were never saved go at once.
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  session: { token: 'token', loading: false },
  ordering: { root: 'https://api.test' },
  fetch: null,
  get: null
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [mocks.session] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [mocks.ordering] }))
vi.mock('../../../contexts/ToastContext', () => ({
  ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' },
  useToast: () => [null, { showToast: mocks.showToast }]
}))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [null, (_key, fallback) => fallback] }))
vi.mock('../../../contexts/UtilsContext', () => ({ useUtils: () => [{ parsePrice: (value) => `$${value}` }] }))

import { BusinessSpreadSheet } from '..'

const json = (body) => ({ json: async () => body })

const BURGER = { id: 5, name: 'Burger', description: 'Beef', price: 9.5 }
const FRIES = { id: 6, name: 'Fries', description: '', price: 3 }
const BUSINESS = { id: 1, tax: 7, tax_type: 1, service_fee: 5, categories: [{ id: 3, name: 'Mains' }] }

const deleteCalls = () => mocks.fetch.mock.calls.filter(([, options]) => options?.method === 'DELETE')

// A stand-in for the Handsontable instance: `rows` is the source data, `alter` plays the removal
const createHot = (rows, onAlter) => ({
  getSourceDataAtRow: vi.fn((row) => rows[row]),
  validateRows: vi.fn(),
  alter: vi.fn((...args) => onAlter?.(...args))
})

const renderSheet = async () => {
  const ui = { current: null }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  render(
    <BusinessSpreadSheet
      UIComponent={UIComponent}
      business={BUSINESS}
      categoryId={3}
      categoryState={{ products: [BURGER, FRIES] }}
    />
  )
  await waitFor(() => expect(ui.current.spreadSheetState.products).toHaveLength(2))
  return ui
}

describe('BusinessSpreadSheet (D-9 confirm before deleting)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetch = vi.fn(async () => json({ error: false, result: {} }))
    vi.stubGlobal('fetch', mocks.fetch)
    const query = { products: () => query, parameters: () => query, get: mocks.get }
    mocks.get = vi.fn(async () => ({ content: { error: false, result: [BURGER, FRIES] } }))
    query.get = (...args) => mocks.get(...args)
    mocks.ordering.businesses = () => ({ categories: () => query })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('removing saved rows deletes nothing and returns false so the grid keeps them, until confirmed', async () => {
    const ui = await renderSheet()
    const hot = createHot([BURGER, FRIES])
    let outcome
    act(() => { outcome = ui.current.handleRowRemove(0, 2, [0, 1], hot) })
    expect(outcome).toBe(false)
    expect(ui.current.pendingRemoval).toEqual({ ids: [5, 6], count: 2, names: ['Burger', 'Fries'] })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(deleteCalls()).toHaveLength(0)

    await act(async () => { await ui.current.confirmRemoval() })
    const [[url, options]] = deleteCalls()
    expect(url).toBe('https://api.test/bulks/products')
    expect(JSON.parse(options.body)).toEqual({ products: '[5,6]' })
    expect(ui.current.pendingRemoval).toBe(null)
    expect(mocks.get).toHaveBeenCalled() // the grid reloads as today
  })

  it('cancelling deletes nothing and restores the grid from the server', async () => {
    const ui = await renderSheet()
    const emptied = { id: 5, name: '', description: '', price: '' } // what the grid holds after the user emptied the row
    const hot = createHot([emptied])
    act(() => { ui.current.handleRowRemove(0, 1, [0], hot) })
    expect(ui.current.pendingRemoval).toEqual({ ids: [5], count: 1, names: ['Burger'] }) // the name comes from the saved product
    expect(mocks.get).not.toHaveBeenCalled()

    await act(async () => { await ui.current.cancelRemoval() })
    expect(ui.current.pendingRemoval).toBe(null)
    expect(deleteCalls()).toHaveLength(0)
    expect(mocks.get).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(ui.current.spreadSheetState.products.map(product => product.name)).toEqual(['Burger', 'Fries']))
  })

  // Handsontable 9 runs `beforeRemoveRow` once per block of `alter('remove_row', [[row, amount], ...])`
  const playAlter = (getUi, getHot, outcomes) => (action, index, amount) => {
    if (action !== 'remove_row') return
    const blocks = Array.isArray(index) ? index : [[index, amount]]
    for (const [row, count] of blocks) {
      const dataRows = Array.from({ length: count }, (_, i) => row + i)
      outcomes.push(getUi().handleRowRemove(row, count, dataRows, getHot()))
    }
  }

  it('emptying name, price and description of a saved row asks instead of removing it', async () => {
    const ui = await renderSheet()
    const emptied = { id: 5, name: '', description: '', price: '' }
    const outcomes = []
    const hot = createHot([emptied], playAlter(() => ui.current, () => hot, outcomes))
    act(() => { ui.current.handleItemChange([[0, 'name', 'Burger', '']], 'edit', hot) })
    expect(hot.alter).toHaveBeenCalledWith('remove_row', [[0, 1]])
    expect(outcomes).toEqual([false])
    expect(ui.current.pendingRemoval).toMatchObject({ ids: [5], count: 1 })
    expect(deleteCalls()).toHaveLength(0)
  })

  it('emptied rows 2 and 5 remove exactly those rows, not the contiguous ones after the first', async () => {
    const ui = await renderSheet()
    const filler = (index) => ({ id: 100 + index, name: `Filler ${index}`, description: '', price: 1 })
    const rows = [filler(0), filler(1), { id: 5, name: '', description: '', price: '' }, filler(3), filler(4), { id: 6, name: '', description: '', price: '' }]
    const outcomes = []
    const hot = createHot(rows, playAlter(() => ui.current, () => hot, outcomes))
    act(() => {
      ui.current.handleItemChange([[2, 'name', 'Burger', ''], [5, 'name', 'Fries', '']], 'edit', hot)
    })
    expect(hot.alter).toHaveBeenCalledTimes(1)
    expect(hot.alter).toHaveBeenCalledWith('remove_row', [[2, 1], [5, 1]])
    expect(outcomes).toEqual([false, false])
    expect(ui.current.pendingRemoval).toEqual({ ids: [5, 6], count: 2, names: ['Burger', 'Fries'] })
    expect(deleteCalls()).toHaveLength(0)
  })

  it('emptied rows given out of order are removed by sorted unique indexes', async () => {
    const ui = await renderSheet()
    const rows = [{ id: 5, name: '', description: '', price: '' }, { id: 7, name: 'Other', price: 1 }, { id: 6, name: '', description: '', price: '' }]
    const hot = createHot(rows)
    act(() => {
      ui.current.handleItemChange([[2, 'name', 'Fries', ''], [0, 'name', 'Burger', '']], 'edit', hot)
    })
    expect(hot.alter).toHaveBeenCalledWith('remove_row', [[0, 1], [2, 1]])
  })

  it('a removal that arrives in several blocks (Cmd/Ctrl multi-selection) is kept whole, not just its last block', async () => {
    const ui = await renderSheet()
    const rows = [BURGER, { id: 7, name: 'Other', price: 1 }, { id: 8, name: 'More', price: 2 }, FRIES]
    const hot = createHot(rows)
    act(() => {
      expect(ui.current.handleRowRemove(0, 1, [0], hot)).toBe(false)
      expect(ui.current.handleRowRemove(3, 1, [3], hot)).toBe(false)
    })
    expect(ui.current.pendingRemoval).toEqual({ ids: [5, 6], count: 2, names: ['Burger', 'Fries'] })

    await act(async () => { await ui.current.confirmRemoval() })
    const [[, options]] = deleteCalls()
    expect(JSON.parse(options.body)).toEqual({ products: '[5,6]' })
    expect(ui.current.pendingRemoval).toBe(null)
  })

  it('the same row reported twice is counted once, and a removal after a cancel starts fresh', async () => {
    const ui = await renderSheet()
    const hot = createHot([BURGER, FRIES])
    act(() => {
      ui.current.handleRowRemove(0, 1, [0], hot)
      ui.current.handleRowRemove(0, 1, [0], hot)
    })
    expect(ui.current.pendingRemoval).toEqual({ ids: [5], count: 1, names: ['Burger'] })

    await act(async () => { await ui.current.cancelRemoval() })
    expect(ui.current.pendingRemoval).toBe(null)
    act(() => { ui.current.handleRowRemove(1, 1, [1], hot) })
    expect(ui.current.pendingRemoval).toEqual({ ids: [6], count: 1, names: ['Fries'] })
  })

  it('rows that were never saved are removed at once, with no question', async () => {
    const ui = await renderSheet()
    const hot = createHot([{ name: '', description: '', price: '' }])
    let outcome
    act(() => { outcome = ui.current.handleRowRemove(0, 1, [0], hot) })
    expect(outcome).not.toBe(false)
    expect(ui.current.pendingRemoval).toBe(null)
  })

  it('a failed delete keeps the grid in step with the server', async () => {
    mocks.fetch.mockImplementation(async (_url, options) => json(options?.method === 'DELETE' ? { error: true, result: ['No'] } : { error: false, result: {} }))
    const ui = await renderSheet()
    act(() => { ui.current.handleRowRemove(0, 1, [0], createHot([BURGER])) })
    await act(async () => { await ui.current.confirmRemoval() })
    expect(ui.current.pendingRemoval).toBe(null)
    expect(mocks.get).toHaveBeenCalledTimes(1)
  })
})

// bugs E D15: no category selected must not crash the reload, and the price error needs a text of its own
describe('BusinessSpreadSheet (D15 no category, price text)', () => {
  const renderWithoutCategory = async () => {
    const ui = { current: null }
    const UIComponent = (uiProps) => {
      ui.current = uiProps
      return null
    }
    render(<BusinessSpreadSheet UIComponent={UIComponent} business={BUSINESS} categoryState={{ products: [BURGER] }} />)
    await waitFor(() => expect(ui.current.spreadSheetState.products).toHaveLength(1))
    return ui
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetch = vi.fn(async () => json({ error: false, result: {} }))
    vi.stubGlobal('fetch', mocks.fetch)
    const query = { products: () => query, parameters: () => query, get: (...args) => mocks.get(...args) }
    mocks.get = vi.fn(async () => ({ content: { error: false, result: [BURGER] } }))
    mocks.ordering.businesses = () => ({ categories: () => query })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reloading with no category sends no request and raises no error', async () => {
    const ui = await renderWithoutCategory()
    await act(async () => { await ui.current.cancelRemoval() })
    expect(mocks.get).not.toHaveBeenCalled()
    expect(ui.current.spreadSheetState.result?.error).toBeFalsy()
  })

  it('a price that is not a number says so with a visible default text', async () => {
    const ui = await renderSheet()
    const hot = createHot([{ name: 'Soda', price: 'abc', description: '' }])
    act(() => { ui.current.handleItemChange([[0, 'price', '', 'abc']], 'edit', hot) })
    expect(ui.current.spreadSheetState.result.result).toEqual(['The price must be a number'])
  })
})

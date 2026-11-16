/* eslint-disable import/first */
// redesign SP-F3 (C): the controller of a product row. `editProduct` (the Enabled switch and the image), the save of the thumbnail
// and the drop of a drag now RETURN `{ ok, error, result }` so the row can say why a save failed, and a successful save also updates
// `categoryState` (`handleUpdateCategoryState`): the table, the editor header and the card read the product from there. In `main` only
// `businessState` was updated, so the Enable label and the thumbnail of the row could stay old (inventory 6).
import React from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  response: null, // { error, result } the API answers
  throws: null,
  gate: null,
  saves: [],
  loading: false
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [{ loading: mockState.loading }] }))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{
    businesses: () => ({
      categories: () => ({
        products: () => ({
          save: async (params) => {
            mockState.saves.push(params)
            if (mockState.gate) await mockState.gate
            if (mockState.throws) throw mockState.throws
            return { content: mockState.response }
          }
        })
      })
    })
  }]
}))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, (_key, text) => text] }))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: () => {} }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))

import { SingleBusinessProduct } from '../index'

const PRODUCT = { id: 5, category_id: 3, name: 'Burger', description: 'Beef', price: 9, enabled: true, rank: 1, images: 'old.png' }
const OTHER = { id: 6, category_id: 3, name: 'Fries', price: 3, enabled: true, rank: 2 }
const BUSINESS = { id: 1, categories: [{ id: 3, products: [PRODUCT, OTHER] }] }

let latest
const UI = (props) => {
  latest = props
  return null
}

const draw = (props = {}) => render(
  <SingleBusinessProduct
    UIComponent={UI}
    business={BUSINESS}
    category={{ id: 3, products: [PRODUCT, OTHER] }}
    product={PRODUCT}
    handleUpdateBusinessState={vi.fn()}
    handleUpdateCategoryState={vi.fn()}
    setDataSelected={vi.fn()}
    {...props}
  />
)

beforeEach(() => {
  latest = null
  mockState.response = { error: false, result: { id: 5, enabled: false } }
  mockState.throws = null
  mockState.gate = null
  mockState.saves = []
  mockState.loading = false
})

describe('SingleBusinessProduct controller — the Enabled switch', () => {
  it('returns { ok: true, result } and updates categoryState with the product that changed', async () => {
    const handleUpdateCategoryState = vi.fn()
    const handleUpdateBusinessState = vi.fn()
    draw({ handleUpdateCategoryState, handleUpdateBusinessState })
    let outcome
    await act(async () => { outcome = await latest.handleChangeProductActive(false) })
    expect(mockState.saves).toEqual([{ enabled: false }])
    expect(outcome).toEqual({ ok: true, result: { id: 5, enabled: false } })
    expect(handleUpdateBusinessState).toHaveBeenCalledTimes(1)
    expect(handleUpdateCategoryState).toHaveBeenCalledTimes(1)
    const next = handleUpdateCategoryState.mock.calls[0][0]
    expect(next.id).toBe(3)
    expect(next.products.find(item => item.id === 5)).toMatchObject({ id: 5, name: 'Burger', enabled: false })
    expect(next.products.find(item => item.id === 6)).toEqual(OTHER)
  })

  it('works with a consumer that gives no handleUpdateCategoryState', async () => {
    draw({ handleUpdateCategoryState: undefined })
    let outcome
    await act(async () => { outcome = await latest.handleChangeProductActive(false) })
    expect(outcome.ok).toBe(true)
  })

  it('returns { ok: false, error } when the API refuses, and leaves categoryState alone', async () => {
    mockState.response = { error: true, result: ['Product name is invalid'] }
    const handleUpdateCategoryState = vi.fn()
    const handleUpdateBusinessState = vi.fn()
    draw({ handleUpdateCategoryState, handleUpdateBusinessState })
    let outcome
    await act(async () => { outcome = await latest.handleChangeProductActive(false) })
    expect(outcome).toEqual({ ok: false, error: ['Product name is invalid'] })
    expect(handleUpdateCategoryState).not.toHaveBeenCalled()
    expect(handleUpdateBusinessState).not.toHaveBeenCalled()
    expect(latest.productFormState.result).toEqual({ error: true, result: ['Product name is invalid'] })
  })

  it('returns { ok: false, error } when the request throws', async () => {
    const failure = new Error('Network down')
    mockState.throws = failure
    draw()
    let outcome
    await act(async () => { outcome = await latest.handleChangeProductActive(false) })
    expect(outcome).toEqual({ ok: false, error: failure })
  })

  it('is not ready while the session loads: { ok: false } and no request', async () => {
    mockState.loading = true
    draw()
    let outcome
    await act(async () => { outcome = await latest.handleChangeProductActive(false) })
    expect(outcome.ok).toBe(false)
    expect(mockState.saves).toEqual([])
  })

  it('builds the next categoryState from the LATEST one, so a save that was slower does not undo another row', async () => {
    let release
    mockState.gate = new Promise(resolve => { release = resolve })
    const handleUpdateCategoryState = vi.fn()
    const view = draw({ handleUpdateCategoryState })
    let pending
    await act(async () => { pending = latest.handleChangeProductActive(false) })
    // meanwhile another row saved: the page now holds a categoryState where Fries is disabled
    view.rerender(
      <SingleBusinessProduct
        UIComponent={UI}
        business={BUSINESS}
        category={{ id: 3, products: [PRODUCT, { ...OTHER, enabled: false }] }}
        product={PRODUCT}
        handleUpdateBusinessState={vi.fn()}
        handleUpdateCategoryState={handleUpdateCategoryState}
        setDataSelected={vi.fn()}
      />
    )
    await act(async () => {
      release()
      await pending
    })
    const next = handleUpdateCategoryState.mock.calls[0][0]
    expect(next.products.find(item => item.id === 6).enabled).toBe(false)
    expect(next.products.find(item => item.id === 5).enabled).toBe(false)
  })
})

describe('SingleBusinessProduct controller — the image of the thumbnail', () => {
  it('handleUpdateClick returns the outcome of the save', async () => {
    mockState.response = { error: false, result: { id: 5, images: 'new.png' } }
    const handleUpdateCategoryState = vi.fn()
    draw({ handleUpdateCategoryState })
    await act(async () => {}) // the effect that fills `changes` from the product
    let outcome
    await act(async () => { outcome = await latest.handleUpdateClick() })
    expect(outcome.ok).toBe(true)
    const saved = handleUpdateCategoryState.mock.calls[0][0].products.find(item => item.id === 5)
    expect(saved.images).toBe('new.png') // what the API answered wins over what was sent
    expect(saved.name).toBe('Burger') // a field that was sent as undefined does not wipe the stored one
  })

  it('a refused image goes back to the stored one and stops asking to be saved', async () => {
    mockState.response = { error: true, result: ['Image is too large'] }
    draw()
    await act(async () => {}) // the effect that fills `changes` from the product
    const file = new File(['x'], 'photo.png', { type: 'image/png' })
    await act(async () => {
      latest.handlechangeImage(file)
      await new Promise(resolve => setTimeout(resolve, 20)) // FileReader
    })
    expect(latest.productFormState.changes.images).toMatch(/^data:/)
    expect(latest.isEditMode).toBe(true)
    let outcome
    await act(async () => { outcome = await latest.handleUpdateClick() })
    expect(outcome).toEqual({ ok: false, error: ['Image is too large'] })
    expect(latest.productFormState.changes.images).toBe('old.png')
    expect(latest.isEditMode).toBe(false)
  })
})

// J2 row 12 (stores-products P-10, D-56 d): the thumbnail is saved when the file is chosen, not with the next click outside the row
describe('SingleBusinessProduct controller — the thumbnail saves when it is chosen', () => {
  it('handleSaveImage sends only the image, at once, and returns the outcome', async () => {
    mockState.response = { error: false, result: { id: 5, images: 'stored.png' } }
    const handleUpdateCategoryState = vi.fn()
    draw({ handleUpdateCategoryState })
    await act(async () => {})
    const file = new File(['x'], 'photo.png', { type: 'image/png' })
    let outcome
    await act(async () => { outcome = await latest.handleSaveImage(file) })
    expect(mockState.saves).toHaveLength(1)
    expect(Object.keys(mockState.saves[0])).toEqual(['images'])
    expect(mockState.saves[0].images).toMatch(/^data:image\/png/)
    expect(outcome.ok).toBe(true)
    expect(handleUpdateCategoryState.mock.calls[0][0].products.find(item => item.id === 5).images).toBe('stored.png')
    expect(latest.isEditMode).toBe(false) // nothing waits for a click outside
  })

  it('a refused image says why and goes back to the stored one', async () => {
    mockState.response = { error: true, result: ['Image is too large'] }
    draw()
    await act(async () => {})
    let outcome
    await act(async () => { outcome = await latest.handleSaveImage(new File(['x'], 'photo.png', { type: 'image/png' })) })
    expect(outcome).toEqual({ ok: false, error: ['Image is too large'] })
    expect(latest.productFormState.changes.images).toBe('old.png')
  })
})

describe('SingleBusinessProduct controller — dropping a dragged product', () => {
  const dropEvent = (data) => ({
    preventDefault: () => {},
    dataTransfer: { getData: () => data }
  })

  it('handleDrop returns the outcome of the rank change', async () => {
    mockState.response = { error: false, result: { id: 6, rank: 1 } }
    draw()
    let outcome
    await act(async () => { outcome = await latest.handleDrop(dropEvent(JSON.stringify(OTHER))) })
    expect(mockState.saves).toEqual([{ rank: 1 }])
    expect(outcome.ok).toBe(true)
  })

  it('handleDrop reports a refused rank change', async () => {
    mockState.response = { error: true, result: ['Not allowed'] }
    draw()
    let outcome
    await act(async () => { outcome = await latest.handleDrop(dropEvent(JSON.stringify(OTHER))) })
    expect(outcome).toEqual({ ok: false, error: ['Not allowed'] })
  })

  it('ignores a drop that is not a product (a file or some text dragged over the row)', async () => {
    draw()
    let outcome
    await act(async () => { outcome = await latest.handleDrop(dropEvent('')) })
    expect(outcome).toBeUndefined()
    expect(mockState.saves).toEqual([])
  })
})

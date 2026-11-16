/* eslint-disable import/first */
// redesign SP-FB: the SingleBusinessCategory controller RETURNS what a caller needs to react to a save: `{ ok: true, result }`
// or `{ ok: false, error }` from handelChangeCategoryActive (and handleUpdateClick, through editCategory). Before this change both
// returned nothing, so the switch of the tree could not tell a failed save from a good one. A failed save leaves `categoryFormState.result`
// as it always did, and the controller adds no toast of its own for the failure.
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  response: null,
  throws: null,
  saves: [],
  toasts: [],
  session: { loading: false }
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [mockState.session] }))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [{ dictionary: {} }, (_key, text) => text] }))
vi.mock('../../../contexts/ToastContext', () => ({
  ToastType: { Info: 'info', Success: 'success', Error: 'error' },
  useToast: () => [{}, { showToast: (type, message) => mockState.toasts.push([type, message]) }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{
    businesses: (businessId) => ({
      categories: (categoryId) => ({
        save: async (params) => {
          mockState.saves.push({ businessId, categoryId, params })
          if (mockState.throws) throw mockState.throws
          return mockState.response
        }
      })
    })
  }]
}))

import { SingleBusinessCategory } from '../index'

const CATEGORY = { id: 10, name: 'Burgers', rank: 1, enabled: true, subcategories: [] }
const makeBusiness = () => ({ id: 5, categories: [{ ...CATEGORY }] })

let ui
const Probe = (props) => {
  ui = props
  return null
}

// the controller sets state after the request: run the call inside act and hand back what it resolved to
const call = async (fn) => {
  let outcome
  await act(async () => { outcome = await fn() })
  return outcome
}

const draw = (extra = {}) => {
  const business = makeBusiness()
  const handleUpdateBusinessState = vi.fn()
  render(
    <SingleBusinessCategory
      UIComponent={Probe}
      business={business}
      category={business.categories[0]}
      categorySelected={null}
      handleUpdateBusinessState={handleUpdateBusinessState}
      {...extra}
    />
  )
  return { business, handleUpdateBusinessState }
}

beforeEach(() => {
  ui = null
  mockState.response = null
  mockState.throws = null
  mockState.saves = []
  mockState.toasts = []
  mockState.session = { loading: false }
})

describe('SingleBusinessCategory — handelChangeCategoryActive returns the outcome', () => {
  it('resolves { ok: true, result } when the API saves, and updates the business as before', async () => {
    mockState.response = { content: { error: false, result: { id: 10, name: 'Burgers', enabled: false, image: null } } }
    const { handleUpdateBusinessState } = draw()
    const outcome = await call(() => ui.handelChangeCategoryActive(false))
    expect(outcome).toEqual({ ok: true, result: { id: 10, name: 'Burgers', enabled: false, image: null } })
    expect(mockState.saves).toEqual([{ businessId: 5, categoryId: 10, params: { enabled: false } }])
    expect(handleUpdateBusinessState).toHaveBeenCalledTimes(1)
    expect(handleUpdateBusinessState.mock.calls[0][0].categories[0].enabled).toBe(false)
    await waitFor(() => expect(ui.categoryFormState.result).toEqual({ error: false, result: { id: 10, name: 'Burgers', enabled: false, image: null } }))
  })

  it('resolves { ok: false, error } with the messages of the API, and leaves formState.result as it was', async () => {
    mockState.response = { content: { error: true, result: ['Internal error'] } }
    const { handleUpdateBusinessState } = draw()
    const outcome = await call(() => ui.handelChangeCategoryActive(false))
    expect(outcome).toEqual({ ok: false, error: ['Internal error'] })
    expect(handleUpdateBusinessState).not.toHaveBeenCalled()
    await waitFor(() => expect(ui.categoryFormState.result).toEqual({ error: true, result: ['Internal error'] }))
    expect(ui.categoryFormState.loading).toBe(false)
  })

  it('resolves { ok: false, error } with the exception of a request that throws, and leaves formState.result as it was', async () => {
    const failure = new Error('Network down')
    mockState.throws = failure
    draw()
    const outcome = await call(() => ui.handelChangeCategoryActive(true))
    expect(outcome).toEqual({ ok: false, error: failure })
    await waitFor(() => expect(ui.categoryFormState.result).toEqual({ error: true, result: failure }))
  })

  it('resolves { ok: false } and does not call the API while the session is loading', async () => {
    mockState.session = { loading: true }
    draw()
    expect(await call(() => ui.handelChangeCategoryActive(false))).toEqual({ ok: false })
    expect(mockState.saves).toEqual([])
  })

  it('adds no toast for the failure (only the «Loading» of main)', async () => {
    mockState.response = { content: { error: true, result: ['Internal error'] } }
    draw()
    await call(() => ui.handelChangeCategoryActive(false))
    expect(mockState.toasts).toEqual([['info', 'Loading']])
  })

  it('handleUpdateClick (the edit form) returns the same outcome', async () => {
    mockState.response = { content: { error: false, result: { id: 10, name: 'Burgers', enabled: true } } }
    draw()
    const outcome = await call(() => ui.handleUpdateClick())
    expect(outcome.ok).toBe(true)
    expect(mockState.saves[0].params).toEqual({ name: 'Burgers' })
  })
})

// bugs E D11: the drop that re-orders a category used to ignore `content.error` and its catch only set formState: the
// «Loading» toast stayed and nothing said why the order did not change.
describe('SingleBusinessCategory — a failed re-order says why (D11)', () => {
  const drop = () => ({ preventDefault: () => {}, dataTransfer: { getData: () => '11' } })

  it('shows the message of the API as an error toast and leaves the business untouched', async () => {
    mockState.response = { content: { error: true, result: ['Internal error'] } }
    const { handleUpdateBusinessState } = draw()
    await call(() => ui.handleDrop(drop()))
    expect(mockState.saves).toEqual([{ businessId: 5, categoryId: 11, params: { rank: 1 } }])
    expect(handleUpdateBusinessState).not.toHaveBeenCalled()
    expect(mockState.toasts).toEqual([['info', 'Loading'], ['error', 'Internal error']])
  })

  it('shows the generic text when the API sends no message', async () => {
    mockState.response = { content: { error: true, result: [] } }
    draw()
    await call(() => ui.handleDrop(drop()))
    expect(mockState.toasts.at(-1)).toEqual(['error', "We couldn't save the change."])
  })

  it('shows an error toast when the request throws', async () => {
    mockState.throws = new Error('Network down')
    const { handleUpdateBusinessState } = draw()
    await call(() => ui.handleDrop(drop()))
    expect(handleUpdateBusinessState).not.toHaveBeenCalled()
    // review (bugs E): an exception's text is not an API message: the generic text, not «Network down»
    expect(mockState.toasts.at(-1)).toEqual(['error', "We couldn't save the change."])
  })

  it('keeps the success path: updates the rank and says «Category updated»', async () => {
    mockState.response = { content: { error: false, result: { id: 10, rank: 1 } } }
    const { handleUpdateBusinessState } = draw()
    await call(() => ui.handleDrop({ preventDefault: () => {}, dataTransfer: { getData: () => '10' } }))
    expect(handleUpdateBusinessState).toHaveBeenCalledTimes(1)
    expect(mockState.toasts.at(-1)).toEqual(['success', 'Category updated'])
  })
})

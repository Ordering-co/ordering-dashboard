/* eslint-disable import/first */
// redesign bugs E (review E2-4): a new option the API refuses left `extrasState.loading` on true for good, so the
// add field stayed read-only and «Add» off until a reload, and nothing said why. Now the field is free again and a toast says why.
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  fetch: vi.fn()
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token' }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test' }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (key, text) => text]
}))

import { ProductExtras } from '../index'

let ui
let handleSuccessUpdate
const draw = () => {
  ui = null
  handleSuccessUpdate = vi.fn()
  const extra = { id: 1, name: 'Cheese' }
  const UI = (props) => {
    ui = props
    return null
  }
  return render(
    <ProductExtras
      UIComponent={UI}
      business={{ id: 7, extras: [extra] }}
      product={{ id: 9, category_id: 2, extras: [{ id: 1, name: 'Cheese' }] }}
      handleSuccessUpdate={handleSuccessUpdate}
    />
  )
}

const answer = (content) => mocks.fetch.mockResolvedValue({ json: async () => content })

beforeEach(() => {
  mocks.showToast.mockReset()
  mocks.fetch.mockReset()
  vi.stubGlobal('fetch', mocks.fetch)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ProductExtras controller · handleAddExtra', () => {
  it('creates the option with the given name and leaves the add mode', async () => {
    draw()
    act(() => { ui.handleOpenAddForm() })
    answer({ error: false, result: { id: 5, name: 'Size' } })
    await act(async () => { await ui.handleAddExtra({ name: 'Size' }) })
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toEqual({ business_id: 7, name: 'Size' })
    expect(ui.extrasState.loading).toBe(false)
    expect(ui.extrasState.extras.map(extra => extra.name)).toContain('Size')
    expect(ui.isAddMode).toBe(false)
  })

  it('an API refusal frees the field, keeps the add mode and says why', async () => {
    draw()
    act(() => { ui.handleOpenAddForm() })
    answer({ error: true, result: ['The name is taken'] })
    await act(async () => { await ui.handleAddExtra({ name: 'Size' }) })
    expect(ui.extrasState.loading).toBe(false)
    expect(ui.isAddMode).toBe(true)
    expect(mocks.showToast).toHaveBeenLastCalledWith('error', 'The name is taken')
  })

  it('a failed request frees the field too', async () => {
    draw()
    act(() => { ui.handleOpenAddForm() })
    mocks.fetch.mockRejectedValue(new Error('Failed to fetch'))
    await act(async () => { await ui.handleAddExtra({ name: 'Size' }) })
    expect(ui.extrasState.loading).toBe(false)
    expect(ui.isAddMode).toBe(true)
  })
})

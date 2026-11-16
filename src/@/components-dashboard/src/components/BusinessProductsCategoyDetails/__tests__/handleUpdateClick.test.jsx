/* eslint-disable import/first */
// redesign stores 2.F: `handleUpdateClick` of the category editor.
// Without options it saves the whole form model (`formState.changes` is the category, seeded from the `category` prop) and, once
// saved, replaces the model with the answer. With `{ keepPendingChanges: true }` (the Snooze dialog) it sends ONLY the given
// keys; the model keeps the other pending edits and holds the saved values of the sent keys, `formState.result` is not touched
// (the editor opens an Alert from `result.error`; the dialog shows the error inline) and a failure leaves everything as it was.
import React from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  showToast: vi.fn()
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ loading: false, token: 'test-token' }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{
    businesses: () => ({ categories: () => ({ save: mocks.save }) })
  }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { BusinessProductsCategoyDetails } from '../index'

const CATEGORY = { id: 5, name: 'Burgers', rank: 1, enabled: true, parent_category_id: null, snooze_until: null, description: null }
const SNOOZE = { snooze_until: '2026-10-11 18:50:00' }

let ui
let props
const draw = () => {
  ui = null
  const UI = (uiProps) => {
    ui = uiProps
    return null
  }
  props = {
    UIComponent: UI,
    category: CATEGORY,
    categoryId: CATEGORY.id,
    businessState: { business: { id: 3, categories: [{ ...CATEGORY, subcategories: [] }] } },
    handleUpdateBusinessState: vi.fn(),
    setCategorySelected: vi.fn()
  }
  render(<BusinessProductsCategoyDetails {...props} />)
}

const toastTypes = () => mocks.showToast.mock.calls.map(([type]) => type)

beforeEach(() => {
  mocks.save.mockReset()
  mocks.showToast.mockReset()
})

describe('BusinessProductsCategoyDetails controller · handleUpdateClick without options (unchanged)', () => {
  it('sends the whole model without rank and nulls (but snooze_until: null), replaces it with the answer and sets result', async () => {
    const saved = { ...CATEGORY, name: 'Burgers XL' }
    mocks.save.mockResolvedValue({ content: { error: false, result: saved } })
    draw()
    act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Burgers XL' } }) })

    let result
    await act(async () => { result = await ui.handleUpdateClick() })

    expect(result).toEqual({ ok: true })
    expect(mocks.save.mock.calls[0][0]).toEqual({ id: 5, name: 'Burgers XL', enabled: true, snooze_until: null })
    expect(ui.formState.changes).toEqual(saved)
    expect(ui.formState.result).toEqual({ error: false, result: saved })
    expect(ui.formState.loading).toBe(false)
    expect(props.setCategorySelected).toHaveBeenCalledWith(saved)
    expect(props.handleUpdateBusinessState).toHaveBeenCalledTimes(1)
    expect(toastTypes()).toEqual(['info', 'success'])
  })

  it('keeps the edits and puts the API answer in result when the API rejects the save', async () => {
    const content = { error: true, result: ['Nope'] }
    mocks.save.mockResolvedValue({ content })
    draw()
    act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Draft' } }) })

    let result
    await act(async () => { result = await ui.handleUpdateClick() })

    expect(result).toEqual({ ok: false, error: ['Nope'] })
    expect(ui.formState.changes).toEqual({ ...CATEGORY, name: 'Draft' })
    expect(ui.formState.result).toEqual(content)
    expect(ui.formState.loading).toBe(false)
    expect(props.setCategorySelected).not.toHaveBeenCalled()
    expect(toastTypes()).toEqual(['info'])
  })

  it('puts the message in result when the request throws', async () => {
    mocks.save.mockRejectedValue(new Error('Network down'))
    draw()

    let result
    await act(async () => { result = await ui.handleUpdateClick() })

    expect(result).toEqual({ ok: false, error: ['Network down'] })
    expect(ui.formState.result).toEqual({ error: true, result: ['Network down'] })
    expect(ui.formState.loading).toBe(false)
  })

  it('ignores an event passed as the first argument', async () => {
    mocks.save.mockResolvedValue({ content: { error: false, result: CATEGORY } })
    draw()
    act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Draft' } }) })

    await act(async () => { await ui.handleUpdateClick({ target: {}, nativeEvent: {} }) })

    expect(mocks.save.mock.calls[0][0]).toEqual({ id: 5, name: 'Draft', enabled: true, snooze_until: null })
  })
})

describe('BusinessProductsCategoyDetails controller · handleUpdateClick with { keepPendingChanges: true }', () => {
  it('sends only the given keys, keeps the other edits, holds the saved value and does not set result', async () => {
    const saved = { ...CATEGORY, ...SNOOZE }
    mocks.save.mockResolvedValue({ content: { error: false, result: saved } })
    draw()
    act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Draft' } }) })
    const resultBefore = ui.formState.result

    let result
    await act(async () => { result = await ui.handleUpdateClick(SNOOZE, { keepPendingChanges: true }) })

    expect(result).toEqual({ ok: true })
    expect(mocks.save.mock.calls[0][0]).toEqual(SNOOZE)
    // the model is not replaced by the answer: the edit of `name` survives and the form's next Save sends the new snooze
    expect(ui.formState.changes.name).toBe('Draft')
    expect(ui.formState.changes.snooze_until).toBe(SNOOZE.snooze_until)
    expect(ui.formState.result).toBe(resultBefore)
    expect(ui.formState.loading).toBe(false)
    // the entity shown is updated, with the success toast it already had
    expect(props.setCategorySelected).toHaveBeenCalledWith(saved)
    expect(props.handleUpdateBusinessState).toHaveBeenCalledTimes(1)
    expect(toastTypes()).toEqual(['info', 'success'])
  })

  it('keeps snooze_until: null in the request ("Off")', async () => {
    mocks.save.mockResolvedValue({ content: { error: false, result: { ...CATEGORY, snooze_until: null } } })
    draw()

    await act(async () => { await ui.handleUpdateClick({ snooze_until: null }, { keepPendingChanges: true }) })

    expect(mocks.save.mock.calls[0][0]).toEqual({ snooze_until: null })
    expect(ui.formState.changes.snooze_until).toBeNull()
  })

  it('on an API error leaves changes and result exactly as they were and returns { ok: false, error }', async () => {
    mocks.save.mockResolvedValue({ content: { error: true, result: ['Nope'] } })
    draw()
    act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Draft' } }) })
    const changesBefore = ui.formState.changes
    const resultBefore = ui.formState.result

    let result
    await act(async () => { result = await ui.handleUpdateClick(SNOOZE, { keepPendingChanges: true }) })

    expect(result).toEqual({ ok: false, error: ['Nope'] })
    expect(ui.formState.changes).toBe(changesBefore)
    expect(ui.formState.result).toBe(resultBefore)
    expect(ui.formState.loading).toBe(false)
    expect(props.setCategorySelected).not.toHaveBeenCalled()
    expect(props.handleUpdateBusinessState).not.toHaveBeenCalled()
    expect(toastTypes()).toEqual(['info'])
  })

  it('on a throw leaves changes and result as they were and returns { ok: false, error }', async () => {
    mocks.save.mockRejectedValue(new Error('Network down'))
    draw()
    act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Draft' } }) })
    const changesBefore = ui.formState.changes
    const resultBefore = ui.formState.result

    let result
    await act(async () => { result = await ui.handleUpdateClick(SNOOZE, { keepPendingChanges: true }) })

    expect(result).toEqual({ ok: false, error: ['Network down'] })
    expect(ui.formState.changes).toBe(changesBefore)
    expect(ui.formState.result).toBe(resultBefore)
    expect(ui.formState.loading).toBe(false)
  })

  it('keeps an edit typed while the request is in flight', async () => {
    let release
    mocks.save.mockReturnValue(new Promise(resolve => { release = resolve }))
    draw()
    let pending
    act(() => { pending = ui.handleUpdateClick(SNOOZE, { keepPendingChanges: true }) })
    act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'typed later' } }) })
    await act(async () => {
      release({ content: { error: false, result: { ...CATEGORY, ...SNOOZE } } })
      await pending
    })

    expect(ui.formState.changes.name).toBe('typed later')
    expect(ui.formState.changes.snooze_until).toBe(SNOOZE.snooze_until)
  })
})

describe('BusinessProductsCategoyDetails controller · a category being created (review 2.F R-1)', () => {
  // «Add new category» keeps the category selected in the list as `categorySelected`, so the Snooze dialog cannot tell a new
  // category from a saved one. Here there is no `category` yet: the snooze goes into the form and is created with it, as in main.
  const drawNew = () => {
    ui = null
    props = {
      UIComponent: (uiProps) => { ui = uiProps; return null },
      businessState: { business: { id: 3, categories: [] } },
      handleUpdateBusinessState: vi.fn(),
      setCategorySelected: vi.fn()
    }
    render(<BusinessProductsCategoyDetails {...props} />)
  }

  it('writes snooze_until into the form without a request, and the category is created with it', async () => {
    mocks.save.mockResolvedValue({ content: { error: false, result: { id: 9, name: 'Desserts', ...SNOOZE } } })
    drawNew()
    act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Desserts' } }) })
    let result
    await act(async () => { result = await ui.handleUpdateClick(SNOOZE, { keepPendingChanges: true }) })

    expect(result).toEqual({ ok: true })
    expect(mocks.save).not.toHaveBeenCalled()
    expect(ui.formState.changes).toMatchObject({ name: 'Desserts', ...SNOOZE })

    await act(async () => { await ui.handleUpdateClick() })
    expect(mocks.save).toHaveBeenCalledTimes(1)
    expect(mocks.save.mock.calls[0][0]).toMatchObject({ name: 'Desserts', ...SNOOZE })
  })
})

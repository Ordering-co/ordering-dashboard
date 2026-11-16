/* eslint-disable import/first */
// redesign SB-B1: the BusinessBrandGENDetail controller answers `{ ok, error }` to the save bar, hands the saved
// brand to the detail on create AND on update, adds one to the list total on create, can discard, and seeds the ribbon when
// it is turned on. Every state update is functional.
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ showToast: vi.fn(), hideToast: vi.fn() }))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', loading: false, user: { level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test/v400/en/demo' }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast, hideToast: mocks.hideToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { BusinessBrandGENDetail } from '../index'
import { ribbonValues } from '../../../ui/src/utils'

const BRAND = { id: 5, name: 'Burger Palace', slug: 'burger-palace', logo: 'a.png', ribbon: null }
const LIST = [BRAND, { id: 6, name: 'Vips', slug: 'vips' }]

const json = (body) => ({ json: async () => body })

let ui
const UI = (props) => {
  ui = props
  return null
}

const fetchMock = vi.fn()
const handleUpdateBrandList = vi.fn()
const onSelectedBrand = vi.fn()
const setPaginationProps = vi.fn()

const draw = (props = {}) => {
  ui = null
  return render(
    <BusinessBrandGENDetail
      UIComponent={UI}
      brand={BRAND}
      handleUpdateBrandList={handleUpdateBrandList}
      onSelectedBrand={onSelectedBrand}
      setPaginationProps={setPaginationProps}
      {...props}
    />
  )
}

const change = (changes) => act(() => ui.handleChangeItem(changes))

beforeEach(() => {
  mocks.showToast.mockReset()
  mocks.hideToast.mockReset()
  fetchMock.mockReset()
  handleUpdateBrandList.mockReset()
  onSelectedBrand.mockReset()
  setPaginationProps.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BusinessBrandGENDetail controller · create', () => {
  it('returns { ok: true }, posts the changes, adds the brand to the list, adds one to the total and hands the brand to the detail', async () => {
    const created = { id: 77, name: 'New brand' }
    fetchMock.mockResolvedValue(json({ error: false, result: created }))
    draw({ brand: null })
    await change({ name: 'New brand', slug: 'new-brand' })
    let result
    await act(async () => { result = await ui.handleUpdateClick() })
    expect(result).toEqual({ ok: true })
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.test/v400/en/demo/franchises')
    expect(options.method).toBe('POST')
    expect(options.headers.Authorization).toBe('Bearer test-token')
    expect(JSON.parse(options.body)).toEqual({ name: 'New brand', slug: 'new-brand' })
    // the list and the total are updated with updaters, not with a list captured before
    expect(handleUpdateBrandList.mock.calls[0][0](LIST)).toEqual([...LIST, created])
    expect(setPaginationProps.mock.calls[0][0]({ totalItems: 2, pageSize: 10 })).toEqual({ totalItems: 3, pageSize: 10 })
    expect(setPaginationProps.mock.calls[0][0]({ totalItems: null })).toEqual({ totalItems: null })
    expect(onSelectedBrand).toHaveBeenCalledWith(created)
    expect(ui.brandFormState.changes).toEqual({})
    expect(ui.brandFormState.loading).toBe(false)
    expect(mocks.showToast.mock.calls).toEqual([['info', 'Loading'], ['success', 'Brand added']])
    expect(mocks.hideToast).not.toHaveBeenCalled()
  })

  it('drops a ribbon that is not enabled from the request', async () => {
    fetchMock.mockResolvedValue(json({ error: false, result: { id: 77 } }))
    draw({ brand: null })
    await change({ name: 'New brand', ribbon: { enabled: false } })
    await act(async () => { await ui.handleUpdateClick() })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ name: 'New brand' })
  })

  it('returns { ok: false, error: result } on an API error, keeps the changes and stores the result for the bar', async () => {
    const failure = { error: true, result: ['API_ERROR_NAME'] }
    fetchMock.mockResolvedValue(json(failure))
    draw({ brand: null })
    await change({ name: 'New brand' })
    let result
    await act(async () => { result = await ui.handleUpdateClick() })
    expect(result).toEqual({ ok: false, error: ['API_ERROR_NAME'] })
    expect(ui.brandFormState.result).toEqual(failure)
    expect(ui.brandFormState.changes).toEqual({ name: 'New brand' })
    expect(ui.brandFormState.loading).toBe(false)
    expect(handleUpdateBrandList).not.toHaveBeenCalled()
    expect(setPaginationProps).not.toHaveBeenCalled()
    expect(onSelectedBrand).not.toHaveBeenCalled()
    expect(mocks.showToast.mock.calls.map(([type]) => type)).toEqual(['info'])
    // redesign bugs F row 19: the «Loading» toast is hidden on failure (the bar shows the error)
    expect(mocks.hideToast).toHaveBeenCalledTimes(1)
  })

  it('returns { ok: false, error: [message] } when the request throws and keeps the changes', async () => {
    fetchMock.mockRejectedValue(new Error('Network down'))
    draw({ brand: null })
    await change({ name: 'New brand' })
    let result
    await act(async () => { result = await ui.handleUpdateClick() })
    expect(result).toEqual({ ok: false, error: ['Network down'] })
    expect(ui.brandFormState.result).toEqual({ error: true, result: 'Network down' })
    expect(ui.brandFormState.changes).toEqual({ name: 'New brand' })
    expect(mocks.hideToast).toHaveBeenCalledTimes(1)
  })
})

describe('BusinessBrandGENDetail controller · update', () => {
  it('returns { ok: true }, merges the saved brand into the list and hands it to the detail (also on update)', async () => {
    const saved = { ...BRAND, name: 'Burger Palace 2' }
    fetchMock.mockResolvedValue(json({ error: false, result: saved }))
    draw()
    await change({ name: 'Burger Palace 2' })
    let result
    await act(async () => { result = await ui.handleUpdateClick() })
    expect(result).toEqual({ ok: true })
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.test/v400/en/demo/franchises/5')
    expect(JSON.parse(options.body)).toEqual({ name: 'Burger Palace 2' })
    expect(handleUpdateBrandList.mock.calls[0][0](LIST)).toEqual([saved, LIST[1]])
    expect(setPaginationProps).not.toHaveBeenCalled()
    expect(onSelectedBrand).toHaveBeenCalledWith(saved)
    expect(ui.brandFormState.changes).toEqual({})
    expect(mocks.showToast.mock.calls).toEqual([['info', 'Loading'], ['success', 'Brand updated']])
    expect(mocks.hideToast).not.toHaveBeenCalled()
  })

  it('returns { ok: false, error: result } on an API error and keeps the changes', async () => {
    const failure = { error: true, result: ['API_ERROR_SLUG'] }
    fetchMock.mockResolvedValue(json(failure))
    draw()
    await change({ slug: 'taken' })
    let result
    await act(async () => { result = await ui.handleUpdateClick() })
    expect(result).toEqual({ ok: false, error: ['API_ERROR_SLUG'] })
    expect(ui.brandFormState.result).toEqual(failure)
    expect(ui.brandFormState.changes).toEqual({ slug: 'taken' })
    expect(onSelectedBrand).not.toHaveBeenCalled()
    expect(mocks.showToast.mock.calls.map(([type]) => type)).toEqual(['info'])
    expect(mocks.hideToast).toHaveBeenCalledTimes(1)
  })

  it('returns { ok: false, error: [message] } when the request throws', async () => {
    fetchMock.mockRejectedValue(new Error('Network down'))
    draw()
    await change({ slug: 'x' })
    let result
    await act(async () => { result = await ui.handleUpdateClick() })
    expect(result).toEqual({ ok: false, error: ['Network down'] })
    expect(ui.brandFormState.changes).toEqual({ slug: 'x' })
    expect(mocks.hideToast).toHaveBeenCalledTimes(1)
  })

  it('keeps the second POST that turns the ribbon off when the API still answers it on', async () => {
    const ribbonBrand = { ...BRAND, ribbon: { enabled: true, text: 'new', color: '#fff', shape: 'capsule_shape' } }
    const off = { ...ribbonBrand, ribbon: { enabled: false } }
    fetchMock
      .mockResolvedValueOnce(json({ error: false, result: ribbonBrand }))
      .mockResolvedValueOnce(json({ error: false, result: off }))
    draw({ brand: ribbonBrand })
    act(() => ui.handleChangeRibbon({ enabled: false }))
    let result
    await act(async () => { result = await ui.handleUpdateClick() })
    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ ribbon: JSON.stringify({ enabled: false }) })
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ ribbon: JSON.stringify({ enabled: false }) })
    expect(onSelectedBrand).toHaveBeenCalledWith(off)
  })
})

describe('BusinessBrandGENDetail controller · discard and changes', () => {
  it('handleDiscard empties the changes and the result', async () => {
    fetchMock.mockResolvedValue(json({ error: true, result: ['API_ERROR_SLUG'] }))
    draw()
    await change({ slug: 'taken' })
    await act(async () => { await ui.handleUpdateClick() })
    expect(ui.brandFormState.result.error).toBe(true)
    act(() => ui.handleDiscard())
    expect(ui.brandFormState.changes).toEqual({})
    expect(ui.brandFormState.result).toEqual({ error: false })
  })

  it('keeps every change made in the same tick (updates are functional)', () => {
    draw()
    act(() => {
      ui.handleChangeInput({ target: { name: 'slug', value: 'a-slug' } })
      ui.handleChangeItem({ name: 'A name' })
      ui.handleChangeRibbon({ text: 'hello' })
    })
    expect(ui.brandFormState.changes).toEqual({ slug: 'a-slug', name: 'A name', ribbon: { text: 'hello' } })
  })

  // redesign bugs C: not the text: «ribbon» reached the customers; the form asks for it
  it('turning the ribbon on in a brand without ribbon seeds color and shape with enabled true, never the text', () => {
    draw()
    act(() => ui.handleChangeRibbon({ enabled: true }))
    expect(ui.brandFormState.changes.ribbon).toEqual({ color: ribbonValues.color, shape: ribbonValues.shape, enabled: true })
  })

  it('turning the ribbon on keeps what the brand already has and what the person already typed', () => {
    draw({ brand: { ...BRAND, ribbon: { enabled: false, color: '#112233' } } })
    act(() => ui.handleChangeRibbon({ text: 'mine' }))
    act(() => ui.handleChangeRibbon({ enabled: true }))
    expect(ui.brandFormState.changes.ribbon).toEqual({ text: 'mine', shape: ribbonValues.shape, enabled: true })
  })

  it('turning the ribbon off sends enabled false only', () => {
    draw({ brand: { ...BRAND, ribbon: { enabled: true, text: 'x', color: '#112233', shape: 'capsule_shape' } } })
    act(() => ui.handleChangeRibbon({ enabled: false }))
    expect(ui.brandFormState.changes.ribbon).toEqual({ enabled: false })
  })
})

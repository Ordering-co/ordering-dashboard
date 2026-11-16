/* eslint-disable import/first */
// redesign stores 5.3 (; G2-15, G2-16, G2-17): the gallery controller of Store details › Images and Videos. Adding and
// deleting say how they went (`{ ok: true, result }` or `{ ok: false, error }`), so the screens can tell each failure once and
// upload several images one after another. A failed delete is no longer silent; the success toasts have their own text. Same
// requests as before: POST /business/:id/gallery with { business_id, type, file | video }, DELETE
// /business/:id/gallery/:gid?business_id=.
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ showToast: vi.fn() }))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token' }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test/v400/en/demo' }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (key, text) => text ?? key]
}))

import { BusinessGallery } from '../index'

const STORE = {
  id: 2,
  gallery: [
    { id: 1, file: 'https://img.test/1.png' },
    { id: 7, video: 'https://youtu.be/abc' }
  ]
}

let ui
const draw = (props = {}) => {
  ui = null
  const UI = (uiProps) => {
    ui = uiProps
    return null
  }
  return render(<BusinessGallery UIComponent={UI} business={STORE} {...props} />)
}

const answer = (body, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(body) })

beforeEach(() => {
  mocks.showToast.mockReset()
  global.fetch = vi.fn()
})
afterEach(() => {
  delete global.fetch
})

describe('BusinessGallery controller', () => {
  it('splits the gallery into photos and videos', () => {
    draw()
    expect(ui.businessPhotos.map(p => p.id)).toEqual([1])
    expect(ui.businessVideos.map(v => v.id)).toEqual([7])
  })

  it('adds an image with the same request as before and says it went well', async () => {
    const onAdded = vi.fn()
    global.fetch.mockReturnValue(answer({ error: false, result: { id: 9, file: 'https://img.test/9.png' } }))
    draw({ handleSucessAddBusinessGallery: onAdded, isImageGallery: true })
    let result
    await act(async () => { result = await ui.handleAddGalleryItem({ file: 'data:image/png;base64,AAA' }) })
    expect(result).toEqual({ ok: true, result: { id: 9, file: 'https://img.test/9.png' } })
    const [url, options] = global.fetch.mock.calls[0]
    expect(url).toBe('https://api.test/v400/en/demo/business/2/gallery')
    expect(options.method).toBe('POST')
    expect(options.headers.Authorization).toBe('Bearer test-token')
    expect(JSON.parse(options.body)).toEqual({ business_id: 2, type: 1, file: 'data:image/png;base64,AAA' })
    expect(onAdded).toHaveBeenCalledWith({ id: 9, file: 'https://img.test/9.png' })
  })

  it('adds a video as type 2 and toasts with its own text', async () => {
    global.fetch.mockReturnValue(answer({ error: false, result: { id: 10, video: 'https://youtu.be/x' } }))
    draw({ isVideoGallery: true })
    await act(async () => { await ui.handleAddGalleryItem({ video: 'https://youtu.be/x' }) })
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ business_id: 2, type: 2, video: 'https://youtu.be/x' })
    expect(mocks.showToast).toHaveBeenCalledWith('success', 'Business gallery video added')
  })

  it('can add without a toast (the images screen reports a batch itself)', async () => {
    global.fetch.mockReturnValue(answer({ error: false, result: { id: 9 } }))
    draw({ isImageGallery: true })
    await act(async () => { await ui.handleAddGalleryItem({ file: 'data:x' }, { silent: true }) })
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('returns the API error of a failed add and refreshes nothing', async () => {
    const onAdded = vi.fn()
    global.fetch.mockReturnValue(answer({ error: true, result: ['The file is too large'] }))
    draw({ handleSucessAddBusinessGallery: onAdded, isImageGallery: true })
    let result
    await act(async () => { result = await ui.handleAddGalleryItem({ file: 'data:x' }) })
    expect(result).toEqual({ ok: false, error: 'The file is too large' })
    expect(onAdded).not.toHaveBeenCalled()
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('returns a network failure as an error instead of throwing', async () => {
    global.fetch.mockRejectedValue(new Error('Failed to fetch'))
    draw({ isImageGallery: true })
    let result
    await act(async () => { result = await ui.handleAddGalleryItem({ file: 'data:x' }) })
    expect(result).toEqual({ ok: false, error: 'Failed to fetch' })
  })

  it('deletes with the same request, toasts with its own text and refreshes the shell', async () => {
    const onDeleted = vi.fn()
    global.fetch.mockReturnValue(answer({ error: false, result: {} }))
    draw({ handleSucessDeleteBusinessGallery: onDeleted })
    let result
    await act(async () => { result = await ui.handleDeleteBusinessGallery(1) })
    expect(result).toEqual({ ok: true })
    const [url, options] = global.fetch.mock.calls[0]
    expect(url).toBe('https://api.test/v400/en/demo/business/2/gallery/1?business_id=2')
    expect(options.method).toBe('DELETE')
    expect(onDeleted).toHaveBeenCalledWith(1)
    expect(mocks.showToast).toHaveBeenCalledWith('success', 'Business gallery item deleted')
  })

  it('a failed delete says why (G2-16) and keeps the item', async () => {
    const onDeleted = vi.fn()
    global.fetch.mockReturnValue(answer({ error: true, result: 'Not allowed' }))
    draw({ handleSucessDeleteBusinessGallery: onDeleted })
    let result
    await act(async () => { result = await ui.handleDeleteBusinessGallery(1) })
    expect(result).toEqual({ ok: false, error: 'Not allowed' })
    expect(onDeleted).not.toHaveBeenCalled()
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('refreshes the shell through its latest callbacks, so uploads one after another all stay (review 1)', async () => {
    // the shell's callbacks append to the gallery of the render they come from: an old one would drop the previous image
    const first = vi.fn()
    const second = vi.fn()
    const deletedFirst = vi.fn()
    const deletedSecond = vi.fn()
    let answerFetch
    global.fetch.mockReturnValue(new Promise(resolve => { answerFetch = resolve }))
    const { rerender } = draw({ handleSucessAddBusinessGallery: first, handleSucessDeleteBusinessGallery: deletedFirst })
    const add = ui.handleAddGalleryItem
    const remove = ui.handleDeleteBusinessGallery
    let pending
    act(() => { pending = add({ file: 'data:x' }, { silent: true }) })
    const UI = () => null
    rerender(<BusinessGallery UIComponent={(p) => { ui = p; return <UI /> }} business={STORE} handleSucessAddBusinessGallery={second} handleSucessDeleteBusinessGallery={deletedSecond} />)
    await act(async () => {
      answerFetch({ json: () => Promise.resolve({ error: false, result: { id: 9 } }) })
      await pending
    })
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith({ id: 9 })
    global.fetch.mockReturnValue(answer({ error: false }))
    await act(async () => { await remove(1) })
    expect(deletedFirst).not.toHaveBeenCalled()
    expect(deletedSecond).toHaveBeenCalledWith(1)
  })

  it('reports which item is being deleted while it is', async () => {
    let answerFetch
    global.fetch.mockReturnValue(new Promise(resolve => { answerFetch = resolve }))
    draw()
    let pending
    act(() => { pending = ui.handleDeleteBusinessGallery(1) })
    expect(ui.deletingId).toBe(1)
    await act(async () => {
      answerFetch({ json: () => Promise.resolve({ error: false }) })
      await pending
    })
    expect(ui.deletingId).toBe(null)
  })
})

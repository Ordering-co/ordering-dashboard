/* eslint-disable import/first */
// redesign stores 1.A (G2-01, G3-42, G5-02, G1-22, SL-13): a save through the shared form of the store editor
// (Location, SEO, Categories, Notifications, Preorders, Ordering channels, Layout, the slug) said "Loading" and then nothing
// when it failed. Now the failure replaces the "Loading" toast with the API message, translated, and the handler tells its
// caller how the save went: `{ ok: true }` or `{ ok: false, error }`. What failed stays in `formState.changes` (nothing the
// user typed is lost), as before.
import React from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  showToast: vi.fn()
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{
    root: 'https://api.test',
    project: 'demo',
    businesses: () => ({ save: mocks.save }),
    setAccessToken: () => ({ businesses: () => ({ save: mocks.save }) })
  }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  // Known keys answer in "Spanish" so the test sees the translation; unknown keys give back their default text.
  useLanguage: () => [{}, (key, text) => ({ SLUG_ALREADY_IN_USE: 'El slug ya está en uso' }[key] ?? text)]
}))
vi.mock('../../../contexts/EventContext', () => ({
  useEvent: () => [{ emit: vi.fn() }]
}))
vi.mock('../../../contexts/AssistantContext', () => ({
  useAssistantRecordChanges: () => {}
}))

import { BusinessDetails } from '../index'

const STORE = { id: 7, name: 'Sample Burgers', slug: 'sample' }

let ui
const draw = () => {
  ui = null
  const UI = (props) => {
    ui = props
    return null
  }
  return render(<BusinessDetails UIComponent={UI} business={STORE} businessId={STORE.id} notGetSites notGetTaxes notGetStreamConnection />)
}

// A pending edit, as the form fields leave it in `formState.changes`.
const edit = (values) => ui.setFormState(prev => ({ ...prev, changes: { ...prev.changes, ...values } }))

const toasts = () => mocks.showToast.mock.calls.map(([type, message]) => [type, message])

beforeEach(() => {
  mocks.save.mockReset()
  mocks.showToast.mockReset()
})

describe('BusinessDetails controller · handleUpdateBusinessClick', () => {
  it('returns { ok: true }, clears the changes and keeps the success toast when the save works', async () => {
    mocks.save.mockResolvedValue({ content: { error: false, result: { id: 7, slug: 'new-slug' } } })
    draw()
    let result
    await act(async () => { result = await ui.handleUpdateBusinessClick({ slug: 'new-slug' }) })
    expect(result).toEqual({ ok: true })
    expect(ui.formState.changes).toEqual({})
    expect(toasts()).toEqual([['info', 'Loading'], ['success', 'Business updated']])
  })

  it('says the API message, translated, when the API rejects the save, and returns { ok: false, error }', async () => {
    mocks.save.mockResolvedValue({ content: { error: true, result: ['Slug already in use'] } })
    draw()
    let result
    await act(async () => { result = await ui.handleUpdateBusinessClick({ slug: 'taken' }) })
    expect(result).toEqual({ ok: false, error: ['Slug already in use'] })
    expect(toasts()).toEqual([['info', 'Loading'], ['error', 'El slug ya está en uso']])
    // what failed stays pending, as before
    expect(ui.formState.changes).toEqual({ slug: 'taken' })
    expect(ui.formState.result.error).toBe(true)
    expect(ui.formState.loading).toBe(false)
  })

  it('reads a message given as a string and as { message }', async () => {
    mocks.save.mockResolvedValue({ content: { error: true, result: 'Slug already in use' } })
    draw()
    await act(async () => { await ui.handleUpdateBusinessClick({ slug: 'taken' }) })
    mocks.save.mockResolvedValue({ content: { error: true, result: [{ message: 'Slug already in use' }] } })
    await act(async () => { await ui.handleUpdateBusinessClick({ slug: 'taken' }) })
    expect(toasts().filter(([type]) => type === 'error')).toEqual([['error', 'El slug ya está en uso'], ['error', 'El slug ya está en uso']])
  })

  it('falls back to a generic text when the API sends no message', async () => {
    mocks.save.mockResolvedValue({ content: { error: true, result: [] } })
    draw()
    await act(async () => { await ui.handleUpdateBusinessClick({ slug: 'taken' }) })
    expect(toasts()).toEqual([['info', 'Loading'], ['error', "We couldn't save the change."]])
  })

  it('says the error and returns { ok: false, error } when the request throws', async () => {
    mocks.save.mockRejectedValue(new Error('Network down'))
    draw()
    let result
    await act(async () => { result = await ui.handleUpdateBusinessClick({ slug: 'taken' }) })
    expect(result).toEqual({ ok: false, error: ['Network down'] })
    expect(toasts()).toEqual([['info', 'Loading'], ['error', 'Network down']])
    expect(ui.formState.loading).toBe(false)
  })

  // redesign bugs F row 12: Location says a failure in its save bar, so with { inlineError: true } the controller shows
  // neither «Loading» nor the error toast; «Business updated» stays, as with keepPendingChanges.
  describe('with { inlineError: true }', () => {
    it('shows no Loading and no error toast when the API rejects the save, and returns { ok: false, error }', async () => {
      mocks.save.mockResolvedValue({ content: { error: true, result: ['Nope'] } })
      draw()
      act(() => { edit({ address: 'Somewhere 123' }) })
      let result
      await act(async () => { result = await ui.handleUpdateBusinessClick({}, { inlineError: true }) })
      expect(result).toEqual({ ok: false, error: ['Nope'] })
      expect(toasts()).toEqual([])
      // what failed stays pending, as without the option
      expect(ui.formState.changes).toEqual({ address: 'Somewhere 123' })
      expect(ui.formState.loading).toBe(false)
    })

    it('shows no Loading and no error toast when the request throws, and returns { ok: false, error }', async () => {
      mocks.save.mockRejectedValue(new Error('Network down'))
      draw()
      act(() => { edit({ address: 'Somewhere 123' }) })
      let result
      await act(async () => { result = await ui.handleUpdateBusinessClick({}, { inlineError: true }) })
      expect(result).toEqual({ ok: false, error: ['Network down'] })
      expect(toasts()).toEqual([])
    })

    it('keeps the success toast, and sends everything pending, when the save works', async () => {
      mocks.save.mockResolvedValue({ content: { error: false, result: { id: 7 } } })
      draw()
      act(() => { edit({ address: 'Somewhere 123' }) })
      let result
      await act(async () => { result = await ui.handleUpdateBusinessClick({}, { inlineError: true }) })
      expect(result).toEqual({ ok: true })
      expect(mocks.save).toHaveBeenCalledWith({ address: 'Somewhere 123' }, expect.anything())
      expect(ui.formState.changes).toEqual({})
      expect(toasts()).toEqual([['success', 'Business updated']])
    })
  })

  // redesign stores 2.F: the Snooze dialog saves only `snooze_until` and leaves the other pending edits alone.
  describe('with { keepPendingChanges: true }', () => {
    const SNOOZE = { snooze_until: '2026-10-11 18:50:00' }

    it('without the flag sends everything pending, as before', async () => {
      mocks.save.mockResolvedValue({ content: { error: false, result: { id: 7 } } })
      draw()
      act(() => { edit({ name: 'Draft' }) })
      await act(async () => { await ui.handleUpdateBusinessClick() })
      expect(mocks.save).toHaveBeenCalledWith({ name: 'Draft' }, expect.anything())
      expect(ui.formState.changes).toEqual({})
    })

    it('sends only the given keys, keeps the other pending edits and does not set result', async () => {
      mocks.save.mockResolvedValue({ content: { error: false, result: { id: 7, ...SNOOZE } } })
      draw()
      act(() => { edit({ name: 'Draft' }) })
      const resultBefore = ui.formState.result
      let result
      await act(async () => { result = await ui.handleUpdateBusinessClick(SNOOZE, { keepPendingChanges: true }) })
      expect(mocks.save).toHaveBeenCalledWith(SNOOZE, expect.anything())
      expect(result).toEqual({ ok: true })
      expect(ui.formState.changes).toEqual({ name: 'Draft' })
      expect(ui.formState.result).toBe(resultBefore)
      expect(ui.formState.loading).toBe(false)
      // redesign stores 5.18 (from 5.15b): no «Loading» (it outlived a failure, which no toast replaced). «Business
      // updated» stays (review F3): after «Save and continue» of the leave dialog, or a category tick, it is the only confirmation.
      expect(toasts()).toEqual([['success', 'Business updated']])
    })

    it('keeps the very same changes object when none of the sent keys was pending', async () => {
      mocks.save.mockResolvedValue({ content: { error: false, result: { id: 7 } } })
      draw()
      act(() => { edit({ name: 'Draft' }) })
      const changesBefore = ui.formState.changes
      await act(async () => { await ui.handleUpdateBusinessClick(SNOOZE, { keepPendingChanges: true }) })
      expect(ui.formState.changes).toBe(changesBefore)
    })

    it('removes a sent key that was also pending', async () => {
      mocks.save.mockResolvedValue({ content: { error: false, result: { id: 7 } } })
      draw()
      act(() => {
        edit({ name: 'Draft' })
        edit({ snooze_until: 'old' })
      })
      await act(async () => { await ui.handleUpdateBusinessClick(SNOOZE, { keepPendingChanges: true }) })
      expect(ui.formState.changes).toEqual({ name: 'Draft' })
    })

    it('on an API error leaves changes and result exactly as they were and returns { ok: false, error }', async () => {
      mocks.save.mockResolvedValue({ content: { error: true, result: ['Nope'] } })
      draw()
      act(() => { edit({ name: 'Draft' }) })
      const changesBefore = ui.formState.changes
      const resultBefore = ui.formState.result
      let result
      await act(async () => { result = await ui.handleUpdateBusinessClick(SNOOZE, { keepPendingChanges: true }) })
      expect(result).toEqual({ ok: false, error: ['Nope'] })
      expect(ui.formState.changes).toBe(changesBefore)
      expect(ui.formState.result).toBe(resultBefore)
      expect(ui.formState.loading).toBe(false)
      // the dialog says why, inline: no error toast on top of it, and no «Loading» left behind (stores 5.18)
      expect(toasts()).toEqual([])
    })

    it('on a throw leaves changes and result as they were and returns { ok: false, error }', async () => {
      mocks.save.mockRejectedValue(new Error('Network down'))
      draw()
      act(() => { edit({ name: 'Draft' }) })
      const changesBefore = ui.formState.changes
      const resultBefore = ui.formState.result
      let result
      await act(async () => { result = await ui.handleUpdateBusinessClick(SNOOZE, { keepPendingChanges: true }) })
      expect(result).toEqual({ ok: false, error: ['Network down'] })
      expect(ui.formState.changes).toBe(changesBefore)
      expect(ui.formState.result).toBe(resultBefore)
      expect(ui.formState.loading).toBe(false)
      expect(toasts()).toEqual([])
    })

    it('keeps an edit typed while the request is in flight', async () => {
      let release
      mocks.save.mockReturnValue(new Promise(resolve => { release = resolve }))
      draw()
      act(() => { edit({ name: 'Draft' }) })
      let pending
      act(() => { pending = ui.handleUpdateBusinessClick(SNOOZE, { keepPendingChanges: true }) })
      act(() => { edit({ slug: 'typed-later' }) })
      await act(async () => {
        release({ content: { error: false, result: { id: 7 } } })
        await pending
      })
      expect(ui.formState.changes).toEqual({ name: 'Draft', slug: 'typed-later' })
    })
  })
})

/* eslint-disable import/first */
// redesign stores 2.F: the Snooze dialog saves only `snooze_until` through this handler with
// `{ keepPendingChanges: true }`. Without that option the handler behaves as it always did (sends every pending change,
// clears them on success, keeps them and sets `result.error` on failure).
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

import { BusinessMenuOptions } from '../index'

const SNOOZE = '2026-10-11 18:50:00'

let ui
let menu
let setMenuList
let setCurrentMenu
let putAnswer
const draw = () => {
  ui = null
  menu = { id: 4, name: 'Lunch', products: [], sites: [] }
  setMenuList = vi.fn()
  setCurrentMenu = vi.fn()
  const UI = (props) => {
    ui = props
    return null
  }
  return render(
    <BusinessMenuOptions
      UIComponent={UI}
      business={{ id: 7, categories: [] }}
      menu={menu}
      menuList={{ menus: [menu] }}
      setMenuList={setMenuList}
      setCurrentMenu={setCurrentMenu}
    />
  )
}

const answer = (content) => { putAnswer = () => Promise.resolve({ json: async () => content }) }
const puts = () => mocks.fetch.mock.calls.filter(([, options]) => options.method === 'PUT')
const sentBody = () => JSON.parse(puts()[0][1].body)
const typeName = async (value) => {
  await act(async () => { ui.handleChangeInput({ target: { name: 'name', value } }) })
}

beforeEach(() => {
  mocks.showToast.mockReset()
  mocks.fetch.mockReset()
  // the controller also reads the shared menu products on mount (GET); only the PUTs matter here
  mocks.fetch.mockImplementation((url, options) => options.method === 'GET'
    ? Promise.resolve({ json: async () => ({ error: false, result: [] }) })
    : putAnswer())
  vi.stubGlobal('fetch', mocks.fetch)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BusinessMenuOptions controller · handleUpdateBusinessMenuOption', () => {
  describe('without keepPendingChanges (as every caller does today)', () => {
    it('sends every pending change (objects stringified), clears them and returns { ok: true }', async () => {
      draw()
      await typeName('Draft')
      answer({ error: false, result: { id: 4, name: 'Draft' } })
      let result
      await act(async () => { result = await ui.handleUpdateBusinessMenuOption() })
      expect(puts()[0][0]).toBe('https://api.test/business/7/menus/4')
      expect(sentBody()).toMatchObject({ name: 'Draft', products: '[]' })
      expect(result).toEqual({ ok: true })
      expect(ui.formState.changes).toEqual({})
      expect(ui.formState.result).toEqual({ error: false, result: { id: 4, name: 'Draft' } })
      expect(ui.formState.loading).toBe(false)
      expect(ui.businessMenuState.menu.name).toBe('Draft')
      expect(mocks.showToast).toHaveBeenLastCalledWith('success', 'Products catalog saved')
    })

    it('ignores an event and an explicit changes object without the option', async () => {
      draw()
      await typeName('Draft')
      answer({ error: false, result: { id: 4 } })
      await act(async () => { await ui.handleUpdateBusinessMenuOption({ type: 'click' }) })
      expect(sentBody()).toMatchObject({ name: 'Draft' })
      mocks.fetch.mockClear()
      await typeName('Draft 2')
      await act(async () => { await ui.handleUpdateBusinessMenuOption({ snooze_until: SNOOZE }) })
      expect(sentBody()).toMatchObject({ name: 'Draft 2' })
      expect(sentBody().snooze_until).toBeUndefined()
    })

    it('keeps the changes, sets `result` and returns { ok: false, error } when the API rejects', async () => {
      draw()
      await typeName('Draft')
      const pending = ui.formState.changes
      answer({ error: true, result: ['Nope'] })
      let result
      await act(async () => { result = await ui.handleUpdateBusinessMenuOption() })
      expect(result).toEqual({ ok: false, error: ['Nope'] })
      expect(ui.formState.changes).toEqual(pending)
      expect(ui.formState.result).toEqual({ error: true, result: ['Nope'] })
      expect(ui.formState.loading).toBe(false)
    })

    it('sets `result` and returns { ok: false, error } when the request throws', async () => {
      draw()
      await typeName('Draft')
      const pending = ui.formState.changes
      putAnswer = () => Promise.reject(new Error('Network down'))
      let result
      await act(async () => { result = await ui.handleUpdateBusinessMenuOption() })
      expect(result).toEqual({ ok: false, error: 'Network down' })
      expect(ui.formState.changes).toEqual(pending)
      expect(ui.formState.result).toEqual({ error: true, result: 'Network down' })
    })
  })

  describe('with { keepPendingChanges: true }', () => {
    it('sends only the given keys and keeps the other pending edits (same changes object when nothing was removed)', async () => {
      draw()
      await typeName('Draft')
      const pending = ui.formState.changes
      const resultBefore = ui.formState.result
      answer({ error: false, result: { id: 4, snooze_until: SNOOZE } })
      let result
      await act(async () => { result = await ui.handleUpdateBusinessMenuOption({ snooze_until: SNOOZE }, { keepPendingChanges: true }) })
      expect(puts()[0][0]).toBe('https://api.test/business/7/menus/4')
      expect(sentBody()).toEqual({ snooze_until: SNOOZE })
      expect(result).toEqual({ ok: true })
      expect(ui.formState.changes).toBe(pending)
      expect(ui.formState.changes.name).toBe('Draft')
      expect(ui.formState.result).toBe(resultBefore)
      expect(ui.formState.loading).toBe(false)
      expect(ui.businessMenuState.menu.snooze_until).toBe(SNOOZE)
      // the list row takes the answer; the open menu is not swapped (see the next case)
      expect(setMenuList).toHaveBeenCalled()
      expect(setCurrentMenu).not.toHaveBeenCalledWith({ menu: expect.objectContaining({ snooze_until: SNOOZE }) })
      expect(mocks.showToast).toHaveBeenLastCalledWith('success', 'Products catalog saved')
    })

    it('keeps the pending edits when the parent swaps the open menu as the store editor does (review 2.F R-2)', async () => {
      // S/BusinessMenu merges what it gets into its state and passes the open menu back as `menu`: a new object resets the form (`useEffect([menu])`), so the
      // first snooze of a freshly opened menu used to drop its unsaved name.
      const Parent = () => {
        const [current, setCurrent] = React.useState({ menu: { id: 4, name: 'Lunch', products: [], sites: [] } })
        return (
          <BusinessMenuOptions
            UIComponent={(props) => { ui = props; return null }}
            business={{ id: 7, categories: [] }}
            menu={current.menu}
            menuList={{ menus: [{ ...current.menu }] }}
            setMenuList={() => {}}
            setCurrentMenu={(data) => setCurrent(prev => ({ ...prev, ...data }))}
          />
        )
      }
      render(<Parent />)
      // the open menu loads its shared products first (and the parent swaps `menu` once), as on screen
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
      await typeName('Lunch pending')
      answer({ error: false, result: { id: 4, snooze_until: SNOOZE } })
      await act(async () => { await ui.handleUpdateBusinessMenuOption({ snooze_until: SNOOZE }, { keepPendingChanges: true }) })
      expect(ui.formState.changes.name).toBe('Lunch pending')
      expect(ui.businessMenuState.menu.snooze_until).toBe(SNOOZE)
    })

    it('removes only the sent keys from the pending changes', async () => {
      draw()
      await typeName('Draft')
      await act(async () => { ui.handleChangeInput({ target: { name: 'snooze_until', value: '2026-01-01 00:00:00' } }) })
      answer({ error: false, result: { id: 4, snooze_until: SNOOZE } })
      await act(async () => { await ui.handleUpdateBusinessMenuOption({ snooze_until: SNOOZE }, { keepPendingChanges: true }) })
      expect(ui.formState.changes.name).toBe('Draft')
      expect('snooze_until' in ui.formState.changes).toBe(false)
    })

    it('stringifies objects like the plain path and sends null as null', async () => {
      draw()
      answer({ error: false, result: { id: 4 } })
      await act(async () => { await ui.handleUpdateBusinessMenuOption({ sites: [1, 2], snooze_until: null }, { keepPendingChanges: true }) })
      expect(sentBody()).toEqual({ sites: '[1,2]', snooze_until: null })
    })

    it('leaves the changes, `result` and the entity alone and returns { ok: false, error } when the API rejects', async () => {
      draw()
      await typeName('Draft')
      const pending = ui.formState.changes
      const resultBefore = ui.formState.result
      answer({ error: true, result: ['Nope'] })
      let result
      await act(async () => { result = await ui.handleUpdateBusinessMenuOption({ snooze_until: SNOOZE }, { keepPendingChanges: true }) })
      expect(result).toEqual({ ok: false, error: ['Nope'] })
      expect(ui.formState.changes).toBe(pending)
      expect(ui.formState.result).toBe(resultBefore)
      expect(ui.formState.loading).toBe(false)
      expect(setMenuList).not.toHaveBeenCalled()
      expect(mocks.showToast.mock.calls.map(([type]) => type)).toEqual(['info'])
    })

    it('does the same when the request throws', async () => {
      draw()
      await typeName('Draft')
      const pending = ui.formState.changes
      const resultBefore = ui.formState.result
      putAnswer = () => Promise.reject(new Error('Network down'))
      let result
      await act(async () => { result = await ui.handleUpdateBusinessMenuOption({ snooze_until: SNOOZE }, { keepPendingChanges: true }) })
      expect(result).toEqual({ ok: false, error: 'Network down' })
      expect(ui.formState.changes).toBe(pending)
      expect(ui.formState.result).toBe(resultBefore)
      expect(ui.formState.loading).toBe(false)
    })
  })
})

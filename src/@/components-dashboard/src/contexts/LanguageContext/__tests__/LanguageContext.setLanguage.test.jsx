import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'

const api = vi.hoisted(() => ({ current: null }))

vi.mock('../../ApiContext', () => ({
  useApi: () => api.current.tuple
}))

import { LanguageProvider, useLanguage } from '../index'

const LANGUAGES = [
  { id: 1, code: 'en', rtl: false, name: 'English', enabled: true, default: true },
  { id: 2, code: 'es', rtl: false, name: 'Spanish', enabled: true, default: false },
  { id: 3, code: 'ar', rtl: true, name: 'Arabic', enabled: true, default: false }
]

const createApi = ({ withProject = false } = {}) => {
  const whereGet = vi.fn(async () => ({
    content: { error: false, result: [{ id: 2, code: 'es', rtl: false }] }
  }))
  const save = vi.fn(async () => ({
    content: { error: false, result: { id: 2, code: 'es', rtl: false, default: true } }
  }))
  const where = vi.fn(() => ({ get: whereGet }))
  const languages = vi.fn((id) => ({
    get: async () => ({ content: { error: false, result: LANGUAGES.map(language => ({ ...language })) } }),
    where,
    save: id === undefined ? undefined : save
  }))
  const translations = () => {
    const chain = {
      parameters: () => chain,
      where: () => chain,
      asDictionary: () => chain,
      get: async () => ({ content: { error: false, result: {} } })
    }
    return chain
  }
  const ordering = {
    project: withProject ? 'demo' : undefined,
    language: 'zz',
    languages,
    translations
  }
  const apiHelper = { setLanguage: vi.fn() }
  return { tuple: [ordering, apiHelper], languages, where, whereGet, save, apiHelper }
}

const createStrategy = (initial = {}) => {
  const store = { ...initial }
  return {
    store,
    getItem: vi.fn(async (key) => store[key] ?? null),
    setItem: vi.fn(async (key, value) => { store[key] = value })
  }
}

let latest
const Consumer = () => {
  latest = useLanguage()
  return null
}

const mount = (strategy) => render(
  <LanguageProvider strategy={strategy}>
    <Consumer />
  </LanguageProvider>
)

describe('LanguageContext.setLanguage', () => {
  let reload

  beforeEach(() => {
    reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    latest = undefined
  })

  it('reads the language with where().get() and never saves it as the project default, from the selector', async () => {
    api.current = createApi()
    const strategy = createStrategy()
    mount(strategy)

    await act(async () => { await latest[2].setLanguage({ id: 2, code: 'es' }, true) })

    expect(api.current.where).toHaveBeenCalledWith([{ attribute: 'id', value: 2 }])
    expect(api.current.whereGet).toHaveBeenCalledTimes(1)
    expect(api.current.save).not.toHaveBeenCalled()
  })

  it('never saves it as the project default without fromSelector either', async () => {
    api.current = createApi()
    const strategy = createStrategy()
    mount(strategy)

    await act(async () => { await latest[2].setLanguage({ id: 2, code: 'es' }) })

    expect(api.current.whereGet).toHaveBeenCalledTimes(1)
    expect(api.current.save).not.toHaveBeenCalled()
    expect(api.current.languages).not.toHaveBeenCalledWith(2)
  })

  it('stores { id, code, rtl } in the strategy and reloads the page', async () => {
    api.current = createApi()
    const strategy = createStrategy()
    mount(strategy)

    await act(async () => { await latest[2].setLanguage({ id: 2, code: 'es' }, true) })

    expect(strategy.setItem).toHaveBeenCalledWith('language', { id: 2, code: 'es', rtl: false }, true)
    expect(api.current.apiHelper.setLanguage).toHaveBeenCalledWith('es')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('stores nothing and does not reload when the API returns no language', async () => {
    api.current = createApi()
    api.current.whereGet.mockResolvedValueOnce({ content: { error: false, result: [] } })
    const strategy = createStrategy()
    mount(strategy)

    await act(async () => { await latest[2].setLanguage({ id: 9, code: 'xx' }, true) })

    expect(strategy.setItem).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('does nothing when the language is the one already selected', async () => {
    api.current = createApi()
    const strategy = createStrategy({ language: { id: 2, code: 'es', rtl: false } })
    mount(strategy)
    await waitFor(() => expect(latest[0].language?.id).toBe(2))

    await act(async () => { await latest[2].setLanguage({ id: 2, code: 'es' }, true) })

    expect(api.current.languages).not.toHaveBeenCalled()
    expect(api.current.save).not.toHaveBeenCalled()
    expect(strategy.setItem).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })
})

describe('LanguageContext.updateLanguageListState', () => {
  it('leaves default false on the other languages when one becomes the default', async () => {
    api.current = createApi({ withProject: true })
    const strategy = createStrategy()
    mount(strategy)
    await waitFor(() => expect(latest[0].languageList).toHaveLength(3))
    const before = latest[0].languageList

    act(() => { latest[2].updateLanguageListState({ id: 2, default: true }) })

    const after = latest[0].languageList
    expect(after.map(language => [language.id, language.default])).toEqual([[1, false], [2, true], [3, false]])
    // New objects: the ones held before the update are not mutated.
    expect(before[0].default).toBe(true)
    expect(before[1].default).toBe(false)
  })

  it('keeps the rest of the list untouched when the update is not a default', async () => {
    api.current = createApi({ withProject: true })
    const strategy = createStrategy()
    mount(strategy)
    await waitFor(() => expect(latest[0].languageList).toHaveLength(3))

    act(() => { latest[2].updateLanguageListState({ id: 3, enabled: false }) })

    expect(latest[0].languageList.map(language => [language.id, language.default, language.enabled]))
      .toEqual([[1, true, true], [2, false, true], [3, false, false]])
  })
})

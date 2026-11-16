/* eslint-disable import/first */
// redesign bugs F row 14: PagesList saves on change. A refused save must not resend itself in a loop, a new edit
// still sends, and typing a name is debounced into one save.
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

import { PagesList } from '../index'

let ui
let putAnswer

const reply = (content) => () => Promise.resolve({ json: async () => content })
const puts = () => mocks.fetch.mock.calls.filter(([, options]) => options.method === 'PUT')

const draw = async () => {
  ui = null
  const UI = (props) => {
    ui = props
    return null
  }
  await act(async () => { render(<PagesList UIComponent={UI} />) })
}
const flush = async () => { await act(async () => { await Promise.resolve() }) }

beforeEach(() => {
  mocks.showToast.mockReset()
  mocks.fetch.mockReset()
  putAnswer = reply({ error: true, result: ['x'] })
  // a runaway resend loop must fail the count, not hang the run: after 6 PUTs the API stops answering
  mocks.fetch.mockImplementation((url, options) => {
    if (options.method === 'GET') return reply({ error: false, result: [{ id: 3, name: 'About', enabled: true }] })()
    return puts().length > 6 ? new Promise(() => {}) : putAnswer()
  })
  vi.stubGlobal('fetch', mocks.fetch)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('PagesList controller · save on change', () => {
  it('sends a refused change once and does not resend it by itself', async () => {
    await draw()
    await act(async () => { ui.handleChangeState(3, 'enabled', false) })
    await flush()
    await flush()
    await flush()

    expect(puts()).toHaveLength(1)
    expect(puts()[0][0]).toBe('https://api.test/pages/3')
    expect(JSON.parse(puts()[0][1].body)).toEqual({ enabled: false })
  })

  it('does not resend after a network failure either', async () => {
    putAnswer = () => Promise.reject(new Error('Network down'))
    await draw()
    await act(async () => { ui.handleChangeState(3, 'enabled', false) })
    await flush()
    await flush()
    await flush()

    expect(puts()).toHaveLength(1)
  })

  it('sends a new edit after a refused one', async () => {
    await draw()
    await act(async () => { ui.handleChangeState(3, 'enabled', false) })
    await flush()
    await flush()
    await act(async () => { ui.handleChangeState(3, 'enabled', false) })
    await flush()
    await flush()

    expect(puts()).toHaveLength(2)
  })

  it('saves and updates the list when the API accepts the change', async () => {
    putAnswer = reply({ error: false, result: { id: 3 } })
    await draw()
    await act(async () => { ui.handleChangeState(3, 'enabled', false) })
    await flush()
    await flush()

    expect(puts()).toHaveLength(1)
    expect(ui.pagesListState.pages[0]).toMatchObject({ id: 3, enabled: false })
    expect(mocks.showToast).toHaveBeenCalledWith('success', 'Page saved')
  })

  it('debounces the name into a single save with the last value', async () => {
    putAnswer = reply({ error: false, result: { id: 3 } })
    await draw()
    vi.useFakeTimers()
    // a render between keystrokes (here, the list re-drawing) is what used to reset the debounce timer
    await act(async () => { ui.handleChangeState(3, 'name', 'A') })
    await act(async () => { ui.handleUpdatePageList([...ui.pagesListState.pages]) })
    await act(async () => { vi.advanceTimersByTime(400) })
    await act(async () => { ui.handleChangeState(3, 'name', 'Ab') })
    await act(async () => { ui.handleUpdatePageList([...ui.pagesListState.pages]) })
    await act(async () => { vi.advanceTimersByTime(400) })
    await act(async () => { ui.handleChangeState(3, 'name', 'Abc') })
    // 1.1s after the first keystroke the earlier values must have been dropped, nothing is sent yet
    await act(async () => { vi.advanceTimersByTime(500) })
    expect(puts()).toHaveLength(0)
    await act(async () => { vi.advanceTimersByTime(600) })
    vi.useRealTimers()
    await flush()
    await flush()

    expect(puts()).toHaveLength(1)
    expect(JSON.parse(puts()[0][1].body)).toEqual({ name: 'Abc' })
  })
})

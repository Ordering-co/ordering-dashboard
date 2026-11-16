/* eslint-disable import/first */
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// redesign (PF-10): handleGoogleAccountLink handles a blocked popup and keeps one message listener
const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  session: { token: 'tok-9', user: { id: 1, level: 0 } },
  api: { root: 'https://api.test', url: 'https://api.test' }
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [mocks.session] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [mocks.api, { configurations: { subdomain: 'acme' } }] }))
vi.mock('../../../contexts/ToastContext', () => ({
  ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' },
  useToast: () => [null, { showToast: mocks.showToast }]
}))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [null, (_key, fallback) => fallback] }))

import { UserDetails } from '..'

const USER = { id: 7, name: 'Ana', lastname: 'Lopez', level: 3 }

const renderDetails = (extra = {}) => {
  const ui = { current: null }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  const view = render(<UserDetails UIComponent={UIComponent} userId={USER.id} user={USER} {...extra} />)
  ui.unmount = view.unmount
  return ui
}

const messageCalls = (spy) => spy.mock.calls.filter(([type]) => type === 'message')

// the API answers the Google URL to a POST authenticated by header
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth?state=abc'
const apiAnswers = (body) => vi.fn().mockResolvedValue({ json: async () => body })
const makePopup = () => ({ closed: false, postMessage: vi.fn(), close: vi.fn(), location: { href: '' } })

describe('UserDetails · handleGoogleAccountLink (PF-10)', () => {
  let addSpy
  let removeSpy
  let setIntervalSpy

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    addSpy = vi.spyOn(window, 'addEventListener')
    removeSpy = vi.spyOn(window, 'removeEventListener')
    setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    vi.stubGlobal('fetch', apiAnswers({ error: false, result: { auth_url: AUTH_URL } }))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('a blocked popup (window.open -> null) returns popup-blocked and creates no interval nor listener', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    const ui = renderDetails()
    setIntervalSpy.mockClear()
    addSpy.mockClear()

    let outcome
    await act(async () => { outcome = await ui.current.handleGoogleAccountLink() })

    expect(outcome).toEqual({ ok: false, reason: 'popup-blocked' })
    expect(setIntervalSpy).not.toHaveBeenCalled()
    expect(messageCalls(addSpy)).toHaveLength(0)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('it asks the Google URL with the token in a header and never puts the token in a URL', async () => {
    const popup = makePopup()
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(popup)
    const ui = renderDetails()

    let outcome
    await act(async () => { outcome = await ui.current.handleGoogleAccountLink() })

    expect(outcome).toEqual({ ok: true })
    expect(openSpy).toHaveBeenCalledTimes(1)
    expect(openSpy.mock.calls[0][0]).toBe('')
    expect(openSpy.mock.calls[0][1]).toBe('_blank')
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe('https://api.test/users/7/google/permissions/request')
    expect(options.method).toBe('POST')
    expect(options.headers.Authorization).toBe('Bearer tok-9')
    expect(JSON.parse(options.body)).toEqual({ name: 'calendar', confirm: true })
    expect(popup.location.href).toBe(AUTH_URL)
    expect([url, popup.location.href, openSpy.mock.calls[0][0]].join(' ')).not.toContain('tok-9')
  })

  it('an API error closes the window, says why and starts no listener', async () => {
    vi.stubGlobal('fetch', apiAnswers({ error: true, result: ['ERROR_GOOGLE_BAD_SETTINGS'] }))
    const popup = makePopup()
    vi.spyOn(window, 'open').mockReturnValue(popup)
    const ui = renderDetails()
    setIntervalSpy.mockClear()
    addSpy.mockClear()

    let outcome
    await act(async () => { outcome = await ui.current.handleGoogleAccountLink() })

    expect(outcome).toEqual({ ok: false, reason: 'request-failed' })
    expect(popup.close).toHaveBeenCalled()
    expect(popup.location.href).toBe('')
    expect(mocks.showToast).toHaveBeenCalledWith('ERROR', 'ERROR_GOOGLE_BAD_SETTINGS')
    expect(setIntervalSpy).not.toHaveBeenCalled()
    expect(messageCalls(addSpy)).toHaveLength(0)
  })

  it('a request that never reaches the API closes the window and says it in words', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const popup = makePopup()
    vi.spyOn(window, 'open').mockReturnValue(popup)
    const ui = renderDetails()

    let outcome
    await act(async () => { outcome = await ui.current.handleGoogleAccountLink() })

    expect(outcome).toEqual({ ok: false, reason: 'request-failed' })
    expect(popup.close).toHaveBeenCalled()
    expect(mocks.showToast).toHaveBeenCalledWith('ERROR', 'Network error, please reload the page')
  })

  // the callback hands the code to this window and the link completes when this session confirms it
  const CONFIRM_MESSAGE = { confirm: true, code: 'c0d3', state: 'st4te', message: '' }
  // the listener of the last attempt, called as the browser would: jsdom's MessageEvent takes no plain object as source
  const deliver = (event) => messageCalls(addSpy).at(-1)[1](event)
  const apiAnswersInTurn = (...bodies) => {
    const spy = vi.fn()
    bodies.forEach((body) => spy.mockResolvedValueOnce({ json: async () => body }))
    return spy
  }

  it('it starts the link with confirm and confirms the code from this session', async () => {
    vi.stubGlobal('fetch', apiAnswersInTurn(
      { error: false, result: { auth_url: AUTH_URL, confirm: true } },
      { error: false, result: ['YOUR_CALENDAR_WILL_BE_SYNCHRONIZED'] }
    ))
    const popup = makePopup()
    vi.spyOn(window, 'open').mockReturnValue(popup)
    const ui = renderDetails()

    await act(async () => { await ui.current.handleGoogleAccountLink() })
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ name: 'calendar', confirm: true })

    deliver({ origin: 'https://api.test', source: popup, data: CONFIRM_MESSAGE })
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })

    expect(fetch).toHaveBeenCalledTimes(2)
    const [url, options] = fetch.mock.calls[1]
    expect(url).toBe('https://api.test/users/7/google/permissions/confirm')
    expect(options.method).toBe('POST')
    expect(options.headers.Authorization).toBe('Bearer tok-9')
    expect(JSON.parse(options.body)).toEqual({ code: 'c0d3', state: 'st4te' })
    expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'YOUR_CALENDAR_WILL_BE_SYNCHRONIZED')
    expect(popup.postMessage).toHaveBeenCalledWith('close', 'https://api.test')
  })

  it('a refused confirm says why and is not a success', async () => {
    vi.stubGlobal('fetch', apiAnswersInTurn(
      { error: false, result: { auth_url: AUTH_URL, confirm: true } },
      { error: true, result: ['ERROR_INVALID_STATE'] }
    ))
    const popup = makePopup()
    vi.spyOn(window, 'open').mockReturnValue(popup)
    const ui = renderDetails()

    await act(async () => { await ui.current.handleGoogleAccountLink() })
    deliver({ origin: 'https://api.test', source: popup, data: CONFIRM_MESSAGE })
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })

    expect(mocks.showToast).toHaveBeenCalledWith('ERROR', 'ERROR_INVALID_STATE')
    expect(mocks.showToast.mock.calls.filter(([type]) => type === 'SUCCESS')).toHaveLength(0)
  })

  it('an API without confirm answers no confirm, and the callback message is shown as today', async () => {
    vi.spyOn(window, 'open').mockReturnValue(makePopup())
    const ui = renderDetails()

    await act(async () => { await ui.current.handleGoogleAccountLink() })
    window.dispatchEvent(new MessageEvent('message', { origin: 'https://app.acme.ordering.co', data: { message: 'Linked' } }))
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Linked')
  })

  it.each([
    ['another origin', (popup) => ({ origin: 'https://evil.example.com', source: popup })],
    ['an origin that only contains the subdomain', (popup) => ({ origin: 'https://x.acme.ordering.co.attacker.net', source: popup })],
    ['another window at the API origin', () => ({ origin: 'https://api.test', source: makePopup() })]
  ])(': a code from %s is never confirmed', async (_label, from) => {
    vi.stubGlobal('fetch', apiAnswersInTurn({ error: false, result: { auth_url: AUTH_URL, confirm: true } }))
    const popup = makePopup()
    vi.spyOn(window, 'open').mockReturnValue(popup)
    const ui = renderDetails()

    await act(async () => { await ui.current.handleGoogleAccountLink() })
    deliver({ ...from(popup), data: CONFIRM_MESSAGE })
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('in confirm mode a callback message without the code is an error, not a success', async () => {
    vi.stubGlobal('fetch', apiAnswersInTurn({ error: false, result: { auth_url: AUTH_URL, confirm: true } }))
    const popup = makePopup()
    vi.spyOn(window, 'open').mockReturnValue(popup)
    const ui = renderDetails()

    await act(async () => { await ui.current.handleGoogleAccountLink() })
    deliver({ origin: 'https://api.test', source: popup, data: { message: 'ERROR_INVALID_STATE' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(mocks.showToast).toHaveBeenCalledWith('ERROR', 'ERROR_INVALID_STATE')
    expect(mocks.showToast.mock.calls.filter(([type]) => type === 'SUCCESS')).toHaveLength(0)
  })

  it('two clicks in a row remove the first listener before adding the second, and a valid message shows a single toast', async () => {
    const popup = makePopup()
    vi.spyOn(window, 'open').mockReturnValue(popup)
    const ui = renderDetails()
    addSpy.mockClear()
    removeSpy.mockClear()

    await act(async () => { await ui.current.handleGoogleAccountLink() })
    const first = messageCalls(addSpy)[0][1]
    await act(async () => { await ui.current.handleGoogleAccountLink() })

    const adds = messageCalls(addSpy)
    const removes = messageCalls(removeSpy)
    expect(adds).toHaveLength(2)
    expect(removes).toHaveLength(1)
    expect(removes[0][1]).toBe(first)
    expect(removeSpy.mock.invocationCallOrder[0]).toBeGreaterThan(addSpy.mock.invocationCallOrder[0])
    expect(removeSpy.mock.invocationCallOrder[0]).toBeLessThan(addSpy.mock.invocationCallOrder[1])

    window.dispatchEvent(new MessageEvent('message', { origin: 'https://app.acme.ordering.co', data: { message: 'Linked' } }))
    expect(mocks.showToast).not.toHaveBeenCalledWith('SUCCESS', 'Linked')
    await act(async () => { vi.advanceTimersByTime(1000) })

    const successCalls = mocks.showToast.mock.calls.filter(([type]) => type === 'SUCCESS')
    expect(successCalls).toEqual([['SUCCESS', 'Linked']])
    expect(popup.postMessage).toHaveBeenCalledWith('close', 'https://api.test')
  })

  it('ignores messages from another origin and removes the listener after the success toast', async () => {
    const popup = makePopup()
    vi.spyOn(window, 'open').mockReturnValue(popup)
    const ui = renderDetails()
    addSpy.mockClear()
    removeSpy.mockClear()

    await act(async () => { await ui.current.handleGoogleAccountLink() })
    const listener = messageCalls(addSpy)[0][1]

    window.dispatchEvent(new MessageEvent('message', { origin: 'https://evil.example.com', data: { message: 'nope' } }))
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(mocks.showToast).not.toHaveBeenCalled()

    window.dispatchEvent(new MessageEvent('message', { origin: 'https://app.acme.ordering.co', data: { message: 'Linked' } }))
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Linked')
    expect(messageCalls(removeSpy).map(([, fn]) => fn)).toContain(listener)
  })

  it('on unmount removes the listener and clears the interval', async () => {
    const popup = makePopup()
    vi.spyOn(window, 'open').mockReturnValue(popup)
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
    const ui = renderDetails()
    addSpy.mockClear()
    removeSpy.mockClear()

    await act(async () => { await ui.current.handleGoogleAccountLink() })
    const listener = messageCalls(addSpy)[0][1]
    const intervalId = setIntervalSpy.mock.results[setIntervalSpy.mock.results.length - 1].value
    clearIntervalSpy.mockClear()

    ui.unmount()

    expect(messageCalls(removeSpy).map(([, fn]) => fn)).toContain(listener)
    expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId)
  })

  it('does not post "close" nor throw when the window is already closed by the time the toast fires', async () => {
    const popup = makePopup()
    vi.spyOn(window, 'open').mockReturnValue(popup)
    const ui = renderDetails()

    await act(async () => { await ui.current.handleGoogleAccountLink() })
    window.dispatchEvent(new MessageEvent('message', { origin: 'https://app.acme.ordering.co', data: { message: 'Linked' } }))
    popup.closed = true
    popup.postMessage.mockClear()
    await act(async () => { vi.advanceTimersByTime(1000) })

    expect(popup.postMessage).not.toHaveBeenCalledWith('close', 'https://api.test')
    expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Linked')
  })

  it('removes the listener when the window closes', async () => {
    const popup = makePopup()
    vi.spyOn(window, 'open').mockReturnValue(popup)
    const ui = renderDetails()
    addSpy.mockClear()
    removeSpy.mockClear()

    await act(async () => { await ui.current.handleGoogleAccountLink() })
    const listener = messageCalls(addSpy)[0][1]

    popup.closed = true
    await act(async () => { vi.advanceTimersByTime(200) })

    expect(messageCalls(removeSpy).map(([, fn]) => fn)).toContain(listener)
  })
})

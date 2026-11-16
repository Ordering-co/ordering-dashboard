// The install links shared by the Builder's Builds card and My Products: one request per key at a time, a renewal that arrives
// while one is on its way is not lost (the answer on its way names the build before), nothing is asked for or drawn once the
// component is gone, and the countdown follows the link drawn, also after it was renewed.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import { INSTALL_TICK, useInstallLinks, useLinkCountdown } from '../useInstallLinks'

const DAY = 24 * 3600 * 1000

const linkOf = (url, expiresIn = DAY) => ({ url, expires_at: new Date(Date.now() + expiresIn).toISOString() })
const ok = (result) => ({ ok: true, result, errorCodes: [] })
const keyOf = (target) => target.id
const target = { id: 7 }

// `create` answers when the test says so: `answers[n]` settles the nth request
const pendingCreate = () => {
  const answers = []
  const create = vi.fn(() => new Promise(resolve => { answers.push(resolve) }))
  return { create, answers }
}

// The hook, with every url it ever gave for the target (what was drawn)
const renderLinks = (create) => {
  const drawn = []
  const view = renderHook(() => {
    const value = useInstallLinks(create, keyOf)
    const url = value.installLinks[target.id]?.link?.url
    if (url && drawn.at(-1) !== url) drawn.push(url)
    return value
  })
  return { ...view, drawn, state: () => view.result.current.installLinks[target.id] }
}

describe('useInstallLinks · a renewal while a request is on its way', () => {
  it('asks again once the one on its way answers, and draws only the second answer', async () => {
    const { create, answers } = pendingCreate()
    const view = renderLinks(create)

    act(() => { view.result.current.requestInstallLink(target) })
    act(() => { view.result.current.requestInstallLink(target, { renew: true }) })
    // one request per key at a time
    expect(create).toHaveBeenCalledTimes(1)

    await act(async () => { answers[0](ok(linkOf('https://files.test/old'))) })
    expect(create).toHaveBeenCalledTimes(2)
    expect(create).toHaveBeenLastCalledWith(target)
    expect(view.state()).toEqual({ loading: true, link: null, errorCodes: [] })

    await act(async () => { answers[1](ok(linkOf('https://files.test/new'))) })
    expect(view.state()).toMatchObject({ loading: false, link: { url: 'https://files.test/new' }, errorCodes: [] })
    expect(view.drawn).toEqual(['https://files.test/new'])
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('asks once more, not once per renewal, and for the last target', async () => {
    const { create, answers } = pendingCreate()
    const view = renderLinks(create)
    const latest = { id: 7, build: 3 }

    act(() => { view.result.current.requestInstallLink(target) })
    act(() => { view.result.current.requestInstallLink({ id: 7, build: 2 }, { renew: true }) })
    act(() => { view.result.current.requestInstallLink(latest, { renew: true }) })
    await act(async () => { answers[0](ok(linkOf('https://files.test/old'))) })
    expect(create).toHaveBeenCalledTimes(2)
    expect(create).toHaveBeenLastCalledWith(latest)

    await act(async () => { answers[1](ok(linkOf('https://files.test/new'))) })
    expect(create).toHaveBeenCalledTimes(2)
    expect(view.drawn).toEqual(['https://files.test/new'])
  })

  it('a renewal that arrives during the repeated request is kept too', async () => {
    const { create, answers } = pendingCreate()
    const view = renderLinks(create)

    act(() => { view.result.current.requestInstallLink(target) })
    act(() => { view.result.current.requestInstallLink(target, { renew: true }) })
    await act(async () => { answers[0](ok(linkOf('https://files.test/1'))) })
    act(() => { view.result.current.requestInstallLink(target, { renew: true }) })
    await act(async () => { answers[1](ok(linkOf('https://files.test/2'))) })
    expect(create).toHaveBeenCalledTimes(3)
    await act(async () => { answers[2](ok(linkOf('https://files.test/3'))) })
    expect(view.drawn).toEqual(['https://files.test/3'])
  })

  it('says why the repeated request was refused, not the answer of the one before', async () => {
    const { create, answers } = pendingCreate()
    const view = renderLinks(create)

    act(() => { view.result.current.requestInstallLink(target) })
    act(() => { view.result.current.requestInstallLink(target, { renew: true }) })
    await act(async () => { answers[0](ok(linkOf('https://files.test/old'))) })
    await act(async () => { answers[1]({ ok: false, result: null, errorCodes: ['build.artifact_missing'] }) })
    expect(view.state()).toEqual({ loading: false, link: null, errorCodes: ['build.artifact_missing'] })
    expect(view.drawn).toEqual([])
  })

  it('still ignores a request that is not a renewal while one is on its way, and keeps a link that is valid', async () => {
    const { create, answers } = pendingCreate()
    const view = renderLinks(create)

    act(() => { view.result.current.requestInstallLink(target) })
    act(() => { view.result.current.requestInstallLink(target) })
    await act(async () => { answers[0](ok(linkOf('https://files.test/1'))) })
    expect(create).toHaveBeenCalledTimes(1)
    expect(view.drawn).toEqual(['https://files.test/1'])

    act(() => { view.result.current.requestInstallLink(target) })
    expect(create).toHaveBeenCalledTimes(1)
  })
})

describe('useInstallLinks · a component that is gone', () => {
  it('asks for nothing else when the answer arrives after it was unmounted, even with a renewal waiting', async () => {
    const { create, answers } = pendingCreate()
    const view = renderLinks(create)

    act(() => { view.result.current.requestInstallLink(target) })
    act(() => { view.result.current.requestInstallLink(target, { renew: true }) })
    view.unmount()
    await act(async () => { answers[0](ok(linkOf('https://files.test/old'))) })

    expect(create).toHaveBeenCalledTimes(1)
    expect(view.drawn).toEqual([])
  })
})

describe('useLinkCountdown · after a renewal', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(Date.parse('2026-10-08T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('counts the new link down from its own expiry and expires it at its own end', () => {
    const view = renderHook(({ link }) => useLinkCountdown(link), { initialProps: { link: linkOf('https://files.test/1', 2 * 60000) } })
    expect(view.result.current.expired).toBe(false)
    act(() => { vi.advanceTimersByTime(2 * 60000) })
    expect(view.result.current.expired).toBe(true)

    // while the new one is asked for there is no link, and then the new one of 24 hours
    view.rerender({ link: null })
    expect(view.result.current.expired).toBe(false)
    view.rerender({ link: linkOf('https://files.test/2') })
    expect(view.result.current.expired).toBe(false)
    expect(view.result.current.expiresAt - view.result.current.now).toBe(DAY)

    act(() => { vi.advanceTimersByTime(INSTALL_TICK) })
    expect(view.result.current.expiresAt - view.result.current.now).toBe(DAY - INSTALL_TICK)
    act(() => { vi.advanceTimersByTime(DAY - INSTALL_TICK - 1) })
    expect(view.result.current.expired).toBe(false)
    act(() => { vi.advanceTimersByTime(1) })
    expect(view.result.current.expired).toBe(true)
  })

  it('counts down a link that replaces another still valid (a newer build finished)', () => {
    const view = renderHook(({ link }) => useLinkCountdown(link), { initialProps: { link: linkOf('https://files.test/1', DAY) } })
    act(() => { vi.advanceTimersByTime(3600 * 1000) })
    expect(view.result.current.expiresAt - view.result.current.now).toBe(DAY - 3600 * 1000)

    view.rerender({ link: linkOf('https://files.test/2') })
    expect(view.result.current.expiresAt - view.result.current.now).toBe(DAY)
    // the end of the link before no longer counts
    act(() => { vi.advanceTimersByTime(DAY - 3600 * 1000) })
    expect(view.result.current.expired).toBe(false)
    act(() => { vi.advanceTimersByTime(3600 * 1000) })
    expect(view.result.current.expired).toBe(true)
  })
})

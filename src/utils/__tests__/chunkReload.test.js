// redesign tramo B r3 (W0-PB2-01, W0-QB2-04, W0-PB2-06): a page chunk that fails to load reloads the page once, never in a loop;
// any other dynamic import behaves as in main (there is no global listener).
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CHUNK_RELOAD_GIVE_UP_MS, CHUNK_RELOAD_KEY, CHUNK_RELOAD_WINDOW_MS, createChunkReloadGuard, isChunkLoadError, lazyWithReload } from '../chunkReload'

const loadError = () => new TypeError('Failed to fetch dynamically imported module: https://x/assets/Page-abc.js')

const setup = (stored) => {
  const win = new EventTarget()
  const store = new Map(stored === undefined ? [] : [[CHUNK_RELOAD_KEY, String(stored)]])
  win.sessionStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }
  const reload = vi.fn()
  let time = 1000000
  const guard = createChunkReloadGuard({ win, reload, now: () => time })
  // `fresh()` is the same tab after the reload: a new document (no memory) over the same sessionStorage.
  const fresh = () => createChunkReloadGuard({ win, reload, now: () => time })
  return { guard, fresh, reload, store, win, advance: ms => { time += ms } }
}

const settled = (promise) => Promise.race([
  promise.then(value => ({ value }), error => ({ error })),
  new Promise(resolve => setTimeout(() => resolve({ pending: true }), 20))
])

describe('isChunkLoadError', () => {
  it.each([
    'Failed to fetch dynamically imported module: /a.js',
    'error loading dynamically imported module',
    'Importing a module script failed.',
    'Unable to preload CSS for /assets/a.css',
    "'text/html' is not a valid JavaScript MIME type for module script 'https://dashboard.ordering.co/assets/index-CxXs63fU.js'.",
    "'text/html' is not a valid JavaScript MIME type."
  ])('recognises %s', (message) => expect(isChunkLoadError(new Error(message))).toBe(true))

  it('recognises ChunkLoadError by name and rejects other errors', () => {
    const named = new Error('x')
    named.name = 'ChunkLoadError'
    expect(isChunkLoadError(named)).toBe(true)
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'a')"))).toBe(false)
    expect(isChunkLoadError(null)).toBe(false)
  })
})

describe('lazyWithReload (a page or panel import)', () => {
  it('resolves the module untouched when the import works', async () => {
    const { guard, reload } = setup()
    await expect(lazyWithReload(() => Promise.resolve({ default: 1 }), guard)).resolves.toEqual({ default: 1 })
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads once when its chunk fails to load, and keeps Suspense waiting (never settles)', async () => {
    const { guard, reload, store } = setup()
    const result = await settled(lazyWithReload(() => Promise.reject(loadError()), guard))
    expect(result).toEqual({ pending: true })
    expect(reload).toHaveBeenCalledTimes(1)
    expect(store.get(CHUNK_RELOAD_KEY)).toBe('1000000')
  })

  it('reloads once when Safari rejects the chunk because the server answered it with HTML', async () => {
    const { guard, reload } = setup()
    const error = new TypeError("'text/html' is not a valid JavaScript MIME type for module script 'https://dashboard.ordering.co/assets/index-CxXs63fU.js'.")
    expect(await settled(lazyWithReload(() => Promise.reject(error), guard))).toEqual({ pending: true })
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does not loop: a second failure inside the window is thrown for the error boundary', async () => {
    const { guard, fresh, reload, advance } = setup()
    await settled(lazyWithReload(() => Promise.reject(loadError()), guard))
    advance(2000)
    const error = loadError()
    expect(await settled(lazyWithReload(() => Promise.reject(error), fresh()))).toEqual({ error })
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reloads again for a later deploy (after the window)', async () => {
    const { guard, reload, advance } = setup()
    await settled(lazyWithReload(() => Promise.reject(loadError()), guard))
    advance(60000)
    expect(await settled(lazyWithReload(() => Promise.reject(loadError()), guard))).toEqual({ pending: true })
    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('treats a reload marked a moment ago in sessionStorage as done', async () => {
    const { guard, reload } = setup(999000)
    const error = loadError()
    expect(await settled(lazyWithReload(() => Promise.reject(error), guard))).toEqual({ error })
    expect(reload).not.toHaveBeenCalled()
  })

  it('several chunks failing together make one reload; none of them is thrown', async () => {
    const { guard, reload } = setup()
    const results = await Promise.all([1, 2, 3].map(() => settled(lazyWithReload(() => Promise.reject(loadError()), guard))))
    expect(results).toEqual([{ pending: true }, { pending: true }, { pending: true }])
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('throws any other error as it is, without reloading (a bug of the module is not a deploy)', async () => {
    const { guard, reload } = setup()
    const error = new TypeError("Cannot read properties of undefined (reading 'x')")
    expect(await settled(lazyWithReload(() => Promise.reject(error), guard))).toEqual({ error })
    expect(reload).not.toHaveBeenCalled()
  })

  // redesign tramo B r3 (W0-PB2-06): when sessionStorage throws the time of a reload cannot be kept, so the next load could not
  // tell it had already reloaded and a missing chunk would reload forever. The guard fails closed: no reload, the error is thrown.
  it('never reloads when sessionStorage throws (it could not remember it, and would loop)', async () => {
    const win = new EventTarget()
    win.sessionStorage = { getItem () { throw new Error('blocked') }, setItem () { throw new Error('blocked') } }
    const reload = vi.fn()
    const guard = createChunkReloadGuard({ win, reload })
    const first = loadError()
    const second = loadError()
    expect(await settled(lazyWithReload(() => Promise.reject(first), guard))).toEqual({ error: first })
    expect(await settled(lazyWithReload(() => Promise.reject(second), guard))).toEqual({ error: second })
    expect(reload).not.toHaveBeenCalled()
  })

  it('does not reload when it can read the time but not write it', async () => {
    const win = new EventTarget()
    win.sessionStorage = { getItem: () => null, setItem () { throw new Error('quota') } }
    const reload = vi.fn()
    const error = loadError()
    expect(await settled(lazyWithReload(() => Promise.reject(error), createChunkReloadGuard({ win, reload })))).toEqual({ error })
    expect(reload).not.toHaveBeenCalled()
  })
})

describe('there is no global listener (W0-QB2-04)', () => {
  it('an import that is not a page and fails runs its own catch, and nothing reloads', async () => {
    // Same shape as the pdf and web-vitals loaders: a plain import() with a try/catch that falls back. The guard is created and
    // given a window whose `vite:preloadError` is dispatched, as Vite does: no listener of the guard may take it.
    const { reload, win } = setup()
    const event = new Event('vite:preloadError', { cancelable: true })
    const handled = vi.fn()
    const loadLocale = async () => {
      try {
        await Promise.reject(loadError())
      } catch (error) {
        handled(error.message)
        return 'en-US'
      }
      return 'fr-FR'
    }
    win.dispatchEvent(event)
    expect(await loadLocale()).toBe('en-US')
    expect(handled).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it('src/index.js does not install any vite:preloadError listener', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const entry = readFileSync(join(__dirname, '../../index.js'), 'utf8')
    expect(entry).not.toMatch(/addEventListener\(\s*['"]vite:preloadError/)
    expect(entry).not.toMatch(/installChunkReloadGuard\(/)
  })
})

// redesign tramo B r4 (W0-PB3-03): a reload that does not end the page (a beforeunload handler, a cancelled dialog) must not leave the
// loading state for ever: after the give-up time the original error is thrown so the boundary acts.
describe('lazyWithReload · a reload that does not happen', () => {
  afterEach(() => vi.useRealTimers())

  // redesign tramo B cierre (W0-PB4-01): a reload that takes 10 to 30 s is still a reload: the page waits as long as the guard remembers it
  it('waits 30 s, the same as the reload window, before it gives up', async () => {
    expect(CHUNK_RELOAD_GIVE_UP_MS).toBe(30000)
    expect(CHUNK_RELOAD_GIVE_UP_MS).toBe(CHUNK_RELOAD_WINDOW_MS)
    vi.useFakeTimers()
    const { guard } = setup()
    const error = loadError()
    let settled = false
    const outcome = lazyWithReload(() => Promise.reject(error), guard).then(value => ({ value }), caught => ({ caught }))
    outcome.then(() => { settled = true })
    await vi.advanceTimersByTimeAsync(29999)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect((await outcome).caught).toBe(error)
  })

  it('rejects with the original error when the page is still alive after the give-up time', async () => {
    vi.useFakeTimers()
    const { guard, reload } = setup()
    const error = loadError()
    const outcome = lazyWithReload(() => Promise.reject(error), guard).then(value => ({ value }), caught => ({ caught }))
    await vi.advanceTimersByTimeAsync(CHUNK_RELOAD_GIVE_UP_MS - 1)
    expect(reload).toHaveBeenCalledTimes(1)
    let done = false
    outcome.then(() => { done = true })
    await vi.advanceTimersByTimeAsync(0)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect((await outcome).caught).toBe(error)
  })

  it('does the same for another chunk that fails while the reload is under way (same document)', async () => {
    vi.useFakeTimers()
    const { guard, reload } = setup()
    lazyWithReload(() => Promise.reject(loadError()), guard).catch(() => {})
    await vi.advanceTimersByTimeAsync(10)
    const second = new TypeError('Failed to fetch dynamically imported module: /b.js')
    const outcome = lazyWithReload(() => Promise.reject(second), guard).then(value => ({ value }), caught => ({ caught }))
    await vi.advanceTimersByTimeAsync(CHUNK_RELOAD_GIVE_UP_MS)
    expect(reload).toHaveBeenCalledTimes(1)
    expect((await outcome).caught).toBe(second)
  })
})

// an import can ask for something to be done right before the reload (the new-order wizard writes `?add=custom_order`
// back into the URL so the sheet reopens). Only an import that passes `beforeReload` is affected.
describe('lazyWithReload · beforeReload', () => {
  it('calls beforeReload once, before the reload, and only when it is going to reload', async () => {
    const { guard, reload } = setup()
    const order = []
    reload.mockImplementation(() => order.push('reload'))
    const beforeReload = vi.fn(() => order.push('beforeReload'))
    expect(await settled(lazyWithReload(() => Promise.reject(loadError()), guard, { beforeReload }))).toEqual({ pending: true })
    expect(beforeReload).toHaveBeenCalledTimes(1)
    expect(order).toEqual(['beforeReload', 'reload'])
  })

  it('does not call it when the guard refuses (a reload inside the window) or sessionStorage is broken', async () => {
    const { guard } = setup(999000)
    const beforeReload = vi.fn()
    const error = loadError()
    expect(await settled(lazyWithReload(() => Promise.reject(error), guard, { beforeReload }))).toEqual({ error })
    const win = new EventTarget()
    win.sessionStorage = { getItem () { throw new Error('blocked') }, setItem () { throw new Error('blocked') } }
    const broken = createChunkReloadGuard({ win, reload: vi.fn() })
    expect(await settled(lazyWithReload(() => Promise.reject(error), broken, { beforeReload }))).toEqual({ error })
    expect(beforeReload).not.toHaveBeenCalled()
  })

  it('does not call it for an error that is not a chunk load error, nor when the import works', async () => {
    const { guard, reload } = setup()
    const beforeReload = vi.fn()
    const error = new TypeError("Cannot read properties of undefined (reading 'x')")
    expect(await settled(lazyWithReload(() => Promise.reject(error), guard, { beforeReload }))).toEqual({ error })
    await expect(lazyWithReload(() => Promise.resolve({ default: 1 }), guard, { beforeReload })).resolves.toEqual({ default: 1 })
    expect(beforeReload).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads anyway when beforeReload throws (the reload is what recovers the tab)', async () => {
    const { guard, reload } = setup()
    const beforeReload = vi.fn(() => { throw new Error('boom') })
    expect(await settled(lazyWithReload(() => Promise.reject(loadError()), guard, { beforeReload }))).toEqual({ pending: true })
    expect(beforeReload).toHaveBeenCalledTimes(1)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('calls it once for several chunks failing together', async () => {
    const { guard, reload } = setup()
    const beforeReload = vi.fn()
    await Promise.all([1, 2, 3].map(() => settled(lazyWithReload(() => Promise.reject(loadError()), guard, { beforeReload }))))
    expect(beforeReload).toHaveBeenCalledTimes(1)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('an import without the option behaves as before', async () => {
    const { guard, reload } = setup()
    expect(await settled(lazyWithReload(() => Promise.reject(loadError()), guard))).toEqual({ pending: true })
    expect(reload).toHaveBeenCalledTimes(1)
  })
})

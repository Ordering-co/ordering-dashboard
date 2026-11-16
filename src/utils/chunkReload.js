// redesign tramo B r3 (W0-PB2-01, W0-QB2-04): pages and the order panels are chunks (React.lazy). After a deploy the files an open
// tab points at are gone and the `import()` of a page rejects. Only those imports are wrapped, one by one, with `lazyWithReload`:
// the first time, the page reloads (it then gets the new index.html and the new chunk names); if a reload happened less than
// `windowMs` ago, or the time of the reload cannot be kept, the error is thrown again and the error boundary of the content
// area acts. There is NO global `vite:preloadError` listener: calling `preventDefault()` there makes every dynamic import resolve
// `undefined`, which silences the `catch` of imports that already handle their failure (pdf, web-vitals).
// The time of the reload is kept in sessionStorage.
export const CHUNK_RELOAD_KEY = 'dashboard:chunk-reload-at'
export const CHUNK_RELOAD_WINDOW_MS = 30000
// redesign tramo B r4 (W0-PB3-03): how long a page waits for a reload it asked for before it gives up and throws the original error.
// redesign tramo B cierre (W0-PB4-01): the same as the reload window (30 s), so a slow reload (10 to 30 s) is not cut short by an error
// that is reported just before the new page arrives; past that the reload is not going to happen (cancelled or blocked).
export const CHUNK_RELOAD_GIVE_UP_MS = CHUNK_RELOAD_WINDOW_MS

// Messages of a dynamic import that could not load its file (Chrome / Firefox / Safari / Vite's CSS preload).
const CHUNK_LOAD_MESSAGE = /dynamically imported module|Importing a module script failed|Unable to preload CSS|error loading dynamically|is not a valid JavaScript MIME type/i

export const isChunkLoadError = (error) => {
  if (!error) return false
  if (error.name === 'ChunkLoadError') return true
  return CHUNK_LOAD_MESSAGE.test(String(error.message ?? error))
}

/**
 * A guard that allows one reload per `windowMs`. `reloadOnce()` returns true when it started the reload (or one is already under
 * way in this document), false when the error must be shown instead. It fails closed: if sessionStorage cannot keep the time
 * (it throws), no reload is made, because the next load could not tell it had already reloaded and would loop.
 */
export const createChunkReloadGuard = ({
  win = typeof window === 'undefined' ? null : window,
  windowMs = CHUNK_RELOAD_WINDOW_MS,
  now = () => Date.now(),
  reload = () => win.location.reload()
} = {}) => {
  let startedAt = 0
  // `beforeReload` (optional) runs once, right before the reload, and only when this call is the one that reloads.
  const reloadOnce = (beforeReload) => {
    if (!win) return false
    const at = now()
    // Another chunk failed while the reload is under way: it is the same reload.
    if (startedAt && at - startedAt < windowMs) return true
    let last = 0
    try { last = Number(win.sessionStorage.getItem(CHUNK_RELOAD_KEY)) || 0 } catch (_) { return false }
    if (last && at - last < windowMs) return false
    try { win.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(at)) } catch (_) { return false }
    startedAt = at
    // A failing hook must not cancel the reload: the reload is what recovers the tab.
    try { beforeReload?.() } catch (_) {}
    reload()
    return true
  }
  return { reloadOnce }
}

let defaultGuard = null

/**
 * Wraps the `import()` of a page or panel: `lazy(() => lazyWithReload(() => import('./pages/X')))`. When the import rejects
 * because its chunk could not load and the guard allows it, the page reloads (the promise then never settles, so Suspense keeps
 * its fallback until the reload, or for `giveUpMs` if the page is still there, and then it rejects with the original error); otherwise the error is thrown again for the boundary. Other rejections are thrown untouched.
 * `beforeReload` (optional) is called right before the reload, and only when the reload is really going to happen. An
 * import that opens from a one-shot URL param (the new-order wizard) uses it to put the param back, since the param is removed once consumed.
 */
export const lazyWithReload = (factory, guard, { giveUpMs = CHUNK_RELOAD_GIVE_UP_MS, beforeReload } = {}) => factory().catch((error) => {
  if (!isChunkLoadError(error)) throw error
  const active = guard ?? (defaultGuard ??= createChunkReloadGuard())
  if (active.reloadOnce(beforeReload)) {
    // redesign tramo B r4 (W0-PB3-03): a reload that really happens ends this document, so the timer never fires. If the page is
    // still alive after `giveUpMs` (a `beforeunload` handler or the user cancelled it), the promise rejects with the original
    // error so the error boundary acts instead of the loading state hanging. The same goes for any other chunk that failed inside
    // the window of a reload already under way.
    return new Promise((resolve, reject) => { setTimeout(() => reject(error), giveUpMs) })
  }
  throw error
})

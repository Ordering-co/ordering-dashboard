/**
 * Which record searches run in safe mode, per project. Pure.
 *
 * Extended search is the default. When an extended order or user search is
 * slower than RECORD_SEARCH_SLOW_MS (commandPaletteRecords.js), the palette
 * marks that entity of that project as slow in localStorage and searches it
 * in safe mode from then on, in this browser. The mark expires after 30 days
 * so a project that got faster (new indexes) goes back to extended search.
 *
 * Storage can be missing or blocked: every access is guarded, and without it
 * the mark lasts for the open session only.
 */

export const COMMAND_PALETTE_SLOW_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const COMMAND_PALETTE_SEARCH_ENTITIES = ['orders', 'users']

export const getCommandPaletteSlowKey = (project) => project ? `command_palette_slow_search:${project}` : null

const getStorage = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

/** `{ orders: bool, users: bool }`: true means safe mode. */
export const readCommandPaletteSlowSearch = (project, now = Date.now()) => {
  const empty = { orders: false, users: false }
  const key = getCommandPaletteSlowKey(project)
  if (!key) return empty
  try {
    const stored = JSON.parse(getStorage()?.getItem(key) || '{}')
    return Object.fromEntries(COMMAND_PALETTE_SEARCH_ENTITIES.map(entity => {
      const at = Number(stored?.[entity])
      return [entity, Number.isFinite(at) && at > 0 && now - at < COMMAND_PALETTE_SLOW_TTL_MS]
    }))
  } catch {
    return empty
  }
}

/** Marks `entity` of `project` as slow. Returns the new flags. */
export const markCommandPaletteSlowSearch = (project, entity, now = Date.now()) => {
  const key = getCommandPaletteSlowKey(project)
  const current = readCommandPaletteSlowSearch(project, now)
  if (!key || !COMMAND_PALETTE_SEARCH_ENTITIES.includes(entity)) return current
  try {
    const stored = JSON.parse(getStorage()?.getItem(key) || '{}')
    getStorage()?.setItem(key, JSON.stringify({ ...(stored && typeof stored === 'object' ? stored : {}), [entity]: now }))
  } catch {}
  return { ...current, [entity]: true }
}

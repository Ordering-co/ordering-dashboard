/**
 * Recent command palette destinations. Pure, no React.
 *
 * Stored per project and user in localStorage, newest first. Storage can be
 * missing or blocked: every access is guarded and the palette works without it.
 */

export const COMMAND_PALETTE_RECENT_LIMIT = 5

export const getCommandPaletteRecentKey = ({ project, userId } = {}) =>
  project && userId ? `command_palette_recent:${project}:${userId}` : null

const getStorage = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

const RECENT_FIELDS = ['id', 'group', 'title', 'subtitle', 'path', 'icon']

const sanitize = (item) => {
  if (!item || typeof item !== 'object' || !item.id || !item.path) return null
  if (typeof item.path !== 'string' || !item.path.startsWith('/')) return null
  return Object.fromEntries(RECENT_FIELDS.filter(field => item[field] !== undefined).map(field => [field, item[field]]))
}

export const readCommandPaletteRecent = (key) => {
  if (!key) return []
  try {
    const raw = getStorage()?.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return (Array.isArray(parsed) ? parsed : []).map(sanitize).filter(Boolean).slice(0, COMMAND_PALETTE_RECENT_LIMIT)
  } catch {
    return []
  }
}

export const pushCommandPaletteRecent = (key, item) => {
  const entry = sanitize(item)
  if (!key || !entry) return readCommandPaletteRecent(key)
  const next = [entry, ...readCommandPaletteRecent(key).filter(recent => recent.id !== entry.id)]
    .slice(0, COMMAND_PALETTE_RECENT_LIMIT)
  try {
    getStorage()?.setItem(key, JSON.stringify(next))
  } catch {}
  return next
}

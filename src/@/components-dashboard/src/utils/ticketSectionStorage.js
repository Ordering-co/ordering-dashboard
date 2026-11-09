export const TICKET_SECTIONS_STORAGE_KEY = 'ordering-dashboard:ticket-sections'

const SECTION_KEYS = ['orderNumber', 'customer', 'business', 'orderDetails']

const memoryStorage = () => {
  const entries = new Map()
  return {
    getItem: (key) => (entries.has(key) ? entries.get(key) : null),
    setItem: (key, value) => entries.set(key, String(value)),
    removeItem: (key) => entries.delete(key)
  }
}

const storageOf = (storage) => storage || (typeof window !== 'undefined' ? window.localStorage : memoryStorage())

export const readTicketSections = (storage) => {
  try {
    const raw = storageOf(storage).getItem(TICKET_SECTIONS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const sections = {}
    for (const key of SECTION_KEYS) {
      if (typeof parsed[key] === 'boolean') sections[key] = parsed[key]
    }
    return Object.keys(sections).length ? sections : null
  } catch {
    return null
  }
}

export const writeTicketSections = (sections, storage) => {
  const payload = {}
  for (const key of SECTION_KEYS) {
    if (typeof sections?.[key] === 'boolean') payload[key] = sections[key]
  }
  storageOf(storage).setItem(TICKET_SECTIONS_STORAGE_KEY, JSON.stringify(payload))
}

export const clearTicketSections = (storage) => {
  storageOf(storage).removeItem(TICKET_SECTIONS_STORAGE_KEY)
}

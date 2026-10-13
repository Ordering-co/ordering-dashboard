/**
 * Pure helpers for the API usage limits screen.
 * Contract: GET /{version}/{lang}/{project}/usage_limits.
 */

/** Shortest gap before the Refresh button can ask again. */
export const USAGE_LIMITS_MANUAL_COOLDOWN_MS = 5000

const STATUS_ORDER = { exceeded: 0, warning: 1, ok: 2 }
const SCOPE_ORDER = { project: 0, http: 1, resource: 2, custom: 3, unknown: 4 }
const WINDOW_ORDER = { second: 0, minute: 1, hour: 2, day: 3, month: 4 }
const KEY_ORDER = { project: 0, app: 1, client: 2 }

/**
 * Exceeded first, then warning, then ok. Inside a status, limits on the same
 * scope sit together, shortest window first, then project / app / client.
 */
export const sortUsageLimits = (limits = []) =>
  [...limits].sort((a, b) => {
    const scopeA = parseUsageScope(a?.scope)
    const scopeB = parseUsageScope(b?.scope)
    return (
      (STATUS_ORDER[a?.status] ?? 3) - (STATUS_ORDER[b?.status] ?? 3) ||
      (SCOPE_ORDER[scopeA.type] ?? 5) - (SCOPE_ORDER[scopeB.type] ?? 5) ||
      String(a?.scope ?? '').localeCompare(String(b?.scope ?? '')) ||
      (WINDOW_ORDER[a?.window] ?? 5) - (WINDOW_ORDER[b?.window] ?? 5) ||
      (KEY_ORDER[a?.key] ?? 3) - (KEY_ORDER[b?.key] ?? 3)
    )
  })

/**
 * `*` → project, `http:POST auth` → endpoint, `resource:sms` → resource,
 * `custom:foo` → custom counter. Anything else is shown as is.
 */
export const parseUsageScope = (scope) => {
  const value = String(scope ?? '').trim()
  if (value === '*') return { type: 'project' }
  const separator = value.indexOf(':')
  if (separator === -1) return { type: 'unknown', name: value }
  const type = value.slice(0, separator)
  const rest = value.slice(separator + 1).trim()
  if (type === 'http') {
    const [method = '', ...pathParts] = rest.split(/\s+/)
    const path = pathParts.join(' ').replace(/^\/+/, '')
    return { type: 'http', method: method.toUpperCase(), path: `/${path}` }
  }
  if (type === 'resource' || type === 'custom') return { type, name: rest }
  return { type: 'unknown', name: value }
}

/** `whatsapp_template` → `Whatsapp template`. */
export const humanizeUsageName = (name) => {
  const text = String(name ?? '').replace(/[_-]+/g, ' ').trim()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : ''
}

/**
 * Seconds left in the window. Uses `reset_at` when it parses, else counts
 * `reset_in` down from the moment the response arrived.
 */
export const getUsageSecondsLeft = (limit, now, fetchedAt) => {
  const resetAt = limit?.reset_at ? Date.parse(limit.reset_at) : NaN
  if (!Number.isNaN(resetAt)) return Math.max(0, Math.ceil((resetAt - now) / 1000))
  if (typeof limit?.reset_in === 'number' && typeof fetchedAt === 'number') {
    return Math.max(0, limit.reset_in - Math.floor((now - fetchedAt) / 1000))
  }
  return null
}

/**
 * Two largest units: `17 s`, `3 min 5 s`, `2 h 5 min`, `4 d 3 h`.
 * `units` carries the translated abbreviations.
 */
export const formatUsageDuration = (seconds, units = {}) => {
  const { d = 'd', h = 'h', min = 'min', s = 's' } = units
  const total = Math.max(0, Math.floor(Number(seconds) || 0))
  const parts = [
    [Math.floor(total / 86400), d],
    [Math.floor((total % 86400) / 3600), h],
    [Math.floor((total % 3600) / 60), min],
    [total % 60, s]
  ]
  const first = parts.findIndex(([value]) => value > 0)
  if (first === -1) return `0 ${s}`
  return parts
    .slice(first, first + 2)
    .filter(([value]) => value > 0)
    .map(([value, unit]) => `${value} ${unit}`)
    .join(' ')
}

/** API error payloads come as a string, an array, or `{ error_codes }`. */
export const getUsageErrorMessage = (result) => {
  if (!result) return null
  if (typeof result === 'string') return result
  if (Array.isArray(result)) return result.filter(Boolean).join(', ') || null
  if (typeof result === 'object') {
    if (Array.isArray(result.error_codes)) return result.error_codes.join(', ')
    if (typeof result.message === 'string') return result.message
  }
  return null
}

/** Lowercase, no accents, trimmed. */
export const normalizeUsageSearch = (value) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()

/** Optimal string alignment distance: edits plus adjacent swaps (`emial` → `email` is 1). */
const editDistance = (a, b) => {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) rows[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1)
      }
    }
  }
  return rows[a.length][b.length]
}

/** `prj` → `project`: same first letter, the rest in order. */
const isSubsequence = (term, word) => {
  if (!term || term[0] !== word[0]) return false
  let index = 0
  for (const char of word) {
    if (char === term[index]) index++
    if (index === term.length) return true
  }
  return false
}

const allowedTypos = (term) => (term.length >= 7 ? 2 : term.length >= 4 ? 1 : 0)

const termMatchesWord = (term, word) => {
  if (word.includes(term) || isSubsequence(term, word)) return true
  const typos = allowedTypos(term)
  if (!typos) return false
  // Compare against the word and against its prefix, so `webhok` finds `webhooks`.
  return editDistance(term, word) <= typos ||
    (word.length > term.length && editDistance(term, word.slice(0, term.length)) <= typos)
}

/**
 * Fuzzy match: every term of the query must hit one word of the texts,
 * as a substring, a subsequence or with a small typo.
 */
export const matchesUsageSearch = (query, texts = []) => {
  const terms = normalizeUsageSearch(query).split(/\s+/).filter(Boolean)
  if (!terms.length) return true
  const haystack = normalizeUsageSearch(texts.filter(Boolean).join(' '))
  const words = new Set([
    ...haystack.split(/\s+/),
    ...haystack.split(/[^a-z0-9%]+/)
  ].filter(Boolean))
  return terms.every(term => haystack.includes(term) || [...words].some(word => termMatchesWord(term, word)))
}

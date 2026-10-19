/**
 * Last menu import per {project, businessId, source}, kept in localStorage so the
 * Importers panel can show it after a reload.
 * Records hold only mapped copy and counts: no tokens, emails or raw server payloads.
 */

const STORAGE_PREFIX = 'menu-import-runs:'

/** A browser request cannot still be in flight after this: older `importing` reads as `unknown`. */
export const IMPORT_STALE_AFTER_MS = 15 * 60 * 1000

/**
 * How long a run stays visible after its last activity (start, finish or check).
 * Change this number to show runs for more or fewer hours.
 */
export const RUN_EXPIRES_AFTER_HOURS = 1

export const RUN_EXPIRES_AFTER_MS = RUN_EXPIRES_AFTER_HOURS * 60 * 60 * 1000

const listeners = new Set()
const cache = new Map()

const storageKey = (project) => `${STORAGE_PREFIX}${project}`
const recordKey = (businessId, source) => `${businessId}:${source}`

const hasRef = ({ project, businessId, source } = {}) =>
  Boolean(project) && businessId != null && businessId !== '' && Boolean(source)

const readRecords = (project) => {
  const key = storageKey(project)
  let raw = null
  try {
    raw = window.localStorage.getItem(key)
  } catch {
    raw = null
  }
  const cached = cache.get(key)
  if (cached && cached.raw === raw) return cached.records

  let records = {}
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      records = parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      records = {}
    }
  }
  cache.set(key, { raw, records })
  return records
}

const writeRecords = (project, records) => {
  const key = storageKey(project)
  const raw = Object.keys(records).length ? JSON.stringify(records) : null
  try {
    if (raw) {
      window.localStorage.setItem(key, raw)
    } else {
      window.localStorage.removeItem(key)
    }
  } catch {
    // Storage unavailable or full: the in-memory cache below still serves this session.
  }
  cache.set(key, { raw, records })
  listeners.forEach((listener) => listener())
}

export const getRun = (ref) => {
  if (!hasRef(ref)) return null
  return readRecords(ref.project)[recordKey(ref.businessId, ref.source)] ?? null
}

export const saveRun = (ref, run) => {
  if (!hasRef(ref)) return
  writeRecords(ref.project, {
    ...readRecords(ref.project),
    [recordKey(ref.businessId, ref.source)]: run
  })
}

export const clearRun = (ref) => {
  if (!hasRef(ref)) return
  const { [recordKey(ref.businessId, ref.source)]: _removed, ...rest } = readRecords(ref.project)
  writeRecords(ref.project, rest)
}

export const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Status as it should be read now: a stale `importing` run is `unknown`. */
export const resolveRunStatus = (run, now = Date.now()) => {
  if (run?.status !== 'importing') return run?.status ?? null
  const startedAt = Date.parse(run.startedAt)
  if (Number.isNaN(startedAt)) return 'unknown'
  return now - startedAt > IMPORT_STALE_AFTER_MS ? 'unknown' : 'importing'
}

export const menuGrew = (before, after) =>
  Boolean(before && after) &&
  (after.products > before.products || after.categories > before.categories)

/**
 * A run is resolved when the server confirmed it, or when the connection was lost but a
 * later `Check now` saw the menu grow: the user has nothing left to do with it.
 */
export const isRunResolved = (run) => {
  if (!run) return false
  if (run.status === 'success') return true
  return run.status === 'unknown' && Boolean(run.checkedAt) && menuGrew(run.menuBefore, run.menuAfter)
}

/** Latest of start, finish and check: a `Check now` on a pending run keeps it alive. */
const lastActivityAt = (run) =>
  Math.max(
    ...[run.startedAt, run.finishedAt, run.checkedAt]
      .map((value) => Date.parse(value))
      .filter((time) => !Number.isNaN(time))
  )

export const isRunExpired = (run, now = Date.now()) => {
  if (!run) return false
  const lastActivity = lastActivityAt(run)
  if (!Number.isFinite(lastActivity)) return true
  return now - lastActivity > RUN_EXPIRES_AFTER_MS
}

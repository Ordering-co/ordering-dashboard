// redesign (B2): pure helpers of /profile. No React, no network, no state.

export const SESSIONS_PAGE_SIZE = 10

// The API sends `YYYY-MM-DD HH:mm:ss`; the T makes it a string every engine reads. null when it cannot be read.
const timeOf = (value) => {
  if (value == null) return null
  const time = Date.parse(String(value).replace(' ', 'T'))
  return Number.isFinite(time) ? time : null
}

/**
 * A copy of the sessions from the newest to the oldest by `created_at`, the order of the modal of main
 * (`moment(b.created_at) - moment(a.created_at)`). It never mutates its input (PF-05: main sorted the controller's
 * own array in place on every render). Dates that cannot be read go last, in the order they came.
 */
export const sortSessionsNewestFirst = (sessions) => {
  if (!Array.isArray(sessions)) return []
  return sessions
    .map((session, index) => ({ session, index, time: timeOf(session?.created_at) }))
    .sort((a, b) => {
      if (a.time != null && b.time != null) return b.time - a.time || a.index - b.index
      if (a.time != null) return -1
      if (b.time != null) return 1
      return a.index - b.index
    })
    .map(item => item.session)
}

/** The slice of one page (pages count from 1; anything under 1 is the first page). */
export const pageSessions = (sorted, page, pageSize = SESSIONS_PAGE_SIZE) => {
  const first = Math.max(1, Math.floor(Number(page)) || 1)
  return (sorted || []).slice((first - 1) * pageSize, first * pageSize)
}

/** The sessions that are not this browser's. Never N - 1: the current one may be missing from the list. */
export const countOtherSessions = (sessions) => (sessions || []).filter(session => !session.current).length

/**
 * The name of a user level. Literal `t()` calls, so the i18n scanner sees every key (a key built with
 * `toUpperCase()` would come out in English in the 12 languages). Any other level has no label.
 */
export const levelLabel = (t, level) => {
  switch (level) {
    case 0: return t('ADMINISTRATOR', 'Administrator')
    case 2: return t('BUSINESS_OWNER', 'Business owner')
    case 5: return t('DRIVER_MANAGER', 'Driver manager')
    case 8: return t('PROFESSIONAL', 'Professional')
    default: return null
  }
}

// redesign SC-B1 (decision 2A): the school the user chose last, kept per project and user. Every access is guarded: a private window
// or a blocked storage throws on read and on write, and the page must work the same without it (null / nothing).

const keyOf = (project, userId) => `odc-schools-last:${project}:${userId}`

const isId = (value) => Number.isInteger(value) && value > 0

/** The id (number) of the school remembered for this project and user, or null. */
export const readRememberedSchool = (project, userId) => {
  if (!project || !userId) return null
  try {
    const stored = window.localStorage.getItem(keyOf(project, userId))
    if (typeof stored !== 'string' || !/^\d+$/.test(stored)) return null
    const id = Number(stored)
    return isId(id) ? id : null
  } catch {
    return null
  }
}

/** Remembers the school; `null` forgets it. Anything that is not a positive whole id is not remembered. */
export const rememberSchool = (project, userId, schoolId) => {
  if (!project || !userId) return
  try {
    if (schoolId === null) window.localStorage.removeItem(keyOf(project, userId))
    else if (isId(schoolId)) window.localStorage.setItem(keyOf(project, userId), String(schoolId))
  } catch {
    // storage blocked: nothing to remember
  }
}

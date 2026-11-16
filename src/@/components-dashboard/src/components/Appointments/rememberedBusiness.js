// The business a user chose in Appointments, remembered per project and user (decision 2).
// Only { id, name } is stored, and the store's timezone when it has one (the calendar opens in its zone). Every access is guarded: private mode or a full quota must never break the page.

const keyOf = (project, userId) => `appointments.business.${project}.${userId}`

const hasValue = (value) => value !== undefined && value !== null && value !== ''

const isValidId = (id) => (typeof id === 'number' && Number.isFinite(id)) || (typeof id === 'string' && id.trim() !== '')

export const readRememberedBusiness = (storage, project, userId) => {
  if (!storage || !hasValue(project) || !hasValue(userId)) return null
  try {
    const raw = storage.getItem(keyOf(project, userId))
    if (!raw) return null
    const value = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    if (!isValidId(value.id) || typeof value.name !== 'string') return null
    return typeof value.timezone === 'string' ? { id: value.id, name: value.name, timezone: value.timezone } : { id: value.id, name: value.name }
  } catch (err) {
    return null
  }
}

export const writeRememberedBusiness = (storage, project, userId, business) => {
  if (!storage || !hasValue(project) || !hasValue(userId)) return
  try {
    const key = keyOf(project, userId)
    if (!business) {
      storage.removeItem(key)
      return
    }
    storage.setItem(key, JSON.stringify({ id: business.id, name: business.name, timezone: business.timezone ?? undefined }))
  } catch (err) {
    // Storage unavailable (private mode, quota): the choice just isn't remembered.
  }
}

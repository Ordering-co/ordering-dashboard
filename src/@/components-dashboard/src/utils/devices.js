// redesign stores-devices: the pure model of /stores/devices. The page and its controllers share it: what a
// device's owner is, what the search matches, what an add form must have before it is sent and which owner a device keeps
// when its store changes. No text of its own: the callers translate.

const text = value => String(value ?? '').trim()

// «café» finds «Café»: the text is folded with NFD and its combining marks are dropped
const fold = value => text(value).normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()

/** The owner's full name, or '' when the device has none (the API sends `user: null` when that user no longer exists). */
export const ownerNameOf = (device) => {
  const user = device?.user
  if (!user) return ''
  return [user.name, user.lastname].map(text).filter(Boolean).join(' ')
}

/**
 * Whether the device points at an owner the API no longer returns (`user_id` set, `user` null): main's form then said «Select an
 * option» and nothing else (DV-04).
 */
export const hasMissingOwner = device => device?.user_id != null && !device?.user

/**
 * The search of the list (G5-36, T7): main filtered by the device's name only; now the name, the store, the owner and the code. It
 * stays in the browser over the list already loaded, as in main: no request.
 */
export const matchesDeviceSearch = (device, query) => {
  const needle = fold(query)
  if (!needle) return true
  return [device?.name, device?.business?.name, ownerNameOf(device), device?.code].some(value => fold(value).includes(needle))
}

/**
 * What the add form needs before it is sent (G5-37): a name and a store. The owner stays optional and is not pre-filled, as in
 * main (agreed with the coordinator, 2026-10-11). Editing checks only a name that was emptied: the store is locked once created.
 * Returns `{ name: boolean, business: boolean }`, true where the field is missing.
 */
export const missingDeviceFields = (changes, device) => {
  const name = changes?.name !== undefined ? changes.name : device?.name
  const business = changes?.business_id !== undefined ? changes.business_id : device?.business_id
  return {
    name: !text(name),
    business: !device && (business == null || business === '')
  }
}

export const isDeviceDraftValid = (changes, device) => {
  const missing = missingDeviceFields(changes, device)
  return !missing.name && !missing.business
}

/**
 * The changes that really differ from the device (R-2): a name typed back to what it was is not a change, so the panel is not
 * dirty and Save sends nothing. A new device (no `device`) keeps every change.
 */
export const effectiveDeviceChanges = (changes, device) => {
  if (!device) return { ...changes }
  return Object.fromEntries(Object.entries(changes || {}).filter(([key, value]) => value !== device[key]))
}

/**
 * The changes after picking a store (DV-03): an owner chosen for the previous store is dropped, because it belongs to that store's
 * owners. Picking the same store keeps it.
 */
export const changesForStore = (changes, businessId) => {
  const next = { ...changes, business_id: businessId }
  if (changes?.business_id !== businessId && 'user_id' in next) delete next.user_id
  return next
}

/**
 * The owner object a saved device should carry in the list, so the Owner column shows the new name at once: the matching owner of
 * the store when the save set `user_id`, else what the device had.
 */
export const ownerAfterSave = ({ device, changes, owners }) => {
  if (!changes || !('user_id' in changes)) return device?.user ?? null
  if (changes.user_id == null) return null
  return (owners || []).find(owner => owner?.id === changes.user_id) ?? device?.user ?? null
}

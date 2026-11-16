// redesign stores-devices: the pure model of /stores/devices
import { describe, expect, it } from 'vitest'
import {
  changesForStore,
  effectiveDeviceChanges,
  hasMissingOwner,
  isDeviceDraftValid,
  matchesDeviceSearch,
  missingDeviceFields,
  ownerAfterSave,
  ownerNameOf
} from '../devices'

const DEVICE = {
  id: 34,
  name: 'Kiosk Updated',
  code: 'wdzuyd',
  business_id: 6,
  user_id: 39,
  business: { id: 6, name: "Dono's Pizza" },
  user: { id: 39, name: 'Daniel', lastname: 'Morgan' }
}

describe('devices model', () => {
  it('names the owner, and nothing when the API sends no user', () => {
    expect(ownerNameOf(DEVICE)).toBe('Daniel Morgan')
    expect(ownerNameOf({ ...DEVICE, user: { name: 'Ana', lastname: null } })).toBe('Ana')
    expect(ownerNameOf({ ...DEVICE, user: null })).toBe('')
  })

  it('tells a deleted owner from a device without owner (DV-04)', () => {
    expect(hasMissingOwner({ ...DEVICE, user: null })).toBe(true)
    expect(hasMissingOwner({ ...DEVICE, user_id: null, user: null })).toBe(false)
    expect(hasMissingOwner(DEVICE)).toBe(false)
  })

  it('searches the name, the store, the owner and the code, folding accents and case (T7)', () => {
    expect(matchesDeviceSearch(DEVICE, '')).toBe(true)
    expect(matchesDeviceSearch(DEVICE, 'kiosk')).toBe(true)
    expect(matchesDeviceSearch(DEVICE, 'dono')).toBe(true)
    expect(matchesDeviceSearch(DEVICE, 'morgan')).toBe(true)
    expect(matchesDeviceSearch(DEVICE, 'WDZ')).toBe(true)
    expect(matchesDeviceSearch({ ...DEVICE, name: 'Café' }, 'cafe')).toBe(true)
    expect(matchesDeviceSearch(DEVICE, 'subway')).toBe(false)
  })

  it('asks a name and a store before an add is sent (G5-37); the owner stays optional', () => {
    expect(missingDeviceFields({}, null)).toEqual({ name: true, business: true })
    expect(missingDeviceFields({ name: '  ', business_id: 2 }, null)).toEqual({ name: true, business: false })
    expect(isDeviceDraftValid({ name: 'Lobby', business_id: 2 }, null)).toBe(true)
  })

  it('checks only an emptied name when editing (the store is locked)', () => {
    expect(isDeviceDraftValid({}, DEVICE)).toBe(true)
    expect(missingDeviceFields({ name: '' }, DEVICE)).toEqual({ name: true, business: false })
  })

  it('keeps only the changes that differ from the device (R-2)', () => {
    expect(effectiveDeviceChanges({ name: 'Kiosk Updated', user_id: 40 }, DEVICE)).toEqual({ user_id: 40 })
    expect(effectiveDeviceChanges({ name: 'Kiosk Updated' }, DEVICE)).toEqual({})
    expect(effectiveDeviceChanges({ name: 'New' }, null)).toEqual({ name: 'New' })
  })

  it('drops the owner of the previous store when the store changes (DV-03)', () => {
    expect(changesForStore({ name: 'A', business_id: 2, user_id: 9 }, 6)).toEqual({ name: 'A', business_id: 6 })
    expect(changesForStore({ business_id: 6, user_id: 9 }, 6)).toEqual({ business_id: 6, user_id: 9 })
    expect(changesForStore({}, 6)).toEqual({ business_id: 6 })
  })

  it('gives a saved device the owner it now has', () => {
    const owners = [{ id: 39, name: 'Daniel' }, { id: 40, name: 'Eva' }]
    expect(ownerAfterSave({ device: DEVICE, changes: { name: 'X' }, owners })).toBe(DEVICE.user)
    expect(ownerAfterSave({ device: DEVICE, changes: { user_id: 40 }, owners })).toEqual({ id: 40, name: 'Eva' })
    expect(ownerAfterSave({ device: null, changes: { user_id: null }, owners })).toBe(null)
  })
})

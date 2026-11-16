import { describe, expect, it } from 'vitest'

import { driverName, driverStatus, isOfflineBusy, phoneOf } from '../driverData'
import { driverState as dashboardState, fullName as dashboardName } from '../../../Orders/DriversDashboard/driverState'

// redesign DL-B2 (decision 3): one meaning for the state across the drivers family
const t = (_key, fallback) => fallback

describe('driverData', () => {
  it('reads the state of /drivers-dashboard with Inactive on top', () => {
    expect(driverStatus({ enabled: false, available: true, busy: true })).toBe('inactive')
    expect(driverStatus({ enabled: true, available: false, busy: false })).toBe('offline')
    expect(driverStatus({ enabled: true, available: false, busy: true })).toBe('offline')
    expect(driverStatus({ enabled: true, available: true, busy: true })).toBe('busy')
    expect(driverStatus({ enabled: true, available: true, busy: false })).toBe('available')
  })

  it('says Offline · Busy only for a connected-off driver that still has orders', () => {
    expect(isOfflineBusy({ enabled: true, available: false, busy: true })).toBe(true)
    expect(isOfflineBusy({ enabled: true, available: true, busy: true })).toBe(false)
    expect(isOfflineBusy({ enabled: false, available: false, busy: true })).toBe(false)
  })

  it('is the same function the dashboard uses (promoted, not copied)', () => {
    const driver = { name: ' Ana  ', lastname: 'Lopez', available: true, busy: false }
    expect(dashboardState(driver)).toBe('available')
    expect(dashboardName(driver)).toBe('Ana Lopez')
  })

  it('names a driver, or says No name', () => {
    expect(driverName({ name: 'Carlos', lastname: 'Mendoza' }, t)).toBe('Carlos Mendoza')
    expect(driverName({ name: '', lastname: null }, t)).toBe('No name')
  })

  it('writes the phone with its country code', () => {
    expect(phoneOf({ cellphone: '5550100', country_phone_code: '1' })).toBe('+1 5550100')
    expect(phoneOf({ cellphone: '5550100', country_phone_code: '+34' })).toBe('+34 5550100')
    expect(phoneOf({ cellphone: '5550100' })).toBe('5550100')
    expect(phoneOf({ cellphone: '' })).toBe('')
    expect(phoneOf({ cellphone: '+584241233333', country_phone_code: '58' })).toBe('+58 4241233333') //
  })
})

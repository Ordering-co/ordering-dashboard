// redesign DM-B1 (decisions 1-3): the role of the DriversDirectory composition and its texts.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { ROLES, directoryCopy, isManagersRole, panelStorageKey, roleOf } from '../directoryRole'
import { MANAGER_SECTIONS, driverSectionIds } from '../driverSections'

const t = (key, fallback) => `${key}|${fallback}`
const keyOf = (text) => text.split('|')[0]

describe('directoryRole', () => {
  it('anything but «managers» is the drivers list', () => {
    expect(ROLES).toEqual(['drivers', 'managers'])
    expect(roleOf('managers')).toBe('managers')
    for (const value of ['drivers', undefined, null, '', 'manager', 'MANAGERS', 5]) {
      expect(roleOf(value)).toBe('drivers')
      expect(isManagersRole(value)).toBe(false)
    }
    expect(isManagersRole('managers')).toBe(true)
  })

  it('keeps one panel width per list', () => {
    expect(panelStorageKey()).toBe('od.drivers.panel')
    expect(panelStorageKey('drivers')).toBe('od.drivers.panel')
    expect(panelStorageKey('managers')).toBe('od.drivers-managers.panel')
  })

  it('the drivers texts are the keys and defaults used', () => {
    const copy = directoryCopy('drivers', t)
    expect(copy.add).toBe('ADD_DRIVER|Add driver')
    expect(copy.countOther).toBe('DRIVERS_COUNT_OTHER|_count_ drivers')
    expect(copy.column).toBe('DRIVER|Driver')
    expect(copy.groupSection).toBe('DRIVER_GROUP|Driver group')
    expect(copy.exportScope).toBe("DRIVERS_EXPORT_SCOPE|The file includes active and inactive drivers. The search and the status filter don't apply.")
    expect(directoryCopy(undefined, t)).toEqual(copy)
    // redesign D-4: the one-record delete confirmation (existing catalog keys)
    expect(copy.deleteTitle).toBe('DRIVERS_DELETE_TITLE|Delete _name_?')
    expect(copy.deleteConfirm).toBe('DRIVERS_DELETE_CONFIRM|Delete driver')
    expect(copy.deleteBody).toBe("DRIVERS_DELETE_BODY|This can't be undone.")
  })

  it('the managers texts have the same entries, their own keys, and never say «driver» alone', () => {
    const drivers = directoryCopy('drivers', t)
    const managers = directoryCopy('managers', t)
    expect(Object.keys(managers).sort()).toEqual(Object.keys(drivers).sort())
    // existing catalog keys reused on purpose: the page title, the singular and the add action
    const reused = ['ADD_DRIVER_MANAGER', 'DRIVER_MANAGER', 'DRIVERS_MANAGERS']
    Object.values(managers).forEach(text => {
      const key = keyOf(text)
      expect(key.startsWith('DRIVERS_MANAGERS_') || reused.includes(key)).toBe(true)
      expect(text.split('|')[1]).not.toMatch(/\bdrivers?\b(?! managers?)/i)
    })
    expect(managers.groupSection).toBe('DRIVERS_MANAGERS_MANAGED_GROUPS|Managed groups')
    expect(managers.add).toBe('ADD_DRIVER_MANAGER|Add driver manager')
    expect(managers.deleteTitle).toBe('DRIVERS_MANAGERS_DELETE_TITLE|Delete _name_?')
    expect(managers.deleteConfirm).toBe('DRIVERS_MANAGERS_DELETE_CONFIRM|Delete driver manager')
    expect(managers.deleteBody).toBe("DRIVERS_MANAGERS_DELETE_BODY|This can't be undone.")
  })

  it('every text is a literal t() call the i18n scanner can see', () => {
    const source = readFileSync(resolve(__dirname, '../directoryRole.js'), 'utf8')
    const managers = directoryCopy('managers', t)
    const drivers = directoryCopy('drivers', t)
    ;[...Object.values(managers), ...Object.values(drivers)].forEach(text => {
      expect(source).toContain(`t('${keyOf(text)}', `)
    })
  })
})

describe('driverSections for managers (decision 3)', () => {
  it('a manager has main\'s three sections, in main\'s order, at every level', () => {
    expect(MANAGER_SECTIONS).toEqual(['profile', 'saved_places', 'driver_group'])
    for (const level of [0, 2, 5, undefined]) {
      expect(driverSectionIds({ level, role: 'managers' })).toEqual(['profile', 'saved_places', 'driver_group'])
    }
  })

  it('the drivers sections do not change with an unknown role', () => {
    expect(driverSectionIds({ level: 0, role: 'drivers' })).toEqual(driverSectionIds({ level: 0 }))
    expect(driverSectionIds({ level: 0, role: 'other' })).toContain('advanced_logs')
  })
})

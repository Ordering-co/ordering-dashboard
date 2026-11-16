import { describe, expect, test } from 'vitest'

import { userTypeLabel, userTypesValues } from './utils'

const t = (_key, fallback) => fallback

const levelsOf = (options) => options.map(option => option.value)

describe('userTypesValues', () => {
  test('exposes driver, driver manager and call center agent levels on the edit selector', () => {
    const options = userTypesValues({ t, isPrimary: true, defaultUserType: 3 })
    expect(levelsOf(options)).toEqual([0, 2, 3, 4, 5, 9, 8])
  })

  test('includes the professional level without an appointments addon', () => {
    const options = userTypesValues({ t, isPrimary: true })
    expect(levelsOf(options)).toEqual([0, 2, 3, 4, 5, 9, 8])
  })

  test('disables the current level on the bulk selector', () => {
    const options = userTypesValues({ t, isPrimary: false, defaultUserType: 4 })
    const driver = options.find(option => option.value === 4)
    const customer = options.find(option => option.value === 3)
    expect(driver.disabled).toBe(true)
    expect(customer.disabled).toBe(false)
  })

  test('limits options to the page levels when a preset list is given', () => {
    const options = userTypesValues({ t, isPrimary: true, defaultUserTypesSelected: [4] })
    expect(levelsOf(options)).toEqual([4])
  })
})

// redesign D-11: the level as plain text, with the same keys the selector rows use
describe('userTypeLabel', () => {
  test('names every level of the selector as the selector does', () => {
    const labels = userTypesValues({ t, isPrimary: true }).map(option => userTypeLabel(t, option.value))
    expect(labels).toEqual(['Administrator', 'Business owner', 'User', 'Driver', 'Driver manager', 'Call center agent', 'Professional'])
  })

  test('asks the translator with the keys of the rows', () => {
    const keys = []
    userTypeLabel((key, fallback) => { keys.push(key); return fallback }, 5)
    expect(keys).toEqual(['DRIVER_MANAGER'])
  })

  test('takes the level as a number or as text, and says nothing for an unknown one', () => {
    expect(userTypeLabel(t, '4')).toBe('Driver')
    expect(userTypeLabel(t, 1)).toBe('')
    expect(userTypeLabel(t, undefined)).toBe('')
  })
})

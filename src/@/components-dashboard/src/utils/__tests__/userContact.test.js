// redesign BO-B2 (a): the contact readers promoted from the customers directory; they behave as they did there.
import { describe, expect, it } from 'vitest'

import { phoneOf, userFullName } from '../userContact'

describe('userFullName', () => {
  it('joins name and lastname', () => {
    expect(userFullName({ name: 'Ana', lastname: 'Ruiz' })).toBe('Ana Ruiz')
  })

  it('uses what exists when only one of them does, without stray spaces', () => {
    expect(userFullName({ name: 'Ana' })).toBe('Ana')
    expect(userFullName({ name: '  ', lastname: 'Ruiz' })).toBe('Ruiz')
    expect(userFullName({ name: ' Ana ', lastname: null })).toBe('Ana')
  })

  it('is an empty string (never a fallback text) with no name, no fields or no user', () => {
    expect(userFullName({ name: '', lastname: '' })).toBe('')
    expect(userFullName({})).toBe('')
    expect(userFullName(null)).toBe('')
    expect(userFullName(undefined)).toBe('')
  })
})

describe('phoneOf', () => {
  it('is «+code number» when both exist', () => {
    expect(phoneOf({ country_phone_code: '1', cellphone: '5550100' })).toBe('+1 5550100')
    expect(phoneOf({ country_phone_code: 57, cellphone: '3001234567' })).toBe('+57 3001234567')
    expect(phoneOf({ country_phone_code: '+1', cellphone: '5550100' })).toBe('+1 5550100') // never «++1»
  })

  // a cellphone saved with its «+code» never gets the code twice («+58 +584241233333»)
  it('a cellphone that already carries «+code» is not prefixed again', () => {
    expect(phoneOf({ country_phone_code: '58', cellphone: '+584241233333' })).toBe('+58 4241233333')
    expect(phoneOf({ country_phone_code: '+58', cellphone: '+58 4241233333' })).toBe('+58 4241233333')
    expect(phoneOf({ country_phone_code: '1', cellphone: '+447700900123' })).toBe('+447700900123') // another code: as saved
    expect(phoneOf({ cellphone: '+584241233333' })).toBe('+584241233333')
  })

  it('is the cellphone alone without a country code', () => {
    expect(phoneOf({ cellphone: '5550100' })).toBe('5550100')
    expect(phoneOf({ country_phone_code: '', cellphone: '5550100' })).toBe('5550100')
  })

  it('is null with no cellphone (a code alone is not a phone), or no user', () => {
    expect(phoneOf({ country_phone_code: '1' })).toBeNull()
    expect(phoneOf({ cellphone: '  ' })).toBeNull()
    expect(phoneOf({})).toBeNull()
    expect(phoneOf(undefined)).toBeNull()
  })
})

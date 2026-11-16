// redesign UC-B2 (decisions 5, 7): the helpers the customers table and its cards read.
import { describe, expect, it } from 'vitest'

import { customerName, isCashWalletOn, isPointsWalletOn, phoneOf, walletOf } from '../customerData'

const t = (_key, fallback) => fallback

describe('customerName', () => {
  it('joins name and lastname', () => {
    expect(customerName({ name: 'Ana', lastname: 'Ruiz' }, t)).toBe('Ana Ruiz')
  })

  it('uses what exists when only one of them does, without stray spaces', () => {
    expect(customerName({ name: 'Ana' }, t)).toBe('Ana')
    expect(customerName({ name: '  ', lastname: 'Ruiz' }, t)).toBe('Ruiz')
    expect(customerName({ name: ' Ana ', lastname: null }, t)).toBe('Ana')
  })

  it('falls back to the translated «No name» when both are empty, or there is no user', () => {
    const keys = []
    const spy = (key, fallback) => { keys.push(key); return fallback }
    expect(customerName({ name: '', lastname: '' }, spy)).toBe('No name')
    expect(customerName({}, spy)).toBe('No name')
    expect(customerName(null, spy)).toBe('No name')
    expect(keys).toEqual(['CUSTOMERS_NO_NAME', 'CUSTOMERS_NO_NAME', 'CUSTOMERS_NO_NAME'])
  })
})

describe('walletOf', () => {
  const user = { wallets: [{ id: 1, type: 'cash', balance: 12.5 }, { id: 2, type: 'credit_point', balance: 300 }] }

  it('finds the wallet of each type', () => {
    expect(walletOf(user, 'cash')).toEqual({ id: 1, type: 'cash', balance: 12.5 })
    expect(walletOf(user, 'credit_point')).toEqual({ id: 2, type: 'credit_point', balance: 300 })
  })

  it('is null when the user has no such wallet, no wallets, or is missing', () => {
    expect(walletOf({ wallets: [{ id: 2, type: 'credit_point' }] }, 'cash')).toBeNull()
    expect(walletOf({ wallets: [] }, 'cash')).toBeNull()
    expect(walletOf({}, 'cash')).toBeNull()
    expect(walletOf({ wallets: 'nope' }, 'cash')).toBeNull()
    expect(walletOf(null, 'cash')).toBeNull()
  })
})

describe('the wallet flags', () => {
  // main: the wallets stay on in every project, whatever its add-ons (docs/SETTINGS.md › Addon sections are universal)
  it.each([
    [{ addon_cash_wallet_and_refunds: { value: '1' } }],
    [{ addon_cash_wallet_and_refunds: { value: '' }, addon_points_and_levels: { value: 0 } }],
    [{}],
    [undefined],
    [null]
  ])('cash and points are on with configs %j', (configs) => {
    expect(isCashWalletOn(configs)).toBe(true)
    expect(isPointsWalletOn(configs)).toBe(true)
  })
})

describe('phoneOf', () => {
  it('is «+code number» when both exist', () => {
    expect(phoneOf({ country_phone_code: '1', cellphone: '5550100' })).toBe('+1 5550100')
    expect(phoneOf({ country_phone_code: 57, cellphone: '3001234567' })).toBe('+57 3001234567')
    expect(phoneOf({ country_phone_code: '+1', cellphone: '5550100' })).toBe('+1 5550100') // never «++1»
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

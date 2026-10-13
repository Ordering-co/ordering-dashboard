import { describe, expect, it } from 'vitest'

import {
  getEnabledProductApps,
  isMyProductsPath,
  isProductAppActive
} from '../myProductsNav'

describe('getEnabledProductApps', () => {
  it('returns only enabled apps', () => {
    expect(getEnabledProductApps([
      { id: 1, enabled: false },
      { id: 2, enabled: true }
    ])).toEqual([{ id: 2, enabled: true }])
  })

  it('treats a missing list as empty', () => {
    expect(getEnabledProductApps()).toEqual([])
    expect(getEnabledProductApps(null)).toEqual([])
  })
})

describe('isMyProductsPath', () => {
  it('matches the products family', () => {
    expect(isMyProductsPath('/my-products')).toBe(true)
    expect(isMyProductsPath('/my-products/ordering-website')).toBe(true)
    expect(isMyProductsPath('/settings')).toBe(false)
  })
})

describe('isProductAppActive', () => {
  it('matches query id or navigation state', () => {
    expect(isProductAppActive({ app: { id: 9 }, search: '?id=9' })).toBe(true)
    expect(isProductAppActive({ app: { id: 9 }, state: { productId: 9 } })).toBe(true)
    expect(isProductAppActive({ app: { id: 9 }, search: '?id=8' })).toBe(false)
    expect(isProductAppActive({ app: {} })).toBe(false)
  })
})

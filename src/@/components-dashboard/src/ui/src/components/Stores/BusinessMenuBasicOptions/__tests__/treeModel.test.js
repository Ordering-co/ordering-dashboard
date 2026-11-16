// redesign stores 5.5b: the pure helpers behind the «Basic» tab of a menu: the flat model of the catalog tree, the search
// and the count of selected products.
import { describe, expect, it } from 'vitest'

import { buildCategoryIndex, countSelected, flattenCategories, isDefaultSchedule, matchProductIds, validateMenuForm } from '../treeModel'

const categories = [
  {
    id: 1,
    name: 'Burgers',
    products: [{ id: 11, name: 'Cheese Burger' }, { id: 12, name: 'Fries' }],
    subcategories: [
      { id: 2, name: 'Veggie', products: [{ id: 21, name: 'Bean patty' }], subcategories: [] }
    ]
  },
  { id: 3, name: 'Drinks', products: [{ id: 31, name: 'Cola' }] }
]

describe('flattenCategories', () => {
  it('lists every product with the names of the categories on its path', () => {
    const model = flattenCategories(categories)
    expect([...model.productIds].sort()).toEqual([11, 12, 21, 31])
    expect(model.products).toEqual([
      { id: 11, name: 'Cheese Burger', path: ['Burgers'] },
      { id: 12, name: 'Fries', path: ['Burgers'] },
      { id: 21, name: 'Bean patty', path: ['Burgers', 'Veggie'] },
      { id: 31, name: 'Cola', path: ['Drinks'] }
    ])
  })

  it('gives an empty model for no categories, null, or a category without products', () => {
    for (const input of [undefined, null, [], [{ id: 1, name: 'Empty' }]]) {
      const model = flattenCategories(input)
      expect(model.productIds.size).toBe(0)
      expect(model.products).toEqual([])
    }
  })

  it('counts a product that sits in two categories once in productIds', () => {
    const model = flattenCategories([
      { id: 1, name: 'A', products: [{ id: 5, name: 'Same' }] },
      { id: 2, name: 'B', products: [{ id: 5, name: 'Same' }] }
    ])
    expect(model.productIds.size).toBe(1)
  })
})

describe('matchProductIds', () => {
  const model = flattenCategories(categories)

  it('answers null for a blank query', () => {
    expect(matchProductIds(model, '')).toBeNull()
    expect(matchProductIds(model, '   ')).toBeNull()
    expect(matchProductIds(model, undefined)).toBeNull()
  })

  it('matches the product name ignoring case and spaces around', () => {
    expect([...matchProductIds(model, '  CHEESE ')]).toEqual([11])
  })

  it('matches every product under a category whose name matches', () => {
    expect([...matchProductIds(model, 'burgers')].sort()).toEqual([11, 12, 21])
    expect([...matchProductIds(model, 'veggie')]).toEqual([21])
  })

  it('answers an empty set when nothing matches', () => {
    expect(matchProductIds(model, 'pizza').size).toBe(0)
  })
})

describe('countSelected', () => {
  const model = flattenCategories(categories)

  it('counts the unique selected ids that exist in the tree', () => {
    expect(countSelected(model, [11, 31])).toBe(2)
    expect(countSelected(model, [11, 11, 999])).toBe(1)
  })

  it('is 0 without a selection', () => {
    expect(countSelected(model, undefined)).toBe(0)
    expect(countSelected(model, [])).toBe(0)
  })
})

describe('isDefaultSchedule', () => {
  const day = () => ({ enabled: true, lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }] })
  const week = () => Array.from({ length: 7 }, day)

  it('recognises the schedule the Schedule controller seeds', () => {
    expect(isDefaultSchedule(week())).toBe(true)
  })

  it('rejects anything that differs', () => {
    const closed = week()
    closed[2].enabled = false
    const shorter = week()
    shorter[0].lapses[0].close.minute = 45
    const two = week()
    two[1].lapses.push(day().lapses[0])
    expect(isDefaultSchedule(closed)).toBe(false)
    expect(isDefaultSchedule(shorter)).toBe(false)
    expect(isDefaultSchedule(two)).toBe(false)
    expect(isDefaultSchedule(week().slice(1))).toBe(false)
    expect(isDefaultSchedule(undefined)).toBe(false)
  })
})

describe('buildCategoryIndex', () => {
  it('lists every category at every depth with all the product ids under it, own first', () => {
    const deep = [
      {
        id: 1,
        name: 'Burgers',
        products: [{ id: 11 }, { id: 12 }],
        subcategories: [
          { id: 2, name: 'Veggie', products: [{ id: 21 }], subcategories: [{ id: 3, name: 'Vegan', products: [{ id: 31 }] }] }
        ]
      },
      { id: 4, name: 'Drinks', products: [{ id: 41 }] }
    ]
    expect(buildCategoryIndex(deep)).toEqual([
      { id: 1, name: 'Burgers', productIds: [11, 12, 21, 31] },
      { id: 2, name: 'Veggie', productIds: [21, 31] },
      { id: 3, name: 'Vegan', productIds: [31] },
      { id: 4, name: 'Drinks', productIds: [41] }
    ])
  })

  it('gives an empty productIds to a category without products and an empty list for no categories', () => {
    expect(buildCategoryIndex([{ id: 1, name: 'Empty' }])).toEqual([{ id: 1, name: 'Empty', productIds: [] }])
    for (const input of [undefined, null, []]) expect(buildCategoryIndex(input)).toEqual([])
  })
})

describe('validateMenuForm', () => {
  it('is ok for a saved menu with a name, whatever its products', () => {
    expect(validateMenuForm({ menu: { id: 5, name: 'Lunch' }, changes: {}, selectedProductsIds: [] }))
      .toEqual({ nameBlank: false, productsMissing: false, ok: true })
  })

  it('flags a blank name, trimmed, and prefers the pending name over the saved one', () => {
    expect(validateMenuForm({ menu: { id: 5, name: 'Lunch' }, changes: { name: '   ' } }).nameBlank).toBe(true)
    expect(validateMenuForm({ menu: { id: 5, name: '' }, changes: { name: 'Dinner' } }).nameBlank).toBe(false)
    expect(validateMenuForm({ menu: { id: 5 }, changes: {} })).toEqual({ nameBlank: true, productsMissing: false, ok: false })
    expect(validateMenuForm({}).nameBlank).toBe(true)
  })

  it('flags a new menu without products nor All products', () => {
    const base = { menu: {}, changes: { name: 'Brunch' } }
    expect(validateMenuForm({ ...base, selectedProductsIds: [] })).toEqual({ nameBlank: false, productsMissing: true, ok: false })
    expect(validateMenuForm({ ...base, selectedProductsIds: [11] }).ok).toBe(true)
    expect(validateMenuForm({ menu: {}, changes: { name: 'Brunch', products: [11] } }).ok).toBe(true)
    expect(validateMenuForm({ menu: {}, changes: { name: 'Brunch', all_products: true } }).ok).toBe(true)
    expect(validateMenuForm({ menu: { all_products: true }, changes: { name: 'Brunch' } }).ok).toBe(true)
    expect(validateMenuForm({ menu: { all_products: true }, changes: { name: 'Brunch', all_products: false } }).productsMissing).toBe(true)
  })

  it('never asks a saved menu for products', () => {
    expect(validateMenuForm({ menu: { id: 5, name: 'Lunch', all_products: false }, changes: {}, selectedProductsIds: [] }).productsMissing).toBe(false)
  })
})

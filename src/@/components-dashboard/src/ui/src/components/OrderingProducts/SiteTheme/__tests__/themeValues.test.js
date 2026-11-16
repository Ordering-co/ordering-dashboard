// redesign (OP-12, OP-16, audit «base mutated in place»): the pure helpers of the Theme tab.
import { describe, expect, it } from 'vitest'
import { buildBase, cloneValues, countChanges, filterBorderRadius, firstMessage, getTitle, setAt, validHexColor } from '../themeValues'

const defaults = () => ({
  home: { hidden: false, components: { header: { color: '#111111', title: 'Welcome', nested: { size: 4 } } } },
  menu: { hidden: true, components: { list: { columns: 2 } } }
})

describe('buildBase', () => {
  it('merges the stored values over the defaults, deeply', () => {
    const base = buildBase(defaults(), { home: { components: { header: { title: 'Hola', nested: { size: 8 } } } } })
    expect(base.home.components.header).toEqual({ color: '#111111', title: 'Hola', nested: { size: 8 } })
    expect(base.menu).toEqual(defaults().menu)
  })

  it('keeps a stored false, 0 or empty text over the default; only a missing value takes the default (OP-18)', () => {
    const base = buildBase(defaults(), {
      menu: { hidden: false, components: { list: { columns: 0 } } },
      home: { components: { header: { title: '', color: null } } }
    })
    expect(base.menu.hidden).toBe(false)
    expect(base.menu.components.list.columns).toBe(0)
    expect(base.home.components.header.title).toBe('')
    expect(base.home.components.header.color).toBe('#111111')
  })

  it('does not write into the defaults nor into the stored values', () => {
    const theDefaults = defaults()
    const stored = { home: { components: { header: { title: 'Hola' } } }, extra: { added: { deep: 'yes' } } }
    const defaultsBefore = JSON.stringify(theDefaults)
    const storedBefore = JSON.stringify(stored)
    const base = buildBase(theDefaults, stored)
    expect(JSON.stringify(theDefaults)).toBe(defaultsBefore)
    expect(JSON.stringify(stored)).toBe(storedBefore)
    // and the result shares no object with either input
    base.home.components.header.title = 'changed'
    base.extra.added.deep = 'changed'
    expect(theDefaults.home.components.header.title).toBe('Welcome')
    expect(stored.home.components.header.title).toBe('Hola')
    expect(stored.extra.added.deep).toBe('yes')
  })

  it('answers an object when there is nothing to merge', () => {
    expect(buildBase(undefined, undefined)).toEqual({})
    expect(buildBase(undefined, { a: 1 })).toEqual({ a: 1 })
    expect(buildBase({ a: 1 }, undefined)).toEqual({ a: 1 })
  })
})

describe('setAt', () => {
  it('writes a copy along the path and leaves the original alone', () => {
    const original = defaults()
    const before = JSON.stringify(original)
    const next = setAt(original, 'home.components.header.nested.size', 9)
    expect(JSON.stringify(original)).toBe(before)
    expect(next.home.components.header.nested.size).toBe(9)
    expect(next).not.toBe(original)
    expect(next.home).not.toBe(original.home)
    // what is off the path is shared, not rebuilt
    expect(next.menu).toBe(original.menu)
  })

  it('creates the missing steps of the path', () => {
    expect(setAt({}, 'a.b.c', 1)).toEqual({ a: { b: { c: 1 } } })
  })
})

describe('countChanges', () => {
  it('is 0 for a clone and 1 after one leaf changes', () => {
    const base = buildBase(defaults(), {})
    const copy = cloneValues(base)
    expect(countChanges(base, copy)).toBe(0)
    expect(countChanges(base, setAt(copy, 'home.components.header.color', '#222222'))).toBe(1)
  })

  it('counts every leaf that differs, once each, and a leaf that is added or removed', () => {
    const base = { a: { b: 1, c: [1, 2] }, d: 'x' }
    expect(countChanges(base, { a: { b: 2, c: [1, 3] }, d: 'x' })).toBe(2)
    expect(countChanges(base, { a: { b: 1, c: [1, 2] }, d: 'x', e: true })).toBe(1)
    expect(countChanges(base, { a: { b: 1, c: [1, 2] } })).toBe(1)
  })

  it('compares a leaf by its JSON, so a number and its text differ', () => {
    expect(countChanges({ a: 1 }, { a: '1' })).toBe(1)
  })
})

describe('filterBorderRadius', () => {
  it('keeps the digits, the dot and the slash, as the onInput of main did', () => {
    expect(filterBorderRadius('12')).toBe('12')
    expect(filterBorderRadius('1.5')).toBe('1.5')
    expect(filterBorderRadius('4/8')).toBe('4/8')
  })

  it('drops the last character when the number passes 99, a lone dot or a second dot', () => {
    expect(filterBorderRadius('100')).toBe('10')
    expect(filterBorderRadius('.')).toBe('')
    expect(filterBorderRadius('1..')).toBe('1.')
  })

  it('empties a text that is not a radius and a lone 0', () => {
    expect(filterBorderRadius('ab')).toBe('')
    expect(filterBorderRadius('0')).toBe('')
    expect(filterBorderRadius('')).toBe('')
  })
})

describe('small helpers', () => {
  it('validHexColor accepts #rgb and #rrggbb only', () => {
    expect(validHexColor('#abc')).toBe(true)
    expect(validHexColor('#A1B2C3')).toBe(true)
    expect(validHexColor('#abcd')).toBe(false)
    expect(validHexColor('red')).toBe(false)
    expect(validHexColor(12)).toBe(false)
  })

  // redesign J5 row 48 (ordering-products P-4, ): main passed the function `key.toUpperCase` to `t` (M-OP1)
  it('getTitle translates a known theme key with its own literal key, and t only ever gets a string key', () => {
    const calls = []
    const t = (key, fallback) => { calls.push(key); return key === 'THEME_TITLE_BUSINESS_HERO' ? 'Portada de la tienda' : fallback }
    expect(getTitle(t, 'business_hero')).toBe('Portada de la tienda')
    expect(getTitle(t, 'add_to_cart_button')).toBe('add to cart button')
    expect(calls.every(key => typeof key === 'string')).toBe(true)
  })

  it('getTitle falls back to the English of the theme (the key without underscores) for a key it does not know', () => {
    const t = (key, fallback) => (typeof key === 'string' ? `translated:${key}` : fallback)
    expect(getTitle(t, 'a_brand_new_block')).toBe('a brand new block')
  })

  it('firstMessage reads the first text of an API error', () => {
    expect(firstMessage(['First', 'Second'])).toBe('First')
    expect(firstMessage('Plain')).toBe('Plain')
    expect(firstMessage([{ message: 'In object' }])).toBe('In object')
    expect(firstMessage(null)).toBeUndefined()
    expect(firstMessage([])).toBeUndefined()
  })
})

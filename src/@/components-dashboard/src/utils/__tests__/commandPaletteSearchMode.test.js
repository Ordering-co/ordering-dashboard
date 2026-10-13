import { beforeEach, describe, expect, it } from 'vitest'
import {
  COMMAND_PALETTE_SLOW_TTL_MS,
  getCommandPaletteSlowKey,
  markCommandPaletteSlowSearch,
  readCommandPaletteSlowSearch
} from '../commandPaletteSearchMode'

describe('command palette slow search marks', () => {
  beforeEach(() => window.localStorage.clear())

  it('starts in extended mode and remembers a slow entity per project', () => {
    expect(readCommandPaletteSlowSearch('delosi')).toEqual({ orders: false, users: false })
    expect(markCommandPaletteSlowSearch('delosi', 'orders', 1000)).toEqual({ orders: true, users: false })
    expect(readCommandPaletteSlowSearch('delosi', 2000)).toEqual({ orders: true, users: false })
    expect(readCommandPaletteSlowSearch('orderingv1', 2000)).toEqual({ orders: false, users: false })
  })

  it('forgets the mark after 30 days', () => {
    markCommandPaletteSlowSearch('delosi', 'users', 1000)
    expect(readCommandPaletteSlowSearch('delosi', 1000 + COMMAND_PALETTE_SLOW_TTL_MS - 1).users).toBe(true)
    expect(readCommandPaletteSlowSearch('delosi', 1000 + COMMAND_PALETTE_SLOW_TTL_MS).users).toBe(false)
  })

  it('tolerates bad storage and unknown entities', () => {
    window.localStorage.setItem(getCommandPaletteSlowKey('delosi'), 'not json')
    expect(readCommandPaletteSlowSearch('delosi')).toEqual({ orders: false, users: false })
    expect(markCommandPaletteSlowSearch('delosi', 'products')).toEqual({ orders: false, users: false })
    expect(readCommandPaletteSlowSearch(null)).toEqual({ orders: false, users: false })
  })
})

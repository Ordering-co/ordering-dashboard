import { describe, expect, it } from 'vitest'
import {
  isWithinOneEdit,
  rankCommandEntries,
  scoreCommandEntry,
  tokenizeCommandQuery
} from '../commandPaletteSearch'

const entries = [
  { id: 'payments', title: 'Payments', aliases: ['pagos', 'métodos de pago'] },
  { id: 'notifications', title: 'Emails & notifications', aliases: ['notificaciones', 'correos'] },
  { id: 'orders', title: 'Orders list', aliases: ['órdenes', 'pedidos'] },
  { id: 'reports', title: 'Business reports', subtitle: 'Reports', aliases: ['ventas'] },
  { id: 'store-payments', title: 'Payment methods', subtitle: 'Store', boost: -1 }
]

describe('tokenizeCommandQuery', () => {
  it('lowercases, strips accents and splits words', () => {
    expect(tokenizeCommandQuery('  Órdenes   PENDIENTES ')).toEqual(['ordenes', 'pendientes'])
    expect(tokenizeCommandQuery('')).toEqual([])
  })
})

describe('isWithinOneEdit', () => {
  it('accepts one substitution, insertion, deletion or swap', () => {
    expect(isWithinOneEdit('pagso', 'pagos')).toBe(true)
    expect(isWithinOneEdit('pagos', 'pago')).toBe(true)
    expect(isWithinOneEdit('pgos', 'pagos')).toBe(true)
    expect(isWithinOneEdit('pagis', 'pagos')).toBe(true)
    expect(isWithinOneEdit('pxgxs', 'pagos')).toBe(false)
    expect(isWithinOneEdit('pa', 'pagos')).toBe(false)
  })
})

describe('scoreCommandEntry', () => {
  it('requires every term to match', () => {
    expect(scoreCommandEntry(entries[0], ['payments', 'zebra'])).toBe(0)
  })

  it('matches localized aliases regardless of accents', () => {
    expect(scoreCommandEntry(entries[2], ['ordenes'])).toBeGreaterThan(0)
    expect(scoreCommandEntry(entries[0], ['metodos'])).toBeGreaterThan(0)
  })

  it('tolerates one typo on longer words only', () => {
    expect(scoreCommandEntry(entries[1], ['notificaciomes'])).toBeGreaterThan(0)
    expect(scoreCommandEntry(entries[0], ['pgo'])).toBe(0)
  })

  it('handles empty input', () => {
    expect(scoreCommandEntry(null, ['a'])).toBe(0)
    expect(scoreCommandEntry(entries[0], [])).toBe(0)
  })
})

describe('rankCommandEntries', () => {
  it('ranks title and alias matches above loose ones', () => {
    const ranked = rankCommandEntries(entries, 'pagos')
    expect(ranked[0].id).toBe('payments')
  })

  it('finds entries by subtitle keywords', () => {
    expect(rankCommandEntries(entries, 'store').map(entry => entry.id)).toEqual(['store-payments'])
  })

  it('applies the limit and keeps the best duplicate', () => {
    const duplicated = [...entries, { id: 'payments', title: 'Pay' }]
    const ranked = rankCommandEntries(duplicated, 'pay', { limit: 2 })
    expect(ranked).toHaveLength(2)
    expect(ranked.filter(entry => entry.id === 'payments')).toHaveLength(1)
  })

  it('returns nothing for an empty query', () => {
    expect(rankCommandEntries(entries, '   ')).toEqual([])
  })
})

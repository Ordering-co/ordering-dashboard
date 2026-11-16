import { describe, expect, it } from 'vitest'
import {
  isExactCommandMatch,
  isWithinOneEdit,
  orderLocalCommandSections,
  orderSectionsByTitleMatch,
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

// (2): an action named exactly as the query wins over pages and settings that only contain its words
describe('isExactCommandMatch', () => {
  it('is the whole title or a whole alias, case and accents aside', () => {
    const entry = { id: 'create:business_owner', title: 'Add business owner', aliases: ['nuevo propietario'] }
    expect(isExactCommandMatch(entry, '  ADD  Business owner ')).toBe(true)
    expect(isExactCommandMatch(entry, 'Nuevo propietario')).toBe(true)
    expect(isExactCommandMatch(entry, 'add business')).toBe(false)
    expect(isExactCommandMatch(entry, 'add business owners')).toBe(false)
    expect(isExactCommandMatch(entry, '')).toBe(false)
    expect(isExactCommandMatch(null, 'add business owner')).toBe(false)
  })
})

describe('orderLocalCommandSections', () => {
  const section = (key, ...titles) => ({ key, items: titles.map(title => ({ id: `${key}:${title}`, title })) })
  const keys = (sections) => sections.map(item => item.key)

  it('moves the actions first when their best entry is the whole query', () => {
    const sections = [
      section('navigation', 'Business owners'),
      section('settings', 'Allow Business Owner to Register Business'),
      section('actions', 'Add business owner')
    ]
    expect(keys(orderLocalCommandSections(sections, 'add business owner'))).toEqual(['actions', 'navigation', 'settings'])
  })

  it('keeps navigation, settings, actions otherwise', () => {
    const sections = [section('navigation', 'Customers'), section('settings', 'Customer emails'), section('actions', 'Add customer')]
    expect(keys(orderLocalCommandSections(sections, 'customer'))).toEqual(['navigation', 'settings', 'actions'])
    expect(keys(orderLocalCommandSections(sections, 'add cust'))).toEqual(['navigation', 'settings', 'actions'])
  })

  it('keeps the order when a page or a setting is the whole query too', () => {
    const sections = [section('navigation', 'Add customer'), section('settings'), section('actions', 'Add customer')]
    expect(keys(orderLocalCommandSections(sections, 'add customer'))).toEqual(['navigation', 'settings', 'actions'])
  })

  it('returns the same sections when there are no actions', () => {
    const sections = [section('navigation', 'Orders'), section('settings'), section('actions')]
    expect(orderLocalCommandSections(sections, 'orders')).toBe(sections)
  })
})

// a title that says the query goes ahead of a typo, an alias or a hidden key, also between groups
describe('orderSectionsByTitleMatch', () => {
  const titles = sections => sections.map(section => section.key)
  const actions = rankCommandEntries([{ id: 'fees', title: 'Business fees · Choose a store', aliases: ['cargos'] }], 'carlos')
  const orders = rankCommandEntries([{ id: 'cancelled', title: 'Cancelled orders', aliases: ['canceled'] }], 'cancelled')
  const settings = rankCommandEntries([{ id: 'wallet', title: 'Enable Cash Wallet Refunds', keywords: ['cash_wallet_cancelled_orders_refund'] }], 'cancelled')

  it('puts the stores called Carlos ahead of the alias typo «cargos», and removes nothing', () => {
    expect(actions).toHaveLength(1)
    const sections = [
      { key: 'actions', items: actions },
      { key: 'businesses', remote: true, items: [{ id: 'business:1', title: 'Carlos Tacos' }] },
      { key: 'orders', remote: true, items: [{ id: 'order:2', title: 'Order #2', subtitle: 'Carlos Ruiz · Taco Dos' }] },
      { key: 'records', items: [{ id: 'handoff', title: 'Search “carlos” in Orders' }] }
    ]
    const ordered = orderSectionsByTitleMatch(sections, 'carlos')
    expect(titles(ordered)).toEqual(['businesses', 'orders', 'actions', 'records'])
    expect(ordered).toHaveLength(sections.length)
  })

  it('puts «Cancelled orders» (actions) ahead of the setting found only by its hidden key', () => {
    const sections = [
      { key: 'navigation', items: [] },
      { key: 'settings', items: settings },
      { key: 'actions', items: orders }
    ]
    expect(titles(orderSectionsByTitleMatch(sections, 'cancelled'))).toEqual(['actions', 'navigation', 'settings'])
  })

  it('keeps the order when every section, or none, matches by title; a record found by a hand-off title is not promoted', () => {
    const both = [{ key: 'navigation', items: [{ id: 'a', title: 'Orders' }] }, { key: 'settings', items: [{ id: 'b', title: 'Orders settings' }] }]
    expect(orderSectionsByTitleMatch(both, 'orders')).toBe(both)
    const none = [{ key: 'navigation', items: [{ id: 'a', title: 'Customers', aliases: ['clientes'] }] }, { key: 'businesses', items: [] }]
    expect(orderSectionsByTitleMatch(none, 'clientes')).toBe(none)
    const handoff = [{ key: 'navigation', items: [{ id: 'a', title: 'Customers' }] }, { key: 'records', items: [{ id: 'h', title: 'Search “clientes” in Users' }] }]
    expect(titles(orderSectionsByTitleMatch(handoff, 'clientes'))).toEqual(['navigation', 'records'])
  })
})

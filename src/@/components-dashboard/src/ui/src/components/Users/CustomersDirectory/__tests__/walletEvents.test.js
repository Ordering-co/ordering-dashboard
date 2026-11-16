// redesign UC-B5 (decision 4, M-C4, M-C16): the pure side of the Wallet section. A wallet event becomes plain data for the
// history (never HTML), and the balances are formatted without the «- $0.00» of main.
import { describe, expect, it } from 'vitest'

import {
  authorNameOf,
  formatCash,
  formatPoints,
  formatSignedCash,
  formatSignedPoints,
  resultingBalance,
  walletEvent,
  walletEvents
} from '../walletEvents'

// A catalog whose strings still carry the markup of main (`<strong>`), as the real one does for REDEEMED_GIFT_CARD
const CATALOG = { REDEEMED_GIFT_CARD: 'Redeemed from the <strong>Gift card</strong>' }
const t = (key, text) => CATALOG[key] ?? text
const parseDate = (value, options) => `date(${value}|${options?.utc === false ? 'local' : 'utc'})`
const parsePrice = value => `$${Number(value).toFixed(2)}`
const users = [{ id: 7, name: 'Grace', lastname: 'Okafor' }, { id: 9, name: 'Solo', lastname: '' }]
const context = { t, users, parseDate }

const base = { id: 1, author_id: 7, created_at: '2026-10-09 14:05:00', description: 'Goodwill', amount: 5 }

describe('walletEvent: one event as plain data', () => {
  it('a manual movement is «Balance added» with a positive sign', () => {
    const item = walletEvent({ ...base, event_type: 'manual', event: 'movement', amount: 25 }, context)
    expect(item).toMatchObject({ id: 1, sign: 1, amount: 25, label: 'Balance added', comment: 'Goodwill', authorName: 'Grace Okafor' })
    expect(item.at).toBe('date(2026-10-09 14:05:00|local)')
  })

  it('a manual movement with a negative amount is «Balance reduced» with a negative sign', () => {
    const item = walletEvent({ ...base, event_type: 'manual', event: 'movement', amount: -5.5 }, context)
    expect(item).toMatchObject({ sign: -1, amount: -5.5, label: 'Balance reduced' })
  })

  it('the amount may come as text (the API sends a string after a reduce)', () => {
    const item = walletEvent({ ...base, event_type: 'manual', event: 'movement', amount: '-5' }, context)
    expect(item).toMatchObject({ sign: -1, amount: -5, label: 'Balance reduced' })
  })

  it('locked and unlocked are labels without a figure', () => {
    const locked = walletEvent({ ...base, event_type: 'manual', event: 'locked', amount: 0 }, context)
    const unlocked = walletEvent({ ...base, event_type: 'manual', event: 'unlocked', amount: null }, context)
    expect(locked).toMatchObject({ label: 'Wallet locked', sign: 0, amount: null })
    expect(unlocked).toMatchObject({ label: 'Wallet unlocked', sign: 0, amount: null })
  })

  it('a gift card, a refund and a payment use the catalog keys that exist', () => {
    expect(walletEvent({ ...base, event_type: 'redeem_gift_card' }, context).label).toBe('Redeemed from the Gift card')
    expect(walletEvent({ ...base, event_type: 'refund' }, context).label).toBe('Refund money')
    expect(walletEvent({ ...base, event_type: 'payment', amount: -12 }, context)).toMatchObject({ label: 'Paid money', sign: -1 })
  })

  it('a manual event the code does not know says its own name instead of nothing', () => {
    expect(walletEvent({ ...base, event_type: 'manual', event: 'adjusted' }, context).label).toBe('adjusted')
  })

  // redesign UC-R1 (I-03): live, cashback events showed the raw word «movement» as their label
  it('a movement of any type without its own label is named by its sign, and the API description stays as the comment', () => {
    const added = walletEvent({ ...base, event_type: 'cashback', event: 'movement', amount: 10.07, description: 'Cashback accumulation by order 13960' }, context)
    expect(added).toMatchObject({ sign: 1, amount: 10.07, label: 'Balance added', comment: 'Cashback accumulation by order 13960' })
    const reduced = walletEvent({ ...base, event_type: 'cashback', event: 'movement', amount: -3 }, context)
    expect(reduced).toMatchObject({ sign: -1, label: 'Balance reduced' })
  })

  it('an unknown type with a movement, and a movement with no type, never show the raw word', () => {
    expect(walletEvent({ ...base, event_type: 'some_new_type', event: 'movement', amount: 4 }, context).label).toBe('Balance added')
    expect(walletEvent({ ...base, event_type: 'some_new_type', event: 'movement', amount: -4 }, context).label).toBe('Balance reduced')
    expect(walletEvent({ ...base, event_type: undefined, event: 'movement', amount: 2 }, context).label).toBe('Balance added')
  })

  it('a movement without a number reads as added (as the manual one does), still not «movement»', () => {
    expect(walletEvent({ ...base, event_type: 'cashback', event: 'movement', amount: null }, context).label).toBe('Balance added')
  })

  it('a movement label goes through the catalog keys, so a translation reaches it', () => {
    const translated = { ...context, t: (key, text) => (key === 'CUSTOMERS_WALLET_EVENT_ADDED' ? 'Saldo agregado' : text) }
    expect(walletEvent({ ...base, event_type: 'cashback', event: 'movement', amount: 1 }, translated).label).toBe('Saldo agregado')
  })

  it('no label of any type carries HTML, even when the catalog string does', () => {
    const events = [
      { event_type: 'manual', event: 'movement', amount: 1 },
      { event_type: 'manual', event: 'movement', amount: -1 },
      { event_type: 'manual', event: 'locked' },
      { event_type: 'manual', event: 'unlocked' },
      { event_type: 'redeem_gift_card' },
      { event_type: 'refund' },
      { event_type: 'payment' }
    ]
    const taggy = (key, text) => `<strong>${t(key, text)}</strong><b>_user_</b>`
    for (const event of events) {
      const { label } = walletEvent({ ...base, ...event }, { ...context, t: taggy })
      expect(label).not.toMatch(/<[^>]*>/)
      expect(label).not.toBe('')
    }
  })

  it('the author is shown as data: a name with markup stays as text, it is never interpreted here', () => {
    const hostile = [{ id: 7, name: '<img src=x onerror=alert(1)>', lastname: '<b>Doe</b>' }]
    const item = walletEvent({ ...base, event_type: 'refund' }, { ...context, users: hostile })
    expect(item.authorName).toBe('<img src=x onerror=alert(1)> <b>Doe</b>')
    expect(item.label).toBe('Refund money')
  })

  it('author fallback: the id when the user is unknown or has no name, none without an author', () => {
    expect(walletEvent({ ...base, author_id: 99, event_type: 'refund' }, context).authorName).toBe('#99')
    expect(authorNameOf(9, users)).toBe('Solo')
    expect(authorNameOf(7, [{ id: 7, name: '', lastname: null }])).toBe('#7')
    expect(walletEvent({ ...base, author_id: null, event_type: 'refund' }, context).authorName).toBeNull()
    expect(authorNameOf(undefined, users)).toBeNull()
    expect(authorNameOf(7, undefined)).toBe('#7')
  })

  it('the order number and the code travel with the event, null when there are none', () => {
    const withOrder = walletEvent({ ...base, event_type: 'payment', code: 'AB12', wallet_event: { order_id: 4521 } }, context)
    expect(withOrder).toMatchObject({ orderId: 4521, code: 'AB12' })
    expect(walletEvent({ ...base, event_type: 'refund' }, context)).toMatchObject({ orderId: null, code: null })
  })

  it('a missing description is an empty comment and a missing date an empty string', () => {
    const item = walletEvent({ id: 3, event_type: 'refund', amount: 1 }, context)
    expect(item.comment).toBe('')
    expect(item.at).toBe('')
  })

  it('walletEvents maps a list in order and tolerates nothing', () => {
    const list = walletEvents([{ ...base, id: 2, event_type: 'refund' }, { ...base, id: 1, event_type: 'payment' }], context)
    expect(list.map(item => item.id)).toEqual([2, 1])
    expect(walletEvents(undefined, context)).toEqual([])
    expect(walletEvents(null, context)).toEqual([])
  })
})

describe('balance formatting (M-C4)', () => {
  it('cash: zero is the plain zero amount, never «- $0.00»', () => {
    expect(formatCash(0, parsePrice)).toBe('$0.00')
    expect(formatCash(-0, parsePrice)).toBe('$0.00')
    expect(formatCash(undefined, parsePrice)).toBe('$0.00')
    expect(formatCash(null, parsePrice)).toBe('$0.00')
    expect(formatCash('abc', parsePrice)).toBe('$0.00')
    expect(formatCash(-0.001, parsePrice)).toBe('$0.00')
    expect(formatCash(-0.001, parsePrice)).not.toMatch(/[-−]/)
  })

  it('cash: a positive balance, a negative one with a real minus, and text from the controller', () => {
    expect(formatCash(25, parsePrice)).toBe('$25.00')
    expect(formatCash(-5, parsePrice)).toBe('−$5.00')
    expect(formatCash('12.5', parsePrice)).toBe('$12.50')
    expect(formatCash('-5', parsePrice)).toBe('−$5.00')
  })

  it('cash: the negative goes through the absolute value, so parsePrice never sees a minus', () => {
    const seen = []
    formatCash(-123, value => { seen.push(value); return `$${value}` })
    expect(seen).toEqual([123])
  })

  it('points: a plain number with the project decimals, no currency', () => {
    expect(formatPoints(20.37, 2)).toBe('20.37')
    expect(formatPoints(20, 2)).toBe('20')
    expect(formatPoints(20.370000000000001, 2)).toBe('20.37')
    expect(formatPoints(0, 2)).toBe('0')
    expect(formatPoints(undefined, 2)).toBe('0')
    expect(formatPoints(-0.001, 2)).toBe('0')
    expect(formatPoints(-4, 2)).toBe('−4')
    expect(formatPoints('7.5', 2)).toBe('7.5')
    expect(formatPoints(1.23456, 3)).toBe('1.235')
  })

  it('the signed forms of the history add a plus to a gain and keep the minus of a loss', () => {
    expect(formatSignedCash(25, parsePrice)).toBe('+$25.00')
    expect(formatSignedCash(-5, parsePrice)).toBe('−$5.00')
    expect(formatSignedCash(0, parsePrice)).toBe('$0.00')
    expect(formatSignedPoints(20.37, 2)).toBe('+20.37')
    expect(formatSignedPoints(-3, 2)).toBe('−3')
    expect(formatSignedPoints(0, 2)).toBe('0')
  })

  it('the balance after an adjustment, without float noise', () => {
    expect(resultingBalance(10, 5, true)).toBe(15)
    expect(resultingBalance(10, 5, false)).toBe(5)
    expect(resultingBalance(0.1, 0.2, true)).toBe(0.3)
    expect(resultingBalance(5, 7.5, false)).toBe(-2.5)
    expect(resultingBalance('12.5', '2.5', true)).toBe(15)
    expect(resultingBalance(undefined, 3, true)).toBe(3)
  })
})

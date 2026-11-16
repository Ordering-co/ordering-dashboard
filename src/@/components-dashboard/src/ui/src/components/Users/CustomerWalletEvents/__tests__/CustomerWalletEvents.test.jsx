// the wallet history of the customer details painted `parseEvent(event)` with dangerouslySetInnerHTML,
// and that string carries the author's name. The line keeps the same text and the same bold, without raw HTML.
import React from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback ?? key],
  useUtils: () => [{ parseDate: () => 'Oct 20, 2026', parsePrice: value => `$${value}` }]
}))

import { CustomerWalletEvents } from '..'
import { strongSegments } from '../strongSegments'

const HOSTILE = '<img src=x onerror="window.__walletXss = true">'

// The controller's parseEvent (components/UserWallet), with the catalog strings of main
const parseEvent = (event) => {
  if (event.event_type === 'redeem_gift_card') return 'Redeemed from the <strong>Gift card</strong>'
  return '<strong>_user_</strong> add money'.replace('_user_', event.author)
}

const renderEvents = (events) => renderWithProviders(
  <CustomerWalletEvents
    walletType='cash'
    walletEventsState={{ loading: false, events }}
    parseEvent={parseEvent}
  />
)

describe('CustomerWalletEvents', () => {
  it('paints an author with markup as text, in bold, and runs nothing', () => {
    const { container } = renderEvents([{ id: 1, amount: 5, event_type: 'manual', event: 'movement', author: HOSTILE, code: 'A1' }])

    expect(container.querySelector('img')).toBeNull()
    expect(window.__walletXss).toBeUndefined()
    const author = screen.getByText(HOSTILE)
    expect(author.tagName).toBe('STRONG')
    expect(author.parentElement.textContent).toBe(`${HOSTILE} add money`)
  })

  it('keeps the bold of a normal author and of the catalog strings', () => {
    renderEvents([
      { id: 1, amount: 5, event_type: 'manual', event: 'movement', author: 'Ana Pérez', code: 'A1' },
      { id: 2, amount: 3, event_type: 'redeem_gift_card', code: 'A2' }
    ])

    expect(screen.getByText('Ana Pérez').tagName).toBe('STRONG')
    expect(screen.getByText('Ana Pérez').parentElement.textContent).toBe('Ana Pérez add money')
    expect(screen.getByText('Gift card').tagName).toBe('STRONG')
    expect(screen.getByText('Gift card').parentElement.textContent).toBe('Redeemed from the Gift card')
  })
})

describe('strongSegments', () => {
  it('reads only bold tags as bold and keeps any other markup as text', () => {
    expect(strongSegments('<strong>Ana <i>x</i></strong> locked')).toEqual([
      { text: 'Ana <i>x</i>', strong: true },
      { text: ' locked', strong: false }
    ])
  })

  it('handles an empty bold, an unclosed one, upper case and no value', () => {
    expect(strongSegments('Gift card <strong></strong>')).toEqual([{ text: 'Gift card ', strong: false }])
    expect(strongSegments('<STRONG>12</STRONG> unlocked')).toEqual([{ text: '12', strong: true }, { text: ' unlocked', strong: false }])
    expect(strongSegments('<strong>Ana')).toEqual([{ text: 'Ana', strong: true }])
    expect(strongSegments(undefined)).toEqual([])
  })

  // A project's own dictionary (from the API) may use <b> where the catalog uses <strong>: it stays bold, as in main
  it('reads <b> as bold too', () => {
    expect(strongSegments('<b>Ana</b> locked')).toEqual([{ text: 'Ana', strong: true }, { text: ' locked', strong: false }])
  })
})

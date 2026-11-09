import { describe, expect, it } from 'vitest'

import {
  TICKET_SECTIONS_STORAGE_KEY,
  clearTicketSections,
  readTicketSections,
  writeTicketSections
} from '../ticketSectionStorage'

const memory = () => {
  const entries = new Map()
  return {
    getItem: (key) => (entries.has(key) ? entries.get(key) : null),
    setItem: (key, value) => entries.set(key, String(value)),
    removeItem: (key) => entries.delete(key)
  }
}

describe('ticket section storage', () => {
  it('returns null when nothing was saved', () => {
    expect(readTicketSections(memory())).toBeNull()
  })

  it('stores the four section switches and ignores anything else', () => {
    const storage = memory()
    writeTicketSections({
      orderNumber: false,
      customer: true,
      business: false,
      orderDetails: true,
      total: false
    }, storage)

    expect(readTicketSections(storage)).toEqual({
      orderNumber: false,
      customer: true,
      business: false,
      orderDetails: true
    })
    expect(storage.getItem(TICKET_SECTIONS_STORAGE_KEY)).not.toContain('total')
  })

  it('returns null for a broken value', () => {
    const storage = memory()
    storage.setItem(TICKET_SECTIONS_STORAGE_KEY, '{')
    expect(readTicketSections(storage)).toBeNull()
  })

  it('clears only the ticket section entry', () => {
    const storage = memory()
    writeTicketSections({ customer: false }, storage)
    storage.setItem('token', 'keep')

    clearTicketSections(storage)

    expect(storage.getItem(TICKET_SECTIONS_STORAGE_KEY)).toBeNull()
    expect(storage.getItem('token')).toBe('keep')
  })
})

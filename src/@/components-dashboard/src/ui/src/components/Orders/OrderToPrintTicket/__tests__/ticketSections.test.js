import { describe, expect, it } from 'vitest'

import { showTicketSection } from '../ticketSections'

describe('showTicketSection', () => {
  it('prints every section when the modal was never used', () => {
    expect(showTicketSection(undefined, 'orderNumber')).toBe(true)
    expect(showTicketSection(undefined, 'customer')).toBe(true)
    expect(showTicketSection(undefined, 'business')).toBe(true)
    expect(showTicketSection(undefined, 'orderDetails')).toBe(true)
  })

  it('hides only the section the user turned off', () => {
    const sections = { customer: false }

    expect(showTicketSection(sections, 'customer')).toBe(false)
    expect(showTicketSection(sections, 'business')).toBe(true)
    expect(showTicketSection(sections, 'orderNumber')).toBe(true)
    expect(showTicketSection(sections, 'orderDetails')).toBe(true)
  })
})

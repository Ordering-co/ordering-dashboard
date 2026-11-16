// redesign 5.6-B: below 768px the page pads the list with the mobile gutter (16px), so the hairlines of the
// order cards, which bleed out of that gutter by the same amount (record-card.css), reach the edges of the
// screen. The rule lives next to the container; from 768px up the padding is the one of today.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(path.join(__dirname, '../styles.js'), 'utf8')
const container = source.match(/export const OrdersListContainer = styled\.div`([\s\S]*?)\n`/)[1]
const cards = readFileSync(path.join(__dirname, '../../../Shared/Product/record-card.css'), 'utf8')

describe('OrdersListContainer · mobile gutter (5.6-B)', () => {
  it('keeps the padding of today outside the phone media query', () => {
    expect(container).toMatch(/\n {2}padding: 20px;/)
    expect(container).toMatch(/isSelectedOrders && css`\n {4}margin-top: 0px;\n {4}padding: 20px 0 0 0;\n {2}`/)
  })

  it('pads the inline sides with the mobile gutter token below 768px, for the page and for the lateral bars', () => {
    const phone = container.match(/@media \(max-width: 767px\)\s*{([\s\S]*?)\n {2}}/)
    expect(phone).not.toBeNull()
    expect(phone[1]).toMatch(/padding-inline:\s*var\(--od-x-page-gutter-mobile\)/)
    // Declared after the lateral-bar override, so it wins there too (the cards bleed out of it as well).
    expect(container.indexOf('@media (max-width: 767px)')).toBeGreaterThan(container.indexOf('isSelectedOrders && css'))
  })

  it('is the same token the cards bleed out of', () => {
    expect(cards).toMatch(/\.odc-order-cards\s*{[^}]*margin-inline:\s*calc\(var\(--od-x-page-gutter-mobile\) \* -1\)/)
  })

  it('keeps every named export the harness files import', () => {
    for (const name of ['OrdersListContainer', 'OrdersContent', 'OrdersInnerContent', 'WrapperIndicator', 'WrapItemView', 'OrderSubFilterControls', 'OrderStatusSubFilterWrapper']) {
      expect(source).toMatch(new RegExp(`export const ${name} = `))
    }
  })
})

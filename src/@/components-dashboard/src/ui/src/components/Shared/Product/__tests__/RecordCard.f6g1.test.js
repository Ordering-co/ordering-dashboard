// redesign W1-1 (T1-1): moved with the card from Orders/OrdersTable/__tests__/OrderCard.f6g1.test.js.
// redesign F6g-1 (locales matrix, wave 6): at 320px `.odc-order-card-driver` measured 24px (flex-basis 0 in a wrapping row)
// and «Unassigned» (73px) overflowed it over the order date. The driver takes the width of its content and the date wraps under it
// when both do not fit; a name too long for the whole row ends in an ellipsis (named drivers carry the title already).
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.join(__dirname, '..', 'record-card.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rule = selector => {
  const start = css.indexOf(`${selector} {`)
  return start === -1 ? '' : css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
}

describe('record card logistics row at 320px (F6g-1)', () => {
  it('the driver never starts from a zero basis: it asks for its content and may not outgrow the row', () => {
    const driver = rule('.odc-order-card-driver')
    expect(driver).not.toMatch(/flex:\s*1 1 0/)
    expect(driver).toMatch(/flex:\s*1 0 auto/)
    expect(driver).toMatch(/max-inline-size:\s*100%/)
    expect(driver).toMatch(/min-inline-size:\s*0/)
  })

  it('the date keeps the end edge when it wraps under the driver', () => {
    expect(rule('.odc-order-card-when')).toMatch(/margin-inline-start:\s*auto/)
  })

  it('«Unassigned» (plain text in the driver slot) truncates with an ellipsis instead of overflowing', () => {
    const unassigned = rule('.odc-order-card-driver > .odc-subtle')
    expect(unassigned).toMatch(/min-inline-size:\s*0/)
    expect(unassigned).toMatch(/overflow:\s*hidden/)
    expect(unassigned).toMatch(/text-overflow:\s*ellipsis/)
    expect(unassigned).toMatch(/white-space:\s*nowrap/)
  })
})

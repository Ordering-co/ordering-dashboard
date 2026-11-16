// redesign W0-7 (T0-29): focus ring on the inputs inside a box, the area of the buttons in a field, the page field width,
// one `.odc-figure` (product.css) and no copy of it in field.css.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = file => readFileSync(path.resolve(__dirname, '..', file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const FIELD = css('field.css')
const PAGINATION = css('pagination.css')
const PHONE = css('legacy-fields.css')
const ruleBody = (source, selector) => {
  const found = [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(([, sel]) => sel.trim().replace(/\s+/g, ' ') === selector)
  return found ? found[2].replace(/\s+/g, ' ') : ''
}
const RING = 'outline: var(--od-focus-ring-width) solid var(--od-focus-ring-color)'

describe('W0-7 (T0-29) focus, area and figure', () => {
  it('the password and number inputs draw the house ring on :focus-visible, never outline 0', () => {
    expect(ruleBody(FIELD, '.odc-field-box .odc-field-input:focus-visible')).toContain(RING)
    expect(ruleBody(FIELD, '.odc-field-box .odc-field-input')).not.toMatch(/outline:\s*0/)
  })

  it('the phone number input draws the house ring on :focus-visible', () => {
    expect(ruleBody(PHONE, '.odc-phone-field .od-phone-input input.PhoneInputInput:focus-visible')).toContain(RING)
  })

  it('the buttons inside a field reach 44px by the house inset token', () => {
    expect(ruleBody(FIELD, '.odc-field-box .odc-field-adornment::after')).toContain('inset: var(--od-x-target-inset)')
  })

  it('the page field is 44px wide and high on a phone', () => {
    const phone = PAGINATION.slice(PAGINATION.indexOf('@media (pointer: coarse)'))
    expect(ruleBody(phone, '.odc-pagination-input')).toMatch(/min-inline-size: var\(--od-x-target-coarse\)/)
  })

  it('field.css has no .odc-figure rule of its own (the one in product.css is the only one)', () => {
    expect(FIELD).not.toMatch(/\.odc-figure/)
    expect(css('product.css')).toMatch(/\.odc-figure \{/)
    expect(ruleBody(FIELD, ':where(.odc-field-input)')).toContain('font-family: var(--od-font-sans)')
  })
})

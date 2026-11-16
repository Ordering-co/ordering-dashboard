// X-SC8 / X-SC6 (decision 12): a C18 FirstSelect inside a P/Field is, on a phone, 32px VISIBLE with its 44x44 area on the trigger
// (a pseudo-element), like the DatePicker and the text fields beside it. It measured 44 visible (42 for the trigger inside the 1px border),
// so a row held a 32px DatePicker next to a 44px select, and the trigger did not reach 44 by its own box nor by an area. Outside a P/Field
// (the orders filters sheet, the order details foot, the legacy anatomy) the select keeps its 44px: those rows are stacked closer than 12px.
// The rules are read from the CSS, like the touch tests of Shared/Product.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// the in-field rules live in P/field.css (the Field frames the select, and first-select.css only names od- classes:
// l2-first-select-css); the select's own 44px stay in first-select.css
const strip = source => source.replace(/\/\*[\s\S]*?\*\//g, '')
const css = strip(readFileSync(path.join(__dirname, '..', 'Product', 'field.css'), 'utf8'))
const selectCss = strip(readFileSync(path.join(__dirname, 'first-select.css'), 'utf8'))

const mediaBlocks = (source, query) => {
  const blocks = []
  const needle = `@media ${query}`
  let from = source.indexOf(needle)
  while (from !== -1) {
    const open = source.indexOf('{', from)
    let depth = 1
    let index = open + 1
    while (depth > 0 && index < source.length) {
      if (source[index] === '{') depth += 1
      else if (source[index] === '}') depth -= 1
      index += 1
    }
    blocks.push(source.slice(open + 1, index - 1))
    from = source.indexOf(needle, index)
  }
  return blocks
}

const rulesOf = (source) => [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => [selector.trim().replace(/\s+/g, ' '), body.replace(/\s+/g, ' ')])
const phone = mediaBlocks(css, '(pointer: coarse), (max-width: 767px)').join('\n')
const phoneRule = (selector) => rulesOf(phone).find(([s]) => s === selector)
const selectPhone = mediaBlocks(selectCss, '(pointer: coarse), (max-width: 767px)').join('\n')

const ROOT = ".odc-field .od-ui:where(.od-first-select-root)[data-fit='trigger']:not([data-type='primary'])"
const TRIGGER = `${ROOT} > .od-first-select-trigger`

describe('U/FirstSelect C18 inside a P/Field on a phone (X-SC8, X-SC6)', () => {
  it('the closed field is the control height (32px), like the DatePicker beside it', () => {
    const rule = phoneRule(ROOT)
    expect(rule, `${ROOT} in the phone @media`).toBeTruthy()
    expect(rule[1]).toContain('min-block-size: var(--od-x-control-height)')
  })

  it('the trigger fills the field (control height minus its two borders), it does not grow to 44', () => {
    const rule = phoneRule(TRIGGER)
    expect(rule, `${TRIGGER} in the phone @media`).toBeTruthy()
    expect(rule[1]).toContain('min-block-size: calc(var(--od-x-control-height) - var(--od-x-hairline) * 2)')
    expect(rule[1]).not.toContain('target-coarse')
  })

  it('the trigger carries the 44x44 area as a pseudo-element, with the house token', () => {
    const rule = phoneRule(`${TRIGGER}::after`)
    expect(rule, `${TRIGGER}::after in the phone @media`).toBeTruthy()
    expect(rule[1]).toContain("content: ''")
    expect(rule[1]).toContain('position: absolute')
    expect(rule[1]).toContain('inset: var(--od-x-target-inset)')
  })

  it('outside a P/Field the C18 select, the options and the legacy anatomy keep their 44px', () => {
    const coarse = rulesOf(selectPhone).filter(([, body]) => /min-(?:block-size|height):\s*(?:var\(--od-x-target-coarse\)|calc\(var\(--od-x-target-coarse\))/.test(body)).map(([selector]) => selector)
    expect(coarse).toContain(".od-ui:where(.od-first-select-root)[data-fit='trigger']:not([data-type='primary'])")
    expect(coarse).toContain(".od-ui:where(.od-first-select-root)[data-fit='trigger'] > .od-first-select-trigger")
    expect(coarse).toContain(".od-ui:where(.od-first-select-root) > .od-first-select-list[data-fit='trigger'] .od-first-select-option")
    expect(rulesOf(selectPhone).find(([s]) => s === '.od-ui:where(.od-first-select-root) > .od-first-select-trigger, .od-ui:where(.od-first-select-root) .od-first-select-option, .od-ui:where(.od-first-select-root) .od-first-select-delete')[1])
      .toContain('min-height: var(--od-first-select-touch-target)')
  })
})

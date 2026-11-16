// redesign F6g-1 (locales matrix, wave 6): at 320 and 390px the «New user» button went under the field (<600px) but the
// suggestions dropdown, absolutely positioned under the field, covered its row, so the button was never visible while the field
// had the focus (and the wizard focuses it). Under 600px the suggestions are part of the column: they push the button down
// instead of covering it, and the list is short enough that the button stays on the screen. main always showed the button
// beside the field; it stays reachable and visible at every width.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.join(__dirname, '..', 'steps.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

const mediaBody = (query) => {
  const open = css.indexOf('{', css.indexOf(`@media ${query}`))
  let depth = 1
  let index = open + 1
  while (depth > 0 && index < css.length) {
    if (css[index] === '{') depth += 1
    else if (css[index] === '}') depth -= 1
    index += 1
  }
  return css.slice(open + 1, index - 1)
}
const rule = (source, selector) => {
  const start = source.indexOf(`${selector} {`)
  return start === -1 ? '' : source.slice(source.indexOf('{', start) + 1, source.indexOf('}', start))
}

describe('wizard step 1: «New user» on a narrow viewport (F6g-1)', () => {
  const narrow = mediaBody('(max-width: 599px)')

  it('puts the button under the field below 600px', () => {
    expect(rule(narrow, '.odc-steps-customer-row')).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/)
  })

  it('the suggestions flow in the column below 600px, so they never cover the button', () => {
    const suggestions = rule(narrow, '.odc-steps-suggestions')
    expect(suggestions).toMatch(/position:\s*static/)
    expect(suggestions).toMatch(/margin-block-start:\s*var\(--od-space-1\)/)
  })

  it('the in-flow list is capped so the button stays within a short scroll of the field', () => {
    expect(rule(narrow, '.odc-steps-suggestions')).toMatch(/max-block-size:\s*calc\(var\(--od-x-row-comfortable\)\s*\*\s*3\)/)
  })

  it('the floating dropdown of wider layouts is untouched', () => {
    expect(rule(css.slice(0, css.indexOf('@media')), '.odc-steps-suggestions')).toMatch(/position:\s*absolute/)
  })
})

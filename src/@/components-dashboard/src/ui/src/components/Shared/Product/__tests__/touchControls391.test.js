// (W0-E-13, decision 12): with a coarse pointer or below 768px the compact controls are SEEN at 32px
// (--od-x-control-height), not at 28 / 24. Their 44×44 touch area stays the centered pseudo-element (touch.w03d1/w03d2).
// With a mouse nothing changes: the base boxes keep sm 28, the fine target 24.
// (O-10): the switch is the exception to «the drawn control stays as it was»: on touch its track is 40×24 with a 20px thumb
// (32×18 and 14 with a mouse), set locally on .odc-switch through the three --od-x-switch-* tokens, never in :root.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const COMPONENTS = path.join(__dirname, '..', '..', '..')
const read = file => readFileSync(path.join(COMPONENTS, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

const mediaBlocks = (css, query) => {
  const blocks = []
  const needle = `@media ${query}`
  let from = css.indexOf(needle)
  while (from !== -1) {
    const open = css.indexOf('{', from)
    let depth = 1
    let index = open + 1
    while (depth > 0 && index < css.length) {
      if (css[index] === '{') depth += 1
      else if (css[index] === '}') depth -= 1
      index += 1
    }
    blocks.push(css.slice(open + 1, index - 1))
    from = css.indexOf(needle, index)
  }
  return blocks
}

const rulesOf = css => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => [selector.trim().replace(/\s+/g, ' '), body.replace(/\s+/g, ' ')])
const PHONE = '(pointer: coarse), (max-width: 767px)'
const phoneRule = (css, selector) => rulesOf(mediaBlocks(css, PHONE).join('\n')).find(([s]) => s === selector)
const baseRule = (css, selector) => rulesOf(css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')).find(([s]) => s === selector)

describe('W0-E-13: compact controls are seen at 32px on a phone', () => {
  it('product.css: a small button and its icon-only width reach --od-x-control-height', () => {
    const css = read('Shared/Product/product.css')
    expect(phoneRule(css, ".odc-btn[data-size='sm']"), 'sm in the phone @media').toBeTruthy()
    expect(phoneRule(css, ".odc-btn[data-size='sm']")[1]).toContain('block-size: var(--od-x-control-height)')
    expect(phoneRule(css, ".odc-btn[data-icon-only][data-size='sm']"), 'icon-only sm in the phone @media').toBeTruthy()
    expect(phoneRule(css, ".odc-btn[data-icon-only][data-size='sm']")[1]).toContain('inline-size: var(--od-x-control-height)')
    // a mouse keeps 28
    expect(baseRule(css, ".odc-btn[data-size='sm']")[1]).toContain('block-size: var(--od-x-control-height-sm)')
    expect(baseRule(css, ".odc-btn[data-icon-only][data-size='sm']")[1]).toContain('inline-size: var(--od-x-control-height-sm)')
  })

  it('switch.css: the box is 32 high and the track is taller on touch (40×24, thumb 20), 32×18 with a mouse', () => {
    const css = read('Shared/Product/switch.css')
    const rule = phoneRule(css, '.odc-switch')
    expect(rule, '.odc-switch in the phone @media').toBeTruthy()
    expect(rule[1]).toContain('min-block-size: var(--od-x-control-height)')
    expect(baseRule(css, '.odc-switch')[1]).toContain('min-block-size: var(--od-x-target-fine)')
    // touch: 24 high (1.5rem), 40 wide (2rem + 0.5rem), 20 thumb (1rem + 0.25rem), from the release space scale
    expect(rule[1]).toContain('--od-x-switch-height: var(--od-space-5)')
    expect(rule[1]).toContain('--od-x-switch-width: calc(var(--od-space-6) + var(--od-space-2))')
    expect(rule[1]).toContain('--od-x-switch-thumb: calc(var(--od-space-4) + var(--od-space-1))')
    // the track itself is still sized by the tokens, and a mouse keeps 32×18 / 14 (the :root values)
    expect(mediaBlocks(css, PHONE).join('\n')).not.toContain('.odc-switch-track')
    expect(baseRule(css, '.odc-switch')[1]).not.toContain('--od-x-switch')
    const candidates = readFileSync(path.join(__dirname, '..', '..', '..', '..', '..', '..', '..', '..', '..', 'brand', 'candidates.css'), 'utf8')
    expect(candidates).toMatch(/--od-x-switch-width: 32px;/)
    expect(candidates).toMatch(/--od-x-switch-height: 18px;/)
    expect(candidates).toMatch(/--od-x-switch-thumb: 14px;/)
  })

  it('timeline.css: «Technical details» is 32 high', () => {
    const css = read('Shared/Product/timeline.css')
    const rule = phoneRule(css, '.odc-feed-summary')
    expect(rule[1]).toContain('min-block-size: var(--od-x-control-height)')
    expect(baseRule(css, '.odc-feed-summary')[1]).toContain('min-block-size: var(--od-x-target-fine)')
  })

  it('wizard.css: the done step link is 32 high', () => {
    const css = read('Shared/Product/Wizard/wizard.css')
    const rule = phoneRule(css, 'button.odc-wizard-step-link')
    expect(rule[1]).toContain('min-block-size: var(--od-x-control-height)')
    expect(baseRule(css, '.odc-wizard-step-link')[1]).toContain('min-block-size: var(--od-x-target-fine)')
  })
})

// redesign W0-3d (T0-12, decision 12), second part: filter-popover.css, date-range.css, timeline.css, column-manager.css, menu.css and
// Wizard/wizard.css. Like touch.w03d1.test.js: a loose control is SEEN at its size (the box does not grow) and its touch area reaches 44px
// with a centered pseudo-element; a stacked row, or a control whose neighbour is closer than the area needs, stays as it was.
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

const PHONE = '(pointer: coarse), (max-width: 767px)'
const COARSE_ONLY = '(pointer: coarse) {'
const COARSE = 'var(--od-x-target-coarse)'
const phoneRules = css => mediaBlocks(css, PHONE).join('\n')
const coarseOnlyRules = css => mediaBlocks(css, COARSE_ONLY).join('\n')
// the rules of a block as [selector, body] pairs (no nesting in the blocks under test)
const rulesOf = (css) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => [selector.trim().replace(/\s+/g, ' '), body.replace(/\s+/g, ' ')])
const ruleFor = (css, selector) => rulesOf(css).find(([s]) => s === selector)

// one declaration: the token of src/brand/candidates.css (min(0px, calc((100% - var(--od-x-target-coarse)) / 2)); the literal guard rejects a 0px here)
const AREA_INSET = 'inset: var(--od-x-target-inset)'

// every width/height of a rule that sets the target token as the size of the box
const GROWS = /(?:^|[\s;{])(?:min-|max-)?(?:block|inline)-size:\s*var\(--od-x-target-coarse\)/
const growing = (css) => rulesOf(css).filter(([, body]) => GROWS.test(body)).map(([selector]) => selector)

const expectArea = (css, anchor) => {
  const rule = ruleFor(phoneRules(css), `${anchor}::after`)
  expect(rule, `${anchor}::after in the phone @media`).toBeTruthy()
  expect(rule[1]).toContain("content: ''")
  expect(rule[1]).toContain('position: absolute')
  expect(rule[1]).toContain(AREA_INSET)
}

// product.css belongs to W0-3d1: the area of .odc-btn is asserted there in its own test. Here it only has to be there, in the
// token form or in the two-declaration form it had before moving to the token.
const expectButtonArea = () => {
  const rule = ruleFor(phoneRules(read('Shared/Product/product.css')), '.odc-btn::after')
  expect(rule, '.odc-btn::after in the phone @media').toBeTruthy()
  expect(rule[1]).toContain('position: absolute')
  expect(rule[1]).toMatch(/inset: var\(--od-x-target-inset\)/) // redesign W0-3d (coordinator): the token only
}

const expectPositioned = (css, anchor) => {
  const rule = ruleFor(phoneRules(css), anchor)
  expect(rule, `${anchor} in the phone @media`).toBeTruthy()
  expect(rule[1]).toContain('position: relative')
}

describe('W0-3d2: loose controls get the 44px area, not a 44px box', () => {
  it('timeline.css: the details summary keeps its box and gets the centered ::after', () => {
    const css = read('Shared/Product/timeline.css')
    expectPositioned(css, '.odc-feed-summary')
    expectArea(css, '.odc-feed-summary')
    expect(growing(phoneRules(css)), 'no growth in the phone @media').toEqual([])
    expect(mediaBlocks(css, COARSE_ONLY), 'no coarse-only block is left').toEqual([])
    // the base box is the fine target, as before
    expect(ruleFor(css, '.odc-feed-summary')[1]).toContain('min-block-size: var(--od-x-target-fine)')
  })

  it('date-range.css: the trigger keeps its box (32, or the field of the sheet) and gets the area', () => {
    const css = read('Shared/Product/date-range.css')
    expectPositioned(css, '.odc-dr-trigger')
    expectArea(css, '.odc-dr-trigger')
    const triggerRules = rulesOf(`${coarseOnlyRules(css)}\n${phoneRules(css)}`).filter(([selector]) => selector === '.odc-dr-trigger')
    for (const [, body] of triggerRules) expect(body).not.toMatch(/(?:min-|max-)?(?:block|inline)-size/)
    // the phone font size of the trigger (no zoom on iOS) stays where it was, with the coarse pointer
    expect(ruleFor(coarseOnlyRules(css), '.odc-dr-trigger')[1]).toContain('font-size: var(--od-x-type-lead-size)')
    // the base keeps following the field of the Filters sheet
    expect(ruleFor(css, '.odc-dr-trigger')[1]).toContain('min-block-size: var(--odc-ofs-control, var(--od-x-control-height))')
  })

  it('wizard.css: the step link and the summary toggle keep their box and get the area', () => {
    const css = read('Shared/Product/Wizard/wizard.css')
    for (const anchor of ['button.odc-wizard-step-link', '.odc-wizard-summary-toggle']) {
      expectPositioned(css, anchor)
      expectArea(css, anchor)
    }
    expect(mediaBlocks(css, COARSE_ONLY), 'no coarse-only block is left').toEqual([])
    expect(growing(phoneRules(css)), 'no growth in the phone @media').toEqual([])
    // the base boxes are the ones of the desktop
    expect(ruleFor(css, '.odc-wizard-step-link')[1]).toContain('min-block-size: var(--od-x-target-fine)')
    expect(ruleFor(css, '.odc-wizard-summary-toggle')[1]).toContain('min-block-size: var(--od-x-control-height-lg)')
  })

  it('wizard.css: the footer buttons keep their size, share the row, and take the area of .odc-btn (product.css)', () => {
    const css = read('Shared/Product/Wizard/wizard.css')
    const narrow = mediaBlocks(css, '(max-width: 767px)').join('\n')
    const actions = ruleFor(narrow, '.odc-wizard-actions > .odc-btn')
    expect(actions).toBeTruthy()
    expect(actions[1]).toContain('flex: 1')
    expect(actions[1]).not.toMatch(/(?:min-)?(?:block|inline)-size/)
    // the area is the one of every button
    expectButtonArea()
  })

  it('filter-popover.css: the foot button keeps its fine minimum width; the 44px is the area of .odc-btn', () => {
    const css = read('Shared/Product/filter-popover.css')
    expect(ruleFor(css.split(`@media ${PHONE}`)[0], '.odc-orders-popover-foot .odc-btn')[1]).toContain('min-inline-size: var(--od-x-target-fine)')
    expect(rulesOf(phoneRules(css)).map(([selector]) => selector)).not.toContain('.odc-orders-popover-foot .odc-btn')
    expect(growing(phoneRules(css))).toEqual(['.odc-orders-popover .odc-checkbox-labelled'])
    expectButtonArea()
  })
})

describe('W0-3d2: stacked rows stay as they were (listed in the delivery, decided by the owner)', () => {
  it.each([
    ['Shared/Product/menu.css', PHONE, '.odc-menu-item', 'min-block-size'],
    ['Shared/Product/column-manager.css', COARSE_ONLY, '.odc-cm-row', 'min-block-size'],
    ['Shared/Product/filter-popover.css', PHONE, '.odc-orders-popover .odc-checkbox-labelled', 'min-block-size'],
    ['Shared/Product/filter-popover.css', PHONE, '.odc-orders-picker-popup', '--odc-picker-row'],
    ['Shared/Product/date-range.css', COARSE_ONLY, '.odc-dr-popup, .odc-dr-sheet', '--odc-dr-day'],
    ['Shared/Product/date-range.css', COARSE_ONLY, '.odc-dr-preset, .odc-dr-input', 'min-block-size']
  ])('%s keeps the 44px in @media %s for %s', (file, query, selector, property) => {
    const css = read(file)
    const blocks = mediaBlocks(css, query === COARSE_ONLY ? COARSE_ONLY : query)
    expect(blocks.length).toBeGreaterThan(0)
    const rule = blocks.flatMap(rulesOf).find(([s]) => s === selector)
    expect(rule, selector).toBeTruthy()
    expect(rule[1]).toContain(`${property}: ${COARSE}`)
    // and no area pseudo was added to them
    expect(css).not.toMatch(/odc-(menu-item|cm-row|checkbox-labelled|dr-day|dr-preset|dr-input)[^{]*::(after|before)/)
  })
})

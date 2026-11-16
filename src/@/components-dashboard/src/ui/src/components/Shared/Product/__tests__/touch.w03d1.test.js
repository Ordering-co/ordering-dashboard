// redesign W0-3d (T0-12, decision 12): on the phone the compact controls are SEEN at 32px (the box does not grow) and their
// touch area reaches 44px with a centered pseudo-element. A loose control moves from "the box grows to --od-x-target-coarse"
// to the area pattern; a stacked row, or a control whose neighbour is closer than the area needs, stays as it was.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const COMPONENTS = path.join(__dirname, '..', '..', '..')
const read = file => readFileSync(path.join(COMPONENTS, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

// redesign deliveries-followups W1-D-25: the query must be the whole query, so `(pointer: coarse)` no longer also reads the
// `(pointer: coarse), (max-width: 767px)` blocks (segmented.css has both now)
const nextMedia = (css, needle, from) => {
  let at = css.indexOf(needle, from)
  while (at !== -1 && !/^\s*\{/.test(css.slice(at + needle.length))) at = css.indexOf(needle, at + needle.length)
  return at
}

const mediaBlocks = (css, query) => {
  const blocks = []
  const needle = `@media ${query}`
  let from = nextMedia(css, needle, 0)
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
    from = nextMedia(css, needle, index)
  }
  return blocks
}

const PHONE = '(pointer: coarse), (max-width: 767px)'
const phoneRules = css => mediaBlocks(css, PHONE).join('\n')
const COARSE = 'var(--od-x-target-coarse)'
const GROWS = /(?:^|[\s;{])(?:min-)?(?:block|inline)-size:\s*var\(--od-x-target-coarse\)/

// The rules of a block as [selector, body] pairs (no nesting in the blocks under test).
const rulesOf = (css) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => [selector.trim().replace(/\s+/g, ' '), body])

// redesign W0-3d (coordinator): the inset is one candidate token, --od-x-target-inset (src/brand/candidates.css, anchor W0-3d)
const AREA_INSET = 'inset: var(--od-x-target-inset)'

const expectArea = (css, pseudoSelector) => {
  const rule = rulesOf(phoneRules(css)).find(([selector]) => selector === pseudoSelector)
  expect(rule, `${pseudoSelector} in the phone @media`).toBeTruthy()
  const body = rule[1].replace(/\s+/g, ' ')
  expect(body).toContain("content: ''")
  expect(body).toContain('position: absolute')
  expect(body).toContain(AREA_INSET)
}

const growing = (css) => rulesOf(phoneRules(css)).filter(([, body]) => GROWS.test(body)).map(([selector]) => selector)

describe('W0-3d1: loose controls get the 44px area, not a 44px box', () => {
  it('product.css: .odc-btn (every size, icon-only, link) keeps its box and has the centered ::after', () => {
    const css = read('Shared/Product/product.css')
    expectArea(css, '.odc-btn::after')
    // the button is already positioned: the pseudo is placed against it
    expect(css).toMatch(/\.odc-btn\s*\{\s*position:\s*relative/)
    // nothing in the phone @media makes a button box grow any more (md 32, sm 28, lg 40, icon-only 32x32, link)
    expect(growing(css)).toEqual([])
    expect(phoneRules(css)).not.toMatch(GROWS)
  })

  it('filter-bar.css: the notice button no longer grows (it takes the .odc-btn area); the rest of the phone block is as it was', () => {
    const rules = rulesOf(phoneRules(read('Shared/Product/filter-bar.css')))
    const selectors = rules.map(([selector]) => selector).join(' | ')
    expect(selectors).not.toContain('.odc-notice .odc-btn')
    const grow = (selector) => rules.find(([s, body]) => s === selector && GROWS.test(body))
    // stays: search / pills / filter-bar buttons (vertical neighbour at 8px), their icon-only width, the pill width, the chip X
    expect(grow('.odc-search, .odc-pill, .odc-filterbar .odc-btn')).toBeTruthy()
    expect(grow('.odc-filterbar .odc-btn[data-icon-only]')).toBeTruthy()
    expect(grow('.odc-pill')).toBeTruthy()
    expect(grow(".odc-chip .odc-chip-remove.odc-btn[data-icon-only][data-size='sm']")).toBeTruthy()
  })
})

describe('W0-3d1: stacked rows and tight neighbours stay as they were (listed in the delivery, decided by the owner)', () => {
  it.each([
    ['Shared/Product/tabs.css', PHONE, ".odc-tab, .odc-tabs-list[data-size='sm'] .odc-tab"],
    // redesign W0-4b (T0-14, decision 18): the icon of «Clear filters» is gone (it goes to «+N»), and its 44px rule with it
    // redesign deliveries-followups W1-D-25: the segmented buttons left this list (32 visible + the area, below); its
    // fallback select keeps the 44px box with a coarse pointer (a <select> cannot hold a pseudo-element)
    // (M3-F3): the select moved to the phone query with the options; touch.maintainer.test.js pins its 44px box there
    // same query as switch/field (decision 12); box kept per W0-3d1
    ['Shared/Product/checkbox.css', PHONE, '.odc-checkbox'],
    ['Shared/Product/checkbox.css', PHONE, '.odc-checkbox-labelled'],
    ['Shared/Product/data-table.css', '(pointer: coarse)', '.odc-table tbody td, .odc-table[data-density=\'compact\'] tbody td']
  ])('%s keeps the 44px box in @media %s for %s', (file, query, selector) => {
    const css = read(file)
    const blocks = mediaBlocks(css, query)
    expect(blocks.length).toBeGreaterThan(0)
    const rule = blocks.flatMap(rulesOf).find(([s]) => s === selector)
    expect(rule, selector).toBeTruthy()
    expect(rule[1]).toContain(COARSE)
    // and no area pseudo was added to them
    expect(blocks.join('\n')).not.toContain(AREA_INSET)
  })
})

// redesign deliveries-followups W1-D-25 (decision 12; owner's «ok» of 2026-10-10): P/SegmentedControl is SEEN at 32px
// on a phone and with a coarse pointer, and its 44×44 area is the centred pseudo-element, as P/Button. It was 28 visible below 768px
// with a mouse (no area) and a 44px box with a coarse pointer. Each option keeps at least 44 of width, so the areas of two
// neighbours (2px apart) never overlap; on a desktop with a mouse it stays at 28.
describe('W1-D-25: the segmented control', () => {
  const css = read('Shared/Product/segmented.css')
  const rules = rulesOf(phoneRules(css))
  const body = selector => (rules.find(([s]) => s === selector) || [])[1] || ''

  it('each option is 32 visible, at least 44 wide, with the 44×44 area pseudo-element', () => {
    expect(body('.odc-seg-btn')).toContain('block-size: var(--od-x-control-height)')
    expect(body('.odc-seg-btn')).toContain('min-inline-size: var(--od-x-target-coarse)')
    expect(body('.odc-seg-btn')).not.toMatch(/(?:^|[\s;])block-size:\s*var\(--od-x-target-coarse\)/)
    expectArea(css, 'button.odc-seg-btn::after')
  })

  it('the area is on the real options only: the hidden twin draws its labels with ::after and keeps their width', () => {
    expect(css).toMatch(/\.odc-seg-measure \.odc-seg-btn::after\s*\{\s*content:\s*attr\(data-label\)/)
    expect(rules.find(([s]) => s === '.odc-seg-btn::after')).toBeUndefined()
  })

  it('the option is positioned, so the pseudo is placed against it', () => {
    expect(css).toMatch(/\.odc-seg-btn\s*\{[^}]*position:\s*relative/)
  })

  it('no 44px box is left for the options in any @media', () => {
    const coarse = mediaBlocks(css, '(pointer: coarse)').flatMap(rulesOf)
    expect(coarse.find(([s]) => s === '.odc-seg-btn')).toBeUndefined()
  })

  it('on a desktop with a mouse it keeps --od-x-control-height-sm', () => {
    const base = rulesOf(css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')).find(([s]) => s === '.odc-seg-btn')
    expect(base[1]).toContain('block-size: var(--od-x-control-height-sm)')
  })
})

// redesign W0 close-fixes-3 (W0-E-12, decision 12): the selection bar's «Select all» link leaves the 44px box for the area pattern
// (32 visible, also under 768px with a mouse); the clear button, last in a bar with rounded, scrolling ends, keeps 44 visible (W0-D-08).
describe('W0-E-12: the selection bar', () => {
  const rules = rulesOf(phoneRules(read('Shared/Product/selection-bar.css')))
  const body = selector => (rules.find(([s]) => s === selector) || [])[1]

  it('the Select all link is 32 visible with the 44×44 area pseudo-element, not a 44px box', () => {
    expect(body('.odc-selbar-link')).toContain('min-block-size: var(--od-x-control-height)')
    expect(body('.odc-selbar-link')).not.toMatch(GROWS)
    expect(body('.odc-selbar-link::after')).toContain(AREA_INSET)
  })

  it('the clear button keeps 44 visible', () => {
    const clear = body('.odc-selbar .odc-btn[data-selbar-clear][data-icon-only]')
    expect(clear).toContain(`block-size: ${COARSE}`)
    expect(clear).toContain(`inline-size: ${COARSE}`)
  })
})

// (M3-F3, from ): a panel at 390px with a mouse (below 768px, no coarse pointer) measured the fallback select of
// P/SegmentedControl at 32px with no touch area: a <select> takes no pseudo-element, so it keeps a 44px box, and it only did so with
// a coarse pointer. TextField, TextArea, PasswordField and NumberField already reach 44 by the area of their frame (field.css): locked.
describe('M3-F3: form controls reach 44px with a coarse pointer and below 768px', () => {
  it('the fallback select of the segmented control keeps a 44px box in the phone query, not only with a coarse pointer', () => {
    const css = read('Shared/Product/segmented.css')
    const rule = rulesOf(phoneRules(css)).find(([s]) => s === '.odc-seg-select')
    expect(rule, '.odc-seg-select in the phone @media').toBeTruthy()
    expect(rule[1]).toMatch(/block-size:\s*var\(--od-x-target-coarse\)/)
    expect(mediaBlocks(css, '(pointer: coarse)').flatMap(rulesOf).find(([s]) => s === '.odc-seg-select'), 'no coarse-only rule left').toBeUndefined()
  })

  it('the text controls and the number box take the 44px area on their frame in the phone query', () => {
    const rules = rulesOf(phoneRules(read('Shared/Product/field.css')))
    const area = rules.find(([s]) => s === '.odc-field-control:has(> .odc-field-input)::after, .odc-field-box::after')
    expect(area, 'the frame pseudo-element').toBeTruthy()
    expect(area[1]).toContain('position: absolute')
    expect(area[1]).toContain(AREA_INSET)
    expect(rules.find(([s]) => s === '.odc-field-control:has(> .odc-field-input), .odc-field-box')).toBeTruthy()
  })
})

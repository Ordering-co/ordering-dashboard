// redesign W0-3d3 (T0-12, decision 12): the phone surface of /orders. A loose control is SEEN at its own size (the box does not
// grow to --od-x-target-coarse) and its 44px area is a centered pseudo-element. What stays as it was (a stacked row, a control
// whose neighbour is closer than the area needs, an <input>/<select>/<textarea>, which cannot hold a pseudo-element) keeps its
// 44px box here and is listed in the delivery for the owner. Same reading as Shared/Product/__tests__/touch.w03d1.test.js.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const COMPONENTS = path.join(__dirname, '..')
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
const COARSE_ONLY = '(pointer: coarse)'
const phoneRules = css => mediaBlocks(css, PHONE).join('\n')
const COARSE = 'var(--od-x-target-coarse)'
const GROWS = /(?:^|[\s;{])(?:min-)?(?:block|inline)-size:\s*var\(--od-x-target-coarse\)/

// The rules of a block as [selector, body] pairs (no nesting in the blocks under test).
const rulesOf = (css) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => [selector.trim().replace(/\s+/g, ' '), body.replace(/\s+/g, ' ')])
const ruleOf = (css, selector) => rulesOf(css).find(([s]) => s === selector)

// the one declaration of the area (token of src/brand/candidates.css: min(0px, calc((100% - 44px) / 2)); a literal 0px does not pass the guard)
const AREA_INSET = 'inset: var(--od-x-target-inset)'
// product.css is the d1 agent's file: until it moves to the token it carries the same area as the inset-block/inset-inline pair
const LEGACY_PAIR = /inset-block:\s*min\(calc\(var\(--od-x-target-coarse\) \* 0\), calc\(\(100% - var\(--od-x-target-coarse\)\) \/ 2\)\);\s*inset-inline:\s*min\(calc\(var\(--od-x-target-coarse\) \* 0\), calc\(\(100% - var\(--od-x-target-coarse\)\) \/ 2\)\)/

const SIX = [
  'OrdersContentHeader/content-header.css',
  'OrdersFilterBar/orders-filter-bar.css',
  'OrdersFilterGroup/orders-filter-group.css',
  'OrdersTable/orders-table.css',
  'OrdersTable/order-card.css',
  '../Shared/Product/record-card.css',
  'CreateCustomOrder/steps.css'
]

describe('W0-3d3: the loose controls of the order cards get the 44px area, not a 44px box', () => {
  const card = read('../Shared/Product/record-card.css') // redesign W1-1 (T1-1): the card moved to Product

  it('the card link keeps its own line (no 44px box, no negative margin to give it back) and its overlay is the area', () => {
    const link = ruleOf(card, '.odc-order-card-link')
    expect(link).toBeTruthy()
    expect(link[1]).not.toContain(COARSE)
    expect(link[1]).not.toMatch(/margin-block\s*:/)
    expect(link[1]).toContain('display: inline-flex')
    // the overlay already covers the whole card, which is far more than 44px around the link: it IS the area
    // (the link has its ::after: a second pseudo would be ::before, and it is not needed)
    const overlay = ruleOf(card, '.odc-order-card-link::after')
    expect(overlay[1]).toContain("content: ''")
    expect(overlay[1]).toContain('position: absolute')
    expect(overlay[1]).toContain('inset: 0')
    // …and the link is NOT positioned itself, so the overlay is placed against the card, not against the link
    expect(link[1]).not.toMatch(/position\s*:/)
    expect(ruleOf(card, '.odc-order-card')[1]).toContain('position: relative')
  })

  it('Reject / Accept keep the size of their Button (lg) and take the area of Product\'s .odc-btn::after', () => {
    const actions = ruleOf(card, '.odc-order-card-actions .odc-btn')
    expect(actions).toBeTruthy()
    expect(actions[1]).not.toContain(COARSE)
    expect(actions[1]).not.toMatch(/(?:^|[\s;])(?:min-)?block-size\s*:/)
    expect(actions[1]).toContain('inline-size: 100%')
    // the two buttons are wide: the area grows in the block direction only, so the 8px between them is not crossed
    expect(ruleOf(card, '.odc-order-card-actions')[1]).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))')
    // where the area comes from: the same pattern, once, in product.css, for every .odc-btn
    const product = read('../Shared/Product/product.css')
    const area = ruleOf(phoneRules(product), '.odc-btn::after')
    expect(area, '.odc-btn::after in the phone @media of product.css').toBeTruthy()
    expect(area[1]).toContain("content: ''")
    expect(area[1]).toContain('position: absolute')
    expect(area[1].includes(AREA_INSET) || LEGACY_PAIR.test(area[1]), 'the area declaration').toBe(true)
  })

  it('no file of the surface repeats the area pseudo (the changed sites use the overlay and Product\'s)', () => {
    for (const file of SIX) expect(read(file), file).not.toMatch(/--od-x-target-inset|inset-block:\s*min\(/)
  })
})

describe('W0-3d3: stacked rows, tight neighbours and form fields stay as they were (listed in the delivery, decided by the owner)', () => {
  // [file, query (null: no media, the rule is the phone layout itself), selector, the property that holds the target]
  it.each([
    // page head: menu, live status, Learn, Export, «+», «More actions» in one row at 4px (phone) to 12px (tablet)
    ['OrdersContentHeader/content-header.css', PHONE, '.odc-header-actions > [data-action] > button:first-of-type, .odc-header-actions > [data-action] > div:first-child > button:first-of-type, .odc-page-head .odc-btn, .odc-page-head .od-ui.od-learn-menu .learn-drop-down', 'min-block-size'],
    ['OrdersContentHeader/content-header.css', PHONE, '.odc-page-head .odc-btn[data-icon-only]', 'min-inline-size'],
    ['OrdersContentHeader/content-header.css', PHONE, '.odc-page-head .odc-live-btn.odc-btn', 'min-inline-size'],
    // the SLA pill is one of the pills of the bar (8px between them)
    ['OrdersFilterBar/orders-filter-bar.css', PHONE, '.odc-btn.odc-orders-menu-pill', 'min-block-size'],
    // the filters sheet: stacked field rows, and <input> cannot hold a pseudo-element
    ['OrdersFilterBar/orders-filter-bar.css', PHONE, '.odc-ofs-input, .odc-ofs-field :is(.od-first-select-root, .od-multi-select-root)', 'min-block-size'],
    ['OrdersFilterBar/orders-filter-bar.css', PHONE, '.odc-ofs-field :is(.od-first-select-root, .od-multi-select-root) > :is(.od-first-select-trigger, .od-multi-select-trigger)', 'min-block-size'],
    ['OrdersFilterGroup/orders-filter-group.css', PHONE, '.odc-ofs-body', '--odc-ofs-control'],
    // the pager under the cards: buttons, menu and page field at 4-8px from each other
    ['OrdersTable/order-card.css', null, '.odc-orders-foot[data-cards] .odc-btn', 'min-inline-size'],
    ['OrdersTable/order-card.css', null, '.odc-orders-foot[data-cards] .odc-btn', 'block-size'],
    ['OrdersTable/order-card.css', null, '.odc-orders-foot[data-cards] .odc-orders-page-input', 'block-size'],
    ['OrdersTable/orders-table.css', null, ".odc-orders-foot[data-skeleton][data-cards] .odc-skeleton[data-shape='box']", 'block-size'],
    ['OrdersTable/orders-table.css', null, '.odc-orders-foot[data-skeleton][data-cards] .odc-orders-pager', 'min-block-size'],
    ['OrdersTable/orders-table.css', COARSE_ONLY, '.odc-orders-page-input', 'block-size'],
    ['OrdersTable/orders-table.css', COARSE_ONLY, '.odc-orders-selbar .odc-orders-bulk .od-first-select-root', 'block-size'],
    ['OrdersTable/orders-table.css', COARSE_ONLY, ".odc-orders-table .odc-table[data-density='compact'] tbody td", 'block-size'],
    // the wizard: <input>/<select> (no pseudo-element), the GPS button 8px from its input, rows of the address list
    ['CreateCustomOrder/steps.css', PHONE, '.odc-steps-input, .odc-steps-select', 'block-size'],
    ['CreateCustomOrder/steps.css', PHONE, '.odc-steps-qty', 'min-inline-size'],
    ['CreateCustomOrder/steps.css', PHONE, '.odc-addr-autocomplete .gps-button', 'inline-size'],
    ['CreateCustomOrder/steps.css', PHONE, '.odc-addr-autocomplete .gps-button', 'block-size'],
    ['CreateCustomOrder/steps.css', PHONE, '.odc-addr-main', 'min-block-size']
  ])('%s keeps %s %s on %s', (file, query, selector, property) => {
    const css = read(file)
    const rules = query ? rulesOf(mediaBlocks(css, query).join('\n')) : rulesOf(css)
    const rule = rules.find(([s, body]) => s === selector && new RegExp(`(?:^|[\\s;])${property}:\\s*var\\(--od-x-target-coarse\\)`).test(body))
    expect(rule, `${selector} { ${property}: ${COARSE} }`).toBeTruthy()
  })

  it('the phone @media blocks of the six files add no area pseudo and drop no box of the list above', () => {
    for (const file of SIX) {
      const blocks = [...mediaBlocks(read(file), PHONE), ...mediaBlocks(read(file), COARSE_ONLY)].join('\n')
      expect(blocks, file).not.toMatch(/::(?:before|after)/)
    }
    // the phone rules that still grow a box are exactly these (a new one would be a decision for the owner)
    const growing = Object.fromEntries(SIX.map(file => [file, rulesOf(phoneRules(read(file))).filter(([, body]) => GROWS.test(body) || body.includes(`--odc-ofs-control: ${COARSE}`)).length]))
    expect(growing).toEqual({
      'OrdersContentHeader/content-header.css': 3,
      'OrdersFilterBar/orders-filter-bar.css': 3,
      'OrdersFilterGroup/orders-filter-group.css': 1,
      'OrdersTable/orders-table.css': 0,
      'OrdersTable/order-card.css': 0,
      '../Shared/Product/record-card.css': 0,
      'CreateCustomOrder/steps.css': 4
    })
  })
})

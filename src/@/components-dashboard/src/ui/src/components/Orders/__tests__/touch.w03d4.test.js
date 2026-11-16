// redesign W0-3d4 (T0-12, decision 12) + W0-3a (T0-9, decision 11a): the phone surface of the order detail (1/2).
// A loose control is SEEN at its own size and its 44px area is a centered pseudo-element; what stays as it was (an
// <input>/<select>/<textarea>, which cannot hold a pseudo-element; stacked rows; a control with a neighbour closer than
// the area needs; the FirstSelect, whose own CSS grows it) keeps its 44px box here and is listed in the delivery.
// Same reading as touch.w03d3.test.js. The second half pins the amount of the tax and fee rows of the order bill (mono,
// tabular) and the time of the order route (a figure, not plain mono).
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const COMPONENTS = path.join(__dirname, '..', '..')
const raw = file => readFileSync(path.join(COMPONENTS, file), 'utf8')
const read = file => raw(file).replace(/\/\*[\s\S]*?\*\//g, '')

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
const rulesOf = (css) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => [selector.trim().replace(/\s+/g, ' '), body.replace(/\s+/g, ' ')])
const ruleOf = (css, selector) => rulesOf(css).find(([s]) => s === selector)
const phoneRules = css => rulesOf(mediaBlocks(css, PHONE).join('\n'))

const COARSE = 'var(--od-x-target-coarse)'
const GROWS = /(?:^|[\s;{])(?:min-)?(?:block|inline)-size:\s*var\(--od-x-target-coarse\)|--od-field-touch-target:\s*var\(--od-x-target-coarse\)/
const growing = css => rulesOf(css).filter(([, body]) => GROWS.test(body)).map(([selector]) => selector).sort()
const AREA_INSET = 'inset: var(--od-x-target-inset)'

const DETAILS = 'Orders/OrderDetails/details-tab.css'
const ACTIVITY = 'Orders/OrderDetails/activity-tab.css'
// redesign deliveries-followups P3: the assignment comment is P/AssignCommentDialog, a P/TextArea (field.css), not a sheet of its own
const HEADER = 'Orders/OrderDetailsHeader/order-details-header.css'
const TRACKING = 'Orders/OrderTrackingLink/tracking-link.css'

describe('W0-3d4: the loose controls of the order detail get the 44px area, not a 44px box', () => {
  it('details-tab.css: Cancel / Save of Edit customer keep the box of their Button (the area is Product\'s .odc-btn::after)', () => {
    const css = read(DETAILS)
    expect(css).not.toMatch(/\.odt-edit-actions\s*>\s*\.odc-btn\s*\{/)
    expect(growing(css)).not.toContain('.odt-edit-actions > .odc-btn')
    // where the area comes from, once, for every .odc-btn
    const area = phoneRules(read('Shared/Product/product.css')).find(([selector]) => selector === '.odc-btn::after')
    expect(area, '.odc-btn::after in the phone @media of product.css').toBeTruthy()
    expect(area[1]).toContain("content: ''")
    expect(area[1]).toContain('position: absolute')
    expect(area[1]).toContain(AREA_INSET)
    // the one row of wide buttons is 8px apart and the field above it 12px: the area does not cross a neighbour
    expect(ruleOf(css, '.odt-edit-actions')[1]).toContain('gap: var(--od-space-2)')
    expect(ruleOf(css, '.odt-edit')[1]).toContain('gap: var(--od-space-3)')
  })

  it('activity-tab.css: the picture thumbnail keeps its size and takes the area as a centered ::after', () => {
    const css = read(ACTIVITY)
    expect(growing(css).join('|')).not.toMatch(/odt-chat-thumb/)
    const rules = phoneRules(css)
    const box = rules.find(([selector]) => selector === '.odt-chat-thumb')
    expect(box, '.odt-chat-thumb in the phone @media').toBeTruthy()
    expect(box[1]).toContain('position: relative')
    const area = rules.find(([selector]) => selector === '.odt-chat-thumb::after')
    expect(area, '.odt-chat-thumb::after in the phone @media').toBeTruthy()
    expect(area[1]).toContain("content: ''")
    expect(area[1]).toContain('position: absolute')
    expect(area[1]).toContain(AREA_INSET)
    // the thumbnail has no pseudo of its own elsewhere (a button can hold one, and none was there)
    expect(css.match(/\.odt-chat-thumb(?::|\s)*::(?:before|after)/g) || []).toHaveLength(1)
  })

  it('activity-tab.css: under a picture the fold gives up its area (2px away, its area would cover the foot of the picture)', () => {
    const rule = phoneRules(read(ACTIVITY)).find(([selector]) => selector === '.odt-chat-thumb + .odc-feed-details .odc-feed-summary::after')
    expect(rule, 'the fold rule in the phone @media').toBeTruthy()
    expect(rule[1]).toContain('content: none')
    // the real markup: the fold follows the picture as a sibling in the chat bubble, and the summary has the area to give up
    expect(raw('Orders/OrderDetails/ChatTab.jsx')).toMatch(/renderPhoto\(item\.source, item\.author\?\.name\)\}\s*\{technical && \(\s*<Fold/)
    expect(phoneRules(read('Shared/Product/timeline.css')).find(([selector]) => selector === '.odc-feed-summary::after')).toBeTruthy()
  })
})

describe('W0-3d4: inputs, stacked rows, tight neighbours and the FirstSelect stay as they were (listed in the delivery, decided by the owner)', () => {
  it('the rules that still grow a box are exactly these', () => {
    expect(growing(read(DETAILS))).toEqual([
      '.odt-edit .od-field', // --od-field-touch-target: an <input> (Google autocomplete)
      '.odt-edit .od-field-input', // <input>, coarse pointer
      '.odt-edit .od-field-input', // <input>, phone
      // redesign tramo A r3 (W0-QA1-01): grouped buttons, neighbours closer than 12px, 44 visible
      '.odt-sec-actions .odc-btn[data-size][data-variant], .odt-party-acts .odc-btn[data-size][data-variant], .odt-addr > .odc-btn[data-size][data-variant], .odt-assign-head .odc-btn[data-size][data-variant]',
      '.odt-party-acts .odc-btn[data-icon-only][data-size][data-variant], .odt-addr > .odc-btn[data-icon-only][data-size][data-variant], .odt-assign-head .odc-btn[data-icon-only][data-size][data-variant]',
      '.odt-party-lines a', // bugs H W0-E-16: tel/mailto links 44px on touch, on stacked lines so no ::after crosses a neighbour
      '.odt-foot .odt-foot-selector .od-first-select-trigger', // the FirstSelect trigger, stacked with Reject / Accept at 8px
      '.odt-foot > .odc-btn' // Reject / Accept: stacked full-width rows 8px apart
    ].sort())
    expect(growing(read(ACTIVITY))).toEqual([
      '.odt-act-photo', // no element carries the class today (overflow: hidden would also clip a pseudo)
      '.odt-chat-chip, .odt-chat-input', // chips wrap at 8px in a scroll container that clips; the message is an <input>
      '.odt-chat-composer .odt-chat-quick-toggle', // 8px from the chips above and from the quick replies below
      '.odt-fld-control' // <input>
    ].sort())
    expect(growing(read(HEADER))).toEqual(['.odc-od-head-actions > .odc-btn[data-size][data-variant]', '.odc-od-link'].sort()) // Print / More actions (r3, W0-QA1-01) and inline link in the metadata line: 4px/6px from its neighbours
    expect(growing(read(TRACKING))).toEqual(['.odc-tracking-input, .odc-tracking-select']) // <input> and a FirstSelect (first-select.css grows it)
  })

  it.each([
    [DETAILS, '(max-width: 767px)', '.odt-foot > .odc-btn', 'min-block-size'],
    [DETAILS, PHONE, '.odt-foot .odt-foot-selector .od-first-select-trigger', 'min-block-size'],
    [DETAILS, PHONE, '.odt-edit .od-field-input', 'min-block-size'],
    [DETAILS, '(pointer: coarse)', '.odt-edit .od-field-input', 'min-block-size'],
    [ACTIVITY, '(pointer: coarse)', '.odt-chat-chip, .odt-chat-input', 'min-block-size'],
    [ACTIVITY, '(max-width: 767px)', '.odt-chat-composer .odt-chat-quick-toggle', 'min-block-size'],
    [ACTIVITY, PHONE, '.odt-fld-control', 'min-block-size'],
    [HEADER, '(pointer: coarse)', '.odc-od-link', 'min-block-size'],
    [TRACKING, PHONE, '.odc-tracking-input, .odc-tracking-select', 'min-block-size']
  ])('%s keeps %s %s %s', (file, query, selector, property) => {
    const rule = rulesOf(mediaBlocks(read(file), query).join('\n')).find(([s]) => s === selector)
    expect(rule, `${selector} { ${property}: ${COARSE} }`).toBeTruthy()
    expect(rule[1]).toMatch(new RegExp(`(?:^|[\\s;])${property}:\\s*var\\(--od-x-target-coarse\\)`))
  })

  it('no file of the five adds an area pseudo but the thumbnail\'s', () => {
    for (const file of [DETAILS, HEADER, TRACKING]) expect(read(file), file).not.toMatch(/--od-x-target-inset/)
    expect(read(ACTIVITY).match(/--od-x-target-inset/g)).toHaveLength(1)
  })
})

// redesign tramo A r3 (W0-QA1-01): rojo antes (28px visibles, areas de 44 cruzadas a 2px), verde despues (44 visibles).
describe('tramo A r3 (W0-QA1-01): the grouped buttons of the order detail are 44px VISIBLE on a phone', () => {
  const find = (css, query, needle) => phoneRulesOf(css, query).filter(([selector]) => selector.includes(needle))

  function phoneRulesOf (css, query) { return rulesOf(mediaBlocks(css, query).join('\n')) }

  it.each([
    ['.odt-party-acts', 'Call / Message of customer, business and driver (2px apart)'],
    ['.odt-sec-actions', 'Review / Edit Customer (8px apart, Edit Customer is 8px above Message)'],
    ['.odt-addr >', 'Open address in maps'],
    ['.odt-assign-head', 'Call driver next to the foot selector']
  ])('details-tab.css: %s takes a 44px block-size in the phone @media (%s)', (needle) => {
    const rules = find(read(DETAILS), PHONE, needle)
    expect(rules.length).toBeGreaterThan(0)
    expect(rules.some(([, body]) => /(?:^|[\s;])block-size:\s*var\(--od-x-target-coarse\)/.test(body))).toBe(true)
  })

  it('the icon-only ones are 44 wide too, and no area pseudo is added (the box is the target)', () => {
    const css = read(DETAILS)
    const wide = find(css, PHONE, '[data-icon-only]')
    expect(wide.length).toBeGreaterThan(0)
    expect(wide.every(([, body]) => /(?:^|[\s;])inline-size:\s*var\(--od-x-target-coarse\)/.test(body))).toBe(true)
    expect(css).not.toMatch(/--od-x-target-inset/)
  })

  it('the attribute selectors outrank .odc-btn[data-icon-only][data-size] of product.css (4 against 3 selectors)', () => {
    const [selector] = find(read(DETAILS), PHONE, '.odt-party-acts .odc-btn[data-icon-only]')[0]
    const parts = selector.split(',')[0]
    expect((parts.match(/\[|\./g) || []).length).toBeGreaterThanOrEqual(5)
  })

  it('order-details-header.css: Print and More actions (2px apart) are 44x44 visible in the phone @media', () => {
    const rule = find(read(HEADER), PHONE, '.odc-od-head-actions > .odc-btn')[0]
    expect(rule).toBeTruthy()
    expect(rule[1]).toMatch(/(?:^|[\s;])block-size:\s*var\(--od-x-target-coarse\)/)
    expect(rule[1]).toMatch(/(?:^|[\s;])inline-size:\s*var\(--od-x-target-coarse\)/)
    expect(read(HEADER)).not.toMatch(/--od-x-target-inset/)
    // the header actions are those two Menu triggers (IconButton), direct children of the actions box
    expect(raw('Orders/OrderDetailsHeader/index.js')).toMatch(/odc-od-head-actions[\s\S]*label=\{t\('PRINT'[\s\S]*label=\{t\('MORE_ACTIONS'/)
  })

  it('the buttons are the Product ones with size sm (data-size) in the contact section', () => {
    const source = raw('Orders/OrderContactInformation/index.js')
    expect(source.match(/size='sm'/g).length).toBeGreaterThanOrEqual(7)
  })
})

describe('W0-3a: amounts and times of the order detail are figures (decision 11a)', () => {
  it('the amount cell of the tax and fee rows is what TaxBillRows and FeeBillRows paint, and the order bill is .odt-bill', () => {
    for (const file of ['Shared/UI/TaxBillRows.jsx', 'Shared/UI/FeeBillRows.jsx']) {
      expect(raw(file), file).toMatch(/<td data-bill-row-slot='amount'>/)
    }
    expect(raw('Orders/OrderBill/index.js')).toMatch(/className=\{isPanel \? 'odt-bill' : undefined\}/)
  })

  it('details-tab.css sets those amounts in mono with tabular figures, by surface (inside .odt-bill only)', () => {
    const rule = ruleOf(read(DETAILS), ".odt-bill table td[data-bill-row-slot='amount']")
    expect(rule, 'the amount rule of the order bill').toBeTruthy()
    expect(rule[1]).toContain('font-family: var(--od-font-mono)')
    expect(rule[1]).toContain('font-variant-ligatures: var(--od-font-mono-ligatures)')
    expect(rule[1]).toContain('font-variant-numeric: tabular-nums')
    expect(rule[1]).toContain('unicode-bidi: isolate')
    // shared rows: no rule outside the surface touches the slot (CartRecovery and the custom-order bill keep their own)
    const unscoped = rulesOf(read(DETAILS)).filter(([selector]) => selector.includes('data-bill-row-slot') && !selector.startsWith('.odt-bill '))
    expect(unscoped).toEqual([])
    // a figure is never the label cell, which is prose
    expect(rulesOf(read(DETAILS)).filter(([selector]) => /data-bill-row-slot='label'/.test(selector))).toEqual([])
  })

  it('OrderRoute draws its time as a figure (mono with tabular digits), and Product defines that class', () => {
    const source = raw('Shared/Product/OrderRoute.jsx')
    expect(source).toContain("<span className='odc-figure'>{step.at}</span>")
    expect(source).not.toContain('odc-mono')
    const figure = ruleOf(read('Shared/Product/product.css'), '.odc-figure')
    expect(figure[1]).toContain('font-variant-numeric: tabular-nums')
  })
})

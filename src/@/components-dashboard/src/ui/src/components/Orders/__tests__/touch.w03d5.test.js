// redesign W0-3d5 (T0-12, decision 12): the phone surface of the Orders dialogs (refund, customer review, clone, status
// regression, CSV export). A loose control is SEEN at its own size (the box does not grow to --od-x-target-coarse) and its 44px
// area is a centered pseudo-element; a Product button (.odc-btn) already has that area from product.css, so its CSS only has to
// stop growing the box. What stays as it was (a field that is an <input>/<textarea> and cannot hold a pseudo-element, a stacked
// row, a control whose neighbour is closer than the area needs) keeps its 44px box here and is listed in the delivery for the
// owner. Same reading as touch.w03d3.test.js.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const COMPONENTS = path.join(__dirname, '..')
const read = file => readFileSync(path.join(COMPONENTS, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

const mediaBlocks = (css, query) => {
  const blocks = []
  const needle = `@media ${query} {`
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
const NARROW_ONLY = '(max-width: 767px)'
const COARSE = 'var(--od-x-target-coarse)'
const AREA_INSET = 'inset: var(--od-x-target-inset)'
const GROWS = /(?:^|[\s;{])(?:min-)?(?:block|inline)-size:\s*var\(--od-x-target-coarse\)/

const rulesOf = (css) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => [selector.trim().replace(/\s+/g, ' '), body.replace(/\s+/g, ' ')])
const ruleOf = (css, selector) => rulesOf(css).find(([s]) => s === selector)
const allMedia = (css) => [PHONE, COARSE_ONLY, NARROW_ONLY].flatMap(query => mediaBlocks(css, query)).join('\n')
const growing = (css) => rulesOf(allMedia(css)).filter(([, body]) => GROWS.test(body)).map(([selector]) => selector)

const FILES = {
  refund: 'OrderBill/refund-dialogs.css',
  review: 'ReviewCustomer/review-customer.css',
  clone: 'CloneOrder/clone-order.css',
  regression: 'OrderStatusRegressionModal/order-status-regression.css',
  exportCsv: 'OrdersExportCSV/orders-export-csv.css'
}

describe('W0-3d5: the loose controls of the dialogs get the 44px area, not a 44px box', () => {
  it('the five marks of the customer review are SEEN at their own height and carry the area (blocks only: they are wider than 44px)', () => {
    const css = read(FILES.review)
    const mark = ruleOf(css, '.odc-review-mark')
    expect(mark[1]).toContain('position: relative')
    expect(mark[1]).toContain('min-block-size: var(--od-x-control-height-lg)')
    expect(growing(css)).not.toContain('.odc-review-mark')
    const area = ruleOf(mediaBlocks(css, PHONE).join('\n'), '.odc-review-mark::after')
    expect(area, '.odc-review-mark::after in the phone @media').toBeTruthy()
    expect(area[1]).toContain("content: ''")
    expect(area[1]).toContain('position: absolute')
    expect(area[1]).toContain(AREA_INSET)
  })

  it('the download link of the export result is SEEN at its own height and carries the area', () => {
    const css = read(FILES.exportCsv)
    const link = ruleOf(css, '.odc-export-download')
    expect(link[1]).toContain('min-block-size: var(--od-x-target-fine)')
    const phone = mediaBlocks(css, PHONE).join('\n')
    expect(ruleOf(phone, '.odc-export-download')[1]).toContain('position: relative')
    const area = ruleOf(phone, '.odc-export-download::after')
    expect(area, '.odc-export-download::after in the phone @media').toBeTruthy()
    expect(area[1]).toContain("content: ''")
    expect(area[1]).toContain('position: absolute')
    expect(area[1]).toContain(AREA_INSET)
    // no coarse-only box is left on the link: the only rule that still grows it is the several-files one below
    expect(rulesOf(mediaBlocks(css, COARSE_ONLY).join('\n')).filter(([selector]) => selector.includes('.odc-export-download'))).toEqual([])
  })

  it('several files stack their links at 8px: then (and only then) the link keeps its 44px box', () => {
    const css = read(FILES.exportCsv)
    const several = rulesOf(mediaBlocks(css, PHONE).join('\n')).find(([selector, body]) => selector.includes(':has(') && selector.endsWith('.odc-export-download') && GROWS.test(body))
    expect(several, 'a :has() rule for two or more download rows').toBeTruthy()
    expect(several[0]).toBe('.odc-export-messages:has(> p:has(.odc-export-download) ~ p:has(.odc-export-download)) .odc-export-download')
  })

  it('the close button of an export dialog keeps its own 32px box (Product gives it the area); no icon-only width is forced', () => {
    const css = read(FILES.exportCsv)
    expect(rulesOf(allMedia(css)).filter(([selector]) => selector.includes('data-icon-only'))).toEqual([])
    // no rule left that grows every button of the dialog, head included
    expect(ruleOf(allMedia(css), '.odc-export-dialog .odc-btn')).toBeUndefined()
  })

  it('a lone footer button (OK of the result and of the error) loses the 44px box; the footers with two keep it', () => {
    const css = read(FILES.exportCsv)
    const narrow = mediaBlocks(css, NARROW_ONLY).join('\n')
    const kept = ruleOf(narrow, '.odc-export-dialog .odc-overlay-foot > .odc-btn:not(:only-child)')
    expect(kept, 'the two-button footers').toBeTruthy()
    expect(kept[1]).toContain(`min-block-size: ${COARSE}`)
    expect(growing(css).filter(selector => selector.includes('.odc-btn'))).toEqual(['.odc-export-dialog .odc-overlay-foot > .odc-btn:not(:only-child)'])
  })
})

describe('W0-3d5: the gap that decides the footers (Product dialog.css, read only)', () => {
  const dialog = read('../Shared/Product/dialog.css')

  it('the buttons of a footer are 8px apart (row gap too), and on a phone their height is auto: 35.6px at one line', () => {
    expect(ruleOf(dialog, '.odc-overlay-foot')[1]).toContain('gap: var(--od-space-2)')
    const phone = ruleOf(mediaBlocks(dialog, NARROW_ONLY).join('\n'), '.odc-overlay-foot > .odc-btn')
    expect(phone[1]).toContain('block-size: auto')
    expect(phone[1]).toContain('padding-block: var(--od-space-2)')
    // 13px * 1.35 + 2 * 8px + 2 * 1px = 35.55px: the 44px area grows 4.2px each side, 8.4px between two stacked buttons
    // against an 8px gap, so two areas would cross by 0.4px. That is why the two-button footers keep their 44px box.
  })
})

describe('W0-3d5: what stays as it was (listed in the delivery, decided by the owner)', () => {
  // [file, query (null: no media), selector, the property that holds the target]
  it.each([
    // <input> and <textarea> cannot hold a pseudo-element
    [FILES.refund, null, '.odc-refund-amount .od-field', '--od-field-touch-target'],
    [FILES.refund, PHONE, '.odc-refund-amount .od-field-input', 'min-block-size'],
    [FILES.review, COARSE_ONLY, '.odc-review-field', 'min-block-size'],
    [FILES.regression, COARSE_ONLY, '.odc-regression-reason', 'min-block-size'],
    // chips wrap at 8px: two rows would cross by 4px
    [FILES.review, COARSE_ONLY, '.odc-review-chip', 'min-block-size'],
    // stacked radio rows at 8px
    [FILES.clone, COARSE_ONLY, '.odc-clone-option', 'min-block-size'],
    // the menu rows of the export menu
    [FILES.exportCsv, NARROW_ONLY, '[data-export-menu] .odc-menu-item', 'min-block-size']
  ])('%s keeps %s %s on %s', (file, query, selector, property) => {
    const css = read(file)
    const rules = query ? rulesOf(mediaBlocks(css, query).join('\n')) : rulesOf(css)
    const rule = rules.find(([s, body]) => s.split(', ').includes(selector) && new RegExp(`(?:^|[\\s;])${property}:\\s*var\\(--od-x-target-coarse\\)`).test(body))
    expect(rule, `${selector} { ${property}: ${COARSE} }`).toBeTruthy()
  })

  it('the rules that still grow a box are exactly these (a new one would be a decision for the owner)', () => {
    expect(Object.fromEntries(Object.entries(FILES).map(([key, file]) => [key, growing(read(file)).sort()]))).toEqual({
      refund: ['.odc-refund-amount .od-field-input'],
      review: ['.odc-review-chip', '.odc-review-field'].sort(),
      clone: ['.odc-clone-option'],
      regression: ['.odc-regression-reason'],
      exportCsv: [
        '.odc-export-dialog .odc-overlay-foot > .odc-btn:not(:only-child)',
        '.odc-export-messages:has(> p:has(.odc-export-download) ~ p:has(.odc-export-download)) .odc-export-download',
        '[data-export-menu] .odc-menu-item'
      ].sort()
    })
  })

  it('no file of the five repeats the area on a control that is an <input>, a <textarea> or a stacked row', () => {
    for (const key of ['refund', 'clone', 'regression']) expect(read(FILES[key]), key).not.toMatch(/::(?:before|after)|--od-x-target-inset/)
    const review = read(FILES.review)
    expect(review.match(/::after/g)).toHaveLength(1)
    const exportCss = read(FILES.exportCsv)
    expect(exportCss.match(/::after/g)).toHaveLength(1)
  })
})

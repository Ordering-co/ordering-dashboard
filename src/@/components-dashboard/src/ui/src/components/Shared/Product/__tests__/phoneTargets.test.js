// redesign fix-qa E8: the 44px targets are a size of the phone layout, not only of a coarse pointer. A phone-width
// viewport driven by a mouse (a narrow desktop window, device emulation without touch) measured 30-32px in the page head,
// the filter pills, the search, the menu rows and the foot's status selector. Each of those rules now answers to
// `(pointer: coarse), (max-width: 767px)`. Measured live at 390x844 in e2e/brand-system-app/orders-pilot-e8.spec.js.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const COMPONENTS = path.join(__dirname, '..', '..', '..')
const read = file => readFileSync(path.join(COMPONENTS, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

// The body of every top-level `@media <query> { ... }` block, with its nested rules.
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

const TOUCH_OR_PHONE = '(pointer: coarse), (max-width: 767px)'
const targetRules = (css) => mediaBlocks(css, TOUCH_OR_PHONE).join('\n')

describe('44px targets on a phone-width viewport', () => {
  it.each([
    ['Shared/Product/menu.css', ['.odc-menu-item']],
    // redesign W0-3d (T0-12, decisión 12): the notice's single button stops growing and takes the Product hit area; the search,
    // the pills and the bar's buttons keep their 44px box (the rows are 8px apart: their areas would cross, owner's call)
    ['Shared/Product/filter-bar.css', ['.odc-search', '.odc-pill', '.odc-filterbar .odc-btn']],
    ['Orders/OrdersContentHeader/content-header.css', ['.odc-page-head .odc-btn', '.odc-header-actions > [data-action] > button:first-of-type', '.odc-page-head .od-ui.od-learn-menu .learn-drop-down']],
    ['Orders/OrderDetails/details-tab.css', ['.odt-foot .odt-foot-selector .od-first-select-trigger']]
  ])('%s reaches --od-x-target-coarse for %j with a coarse pointer or below 768px', (file, selectors) => {
    const rules = targetRules(read(file))
    expect(rules).not.toBe('')
    for (const selector of selectors) expect(rules, selector).toContain(selector)
    expect(rules).toMatch(/min-block-size:\s*var\(--od-x-target-coarse\)/)
  })

  it('icon-only buttons of the page head and the filter bar also get the width', () => {
    for (const file of ['Orders/OrdersContentHeader/content-header.css', 'Shared/Product/filter-bar.css']) {
      expect(targetRules(read(file))).toMatch(/\[data-icon-only\][^{]*\{[^}]*min-inline-size:\s*var\(--od-x-target-coarse\)/)
    }
  })

  // e2e stage close (orders-pilot-e8): F6d (Q3-14) keeps only the mark of the live status when the head is narrow (its
  // text is zero-size), so on a phone the pill was a 28px-wide target, an icon-only button without the icon-only width.
  it('the live status of the page head, reduced to its mark, is 44px wide too', () => {
    expect(targetRules(read('Orders/OrdersContentHeader/content-header.css')))
      .toMatch(/\.odc-page-head \.odc-live-btn\.odc-btn[^{]*\{[^}]*min-inline-size:\s*var\(--od-x-target-coarse\)/)
  })

  it('opened as a page the foot buttons keep their own size (they stretched to 316px) and sit at the end', () => {
    const css = read('Orders/OrderDetails/details-tab.css')
    const wide = mediaBlocks(css, '(min-width: 768px)').join('\n')
    expect(wide).toMatch(/\.odc-od\[data-expanded\] \.odt-foot > \.odc-btn\s*\{[^}]*flex:\s*0 0 auto/)
    expect(wide).toMatch(/\.odc-od\[data-expanded\] \.odt-foot > \.odc-btn:first-of-type\s*\{[^}]*margin-inline-start:\s*auto/)
    expect(wide).toMatch(/\.odc-od\[data-expanded\] \.odt-foot-selector\s*\{[^}]*flex:\s*0 1 var\(--od-x-popover\)/)
  })
})

// redesign fix-qa E10: what E8 left under 44px at 390px with a mouse. The list and detail tabs, the detail's icon buttons and
// «Edit», «Add a metafield», the Filters sheet's fields, pickers and Date triggers, and the order card's link answer to the
// same query now. Desktop (>= 768px, fine pointer) keeps its 32px controls: the base rules below the query do not change.
describe('E10: the rest of the phone layout reaches --od-x-target-coarse', () => {
  const coarse = 'var(--od-x-target-coarse)'

  // redesign W0-3d (T0-12, decisión 12): on a phone a Product button keeps its visible box (32, 28 or 40px; 32×32 icon-only)
  // and reaches 44px with a centred hit area (::after) instead of growing the box
  it('product.css: every Product button reaches 44px with a hit area, the box does not grow', () => {
    const css = read('Shared/Product/product.css')
    expect(mediaBlocks(css, '(pointer: coarse) {'), 'no coarse-only block is left').toEqual([])
    const rules = targetRules(css)
    expect(rules).toMatch(/\.odc-btn::after\s*\{[^}]*position:\s*absolute[^}]*inset:\s*var\(--od-x-target-inset\)/)
    expect(rules).not.toMatch(/(?:min-)?(?:block|inline)-size:\s*var\(--od-x-target-coarse\)/)
    // desktop keeps the 32px control: the base size is still the token, with no target token outside the query
    expect(css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')).not.toContain('--od-x-target-coarse')
  })

  it('tabs.css: list and detail tabs', () => {
    const css = read('Shared/Product/tabs.css')
    expect(mediaBlocks(css, '(pointer: coarse) {')).toEqual([])
    const rules = targetRules(css)
    expect(rules).toMatch(/\.odc-tab,\s*\.odc-tabs-list\[data-size='sm'\] \.odc-tab\s*\{[^}]*block-size:\s*var\(--od-x-target-coarse\)/)
    expect(rules).toMatch(/min-inline-size:\s*var\(--od-x-target-coarse\)/)
  })

  // redesign W0-3d (T0-12, decisión 12): the card's link keeps its line box; its target is the overlay that covers the card
  it('record-card.css: the link of the card keeps its box and its target is the card overlay', () => {
    const css = read('Shared/Product/record-card.css')
    const link = css.match(/\.odc-order-card-link\s*\{([^}]*)\}/)[1]
    expect(link).not.toMatch(/var\(--od-x-target-coarse\)/)
    expect(link).not.toMatch(/margin-block/)
    expect(link).toMatch(/display:\s*inline-flex/)
    expect(css).toMatch(/\.odc-order-card-link::after\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0/)
  })

  it('orders-filter-bar.css: the sheet fields, the pickers and the menu pill', () => {
    const rules = targetRules(read('Orders/OrdersFilterBar/orders-filter-bar.css'))
    // redesign W0-2a (T0-4): the picker rule moved to Product's filter-popover.css
    expect(targetRules(read('Shared/Product/filter-popover.css'))).toMatch(/--odc-picker-row:\s*var\(--od-x-target-coarse\)/)
    expect(rules).toMatch(/\.odc-btn\.odc-orders-menu-pill\s*\{[^}]*min-block-size:\s*var\(--od-x-target-coarse\)/)
    expect(rules).toMatch(/\.odc-ofs-input,\s*\.odc-ofs-field :is\(\.od-first-select-root, \.od-multi-select-root\)\s*\{[^}]*min-block-size:\s*var\(--od-x-target-coarse\)/)
    // the trigger inside the bordered field fills it, so the target the finger sees is the 44px
    expect(rules).toMatch(/:is\(\.od-first-select-trigger, \.od-multi-select-trigger\)\s*\{[^}]*min-block-size:\s*var\(--od-x-target-coarse\)/)
  })

  it('orders-filter-group.css: the one control height of the sheet, and the city picker keeps its flex field', () => {
    const css = read('Orders/OrdersFilterGroup/orders-filter-group.css')
    expect(css).toMatch(/\.odc-ofs-body\s*\{\s*--odc-ofs-control:\s*var\(--od-x-control-height\)/)
    expect(targetRules(css)).toMatch(/\.odc-ofs-body\s*\{\s*--odc-ofs-control:\s*var\(--od-x-target-coarse\)/)
    // city-selector.css turns that root into a block below 481px, and the trigger collapses to its text (19px)
    expect(css).toMatch(/\.odc-ofs-body \.odc-ofs-field \.od-multi-select-root\.od-city-multi-select\s*\{[^}]*display:\s*flex/)
  })

  it.each([
    ['Shared/UI/multi-select.css', '.od-multi-select-trigger', '--od-multi-select-touch-target'],
    ['Shared/UI/first-select.css', '.od-first-select-trigger', '--od-first-select-touch-target']
  ])('%s: the trigger and the options are 44px below 768px, not only with a coarse pointer', (file, trigger, token) => {
    const css = read(file)
    expect(mediaBlocks(css, '(pointer: coarse) {'), 'no coarse-only block is left').toEqual([])
    const rules = targetRules(css)
    expect(rules).toContain(trigger)
    expect(rules).toMatch(new RegExp(`min-height:\\s*var\\(${token}\\)`))
    expect(rules).toMatch(new RegExp(`data-fit='trigger'\\][^{]*\\{[^}]*min-height:\\s*${coarse.replace(/[()]/g, '\\$&')}`))
  })
})

// redesign W0-3b (T0-10, decisión 11b): the sidebar row is the published 28px (--od-sidebar-item-height); the 32px candidate
// --od-x-nav-row is retired. jsdom lays nothing out, so this reads the CSS (as Shared/Product/__tests__/phoneTargets.test.js
// does) and does the arithmetic of the 1440px layout from the token values. The rule that lives in a browser (measured height,
// ring visibility, footer reach) is e2e/brand-system/shell-navigation.spec.js.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.join(__dirname, ...Array(10).fill('..'))
const strip = css => css.replace(/\/\*[\s\S]*?\*\//g, '')
const read = file => strip(readFileSync(path.join(ROOT, file), 'utf8'))
const sidebar = read('src/@/components-dashboard/src/ui/src/components/Shared/SideBar/sidebar.css')
const candidates = read('src/brand/candidates.css')
const published = read('src/brand/ordering.tokens.generated.css')

const px = (css, name) => {
  const match = css.match(new RegExp(`${name}:\\s*([\\d.]+)(px|rem)`))
  expect(match, name).not.toBeNull()
  return match[2] === 'rem' ? parseFloat(match[1]) * 16 : parseFloat(match[1])
}
const rule = (css, selector) => {
  const escaped = selector.replace(/[.[\]()*+?^$|]/g, '\\$&')
  const match = css.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm'))
  expect(match, selector).not.toBeNull()
  return match[1]
}
// The body of every top-level `@media <query> { ... }` block.
const mediaBlocks = (css, query) => {
  const blocks = []
  let from = css.indexOf(`@media ${query}`)
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
    from = css.indexOf(`@media ${query}`, index)
  }
  return blocks
}

describe('W0-3b: the sidebar row is the published 28px', () => {
  const row = px(published, '--od-sidebar-item-height')

  // The declaration in src/brand/candidates.css is removed by the coordinator (fragment in the delivery); once it is gone,
  // nothing in src may name the token either.
  it('the token is published at 28px and nothing in the sidebar names the 32px candidate', () => {
    expect(row).toBe(28)
    expect(sidebar).not.toContain('--od-x-nav-row')
  })

  // (DTD-58): the token is the FLOOR of a text row, not its fixed height, so a label that wraps to two lines
  // (Greek, German) makes the row taller instead of being cut with an ellipsis. The rail button holds an icon only: fixed.
  it('the row takes its minimum block size and the rail button its block size from the token', () => {
    expect(rule(sidebar, '.odc-nav-item')).toMatch(/(?:^|[\s;])min-block-size:\s*var\(--od-sidebar-item-height\)/)
    expect(rule(sidebar, '.odc-sidebar[data-rail] .odc-nav-rail-btn')).toMatch(/(?:^|[\s;])block-size:\s*var\(--od-sidebar-item-height\)/)
  })

  it('13px text on its 1.35 leading and the 16px icon fit inside the row, with the 2px inset ring on the box', () => {
    const type = px(candidates, '--od-x-type-ui-size')
    const line = type * parseFloat(candidates.match(/--od-x-leading-ui:\s*([\d.]+)/)[1])
    const icon = px(published, '--od-icon-size')
    expect(type).toBe(13)
    expect(icon).toBe(16)
    expect(line).toBeLessThanOrEqual(row)
    expect(icon).toBeLessThanOrEqual(row)
    // the row has no block padding and the text is a flex item with no block size of its own, so its line box (17.55px)
    // is centred in the 28px: `overflow: hidden` on it clips the inline end (the ellipsis), never a descender
    expect(rule(sidebar, '.odc-nav-item')).toMatch(/padding-block:\s*0/)
    expect(rule(sidebar, '.odc-nav-text')).not.toMatch(/block-size|height/)
    // the ring is drawn inside the box (negative offset = the ring width), so the row's own height shows all of it
    expect(candidates).toMatch(/--od-x-focus-inset:\s*calc\(var\(--od-focus-ring-width\) \* -1\)/)
    expect(sidebar).toMatch(/\.odc-nav-item:focus-visible[^{]*\{[^}]*outline-offset:\s*var\(--od-x-focus-inset\)/)
    expect(px(published, '--od-focus-ring-width') * 2).toBeLessThan(row)
  })

  it('the footer takes its own room and the navigation scrolls in what is left', () => {
    expect(rule(sidebar, '.odc-sidebar-foot')).toMatch(/flex:\s*none/)
    const scroll = rule(sidebar, '.odc-nav-scroll')
    expect(scroll).toMatch(/flex:\s*1/)
    expect(scroll).toMatch(/min-block-size:\s*0/)
    expect(scroll).toMatch(/overflow-y:\s*auto/)
  })
})

describe('DTD-58: a long label wraps to two lines, the menu keeps its width', () => {
  it('no text row (top level or sub-row) has a fixed block size any more: they grow, never shrink below the token', () => {
    expect(rule(sidebar, '.odc-nav-item')).not.toMatch(/(?:^|[\s;])block-size:/)
    const sub = rule(sidebar, '.odc-nav-sub .odc-nav-item')
    expect(sub).not.toMatch(/(?:^|[\s;])block-size:/)
    // a sub-row inherits the floor from `.odc-nav-item`; it must not lower it
    expect(sub).not.toMatch(/min-block-size:\s*(?!var\(--od-sidebar-item-height\))/)
  })

  it('the label of a row wraps and stops at two lines (with an ellipsis only after the second)', () => {
    const text = rule(sidebar, '.odc-nav-item .odc-nav-text')
    expect(text).toMatch(/white-space:\s*normal/)
    expect(text).toMatch(/-webkit-line-clamp:\s*2/)
    expect(text).toMatch(/overflow:\s*hidden/)
    expect(text).toMatch(/overflow-wrap:\s*anywhere/)
  })

  it('wrapping does not change the width of the menu or of the row', () => {
    expect(rule(sidebar, '.odc-nav-item')).toMatch(/inline-size:\s*100%/)
    const text = rule(sidebar, '.odc-nav-item .odc-nav-text')
    expect(text).not.toMatch(/inline-size|width/)
    // the shared label rule keeps flex: 1 and min-inline-size: 0 so the label shares the row with the chevron and badge
    expect(rule(sidebar, '.odc-nav-text')).toMatch(/min-inline-size:\s*0/)
  })

  it('two lines of 13px on their 1.35 leading fit inside the 44px coarse row', () => {
    const line = px(candidates, '--od-x-type-ui-size') * parseFloat(candidates.match(/--od-x-leading-ui:\s*([\d.]+)/)[1])
    expect(line * 2).toBeLessThanOrEqual(px(published, '--od-touch-target-minimum'))
  })
})

// AC-F L1 (locales audit § 2b, bg at 1440): «Одит на регистрационни файлове» (LOGS_AUDIT) was cut with an ellipsis on the group
// trigger. The group does not lose to another rule: it is an `.odc-nav-item` too and gets the same two-line label as a child. It
// is the chevron that makes the difference: the trigger's label is 156px wide against 173px in a child row, and that text needs 167px
// per line (Inter 13px semibold) to fit in two lines, so it takes three. Two lines stay the limit where the row has a fixed block size
// (44px on a coarse pointer or under 768px: three lines of 17.55px do not fit it); on a mouse from 768px the row is only a floor.
describe('AC-F L1: a long group or child label takes a third line before any ellipsis, on the expanded desktop menu', () => {
  const desktop = mediaBlocks(sidebar, '(pointer: fine) and (min-width: 768px)').join('\n')
  const phone = mediaBlocks(sidebar, '(pointer: coarse), (max-width: 767px)').join('\n')

  it('group trigger and child rows share the one label rule: nothing but the search keeps the one-line ellipsis', () => {
    // every rule that names the label, outside the rail's `display: none` list and the media blocks
    const outside = sidebar.replace(/@media[^{]*\{[\s\S]*?\n\}/g, '')
    const selectors = [...outside.matchAll(/(?:^|\})\s*([^{}]*\.odc-nav-text[^{}]*)\{/g)]
      .map(match => match[1].trim())
      .filter(selector => !selector.includes('data-rail'))
    expect(selectors).toEqual(['.odc-nav-search .odc-nav-text', '.odc-nav-text', '.odc-nav-item .odc-nav-text'])
  })

  it('from 768px with a fine pointer the label stops at three lines, with no ellipsis before the third', () => {
    expect(desktop).not.toBe('')
    const text = rule(desktop, '.odc-nav-item .odc-nav-text')
    expect(text).toMatch(/-webkit-line-clamp:\s*3/)
    expect(text).toMatch(/(?:^|[\s;])line-clamp:\s*3/)
    expect(text).not.toMatch(/inline-size|width|block-size|height/)
  })

  it('where the row is a fixed 44px (coarse pointer, under 768px) the label keeps its two lines', () => {
    expect(rule(sidebar, '.odc-nav-item .odc-nav-text')).toMatch(/-webkit-line-clamp:\s*2/)
    expect(phone).toMatch(/\.odc-nav-item,\s*\.odc-nav-sub \.odc-nav-item,\s*\.odc-nav-rail-btn\s*\{\s*block-size:\s*var\(--od-x-target-coarse\)/)
    expect(phone).not.toMatch(/line-clamp:\s*3/)
    const line = px(candidates, '--od-x-type-ui-size') * parseFloat(candidates.match(/--od-x-leading-ui:\s*([\d.]+)/)[1])
    expect(line * 2).toBeLessThanOrEqual(px(published, '--od-touch-target-minimum'))
    expect(line * 3).toBeGreaterThan(px(published, '--od-touch-target-minimum'))
  })

  it('the rail (56px) and the row floor do not change', () => {
    expect(sidebar).toMatch(/\.odc-sidebar\[data-rail\] \.odc-nav-text,[^{]*\{[^}]*display:\s*none/)
    expect(rule(sidebar, '.odc-nav-item')).toMatch(/min-block-size:\s*var\(--od-sidebar-item-height\)/)
    expect(desktop).not.toMatch(/data-rail|min-block-size|--od-x-rail/)
  })
})

describe('W0-3d: the phone', () => {
  const phone = mediaBlocks(sidebar, '(pointer: coarse), (max-width: 767px)').join('\n')

  it('stacked rows and the other listed controls keep growing the box to 44px (the owner decides their reflow)', () => {
    expect(phone).toMatch(/\.odc-nav-item,\s*\.odc-nav-sub \.odc-nav-item,\s*\.odc-nav-rail-btn\s*\{\s*block-size:\s*var\(--od-x-target-coarse\)/)
    expect(phone).toMatch(/\.odc-nav-search\s*\{\s*block-size:\s*var\(--od-x-target-coarse\)/)
    expect(phone).toMatch(/\.odc-account-item,\s*\.odc-account-trigger\s*\{\s*min-block-size:\s*var\(--od-x-target-coarse\)/)
  })

  // (W0-E-15): `.odc-sidebar[data-rail] .odc-nav-rail-btn` (28px, three class-level selectors) outranks the plain
  // `.odc-nav-rail-btn` of the rule above, so on a coarse pointer with the rail the buttons stayed at 28px. The coarse block
  // repeats the 44px for that selector, after the base rule so that equal specificity cannot undo it.
  it('the rail buttons reach 44px on a coarse pointer despite the 28px rail rule', () => {
    const selector = '.odc-sidebar[data-rail] .odc-nav-rail-btn'
    expect(phone).toMatch(/\.odc-sidebar\[data-rail\] \.odc-nav-rail-btn\s*\{\s*block-size:\s*var\(--od-x-target-coarse\)/)
    expect(rule(sidebar, selector)).toMatch(/block-size:\s*var\(--od-sidebar-item-height\)/)
    expect(sidebar.lastIndexOf(`${selector} {`)).toBeGreaterThan(sidebar.indexOf(`${selector} {`))
    expect(sidebar.lastIndexOf(`${selector} {`)).toBeGreaterThan(sidebar.indexOf('@media (pointer: coarse), (max-width: 767px)'))
  })

  it('the skip link keeps its 32px box on a phone and reaches 44px with a centred pseudo-element', () => {
    expect(phone).not.toMatch(/\.odc-skip-link:focus\s*\{/)
    expect(rule(sidebar, '.odc-skip-link:focus')).toMatch(/min-block-size:\s*var\(--od-x-control-height\)/)
    const after = phone.match(/\.odc-skip-link:focus::after\s*\{([^}]*)\}/)[1]
    expect(after).toMatch(/position:\s*absolute/)
    expect(after).toMatch(/inset:\s*var\(--od-x-target-inset\)/)
    expect(after).not.toMatch(/inset-(block|inline)/)
  })
})

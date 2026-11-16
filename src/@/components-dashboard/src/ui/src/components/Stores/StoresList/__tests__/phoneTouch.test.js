// redesign SL-(phone fixes from the phase 3 mechanical review): what only a browser measures (the page's horizontal scroll in a
// long locale, the 44px reach by elementFromPoint) was checked live; these tests pin the CSS that made it true, so a later edit
// cannot undo it unseen. They read the source, like phoneTargets.test.js in Shared/Product.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const STORES = path.join(__dirname, '..', '..')
const read = file => readFileSync(path.join(STORES, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

// The body of the first top-level `@media <query> { ... }` block, with its nested rules.
const mediaBlock = (css, query) => {
  const from = css.indexOf(`@media ${query}`)
  if (from === -1) return ''
  const open = css.indexOf('{', from)
  let depth = 1
  let index = open + 1
  while (depth > 0 && index < css.length) {
    if (css[index] === '{') depth += 1
    else if (css[index] === '}') depth -= 1
    index += 1
  }
  return css.slice(open + 1, index - 1)
}

// The declarations of every top-level rule whose selector is exactly `selector`, joined.
const rule = (css, selector) => {
  const pattern = new RegExp(`(?<=^|\\})\\s*${selector.replace(/[.[\]()]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'g')
  return [...css.matchAll(pattern)].map(match => match[1]).join('\n')
}

describe('view switch (stores-list.css)', () => {
  const css = read('StoresList/stores-list.css')

  it('clips the hidden twin of the segmented control, which in a long locale was wider than the page (pt: 92px of scroll)', () => {
    const body = rule(css, '.odc-sl-viewswitch')
    expect(body).toMatch(/overflow:\s*clip/)
    expect(body).not.toMatch(/overflow:\s*(hidden|auto|scroll)/) // no scroll container to scroll into
    // the focus ring of the buttons and of the select stays inside the clip: padding, and the margin that gives it back
    expect(body).toMatch(/padding:\s*var\(--od-x-space-1-5\)/)
    expect(body).toMatch(/margin:\s*calc\(var\(--od-x-space-1-5\)\s*\*\s*-1\)/)
    expect(body).toMatch(/min-inline-size:\s*0/)
  })

  // redesign deliveries-followups W1-D-25: live at 390, the types row (padding + negative margin) answered the two bottom
  // corners of each option's 44px area (elementFromPoint: DIV.odc-sl-types) until the switch was raised above it
  it('is raised over the padding of the types row, so the 44px area of its options holds at the bottom', () => {
    const body = rule(css, '.odc-sl-viewswitch')
    expect(body).toMatch(/position:\s*relative/)
    expect(body).toMatch(/z-index:\s*var\(--od-x-layer-raised\)/)
  })

  it('on a phone takes the room that is left (and the whole row when it wraps) instead of a fixed box', () => {
    expect(mediaBlock(css, '(max-width: 767px)')).toMatch(/\.odc-sl-viewswitch\s*\{[^}]*flex-grow:\s*1/)
  })
})

describe('44px reach under 768px (stores-table.css)', () => {
  const css = read('StoresList/stores-table.css')

  it('gives the card checkbox and the «Select all» row the house area as a pseudo-element, never smaller than the control', () => {
    const body = mediaBlock(css, '(max-width: 767px)')
    expect(body).toContain('.odc-sl-card-actions .odc-checkbox::after')
    expect(body).toContain('.odc-sl-tools[data-cards] .odc-checkbox::after')
    expect(body).toMatch(/position:\s*absolute/)
    expect(body).toMatch(/inset:\s*var\(--od-x-target-inset\)/)
  })

  it('keeps the «Select all» area off the filters above and the first card under it (8px, more than the 6px it adds)', () => {
    expect(rule(css, '.odc-sl-tools[data-cards]')).toMatch(/padding-block:\s*var\(--od-space-2\)/)
  })
})

describe('store editor header (store-editor.css)', () => {
  const css = read('BusinessDetails/store-editor.css')

  it('puts the 32px header buttons 12px apart under 768px so the 44px areas of «More actions» and Close do not cross', () => {
    expect(mediaBlock(css, '(pointer: coarse), (max-width: 767px)')).toMatch(/\.odc-se-actions\s*\{[^}]*gap:\s*var\(--od-space-3\)/)
  })
})

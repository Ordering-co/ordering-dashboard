// redesign F6g-1 (locales matrix, wave 6): the reject dialog at 390px in Bulgarian pushed «Отхвърляне на поръчката» 7px out of
// the viewport and the close X 20px outside it. jsdom measures nothing, so the geometry is pinned in the stylesheet (rects
// measured live at 320 and 390 in en and bg are in the delivery notes): the dialog column may shrink, the footer wraps and a
// button never keeps the width of its label.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.join(__dirname, '..', 'dialog.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

const block = (source, selector, from = 0) => {
  const start = source.indexOf(`${selector} {`, from)
  if (start === -1) return ''
  return source.slice(source.indexOf('{', start) + 1, source.indexOf('}', start))
}
const phone = () => css.slice(css.indexOf('@media (max-width: 767px)'), css.indexOf('@media (prefers-reduced-motion'))

describe('Dialog on a narrow viewport (F6g-1)', () => {
  it('the dialog column can shrink below its content, so the header (and the close X) stays inside', () => {
    expect(block(css, '.odc-dialog')).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/)
  })

  it('the footer wraps instead of clipping', () => {
    expect(block(css, '.odc-overlay-foot')).toMatch(/flex-wrap:\s*wrap/)
  })

  it('under 768px a footer button fills its row, never overflows it and wraps a long label', () => {
    const rule = block(phone(), '.odc-overlay-foot > .odc-btn')
    expect(rule).toMatch(/flex:\s*1 1 auto/)
    expect(rule).toMatch(/max-inline-size:\s*100%/)
    expect(rule).toMatch(/min-inline-size:\s*0/)
    expect(rule).toMatch(/white-space:\s*normal/)
    // a wrapped label grows the button instead of spilling out of it (44px stays the floor)
    expect(rule).toMatch(/block-size:\s*auto/)
  })

  it('keeps the page gutter on the dialog where it floats (>= 768px) and uses no physical properties', () => {
    expect(block(css, '.odc-dialog')).toMatch(/max-inline-size:\s*calc\(100vw - 2 \* var\(--od-x-viewport-gap\)\)/)
    expect(css).not.toMatch(/(^|[\s;{])(margin|padding|border)-(left|right)\b/)
  })
})

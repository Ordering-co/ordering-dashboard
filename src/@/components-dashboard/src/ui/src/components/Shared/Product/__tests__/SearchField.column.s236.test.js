// AB-S03 (from , /marketing/ad-banners): `.odc-search` is `flex: 0 1 var(--od-x-search)`, a WIDTH for a row. Put in a
// column (flex-direction: column) the same basis is the main size, so the field was 280px TALL. Layout is not computed in jsdom, so the test
// reads the CSS (as touch.w07fix.test.js does): the field's height is also its ceiling, which clamps that basis in a column and changes
// nothing in a row (there the height is the cross size and block-size already fixes it).
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.join(__dirname, '..', 'filter-bar.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rule = (selector) => {
  const start = css.indexOf(`\n${selector} {`)
  return start === -1 ? '' : css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
}
const declaration = (body, property) => body.match(new RegExp(`(?:^|[\\s;])${property}:\\s*([^;]+);`))?.[1].trim()

describe('SearchField in a column (AB-S03)', () => {
  const search = rule('.odc-search')

  it('keeps its width basis for a row', () => {
    expect(declaration(search, 'flex')).toBe('0 1 var(--od-x-search)')
  })

  it('caps its height at the one it declares, so the basis cannot become a height', () => {
    const height = declaration(search, 'block-size')
    expect(height).toBe('var(--od-x-control-height)')
    expect(declaration(search, 'max-block-size')).toBe(height)
  })

  it('the 44px target on a phone still wins over that cap (min-block-size beats max-block-size)', () => {
    const touch = css.slice(css.indexOf('@media (pointer: coarse), (max-width: 767px)'))
    expect(touch).toMatch(/\.odc-search,[\s\S]*?\{\s*min-block-size:\s*var\(--od-x-target-coarse\)/)
  })
})

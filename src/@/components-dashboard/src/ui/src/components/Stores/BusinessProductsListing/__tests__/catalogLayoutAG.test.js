import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// redesign tanda AG (A3-4 and rubric-3 § 6). jsdom lays nothing out, so these read the rules the live probe measured:
// (a) on a phone the Enable switch of a category row keeps 12px from its ⋯ (at 4px their 44px areas crossed: 13 crossings at 390);
// (c) on a desktop the region of the products table ends one page gutter (24px) from the edge, like the page head above it.
const read = path => readFileSync(resolve(__dirname, path), 'utf8')
const block = (css, media) => {
  const start = css.indexOf(media)
  expect(start, media).toBeGreaterThan(-1)
  let depth = 0
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++
    if (css[i] === '}' && --depth === 0) return css.slice(start, i + 1)
  }
  return ''
}

describe('tanda AG · /stores/products layout', () => {
  it('(a) separates the Enable switch of a category row from its ⋯ on a phone', () => {
    const touch = block(read('../../CatalogCategories/catalog-categories.css'), '@media (pointer: coarse), (max-width: 767px)')
    expect(touch).toMatch(/\.odc-cc-row \.odc-switch\s*\{[^}]*margin-inline-end:\s*calc\(var\(--od-space-3\) - var\(--od-space-1\)\)/)
  })

  it('(c) ends the region of the products table one page gutter from the edge on a desktop', () => {
    const wide = block(read('../catalog.css'), '@media (min-width: 768px) {\n  .odc-cat-list')
    expect(wide).toMatch(/\.odc-cat-list \.odc-cp-frame\s*\{[^}]*margin-inline-end:\s*var\(--odc-cat-gutter\)/)
  })
})

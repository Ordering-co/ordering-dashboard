// (review of the frontend security batch): the drag image of a product, category, extra, option, suboption
// or promotion was built with `ghost.innerHTML = <name>`, and those names are typed by other users (a store manager).
// A name like `<img src=x onerror=…>` ran when an admin dragged the row. The ghost takes the name as text.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const CONTROLLERS = [
  'SingleBusinessProduct',
  'SingleBusinessCategory',
  'ProductExtras',
  'ProductExtraOptions',
  'ProductExtraOptionDetails',
  'EnterprisePromotionList'
]

describe('drag ghosts paint the name as text', () => {
  it.each(CONTROLLERS)('%s', (name) => {
    const source = readFileSync(resolve(__dirname, '..', name, 'index.js'), 'utf8')
    expect(source).toMatch(/ghost\w*\.textContent = /)
    expect(source).not.toMatch(/\.innerHTML\s*=/)
  })
})

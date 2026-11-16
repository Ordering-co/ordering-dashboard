// (W1-D-7): in the driver panel «Compact rows» and «Manage columns» sit in .odc-orders-tools-row, outside the filter bar, so
// they are 32px visible with a 44×44 area each (product.css). With the base 4px gap their areas crossed by 8px at 390. On a phone the
// gap is 12px: 32 + 12 = 44, so the areas touch without crossing. With a mouse the gap stays 4px.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.join(__dirname, '..', 'orders-table.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

const blocks = (query) => {
  const found = []
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
    found.push(css.slice(open + 1, index - 1))
    from = css.indexOf(needle, index)
  }
  return found
}

const rulesOf = text => [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => [selector.trim().replace(/\s+/g, ' '), body.replace(/\s+/g, ' ')])

describe('W1-D-7: the tools of the driver panel do not cross their touch areas', () => {
  it('on a phone the gap of the tools row is --od-space-3 (32 + 12 = 44)', () => {
    const rule = rulesOf(blocks('(pointer: coarse), (max-width: 767px)').join('\n')).find(([s]) => s === '.odc-orders-tools-row .odc-orders-tools')
    expect(rule, 'tools row in the phone @media').toBeTruthy()
    expect(rule[1]).toContain('gap: var(--od-space-3)')
  })

  it('with a mouse the gap stays --od-space-1', () => {
    const base = rulesOf(css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')).find(([s]) => s === '.odc-orders-tools')
    expect(base[1]).toContain('gap: var(--od-space-1)')
  })
})

// W0-E-16 (decision 12): the tel: / mailto: links in the party lines (customer, business) were 17px high. On a phone or a coarse
// pointer they reach 44px. The party lines are styled in OrderDetails/details-tab.css (imported by OrderContactInformation/index.js),
// inside the existing `(pointer: coarse), (max-width: 767px)` block.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.join(__dirname, '..', '..', 'OrderDetails', 'details-tab.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

// every `@media <query> { ... }` block with that exact query
const mediaBlocks = (source, query) => {
  const blocks = []
  let from = 0
  for (;;) {
    const start = source.indexOf(`@media ${query}`, from)
    if (start < 0) return blocks
    const open = source.indexOf('{', start)
    let depth = 1
    let index = open + 1
    while (depth > 0 && index < source.length) {
      if (source[index] === '{') depth += 1
      if (source[index] === '}') depth -= 1
      index += 1
    }
    blocks.push(source.slice(open + 1, index - 1))
    from = index
  }
}

describe('W0-E-16 contact links in the party lines', () => {
  it('index.js still draws the links inside .odt-party-lines and imports details-tab.css', () => {
    const source = readFileSync(path.join(__dirname, '..', '..', 'OrderContactInformation', 'index.js'), 'utf8')
    expect(source).toMatch(/odt-party-lines/)
    expect(source).toMatch(/href=\{`tel:/)
    expect(source).toMatch(/href=\{`mailto:/)
    expect(source).toMatch(/OrderDetails\/details-tab\.css/)
  })

  it('gives the links 44px, centered, on a phone or a coarse pointer', () => {
    const phone = mediaBlocks(css, '(pointer: coarse), (max-width: 767px)').join('\n')
    const rule = phone.match(/\.odt-party-lines a\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toMatch(/display:\s*inline-flex/)
    expect(rule).toMatch(/align-items:\s*center/)
    expect(rule).toMatch(/min-block-size:\s*var\(--od-x-target-coarse\)/)
  })
})

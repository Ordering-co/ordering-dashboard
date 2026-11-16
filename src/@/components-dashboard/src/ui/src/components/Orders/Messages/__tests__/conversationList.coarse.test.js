// redesign deliveries-followups review r1 R-1 (W1-D-25): with a coarse pointer the «Show» options of the inbox are 32 drawn
// with a 44px area (6px past each side), and so is the «Sort by» button under them. Wrapped at 8px they were 10px apart and their
// areas crossed by 2px (live at 1440, 1024 and 820 with touch); like the phone, the row gap is 16px with a coarse pointer.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.join(__dirname, '..', 'conversation-list.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

const block = (query) => {
  const from = css.indexOf(`@media ${query} {`)
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

describe('R-1 · the inbox controls with a coarse pointer', () => {
  it('wrap 16px apart, so the 44px areas of the scope and the sort do not cross', () => {
    expect(block('(pointer: coarse)')).toMatch(/\.odc-conv-controls\s*\{[^}]*row-gap:\s*var\(--od-space-4\)/)
  })

  it('the phone keeps its own 16px', () => {
    expect(block('(max-width: 767px)')).toMatch(/\.odc-conv-controls\s*\{[^}]*row-gap:\s*var\(--od-space-4\)/)
  })
})

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// redesign (OP-20, from ). jsdom has no layout, so these read the CSS; the measures were taken in a browser.
// P/SaveBar is sticky with `inset-block-end: 0`, and a sticky box stops at the padding of the scroller it lives in. The store editor
// has no RecordPanel: its scrollers are `.odc-se-content` (below 1000px) and the styled `InfoConatiner` (from 1000px). Each one
// publishes the offset its padding needs as `--odc-bar-end`, and ONE rule in store-editor.css hands it to every bar under the editor.
const read = (...parts) => readFileSync(path.resolve(__dirname, ...parts), 'utf8')
const EDITOR_CSS = read('../store-editor.css').replace(/\/\*[\s\S]*?\*\//g, '')
const INFO_STYLES = read('../../BusinessDetail/styles.js')

const squash = text => text.replace(/\s+/g, ' ')
// Body of the first rule whose selector (whitespace squashed) is exactly `selector`; `scope` limits the search to one text.
const ruleBody = (css, selector) => {
  const found = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(([, sel]) => squash(sel).trim() === selector)
  return found ? squash(found[2]) : ''
}
// The text of the first `@media (query) { ... }` block (one level of nesting).
const mediaBlock = (css, query) => {
  const at = css.indexOf(`@media ${query}`)
  if (at < 0) return ''
  let depth = 0
  for (let index = css.indexOf('{', at); index < css.length; index++) {
    if (css[index] === '{') depth++
    if (css[index] === '}' && --depth === 0) return css.slice(css.indexOf('{', at) + 1, index)
  }
  return ''
}

describe('store editor — the sticky save bar reaches the foot of its scroller (OP-20)', () => {
  it('one rule under the editor gives the bar the offset its scroller publishes, above the per-form `inset-block-end: 0` rules', () => {
    // `.odc-se-main .odc-se-content .odc-savebar` outweighs the `.odc-xx-form > .odc-xx-savebar` rules of the forms (two classes)
    expect(ruleBody(EDITOR_CSS, '.odc-se-main .odc-se-content .odc-savebar')).toMatch(/inset-block-end:\s*var\(--odc-bar-end,\s*0\)/)
  })

  it('.odc-se-content exposes its padding and the offset that gives it back, below 1000px where it pads itself', () => {
    const narrow = mediaBlock(EDITOR_CSS, '(max-width: 999px)')
    const content = ruleBody(narrow, ".odc-se-main[data-view='section'] > .odc-se-content")
    expect(content).toMatch(/--odc-se-pad:\s*var\(--od-space-4\)/)
    expect(content).toMatch(/padding:\s*var\(--odc-se-pad\)/)
    expect(content).toMatch(/--odc-bar-end:\s*calc\(var\(--odc-se-pad\) \* -1\)/)
  })

  // J2 RV-4 (shared-pieces-fixes): at 390 Store details left a 16 px strip under its bar. Its scroller is the inner InfoConatiner, so
  // the bottom padding of .odc-se-content stayed below the bar; with Store details (its frame) inside, the editor drops it.
  it('below 1000px the editor drops its bottom padding around Store details, whose own box scrolls (no strip under the bar)', () => {
    const narrow = mediaBlock(EDITOR_CSS, '(max-width: 999px)')
    expect(ruleBody(narrow, ".odc-se-main[data-view='section'] > .odc-se-content:has(> .odc-sd-frame)")).toMatch(/padding-block-end:\s*0\b/)
    expect(read('../../BusinessDetail/index.js')).toMatch(/<Container className='odc-sd-frame'>/)
  })

  it('a split detail that scrolls by itself has no padding to give back, so it resets the offset for its own bars', () => {
    expect(ruleBody(EDITOR_CSS, ".odc-se-content .odc-section-split[data-view='split'] > .odc-section-split-detail")).toMatch(/--odc-bar-end:\s*0\b/)
  })

  it('the styled InfoConatiner (the scroller from 1000px) gives back the padding it adds, and resets the offset below it', () => {
    const container = INFO_STYLES.match(/export const InfoConatiner = styled\.div`([\s\S]*?)`/)[1]
    const wide = container.match(/@media \(min-width: 1000px\) \{([\s\S]*?)\n\s{2}\}/)[1]
    // below 1000px it has no padding of its own: the editor's offset must not reach the bars inside it (it would push them out of the box)
    expect(squash(container)).toMatch(/--odc-bar-end:\s*0;/)
    expect(squash(wide)).toMatch(/--odc-info-pad:\s*20px/)
    expect(squash(wide)).toMatch(/padding:\s*var\(--odc-info-pad\)/)
    expect(squash(wide)).toMatch(/--odc-bar-end:\s*calc\(var\(--odc-info-pad\) \* -1\)/)
  })
})

// redesign F6h-3 (A2-05): the ⌘K palette is outside the pilot but reachable from it, and axe found 17 nodes under AA
// (2.49–3.75:1): the subtitles, the group headings, the footer, the Kbd and the context chip drew the legacy theme greys
// (#909BA9, #748194) over white, over the selection and over the Kbd fill. Every text colour of the palette is an --od-* role now;
// this test reads the real token values and the real surfaces and measures each pair (AA text = 4.5:1) in light.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (...parts) => readFileSync(path.resolve(__dirname, ...parts), 'utf8')
const styles = read('..', 'styles.js')
const candidates = read('../../../../../../../../brand/candidates.css')
const generated = read('../../../../../../../../brand/ordering.tokens.generated.css')
const theme = JSON.parse(read('../../../../../../../../theme.json'))

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map(channel => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
const expand = (hex) => hex.length === 4 ? `#${[...hex.slice(1)].map(c => c + c).join('')}` : hex
// the light value is the first declaration of the token in the file (the dark overrides come after it)
const token = (css, name) => {
  const match = css.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{3,6})`))
  if (!match) throw new Error(`${name} not found`)
  return expand(match[1])
}

const surfaces = {
  page: expand(theme.colors.backgroundPage),
  selection: expand(theme.colors.lightPrimary),
  kbdFill: expand(theme.colors.secundary)
}

describe('F6h-3 · the command palette reaches AA in light', () => {
  it('no text colour of the palette is a legacy theme grey', () => {
    expect(styles).not.toMatch(/colors\.lightGray/)
    expect(styles).not.toMatch(/colors\.secundaryContrast/)
  })

  it('the subtle text role reads on the page, on the selected row and on the Kbd fill at 4.5:1 or more', () => {
    const subtle = token(candidates, '--od-x-text-subtle')
    expect(styles).toMatch(/var\(--od-x-text-subtle\)/)
    for (const [name, surface] of Object.entries(surfaces)) {
      expect(contrast(subtle, surface), `${subtle} on ${name} ${surface}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('the context chip text is the action content role on the selection tint at 4.5:1 or more', () => {
    const action = token(generated, '--od-action-content')
    expect(styles).toMatch(/var\(--od-action-content\)/)
    expect(contrast(action, surfaces.selection)).toBeGreaterThanOrEqual(4.5)
  })
})

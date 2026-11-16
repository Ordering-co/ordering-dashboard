// redesign SC-B5: schools-page.css is governed like the Product files: tokens only (no literal color, size, weight, duration, z-index), and
// every token it reads exists in the brand files.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { scanSource } from '../../../../../../../../../../scripts/product-ui/literal-guard.mjs'

const ROOT = path.resolve(__dirname, '../../../../../../../../../..')
const FILE = 'src/@/components-dashboard/src/ui/src/components/Schools/SchoolsManagement/schools-page.css'
const css = readFileSync(path.join(ROOT, FILE), 'utf8')
const code = css.replace(/\/\*[\s\S]*?\*\//g, '')
const brand = ['ordering.tokens.generated.css', 'pilot.css', 'candidates.css']
  .map(name => readFileSync(path.join(ROOT, 'src/brand', name), 'utf8'))
  .join('\n')

describe('schools-page.css', () => {
  it('has no literal value (the literal guard of the Product files)', () => {
    expect(scanSource(css, FILE)).toEqual([])
  })

  it('reads only --od-* and --od-x-* variables, and every one of them is defined by the brand files', () => {
    const used = [...new Set([...code.matchAll(/var\((--[a-z0-9-]+)/g)].map(match => match[1]))]
    expect(used.length).toBeGreaterThan(0)
    used.forEach(name => {
      expect(name).toMatch(/^--od-(x-)?[a-z0-9-]+$/)
      expect(brand, `${name} is not defined`).toMatch(new RegExp(`${name}\\s*:`))
    })
  })

  it('styles the classes of the batch (odc-school- prefix) and, besides, only the Field and the legacy select root it lays out', () => {
    const classes = [...new Set([...code.matchAll(/\.([a-z][a-z0-9-]*)/g)].map(match => match[1]))]
    classes.filter(name => !['odc-field', 'od-first-select-root'].includes(name)).forEach(name => expect(name).toMatch(/^odc-school-/))
    // 'odc-school-head' is gone from the list; the opener is PageHeader's `leading`, which replaced the wrapper that laid out the pair
    ;['odc-school-page', 'odc-school-picker', 'odc-school-body', 'odc-school-restoring'].forEach(name => {
      expect(classes).toContain(name)
    })
  })

  it('has no physical left/right properties: the page reads in RTL too', () => {
    expect(code).not.toMatch(/(^|[\s;{])(margin|padding|border)-(left|right)\s*:/)
    expect(code).not.toMatch(/(^|[\s;{])(left|right)\s*:/)
  })
})

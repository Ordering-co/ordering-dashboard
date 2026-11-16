// redesign SC-B1: schools.css is governed like the Product files: tokens only (no literal color, size, weight, duration, z-index),
// and every token it reads exists in the brand files.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { scanSource } from '../../../../../../../../../scripts/product-ui/literal-guard.mjs'

const ROOT = path.resolve(__dirname, '../../../../../../../../..')
const FILE = 'src/@/components-dashboard/src/ui/src/components/Schools/schools.css'
const css = readFileSync(path.join(ROOT, FILE), 'utf8')
const brand = ['ordering.tokens.generated.css', 'pilot.css', 'candidates.css']
  .map(name => readFileSync(path.join(ROOT, 'src/brand', name), 'utf8'))
  .join('\n')

describe('schools.css', () => {
  it('has no literal value (the literal guard of the Product files)', () => {
    expect(scanSource(css, FILE)).toEqual([])
  })

  it('reads only --od-* and --od-x-* variables, and every one of them is defined by the brand files', () => {
    const used = [...new Set([...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/var\((--[a-z0-9-]+)/g)].map(match => match[1]))]
    expect(used.length).toBeGreaterThan(0)
    used.forEach(name => {
      expect(name).toMatch(/^--od-(x-)?[a-z0-9-]+$/)
      expect(brand, `${name} is not defined`).toMatch(new RegExp(`${name}\\s*:`))
    })
  })

  it('uses styles only for the classes of the batch, all with the odc-school- prefix', () => {
    const classes = [...new Set([...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\.([a-z][a-z0-9-]*)/g)].map(match => match[1]))]
    // the one other class is the Field that the day bar lays out (`.odc-school-daybar > .odc-field`)
    classes.filter(name => name !== 'odc-field').forEach(name => expect(name).toMatch(/^odc-school-/))
    ;['odc-school-chip', 'odc-school-daybar', 'odc-school-toolbar', 'odc-school-tab'].forEach(name => {
      expect(classes).toContain(name)
    })
  })

  it('has no physical left/right properties: the page reads in RTL too', () => {
    const code = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(code).not.toMatch(/(^|[\s;{])(margin|padding|border)-(left|right)\s*:/)
    expect(code).not.toMatch(/(^|[\s;{])(left|right)\s*:/)
  })
  it('draws the neutral chip on the light surface of P/ badges, never the inverted strong surface (live check: black chips)', () => {
    const rule = css.match(/\.odc-school-chip \{[^}]*\}/)[0]
    expect(rule).toContain('background: var(--od-x-info-soft)')
    expect(rule).not.toContain('--od-surface-strong')
  })
})

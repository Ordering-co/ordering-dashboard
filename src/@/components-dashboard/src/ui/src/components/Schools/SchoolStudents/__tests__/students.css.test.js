// redesign SC-B3: students.css is governed like the Product files: tokens only (no literal color, size, weight, duration, z-index),
// every token it reads exists in the brand files, its classes carry the odc-school- prefix, and it uses logical properties only.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { scanSource } from '../../../../../../../../../../scripts/product-ui/literal-guard.mjs'

const ROOT = path.resolve(__dirname, '../../../../../../../../../..')
const FILE = 'src/@/components-dashboard/src/ui/src/components/Schools/SchoolStudents/students.css'
const css = readFileSync(path.join(ROOT, FILE), 'utf8')
const code = css.replace(/\/\*[\s\S]*?\*\//g, '')
const brand = ['ordering.tokens.generated.css', 'pilot.css', 'candidates.css']
  .map(name => readFileSync(path.join(ROOT, 'src/brand', name), 'utf8'))
  .join('\n')

describe('students.css', () => {
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

  it('styles only classes with the odc-school- prefix', () => {
    const classes = [...new Set([...code.matchAll(/\.([a-z][a-z0-9-]*)/g)].map(match => match[1]))]
    expect(classes.length).toBeGreaterThan(0)
    // the one other class is the Field that the «Assign parent» row lays out (`.odc-school-student-assign > .odc-field`)
    classes.filter(name => name !== 'odc-field').forEach(name => expect(name).toMatch(/^odc-school-student-/))
  })

  it('has no physical left/right properties: the page reads in RTL too', () => {
    expect(code).not.toMatch(/(^|[\s;{])(margin|padding|border)-(left|right)\s*:/)
    expect(code).not.toMatch(/(^|[\s;{])(left|right)\s*:/)
  })
})

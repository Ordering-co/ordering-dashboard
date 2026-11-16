// redesign SC-B4: the two stylesheets of the batch are governed like schools.css and the Product files: tokens only, every token defined,
// our own classes, logical properties. labels.css is Print labels (the summary and the viewer); meals.css is Meals & reports (the report
// cards, the meals cards of a phone). The JS of the batch gets the literal guard too.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { scanSource } from '../../../../../../../../../../scripts/product-ui/literal-guard.mjs'

const ROOT = path.resolve(__dirname, '../../../../../../../../../..')
const SCHOOLS = 'src/@/components-dashboard/src/ui/src/components/Schools'
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8')
const classesOf = (css) => [...new Set([...strip(css).matchAll(/\.([a-z][a-z0-9-]*)/g)].map(match => match[1]))]
const brand = ['ordering.tokens.generated.css', 'pilot.css', 'candidates.css']
  .map(name => read(`src/brand/${name}`))
  .join('\n')

const SHEETS = [
  {
    file: `${SCHOOLS}/SchoolPrintLabels/labels.css`,
    own: ['odc-school-labels-summary', 'odc-school-labels-pages', 'odc-school-labels-bar'],
    // the notice it lays out
    foreign: ['odc-notice']
  },
  {
    file: `${SCHOOLS}/SchoolMealsReports/meals.css`,
    own: ['odc-school-reports', 'odc-school-report', 'odc-school-report-scope'],
    foreign: []
  }
]

describe.each(SHEETS)('$file', ({ file, own, foreign }) => {
  const css = read(file)

  it('has no literal value (the literal guard of the Product files)', () => {
    expect(scanSource(css, file)).toEqual([])
  })

  it('reads only --od-* and --od-x-* variables, and every one of them is defined by the brand files', () => {
    const used = [...new Set([...strip(css).matchAll(/var\((--[a-z0-9-]+)/g)].map(match => match[1]))]
    expect(used.length).toBeGreaterThan(0)
    used.forEach(name => {
      expect(name).toMatch(/^--od-(x-)?[a-z0-9-]+$/)
      expect(brand, `${name} is not defined`).toMatch(new RegExp(`${name}\\s*:`))
    })
  })

  it('styles the classes of its part of the batch, all with the odc-school- prefix', () => {
    const classes = classesOf(css)
    classes.filter(name => !foreign.includes(name)).forEach(name => expect(name).toMatch(/^odc-school-/))
    own.forEach(name => expect(classes).toContain(name))
  })

  it('has no physical left/right properties: the page reads in RTL too', () => {
    const code = strip(css)
    expect(code).not.toMatch(/(^|[\s;{])(margin|padding|border)-(left|right)\s*:/)
    expect(code).not.toMatch(/(^|[\s;{])(left|right)\s*:/)
  })
})

describe('the split between the two sheets', () => {
  it('labels.css keeps only what Print labels uses: nothing of the report cards or the meals', () => {
    const classes = classesOf(read(`${SCHOOLS}/SchoolPrintLabels/labels.css`))
    expect(classes.filter(name => /^odc-school-(report|meal)/.test(name))).toEqual([])
  })

  it('meals.css holds nothing of Print labels', () => {
    const classes = classesOf(read(`${SCHOOLS}/SchoolMealsReports/meals.css`))
    expect(classes.filter(name => /^odc-school-labels/.test(name))).toEqual([])
  })

  it('the phone card of a meal is not interactive: no pointer, no hover state', () => {
    const code = strip(read(`${SCHOOLS}/SchoolMealsReports/meals.css`))
    expect(code).not.toMatch(/cursor\s*:\s*pointer/)
    expect(code).not.toMatch(/odc-school-meal-card[^{]*:(hover|active)/)
  })

  it('labels.css stops its transitions under reduced motion', () => {
    expect(read(`${SCHOOLS}/SchoolPrintLabels/labels.css`)).toMatch(/prefers-reduced-motion:\s*reduce/)
  })

  it('each tab imports the sheet it needs (meals.css in the index and in ReportCards)', () => {
    expect(read(`${SCHOOLS}/SchoolMealsReports/index.js`)).toMatch(/import '\.\/meals\.css'/)
    expect(read(`${SCHOOLS}/SchoolMealsReports/ReportCards.jsx`)).toMatch(/import '\.\/meals\.css'/)
    expect(read(`${SCHOOLS}/SchoolMealsReports/index.js`)).not.toMatch(/labels\.css/)
    expect(read(`${SCHOOLS}/SchoolMealsReports/ReportCards.jsx`)).not.toMatch(/labels\.css/)
    expect(read(`${SCHOOLS}/SchoolPrintLabels/PdfPreview.js`)).toMatch(/import '\.\/labels\.css'/)
  })
})

describe('the JS of the batch', () => {
  it.each([
    'SchoolPrintLabels/index.js',
    'SchoolPrintLabels/PdfPreview.js',
    'SchoolMealsReports/index.js',
    'SchoolMealsReports/ReportCards.jsx'
  ])('%s has no literal color or size', (name) => {
    const file = path.join(ROOT, SCHOOLS, name)
    expect(existsSync(file)).toBe(true)
    expect(scanSource(readFileSync(file, 'utf8'), `${SCHOOLS}/${name}`)).toEqual([])
  })

  it('the old styled-components file is gone and nothing in the batch imports it', () => {
    expect(existsSync(path.join(ROOT, SCHOOLS, 'SchoolPrintLabels/styles.js'))).toBe(false)
    ;['SchoolPrintLabels/index.js', 'SchoolPrintLabels/PdfPreview.js'].forEach((name) => {
      const source = read(`${SCHOOLS}/${name}`)
      expect(source).not.toMatch(/from '\.\/styles'/)
      expect(source).not.toMatch(/styled-components/)
    })
  })

  it('a meal of the phone list is a static RecordCard (link: false, nothing to open), as the other lists of the page (X-SC4)', () => {
    const source = read(`${SCHOOLS}/SchoolMealsReports/index.js`)
    expect(source).toMatch(/import[^\n]*RecordCardList/)
    expect(source).toMatch(/link: false/)
    expect(source).not.toMatch(/onOpen\s*[:=]/)
  })
})

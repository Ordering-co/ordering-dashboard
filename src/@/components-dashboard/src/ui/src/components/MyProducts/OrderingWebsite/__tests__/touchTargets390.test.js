// tanda O row 19 (b, d): at phone width (390) three targets of /my-products/dashboard and the domain helps were under 44px:
//  b1 · the Name / Title input (FormGroup > input), seen at 40px;
//  b2 · the «Visit: <url>» link of the temporal domain (TemporalDomail > a), a 24px line;
//  d  · the «customer support team» link of the domain help, in the legacy form (CustomDomainInfoContent a) and in the sections
//       editor (.odc-ows-hint a).
// The links reach 44px through a centered ::after (the visible box does not move, the pattern of .odc-ows-link::after); the input
// grows its own box, only at phone width. The source as text: vitest does not give a ?raw CSS import its content.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const HERE = path.join(__dirname, '..')
const read = (file) => readFileSync(path.join(HERE, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

// the css template of one `export const NAME = styled…` in styles.js
const template = (source, name) => {
  const start = source.indexOf(`export const ${name} = `)
  if (start < 0) return null
  const end = source.indexOf('\nexport const ', start + 1)
  return source.slice(start, end < 0 ? undefined : end)
}

// the body of the first block opened by `prelude`, nested braces kept
const blockOf = (text, prelude) => {
  const start = text.indexOf(prelude)
  if (start < 0) return null
  const open = text.indexOf('{', start)
  let depth = 0
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1
    if (text[i] === '}') {
      depth -= 1
      if (depth === 0) return text.slice(open + 1, i)
    }
  }
  return null
}

const PHONE_WIDTH = '@media (max-width: 767px)'
const PHONE_OR_COARSE = '@media (pointer: coarse), (max-width: 767px)'
const squash = (text) => text.replace(/\s+/g, ' ')

describe('b1 · FormGroup > input reaches 44px at phone width', () => {
  const styles = read('styles.js')
  const formGroup = template(styles, 'FormGroup')

  it('has a phone-width block with `> input` at the coarse target minimum', () => {
    const phone = blockOf(formGroup, PHONE_WIDTH)
    expect(phone, 'FormGroup has no @media (max-width: 767px)').not.toBeNull()
    expect(squash(phone)).toMatch(/> input \{[^}]*min-height: var\(--od-x-target-coarse\)/)
  })

  it('does not change the input outside that block (desktop box as it was)', () => {
    const outside = squash(formGroup.replace(blockOf(formGroup, PHONE_WIDTH) ?? '', ''))
    expect(outside).not.toMatch(/> input \{[^}]*min-height/)
  })
})

describe.each([
  ['b2 · TemporalDomail > a («Visit: url»)', 'styles.js', (css) => template(css, 'TemporalDomail'), '> a'],
  ['d · CustomDomainInfoContent a (legacy form help)', 'styles.js', (css) => template(css, 'CustomDomainInfoContent'), 'a']
])('%s', (_, file, pick, anchor) => {
  const source = pick(read(file))
  const phone = blockOf(source, PHONE_OR_COARSE)

  it('has a coarse-pointer or phone-width block', () => {
    expect(phone, `no ${PHONE_OR_COARSE}`).not.toBeNull()
  })

  it('positions the link and gives it a centered ::after that reaches the coarse target (the visible box is untouched)', () => {
    const body = squash(phone)
    expect(body).toMatch(new RegExp(`${anchor} \\{[^}]*position: relative`))
    expect(body).toMatch(/::after \{[^}]*content: ''[^}]*position: absolute[^}]*inset: var\(--od-x-target-inset\)/)
  })

  it('declares none of that outside the block', () => {
    const outside = squash(source.replace(phone ?? '', ''))
    expect(outside).not.toMatch(/::after/)
  })
})

describe('d · .odc-ows-hint a (sections editor help)', () => {
  const css = read('SectionsEditor/sections-editor.css')
  const phone = blockOf(css, PHONE_OR_COARSE)

  it('the phone block positions the link and gives it the ::after of the existing .odc-ows-link pattern', () => {
    expect(phone).not.toBeNull()
    const body = squash(phone)
    expect(body).toMatch(/\.odc-ows-hint a \{[^}]*position: relative/)
    expect(body).toMatch(/\.odc-ows-hint a::after[^{]*\{[^}]*content: ''[^}]*position: absolute[^}]*inset: var\(--od-x-target-inset\)/)
  })

  it('has no ::after on the help link outside the phone block', () => {
    const outside = squash(css.replace(phone ?? '', ''))
    expect(outside).not.toMatch(/\.odc-ows-hint a::after/)
  })
})

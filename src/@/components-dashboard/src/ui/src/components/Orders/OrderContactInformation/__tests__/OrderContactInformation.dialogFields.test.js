// redesign F3: the fields of the order detail's dialogs and forms against the brand field standard (C2/C3).
// Measured live (fine pointer, 390px): the tracking domain field and the custom field inputs stayed at 32px because their
// 44px rule was only for `pointer: coarse`; and in the Add custom field form Bootstrap's `label { margin-bottom: .5rem }`
// pushed the Key and Value labels 8px away from their boxes while the Type label (a span) sat on its box, so the three
// labels of one form were on different baselines.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const components = path.join(__dirname, '..', '..', '..')
const read = file => readFileSync(path.join(components, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const media = (css, query) => {
  const start = css.indexOf(`@media ${query}`)
  if (start < 0) return ''
  const open = css.indexOf('{', start)
  let depth = 1
  let index = open + 1
  while (depth > 0 && index < css.length) {
    if (css[index] === '{') depth += 1
    if (css[index] === '}') depth -= 1
    index += 1
  }
  return css.slice(open + 1, index - 1)
}

describe('Custom fields form (F3)', () => {
  const css = read('Orders/OrderDetails/activity-tab.css')

  it('puts every label of the form right above its box, whatever the element (no Bootstrap label margin)', () => {
    const labels = css.match(/\.odt-fld-field > label,\s*\.odt-fld-field > \.odt-fld-label\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(labels).toMatch(/margin:\s*0/)
  })

  it('reaches 44px on a phone, not only on a coarse pointer (C3)', () => {
    const phone = media(css, '(pointer: coarse), (max-width: 767px)')
    expect(phone).toMatch(/\.odt-fld-control[^{]*\{[^}]*min-block-size:\s*var\(--od-x-target-coarse\)/)
    expect(phone).toMatch(/\.odt-fld-control[^{]*\{[^}]*font-size:\s*var\(--od-x-type-lead-size\)/)
  })
})

describe('Tracking domain dialog (F3)', () => {
  it('reaches 44px on a phone, not only on a coarse pointer (C3)', () => {
    const phone = media(read('Orders/OrderTrackingLink/tracking-link.css'), '(pointer: coarse), (max-width: 767px)')
    expect(phone).toMatch(/\.odc-tracking-input,\s*\.odc-tracking-select\s*\{[^}]*min-block-size:\s*var\(--od-x-target-coarse\)/)
    expect(phone).toMatch(/font-size:\s*var\(--od-x-type-lead-size\)/)
  })
})

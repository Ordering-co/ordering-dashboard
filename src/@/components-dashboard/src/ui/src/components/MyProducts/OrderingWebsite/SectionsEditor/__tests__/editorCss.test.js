// Bugs H · W2-9 · what the two My products editors say in CSS (the stylesheet as text: vitest does not give a `?raw` CSS import its content).
//   #75 R1-08 · at 390 the «Learn» label never folded in the header of either editor.
//   #78 R1-05 · the website content dialog is 720px (Dialog size='lg') while `main` used 70% of the width.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = 'src/@/components-dashboard/src/ui/src/components/MyProducts'
const read = (file) => readFileSync(resolve(ROOT, file), 'utf8')
const withoutComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')

const blockOf = (css, prelude) => {
  const start = css.indexOf(prelude)
  if (start < 0) return null
  let depth = 0
  for (let i = css.indexOf('{', start); i < css.length; i += 1) {
    if (css[i] === '{') depth += 1
    if (css[i] === '}') {
      depth -= 1
      if (depth === 0) return css.slice(css.indexOf('{', start) + 1, i)
    }
  }
  return null
}

describe.each([
  ['AppEditor/app-editor.css', '.odc-ape'],
  ['OrderingWebsite/SectionsEditor/sections-editor.css', '.odc-ows']
])('%s · the Learn label folds in a narrow header (R1-08)', (file, root) => {
  const css = withoutComments(read(file))
  const narrow = blockOf(css, '@container (max-width: 599px)')

  it('has a narrow-container rule (the page header is the container, 600px like its own collapse)', () => {
    expect(narrow).not.toBeNull()
  })

  it('clips the `.od-learn-label` span (clipped, not removed: the accessible name stays)', () => {
    expect(narrow).toMatch(new RegExp(`${root.replace('.', '\\.')}[^{]*\\.od-learn-label\\s*\\{[^}]*clip-path:\\s*inset\\(50%\\)`))
    expect(narrow).toMatch(/\.od-learn-label\s*\{[^}]*position:\s*absolute/)
  })

  it('drops the margins of the Learn trigger so only the icon and the arrow stay', () => {
    expect(narrow).toMatch(/\.od-ui\.od-learn-menu \.learn-drop-down\s*\{[^}]*margin-inline:\s*0/)
  })
})

describe('OrderingWebsite · the content dialog uses 70% of the width again (R1-05)', () => {
  const css = withoutComments(read('OrderingWebsite/SectionsEditor/sections-editor.css'))
  const wide = blockOf(css, '@media (min-width: 768px) {\n  .odc-dialog.odc-ows-content-dialog')

  it('widens only from 768px, so the phone sheet (100% wide) is untouched', () => {
    expect(wide).not.toBeNull()
    expect(wide).toMatch(/\.odc-dialog\.odc-ows-content-dialog\[data-size='lg'\]\s*\{[^}]*inline-size:\s*max\(var\(--od-x-dialog-lg\),\s*70vw\)/)
  })

  it('has no dialog-width rule outside that media query', () => {
    expect(css.replace(wide ?? '', '')).not.toMatch(/odc-ows-content-dialog[^{]*\{[^}]*inline-size/)
  })
})

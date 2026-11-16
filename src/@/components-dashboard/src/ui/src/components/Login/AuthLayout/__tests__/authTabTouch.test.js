// Row #53: the auth method Tab is 32px with a mouse, and 44px on a coarse pointer like every other auth control.
// jsdom lays nothing out, so this reads the styled source of `Tab`; the measured height is e2e/brand-system/auth-forms.spec.js.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(path.join(__dirname, '..', 'styles.js'), 'utf8')

// The template literal of `export const <name> = styled.x`...``, comments removed.
const block = name => {
  const start = source.indexOf(`export const ${name} = styled.`)
  expect(start, name).not.toBe(-1)
  const next = source.indexOf('\nexport const ', start + 1)
  return source.slice(start, next === -1 ? undefined : next).replace(/\/\*[\s\S]*?\*\//g, '')
}

describe('AuthLayout Tab touch target', () => {
  const tab = block('Tab')

  it('keeps the 32px box for a mouse', () => {
    expect(tab).toMatch(/min-height:\s*32px/)
  })

  it('takes a 44px box on a coarse pointer, as TogglePassword and the buttons do', () => {
    expect(tab).toMatch(/@media \(pointer: coarse\)\s*\{[^}]*min-height:\s*44px/)
  })
})

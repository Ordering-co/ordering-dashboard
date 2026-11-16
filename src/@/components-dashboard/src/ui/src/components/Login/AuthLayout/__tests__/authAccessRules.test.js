// (batch V, access): three layout rules of the auth surfaces that jsdom cannot lay out. Like authTabTouch.test.js this reads
// the styled source; the measured result is e2e/brand-system/auth-surface-layout.spec.js and the Playwright pass of the batch.
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

describe('RedirectLink', () => {
  // The declarations of the paragraph itself, before the nested `a { ... }`.
  const paragraph = block('RedirectLink').split(/\n\s*a \{/)[0]

  it('centres the phrase and the link on the cross axis, so the 44px link box does not drop below its phrase', () => {
    expect(paragraph).toMatch(/display:\s*flex/)
    expect(paragraph).toMatch(/align-items:\s*(center|baseline)/)
  })

  it('keeps the 44px touch box of the link on a coarse pointer', () => {
    expect(block('RedirectLink')).toMatch(/@media \(pointer: coarse\)\s*\{[^}]*min-height:\s*44px/)
  })
})

describe('ResendCode', () => {
  it('takes a 44px box on a coarse pointer, as the other auth controls do', () => {
    expect(block('ResendCode')).toMatch(/@media \(pointer: coarse\)\s*\{[^}]*min-(height|block-size):\s*44px/)
  })

  it('does not fake the area with an overlay that could cross a neighbour', () => {
    expect(block('ResendCode')).not.toMatch(/::after/)
  })
})

describe('Route', () => {
  const route = block('Route')
  const item = route.match(/\n\s*li \{([^}]*)\}/)[1]

  it('starts every label under its dot with a logical text-align, in LTR and RTL', () => {
    expect(item).toMatch(/text-align:\s*start/)
    expect(route).not.toMatch(/text-align:\s*(left|right)/)
  })
})

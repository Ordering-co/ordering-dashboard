// redesign wave 6 (N-07, F6g-1 follow-up): the wizard's fields reach 44px below 768px with a mouse too,
// like every other Product surface (product.css), not only with a coarse pointer (C3).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(__dirname, '../steps.css'), 'utf8')

describe('create-order steps · touch targets (C3)', () => {
  it('applies the 44px block to the fields with a coarse pointer or below 768px', () => {
    const block = css.match(/@media \(pointer: coarse\), \(max-width: 767px\) \{([\s\S]*?)\n\}/)
    expect(block, 'the touch block covers narrow viewports too').not.toBeNull()
    expect(block[1]).toMatch(/\.odc-steps-input,\s*\.odc-steps-select \{\s*block-size: var\(--od-x-target-coarse\)/)
  })
})

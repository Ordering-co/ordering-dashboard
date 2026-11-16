// redesign wave 6 (audit A2-04 follow-up): the legacy body sets `text-align: left`; Product surfaces align text to
// the logical start so RTL panels do not render left-aligned lines with `direction: rtl` (C17).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(__dirname, '../product.css'), 'utf8')

describe('product.css · logical text alignment', () => {
  it('aligns Product roots to the start', () => {
    expect(css).toMatch(/\.odc-root \{\s*text-align: start;\s*\}/)
  })
})

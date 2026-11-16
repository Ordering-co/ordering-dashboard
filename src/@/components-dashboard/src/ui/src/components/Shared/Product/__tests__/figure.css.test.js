// redesign W0-3a (T0-9, decisión 11a): amounts, prices, hours and metrics are set in mono with tabular figures through
// one class. The class carries the published mono role (`--od-font-mono`) and no literal family.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(__dirname, '../product.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const ruleOf = (selector) => {
  const match = css.match(new RegExp(`(?:^|\\})\\s*${selector.replace('.', '\\.')}\\s*\\{([^{}]*)\\}`))
  return match?.[1]
}

describe('product.css · .odc-figure', () => {
  it('sets the mono family from the published token', () => {
    const body = ruleOf('.odc-figure')
    expect(body).toBeDefined()
    expect(body).toMatch(/font-family:\s*var\(--od-font-mono\)\s*;/)
  })

  it('keeps the digits tabular and the run isolated', () => {
    const body = ruleOf('.odc-figure')
    expect(body).toMatch(/font-variant-numeric:\s*tabular-nums\s*;/)
    expect(body).toMatch(/unicode-bidi:\s*isolate\s*;/)
  })

  it('does not leave the family to a literal font name', () => {
    const families = Array.from(ruleOf('.odc-figure').matchAll(/font-family:\s*([^;]+);/g)).map(match => match[1].trim())
    expect(families).toEqual(['var(--od-font-mono)'])
  })
})

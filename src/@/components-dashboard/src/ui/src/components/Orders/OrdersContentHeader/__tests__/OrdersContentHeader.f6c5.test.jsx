// redesign F6c-5 (Q2-05): beside the order panel the notices under the tabs keep one line, so they never push the table down.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(__dirname, '../content-header.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rules = Array.from(css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)).map(([, selector, body]) => ({ selector: selector.trim(), body }))
const rulesFor = (part) => rules.filter(({ selector }) => selector.split(',').some(item => item.trim() === part))

describe('F6c-5 · notices stay on one line in the narrow list', () => {
  it('the text of a notice does not wrap: it clips with an ellipsis and leaves the action in place', () => {
    const text = rulesFor('.odc-orders-notices .odc-notice-text').find(({ body }) => /text-overflow:\s*ellipsis/.test(body))
    expect(text).toBeTruthy()
    expect(text.body).toMatch(/white-space:\s*nowrap/)
    expect(text.body).toMatch(/overflow:\s*hidden/)
  })

  it('only from a desktop width: on a phone the notice may wrap, because there it is all there is to read', () => {
    expect(css).toMatch(/@media \(min-width: 768px\)\s*\{\s*\.odc-orders-notices \.odc-notice-text\s*\{/)
  })

  it('the action keeps its size, so the ellipsis is in the text and never in the button', () => {
    const action = rulesFor('.odc-orders-notices .odc-notice-action')
    expect(action.some(({ body }) => /flex:\s*none/.test(body))).toBe(true)
  })
})

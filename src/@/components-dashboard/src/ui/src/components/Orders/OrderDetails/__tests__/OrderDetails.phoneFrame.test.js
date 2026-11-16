// redesign 5.6-B (item 4): on a phone the detail's foot never covers content. It is not overlaid on the body: the
// frame is a grid of three rows (tabs, the scrolling body, the foot), so the body ends where the foot begins and
// its last line stays reachable. Back returns to a list that was only hidden (SplitView keeps it mounted, pinned
// in Shared/Product/__tests__/SplitView.test.jsx), so its scroll offset survives. Measured in the real app at 390px:
// body bottom = foot top; scrolled to the end, the last block ends 33px above the foot; Back kept scrollTop.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = name => readFileSync(path.join(__dirname, '..', name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rule = (css, selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return css.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm'))?.[1] ?? null
}

describe('Order detail frame on phones (5.6-B)', () => {
  const frame = read('order-details.css')
  const tab = read('details-tab.css')

  it('lays tabs, body and foot out as three grid rows, the body taking what the foot leaves', () => {
    expect(rule(frame, '.odc-od-tabs')).toMatch(/grid-template-rows:\s*auto minmax\(0, 1fr\) auto/)
    const body = rule(frame, '.odc-od-body')
    expect(body).toMatch(/overflow-y:\s*auto/)
    expect(body).toMatch(/min-block-size:\s*0/)
  })

  it('never takes the foot out of the flow: no fixed, sticky or absolute positioning on it', () => {
    expect(tab).not.toMatch(/\.odt-foot[^{]*\{[^}]*position:\s*(fixed|sticky|absolute)/)
  })

  it('keeps the bottom padding of the body, so the last block clears the foot edge', () => {
    expect(rule(frame, '.odc-od-body')).toMatch(/padding-block:\s*var\(--od-space-4\) var\(--od-space-6\)/)
  })
})

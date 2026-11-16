import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const CSS = readFileSync(path.resolve(__dirname, '../company-panel.css'), 'utf8').replace(/\s+/g, ' ')

// redesign bugs-d row 63 (drivers-companies Q-04): P/SaveBar sits in the RecordPanel foot, which has its own padding and hairline. Inside
// the foot the bar drops its own box (margin, padding, hairline, sticky) and takes the full row, so at 390 there is one frame, not two.
describe('company panel · the save bar in the foot', () => {
  it('drops the bar\'s own box inside the record foot and takes the full row', () => {
    const rule = CSS.match(/\.odc-dc-panel \.odc-record-foot > \.odc-savebar \{([^}]*)\}/)
    expect(rule).not.toBeNull()
    const body = rule[1]
    expect(body).toMatch(/flex: 1 1 100%/)
    expect(body).toMatch(/margin: 0/)
    expect(body).toMatch(/padding: 0/)
    expect(body).toMatch(/border: 0/)
    expect(body).toMatch(/position: static/)
  })
})

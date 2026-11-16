// redesign AH (overlap sweep): in the record panel the markup form's save bar must reach the foot. record-panel.css gives
// the body's end padding back to P/SaveBar (inset-block-end: calc(var(--odc-record-pad-end) * -1)); a later rule of this section
// (written before that one) set it back to 0, so the bar stopped 32px above the foot and the checks showed under it.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.join(__dirname, '..', 'business-markups.css'), 'utf8')

describe('markups: the save bar of the form', () => {
  it('gives the record body\'s end padding back (0 outside a record body)', () => {
    const rule = css.match(/\.odc-bm-form > \.odc-bm-savebar \{([^}]*)\}/)
    expect(rule, '.odc-bm-savebar rule').toBeTruthy()
    expect(rule[1]).toMatch(/inset-block-end: calc\(var\(--odc-record-pad-end, 0\) \* -1\);/)
  })
})

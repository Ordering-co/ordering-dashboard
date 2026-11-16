// redesign DG-R1 (R1-06): the header of the group panel. At 1440 the panel is 519px wide: the title («Prishtina Zone») broke into two
// lines because the status (Enabled + switch) wrapped into two lines beside it, and the Learn button with text, Open as page, the
// menu and Close took half of the row. jsdom has no layout, so this reads the stylesheet: the status is one line, and below the
// panel width where it no longer leaves the title room it drops to its own line (RecordPanel's rule, which only does it at 480).
// The measured widths are in the live check of the report (519px: one-line title, one-line status).
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'group-panel.css'), 'utf8')
const block = (selector) => {
  const start = css.indexOf(`${selector} {`)
  if (start === -1) return ''
  return css.slice(start, css.indexOf('}', start))
}

describe('group panel header status (R1-06)', () => {
  it('the status and its switch are one line, never stacked', () => {
    const status = block('.gp-status')
    expect(status).toMatch(/flex-wrap:\s*nowrap/)
    expect(status).not.toMatch(/flex-wrap:\s*wrap/)
  })

  it('below the width where the title would not fit, the status drops to its own line (a container query of the record panel)', () => {
    const query = css.match(/@container odc-record \(max-width: (\d+)px\) \{([\s\S]*?)\n\}/)
    expect(query).not.toBeNull()
    // above the 519px of the split panel at 1440, so that width gets the own line
    expect(Number(query[1])).toBeGreaterThanOrEqual(520)
    expect(query[2]).toMatch(/\.odc-record-head-row\b[^{]*\{[^}]*flex-wrap:\s*wrap/)
    expect(query[2]).toMatch(/\.odc-record-status[^{]*\{[^}]*flex-basis:\s*100%/)
  })
})

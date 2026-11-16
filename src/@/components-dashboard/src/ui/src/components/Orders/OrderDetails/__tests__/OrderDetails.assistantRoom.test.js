// redesign fix-qa E6: Mia, the floating assistant button, sits over the bottom end corner of the
// page (fixed, 20px from the edges, 52px tall, under any Sheet but over a split-view panel). It
// used to cover the status selector and the primary action of the order panel footer, and the
// payment row above it. The panel now makes room for it, and only while the button is on screen:
// it is the one with `aria-controls='assistant_panel'`, and it is gone while the assistant is open
// (docked or floating), which is when `--assistant-offset` moves the Sheet instead.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = name => readFileSync(path.join(__dirname, '..', name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const candidatesSource = readFileSync(path.resolve(process.cwd(), 'src/brand/candidates.css'), 'utf8')
const rule = (css, selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return css.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm'))?.[1] ?? null
}

describe('The order panel makes room for the assistant button (fix-qa E6)', () => {
  const tab = read('details-tab.css')
  const frame = read('order-details.css')
  const launcher = ':root:has(button[aria-controls=\'assistant_panel\'][aria-expanded=\'false\']) .odt-foot:not(.odc-sheet *)'

  it('declares the clearance as a candidate token in the E6 block, in rem so it follows the font size', () => {
    const block = candidatesSource.match(/\/\* E6 light \*\/([^]*?)\/\* E7 light \*\//)?.[1] ?? ''
    expect(block).toMatch(/--od-x-launcher-clearance:\s*[\d.]+rem/)
  })

  // In a Sheet the dialog layer is above the button (z-index 990), so the foot there keeps its padding.
  it('adds that clearance under the foot only while the Mia button is on screen, and not inside a Sheet', () => {
    const body = rule(tab, launcher)
    expect(body).not.toBeNull()
    expect(body).toMatch(/padding-block-end:\s*calc\(var\(--od-space-3\) \+ var\(--od-x-launcher-clearance\)\)/)
  })

  it('does not reserve anything when the button is not there (the plain foot keeps its padding)', () => {
    expect(rule(tab, '.odt-foot')).toMatch(/padding:\s*var\(--od-space-3\) var\(--od-space-5\)/)
    expect(rule(tab, '.odt-foot')).not.toMatch(/launcher/)
  })

  it('keeps the same clearance on a phone, where the foot has its own padding', () => {
    const phone = tab.slice(tab.indexOf('@media (max-width: 767px)'))
    expect(phone).not.toMatch(/padding-block-end:\s*var\(--od-space-3\)\s*;/)
  })

  it('still moves the Sheet out of the docked assistant panel, also when expanded', () => {
    expect(rule(frame, '.odc-sheet.odc-order-sheet[data-side=\'end\']')).toMatch(/inset-inline-end:\s*var\(--assistant-offset, 0\)/)
    expect(rule(frame, '.odc-sheet.odc-order-sheet[data-side=\'end\'][data-expanded]')).toMatch(/inline-size:\s*var\(--app-width, 100vw\)/)
  })
})

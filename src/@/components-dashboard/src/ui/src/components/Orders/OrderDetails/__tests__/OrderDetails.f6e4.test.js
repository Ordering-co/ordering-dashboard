// redesign F6e (Q4-07): opened as a page, the content column is 960px (--od-x-page-content) starting at the page's
// inline start, but the foot spanned the whole width: «Mark as ready» / «Accept order» ended 184px outside that column.
// The foot's content now ends where the column ends. Its hairline still crosses the page; the side panel and the
// overlay (not `[data-expanded]`) and the phone (stacked, full width) keep their foot as it was.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const tab = readFileSync(path.join(__dirname, '..', 'details-tab.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rule = (css, selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return css.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm'))?.[1] ?? null
}
const expandedBlock = tab.slice(tab.indexOf('@media (min-width: 768px)'))

describe('The foot of the order opened as a page follows the content column (Q4-07)', () => {
  it('ends its content where the 960px column ends, never closer to the edge than its own padding', () => {
    const body = rule(expandedBlock, '.odc-od[data-expanded] .odt-foot')
    expect(body).not.toBeNull()
    expect(body).toMatch(
      /padding-inline-end:\s*max\(var\(--od-space-5\), calc\(100% - var\(--od-x-page-content\) - var\(--od-space-5\)\)\)/
    )
  })

  it('uses the same width token as the Details column, so both move together', () => {
    expect(rule(expandedBlock, '.odc-od[data-expanded] .odc-od-body > .odt-tab')).toMatch(/max-inline-size:\s*var\(--od-x-page-content\)/)
  })

  it('keeps the buttons at the end of that column and the selector with its field width', () => {
    expect(rule(expandedBlock, '.odc-od[data-expanded] .odt-foot > .odc-btn:first-of-type')).toMatch(/margin-inline-start:\s*auto/)
    expect(rule(expandedBlock, '.odc-od[data-expanded] .odt-foot-selector')).toMatch(/flex:\s*0 1 var\(--od-x-popover\)/)
  })

  it('leaves the foot of the side panel, the overlay and the phone as they were', () => {
    expect(rule(tab, '.odt-foot')).toMatch(/padding:\s*var\(--od-space-3\) var\(--od-space-5\)/)
    expect(rule(tab, '.odt-foot')).not.toMatch(/page-content/)
    const phone = tab.slice(tab.indexOf('@media (max-width: 767px)'), tab.indexOf('@media (pointer: coarse), (max-width: 767px)'))
    expect(phone).not.toMatch(/page-content/)
    // every rule that mentions the page width is inside the expanded block (min-width: 768px)
    const outside = tab.slice(0, tab.indexOf('@media (min-width: 768px)'))
    expect(outside).not.toMatch(/page-content/)
  })
})

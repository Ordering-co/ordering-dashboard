import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// redesign audit-4 (P2-2): beside the detail panel at 1280 the list is as narrow as a container of 552px and the
// six pills did not fit; they used to wrap onto several lines there.
// redesign F1b (D-06): that wrap made the bar change height when an order opened (the pills jumped to a second row
// and pushed the table down). A split view is not a phone: from 768px of viewport the bar is one row at any
// container width, and what does not fit goes to «+N» (FilterBar.f1b.test.jsx). Only a phone keeps the pills on a
// sideways row of their own with the edge fade. jsdom has no layout: the real widths are measured in the gallery
// (e2e/product-ui/behaviour.spec.js) and in the live session.
const css = readFileSync(path.join(__dirname, '../filter-bar.css'), 'utf8')
const narrow = css.match(/@container\s*\(max-width:\s*599px\)\s*{([\s\S]*?)\n}\n/)[1]

describe('FilterBar pills in a narrow container (audit 4, F1b)', () => {
  it('never wraps the pills: no flex-wrap: wrap anywhere in the bar', () => {
    expect(css).not.toMatch(/flex-wrap:\s*wrap\s*;[^}]*}\s*\n[^{]*odc-filterbar-filters/)
    expect(narrow).not.toMatch(/flex-wrap:\s*wrap/)
    expect(css.match(/\.odc-filterbar-filters[^{]*{[^}]*flex-wrap:\s*wrap/)).toBeNull()
  })

  it('applies the narrow-container rules only to a phone (a max-width 767px media query inside)', () => {
    expect(narrow.trim()).toMatch(/^@media\s*\(max-width:\s*767px\)\s*{/)
    expect(narrow).not.toMatch(/min-width:\s*768px/)
  })

  it('keeps the sideways scroll for a phone: one nowrap row that scrolls', () => {
    const rule = narrow.match(/\.odc-filterbar\[data-overflow-menu\]\s+\.odc-filterbar-filters\s*{([^}]*)}/)[1]
    expect(rule).toMatch(/flex-wrap:\s*nowrap/)
    expect(rule).toMatch(/overflow-x:\s*auto/)
    expect(rule).not.toMatch(/mask-image/)
  })

  it('still marks the edge overflow for the fade a phone uses', () => {
    const fade = readFileSync(path.join(__dirname, '../overflow-fade.css'), 'utf8')
    expect(fade).toMatch(/\.odc-fade-x\[data-overflow-end\]/)
  })
})

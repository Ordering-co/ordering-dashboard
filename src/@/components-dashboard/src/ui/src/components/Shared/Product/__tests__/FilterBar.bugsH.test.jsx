import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { FilterBar, FilterChips } from '../FilterBar'
import { VALUE, resize, sweep } from './filterBarLayout'
import {
  BARE_CUT_DESCRIBE, Harness, LEAD_PILLS, VALUE_WIDTH, bar, bareCutSetUp, installBugsHLayout, narrow, parked, pick, rowNames, useBugsHFont
} from './filterBarBugsH'

// Bugs H, work order W2-4, the filter bar in the middle widths (the harness: ./filterBarBugsH.jsx).
//  - W0-Q2-06: with «Clear filters» parked in «+N» the chips row «clear all» is shown (it was hidden by `[data-clear]`).
//  - W0-D-12: in the band where neither «Clear filters» nor the first pill (even with its value cut to 5em) fits, the first pill
//    is cut down to its bare label, so the row is never empty while «Clear filters» is parked. The sweeps of 1px of W0-D-12 are
//    one per file (FilterBar.bugsH.<sweep>.<lead>.test.jsx) so that they run side by side.
installBugsHLayout()

describe('FilterBar · «clear all» of the chips with «Clear filters» parked in «+N» (W0-Q2-06)', () => {
  beforeEach(() => { useBugsHFont(); VALUE.w = VALUE_WIDTH })

  // jsdom's cascade ignores specificity (the last matching rule wins), so what is drawn is decided here the way a browser does it: the
  // selectors of the stylesheet's rules for `.odc-chips-clear` are taken from the file and matched against the real DOM, and of the
  // ones that match, the most specific wins (a selector with more attribute parts).
  const css = readFileSync(path.resolve(__dirname, '../filter-bar.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const rules = [...css.matchAll(/(?:^|\n)(\.odc-filterbar[^{,\n]*\.odc-chips-clear)\s*\{([^}]*)\}/g)]
    .map(match => ({ selector: match[1].trim(), display: /display:\s*([a-z-]+)/.exec(match[2])?.[1], weight: (match[1].match(/\[/g) ?? []).length }))
  const chips = (
    <FilterChips label='Active filters' chips={[{ key: 'a', label: 'Status: x', removeLabel: 'Remove Status' }]} clearAllLabel='Clear all' onClearAll={() => {}} />
  )
  const shown = () => {
    const link = bar().querySelector('.odc-chips-clear')
    const winner = rules
      .filter(rule => bar().matches(rule.selector.replace(/\s+\.odc-chips-clear$/, '')) && link)
      .sort((a, b) => b.weight - a.weight)[0]
    return winner ? winner.display !== 'none' : true
  }

  it('the stylesheet has the rule that hides it with a bar clear button and the one that shows it with that button parked', () => {
    expect(rules.map(rule => `${rule.selector} → ${rule.display}`)).toEqual([
      '.odc-filterbar[data-clear] .odc-chips-clear → none',
      '.odc-filterbar[data-clear][data-clear-parked] .odc-chips-clear → inline-flex'
    ])
  })

  it('parked: the «clear all» of the chips is shown; in the row: it stays hidden', async () => {
    render(<Harness main={1500} pills={LEAD_PILLS('Driver')} chips={chips} />)
    pick('Driver')
    await narrow(1)
    // room for «Clear filters» beside the pill: the bar's own button is in the row and the chips keep their link away
    expect(parked()).toBe(false)
    expect(shown()).toBe(false)
    resize(520)
    expect(parked()).toBe(true)
    expect(shown()).toBe(true)
    resize(1500)
    expect(parked()).toBe(false)
    expect(shown()).toBe(false)
  })

  it('across the widths it follows the parked mark: one «Clear filters» is shown at a time, the bar\'s or the chips\'', async () => {
    render(<Harness main={1500} pills={LEAD_PILLS('Status')} chips={chips} />)
    pick('Status')
    await narrow(1)
    const wrong = []
    for (const main of sweep(1500, 400, 10)) {
      resize(main)
      if (shown() === !parked()) wrong.push(`${main}: parked ${parked()}, chips link shown ${shown()}`)
    }
    expect(wrong).toEqual([])
  }, 30000)

  it('without a clear button of its own the chips link is never touched', async () => {
    render(<FilterBar label='Order filters' search={<span>s</span>} chips={chips} />)
    expect(shown()).toBe(true)
  })
})

describe(BARE_CUT_DESCRIBE, () => {
  beforeEach(bareCutSetUp)

  it('the bare label is the last cut: it keeps the value in its accessible name, hides it and its separator, and is let go when the bar has room', async () => {
    render(<Harness main={1500} pills={LEAD_PILLS('Driver')} />)
    pick('Driver')
    await narrow(1)
    const bare = []
    for (const main of sweep(1000, 400, 1)) {
      resize(main)
      const button = bar().querySelector('.odc-filterbar-filters [data-cut-bare]')
      if (button) {
        bare.push(main)
        expect(parked()).toBe(true)
        expect(rowNames()).toEqual(['Driver x'])
        expect(button).toHaveAttribute('data-cut', '')
        // the value is still read: the button is named with it
        expect(button).toHaveAccessibleName('Driver x')
        expect(button.querySelector('.odc-pill-value')).not.toBeNull()
      }
    }
    expect(bare.length).toBeGreaterThan(0)
    // one band (narrowing: every width is one px under the one before)
    expect(bare.every((main, index) => index === 0 || main === bare[index - 1] - 1)).toBe(true)
    resize(1400)
    expect(bar().querySelector('[data-cut-bare]')).toBeNull()
    expect(bar().querySelector('[data-cut]')).toBeNull()
  }, 60000)

  it('the stylesheet paints only the label of a bare-cut pill and keeps the value for the accessible name', () => {
    const css = readFileSync(path.resolve(__dirname, '../filter-bar.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).toMatch(/\.odc-filterbar \.odc-pill\[data-cut-bare\] \.odc-pill-sep\s*\{[^}]*display:\s*none/)
    expect(css).toMatch(/\.odc-filterbar \.odc-pill\[data-cut-bare\] \.odc-pill-value\s*\{[^}]*position:\s*absolute[^}]*clip:\s*rect\(0 0 0 0\)/)
  })
})

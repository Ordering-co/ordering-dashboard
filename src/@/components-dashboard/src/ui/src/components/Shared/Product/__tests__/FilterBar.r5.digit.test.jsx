import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { VALUE, resize, sweep } from './filterBarLayout'
import { Harness, Pill, bar, installR5Layout, narrow, parked, parkedNames, pick, rowNames, rowWidth, trigger, useR5Font } from './filterBarR5'

// redesign tramo A r5 (W0-QA3-01, W0-QA3-05, W0-PA3-01, W0-PA3-02, W0-PA3-03): the first pill with a value, the open popover and the
// bar when the last filter goes. The harness is ./filterBarR5.jsx and the layout stubs ./filterBarLayout.js (as W0-4b's): jsdom has
// no layout, so the widths the bar measures are stubbed: the buttons follow their text (20px + 7px a character), the pills carry
// theirs in `data-w`, the search is its floor (200) and the tools are 80.
// W0-PA3-03 (the rest of r5 is FilterBar.r5.test.jsx).
installR5Layout()

describe('FilterBar · the digit of «+N» and the name «+1: Clear filters» (W0-PA3-03)', () => {
  // The count of «+N» counts FILTERS (W0-PA2-03), so with ten pills the longest label is «+10 · 10 active»: two digits and the words.
  // «+9» (one pill in the row) becoming «+10» (none) must not change which pills fit: the row is counted with the longest label at
  // every width, so the digit it gains is already paid for and no pill is left out for it.
  it('with ten pills, «+9» to «+10» changes nothing of what fits: every row has room for «+N» at its longest label', async () => {
    const ten = () => Array.from({ length: 10 }, (_, index) => <Pill key={index} name={`P${index}`} base={100} wide={100} />)
    render(<Harness main={1400} pills={ten()} reserve={false} />)
    const longest = 20 + 7 * '+10 · 10 active'.length // the stub: 20px and 7px a character
    const seen = []
    for (const main of sweep(1400, 420, 3)) {
      resize(main)
      const text = trigger()?.textContent ?? ''
      const wrapper = bar().querySelector('.odc-filterbar-overflow')
      const width = wrapper.hasAttribute('data-empty') ? 0 : trigger().getBoundingClientRect().width
      seen.push({ main, hidden: parkedNames().length, text })
      // the row as drawn, with «+N» as wide as its longest label (a row with a pill in it: with none there is nothing to leave out)
      if (rowNames().length > 0) expect(rowWidth() - width + (width > 0 ? Math.max(width, longest) : 0)).toBeLessThanOrEqual(main)
    }
    expect(seen.some(entry => entry.text === '+9')).toBe(true)
    expect(seen.some(entry => entry.text === '+10')).toBe(true)
    // nothing came back in by the digit: the count of hidden pills only went up while narrowing
    expect(seen.map(entry => entry.hidden).every((hidden, index, all) => index === 0 || hidden >= all[index - 1])).toBe(true)
  }, 60000)

  it('when only «Clear filters» is in «+N» the button says +1 and is named «+1: Clear filters», not as a filter nor as a button that clears', async () => {
    // one pill, with a value: it fits alone in the row once «Clear filters» is in «+N»
    useR5Font()
    VALUE.w = 0
    const one = () => [<Pill key='Status' name='Status' base={80} wide={100} />]
    render(<Harness main={700} pills={one()} />)
    pick('Status')
    await narrow(1)
    let found
    for (const main of sweep(700, 330, 1)) {
      resize(main)
      if (parked() && rowNames().length === 1 && parkedNames().length === 0) { found = main; break }
    }
    expect(found).toBeDefined()
    expect(trigger()).toHaveTextContent(/^\+1$/)
    expect(trigger()).toHaveAttribute('aria-label', '+1: Clear filters')
    expect(trigger().getAttribute('aria-label').startsWith(trigger().textContent)).toBe(true)
  })
})

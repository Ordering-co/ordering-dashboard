import React from 'react'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { VALUE, resize, sweep } from './filterBarLayout'
import { FONT, Harness, LEAD_PILLS, VALUE_WIDTH, bar, installR5Layout, narrow, parked, pick, rowNames, rowWidth, useR5Font } from './filterBarR5'

// redesign tramo A r5 (W0-QA3-01, W0-QA3-05, W0-PA3-01, W0-PA3-02, W0-PA3-03): the first pill with a value, the open popover and the
// bar when the last filter goes. The harness is ./filterBarR5.jsx and the layout stubs ./filterBarLayout.js (as W0-4b's): jsdom has
// no layout, so the widths the bar measures are stubbed: the buttons follow their text (20px + 7px a character), the pills carry
// theirs in `data-w`, the search is its floor (200) and the tools are 80.
// W0-PA3-01, the sweeps of 1-2px (the rest of this describe is FilterBar.r5.test.jsx).
installR5Layout()

describe('FilterBar · the first pill with a value: «Clear filters» and the pills move one way when the bar changes (W0-PA3-01, W0-PA3-02, D-26)', () => {
  beforeEach(() => { useR5Font(); VALUE.w = VALUE_WIDTH })

  // the bar is placed again at every width, with the first pill chosen from «+N» (it was out of the row) in the 24px where the room
  // is enough for it alone and not yet for it with the 24px of hysteresis that a pill asks to come back
  it('a value chosen on a parked pill puts it in the row as soon as it fits alone: the row is never empty with «Clear filters» parked', async () => {
    const empty = []
    for (const main of sweep(700, 770, 1)) {
      const { unmount } = render(<Harness main={main} pills={LEAD_PILLS('Driver')} />)
      pick('Driver')
      await narrow(1)
      // the row without any pill, with «Clear filters» parked: the pill (240 wide, its value cut it is 191) would fit beside «+N»
      // (which holds the room of its longest label: the reserve). It is the bar that counts the room, so the same sum is made here.
      const reserve = Number.parseFloat(bar().querySelector('.odc-filterbar-plus-reserve').style.getPropertyValue('--odc-plus-reserve')) || 0
      const moreReserve = Number.parseFloat(bar().querySelector('.odc-filterbar-more > *').style.getPropertyValue('--odc-more-reserve')) || 0
      if (parked() && rowNames().length === 0 && rowWidth() + reserve + moreReserve + 191 + 4 <= main) empty.push(main)
      unmount()
    }
    expect(empty).toEqual([])
  }, 60000)

  it('the first pill is cut to the room it has, never under 5em of its value, and let go when the bar has room', async () => {
    render(<Harness main={400} pills={LEAD_PILLS('Status')} />)
    pick('Status')
    await narrow(1)
    const cuts = []
    for (const main of sweep(400, 1200, 2)) {
      resize(main)
      const button = bar().querySelector('.odc-filterbar-filters [data-cut]')
      if (button) {
        const width = Number.parseFloat(button.style.getPropertyValue('--odc-pill-cut'))
        // 240 wide with a 129px value: 5em (80px) of value is 191 of pill
        cuts.push({ main, width, row: rowNames() })
        expect(width).toBeGreaterThanOrEqual(240 - (VALUE_WIDTH - 5 * FONT))
        expect(width).toBeLessThan(240)
        expect(parked()).toBe(true)
        expect(rowNames()).toHaveLength(1)
      }
    }
    expect(cuts.length).toBeGreaterThan(0)
    // a bar with room for the whole pill beside the words: nothing is cut
    resize(1400)
    expect(bar().querySelector('[data-cut]')).toBeNull()
    expect(bar().querySelector('.odc-filterbar-filters [style*="--odc-pill-cut"]')).toBeNull()
  }, 60000)
})

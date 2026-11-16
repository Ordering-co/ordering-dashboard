import React from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { VALUE, fireResize, flips, resize, sweep } from './filterBarLayout'
import {
  Harness, LEAD_PILLS, VALUE_WIDTH, bar, installR5Layout, narrow, parkedNames, parked, pick, press, rowNames, stateOf, trigger, unpick, useR5Font
} from './filterBarR5'

// redesign tramo A r5 (W0-QA3-01, W0-QA3-05, W0-PA3-01, W0-PA3-02, W0-PA3-03): the first pill with a value, the open popover and the
// bar when the last filter goes. The harness is ./filterBarR5.jsx and the layout stubs ./filterBarLayout.js (as W0-4b's): jsdom has
// no layout, so the widths the bar measures are stubbed: the buttons follow their text (20px + 7px a character), the pills carry
// theirs in `data-w`, the search is its floor (200) and the tools are 80.
// The sweeps of 1-2px of W0-PA3-01 are FilterBar.r5.cut.test.jsx, and W0-PA3-03 FilterBar.r5.digit.test.jsx.
installR5Layout()

describe('FilterBar · the first pill with a value: «Clear filters» and the pills move one way when the bar changes (W0-PA3-01, W0-PA3-02, D-26)', () => {
  beforeEach(() => { useR5Font(); VALUE.w = VALUE_WIDTH })

  it.each([
    ['Status', 400, 1500],
    ['Driver', 400, 1500]
  ])('%s with a value, widening from %i to %i in steps of 10px: no pill leaves, and «Clear filters» goes back to the row once', async (lead, from, to) => {
    render(<Harness main={from} pills={LEAD_PILLS(lead)} />)
    pick(lead)
    await narrow(1)
    const series = []
    let row = new Set(rowNames())
    const left = []
    for (const main of sweep(from, to, 10)) {
      resize(main)
      const next = new Set(rowNames())
      ;[...row].filter(name => !next.has(name)).forEach(name => left.push(`${main}: ${name}`))
      row = next
      series.push(parked())
    }
    expect(left).toEqual([])
    expect(flips(series)).toBeLessThanOrEqual(1)
    expect(series[series.length - 1]).toBe(false)
  }, 30000)

  it.each([
    ['Status'],
    ['Driver']
  ])('%s with a value, narrowing in steps of 10px: no pill that is out comes in, and «Clear filters» leaves the row once', async (lead) => {
    render(<Harness main={1500} pills={LEAD_PILLS(lead)} />)
    pick(lead)
    await narrow(1)
    const series = []
    let row = new Set(rowNames())
    const came = []
    for (const main of sweep(1490, 400, 10)) {
      resize(main)
      const next = new Set(rowNames())
      ;[...next].filter(name => !row.has(name)).forEach(name => came.push(`${main}: ${name}`))
      row = next
      series.push(parked())
    }
    expect(came).toEqual([])
    expect(flips(series)).toBeLessThanOrEqual(1)
  }, 30000)
})

// A pill that opens its popover: it keeps `expanded` and its value, like FilterPopover. The value is set and cleared from outside.
describe('FilterBar · the pill whose popover is open never leaves the row nor moves while its value changes (W0-QA3-01)', () => {
  beforeEach(() => { useR5Font(); VALUE.w = VALUE_WIDTH })

  const unitOf = name => [...bar().querySelectorAll('.odc-filterbar-filters > *')].find(node => node.querySelector('.odc-pill-label').textContent === name)
  const inRow = name => !unitOf(name).hasAttribute('data-overflowed')

  // The pill has one value and is closed; the bar is `main` wide (1024 and 1100 without the panel are 676-ish px of list here).
  const openWithValue = async (lead, main) => {
    render(<Harness main={main} pills={LEAD_PILLS(lead)} />)
    pick(lead)
    await narrow(1)
    expect(inRow(lead)).toBe(true)
    await press(lead)
    expect(unitOf(lead).querySelector('button')).toHaveAttribute('aria-expanded', 'true')
  }

  it.each([
    ['Status', 'a second value', 676, 'more'],
    ['Status', 'the only value taken away', 676, 'none'],
    ['Driver', 'a second value', 676, 'more'],
    ['Driver', 'the only value taken away', 676, 'none'],
    ['Status', 'a second value, with room for the whole pill', 760, 'more'],
    ['Status', 'the only value taken away, with room for the whole pill', 760, 'none']
  ])('%s: %s (the bar is %ipx): the pill stays in the row and does not move', async (lead, _, main, change) => {
    await openWithValue(lead, main)
    const before = Array.from(bar().querySelectorAll('.odc-filterbar-filters > *')).map(node => node.hasAttribute('data-overflowed'))
    if (change === 'none') {
      unpick(lead)
      VALUE.w = 0
    } else {
      VALUE.w = 20
    }
    await act(async () => {})
    fireResize()
    expect(inRow(lead)).toBe(true)
    // the same pills in the same places (the ones that were in the row are in it)
    const after = Array.from(bar().querySelectorAll('.odc-filterbar-filters > *')).map(node => node.hasAttribute('data-overflowed'))
    expect(after.map((out, index) => before[index] || !out)).toEqual(after.map(() => true))
    expect(after.filter(out => !out).length).toBeGreaterThanOrEqual(1)
    // the focus does not go to «+N»
    expect(document.activeElement).not.toBe(trigger())
    // closing places the row again, by the usual rules
    await press(lead)
    expect(unitOf(lead).querySelector('button')).toHaveAttribute('aria-expanded', 'false')
  })

  it('the bar gets narrower with the popover open: the pill stays, the ones after it give way, «Clear filters» goes to «+N»', async () => {
    render(<Harness main={1300} pills={LEAD_PILLS('Status')} />)
    pick('Status')
    await narrow(1)
    expect(rowNames().length).toBeGreaterThan(1)
    await press('Status')
    for (const main of sweep(1290, 560, 10)) {
      resize(main)
      expect(inRow('Status')).toBe(true)
      expect(rowNames()[0]).toBe('Status x')
    }
    expect(parked()).toBe(true)
    expect(rowNames()).toEqual(['Status x'])
  })

  it('the first pill of the row opened for its first value keeps the place it has (a bare pill)', async () => {
    render(<Harness main={676} pills={LEAD_PILLS('Status')} />)
    await narrow(1)
    await press('Status')
    pick('Status')
    await act(async () => {})
    fireResize()
    expect(inRow('Status')).toBe(true)
  })
})

describe('FilterBar · when the last filter goes the bar is the one it was without filters (W0-QA3-05)', () => {
  beforeEach(() => { useR5Font(); VALUE.w = VALUE_WIDTH })

  const snapshot = () => ({ ...stateOf(), parked: parkedNames().join('|'), search: bar().querySelector('[data-search]').hasAttribute('data-pinned') })

  it.each([
    [600], [676], [700], [760], [800], [850], [900], [950], [1000], [1100], [1200], [1300]
  ])('%ipx: a value on the first pill and «Clear filters» pressed leave the row, «+N» and the tools as they were', async (main) => {
    render(<Harness main={main} pills={LEAD_PILLS('Status')} />)
    const base = snapshot()
    pick('Status')
    await narrow(1)
    await press('Status')
    await press('Status')
    unpick('Status')
    await narrow(0)
    expect(snapshot()).toEqual(base)
  })

  it('after a window that changed while the filter was on, the pills that were in the row stay (nothing leaves the row because a filter went)', async () => {
    render(<Harness main={900} pills={LEAD_PILLS('Status')} />)
    const base = rowNames()
    pick('Status')
    await narrow(1)
    resize(1000)
    unpick('Status')
    await narrow(0)
    expect(rowNames().filter(name => base.includes(name))).toEqual(base)
  })
})

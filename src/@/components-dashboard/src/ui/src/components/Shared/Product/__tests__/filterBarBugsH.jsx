import React, { useEffect, useState } from 'react'
import { act, render, screen } from '@testing-library/react'
import { expect } from 'vitest'

import { Button } from '../Button'
import { FilterBar, FilterPill } from '../FilterBar'
import { POSITION, VALUE, WIDTHS, flips, installFilterBarLayout, resize, sweep, useFont } from './filterBarLayout'

// Bugs H, work order W2-4, the filter bar in the middle widths. The harness and the sweeps of the
// FilterBar.bugsH*.test.jsx files: the sweeps of 1px are one per file so that they run side by side (a file runs on one worker).
//  - W0-Q2-06: with «Clear filters» parked in «+N» the chips row «clear all» is shown (it was hidden by `[data-clear]`).
//  - W0-D-12: in the band where neither «Clear filters» nor the first pill (even with its value cut to 5em) fits, the first pill
//    is cut down to its bare label, so the row is never empty while «Clear filters» is parked (D-26: nothing already in the row
//    leaves when the bar widens; W0-PA3-01: «Clear filters» does not come and go with the width).
// The layout stubs are ./filterBarLayout.js (as FilterBar.r5.test.jsx), with the bare cut: a pill whose button carries
// `data-cut-bare` paints only its label.
export const installBugsHLayout = () => installFilterBarLayout({ bareCut: true, styleMarker: 'data-bugs-h' })
export const useBugsHFont = () => useFont('data-bugs-h')

const overflowLabel = count => `+${count} more filters`
const overflowActiveLabel = count => `${count} active`
// The bar, found by its role and name; the sweeps read it several times at every width, and a role query walks the whole tree
// (it costs as much as the bar placing itself), so the node found is kept while it is still in the document as that group.
let barNode = null
export const bar = () => {
  if (barNode?.isConnected && barNode.getAttribute('role') === 'group' && barNode.getAttribute('aria-label') === 'Order filters') return barNode
  barNode = screen.getByRole('group', { name: 'Order filters' })
  return barNode
}
export const rowNames = () => [...bar().querySelectorAll('.odc-filterbar-filters > :not([data-overflowed])')].map(node => node.textContent)
const trigger = () => bar().querySelector('[data-filterbar-overflow]')
const clearButton = () => bar().querySelector('.odc-filterbar-clear > *')
export const parked = () => bar().hasAttribute('data-clear-parked')

const Pill = ({ name, base = 100, wide }) => {
  const [value, setValue] = useState('')
  useEffect(() => {
    const handler = event => { if (event.detail === name) setValue('x') }
    window.addEventListener('bugsh-pick', handler)
    return () => window.removeEventListener('bugsh-pick', handler)
  }, [name])
  return (
    <span data-w={value ? wide : base}>
      <FilterPill label={name} value={value} onClick={() => {}} />
    </span>
  )
}
export const pick = name => act(() => { window.dispatchEvent(new CustomEvent('bugsh-pick', { detail: name })) })
// What the list does when a filter is set outside the pills (the sheet): «Filters N» says how many, «Clear filters» appears.
export const narrow = count => act(() => { window.dispatchEvent(new CustomEvent('bugsh-count', { detail: count })) })

// Widths with a value: 80+20, 80+20, 90+20, 100+20, 90+20, 110+32 (as the pilot's six).
const PILLS = () => [
  <Pill key='Status' name='Status' base={80} wide={100} />,
  <Pill key='SLA' name='SLA' base={80} wide={100} />,
  <Pill key='Driver' name='Driver' base={90} wide={110} />,
  <Pill key='Driver group' name='Driver group' base={100} wide={120} />,
  <Pill key='Date' name='Date' base={90} wide={110} />,
  <Pill key='Business' name='Business' base={110} wide={142} />
]
// Widths of the first pill (the one that goes first): 100 without a value, 240 with it (value 129, bare label 111)
export const LEAD_PILLS = (lead = 'Status') => PILLS().map(pillNode => pillNode.props.name === lead
  ? <Pill key={lead} name={lead} base={pillNode.props.base} wide={240} />
  : pillNode)

export const Harness = ({ main, pills = PILLS(), chips }) => {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const handler = event => setCount(event.detail)
    window.addEventListener('bugsh-count', handler)
    return () => window.removeEventListener('bugsh-count', handler)
  }, [])
  WIDTHS.main = main
  POSITION.plusLeft = main - 300
  return (
    <FilterBar
      label='Order filters'
      overflowLabel={overflowLabel}
      overflowActiveLabel={overflowActiveLabel}
      moreReserve='99'
      clearReserve='Clear filters'
      search={<span data-search style={{ '--od-x-search-min': `${WIDTHS.search}px` }}>search</span>}
      filters={pills}
      more={<Button>Filters{count > 0 && <>{' '}<span data-filterbar-count>{count}</span></>}</Button>}
      clear={count > 0 ? <Button variant='ghost'>Clear filters</Button> : undefined}
      tools={<span>tools</span>}
      chips={count > 0 ? chips : undefined}
    />
  )
}

// The row as the bar measures it (see FilterBar.r5.test.jsx): what has to fit the bar.
const rowWidth = () => {
  const root = bar()
  const width = node => (node ? node.getBoundingClientRect().width : 0)
  const wrapper = root.querySelector('.odc-filterbar-overflow')
  return [
    WIDTHS.search,
    ...[...root.querySelectorAll('.odc-filterbar-filters > :not([data-overflowed])')].map(width),
    wrapper.hasAttribute('data-empty') ? 0 : width(trigger()),
    width(root.querySelector('.odc-filterbar-more > *')),
    parked() ? 0 : width(clearButton()),
    width(root.querySelector('.odc-filterbar-tools'))
  ].reduce((sum, part) => sum + part, 0)
}

export const VALUE_WIDTH = 129
const BARE_WIDTH = 240 - VALUE_WIDTH

// W0-D-12: the describe the bare cut tests share (one per file for the sweeps), and its set up.
export const BARE_CUT_DESCRIBE = 'FilterBar · the first pill is cut down to its bare label so the row is never empty with «Clear filters» parked (W0-D-12)'
export const bareCutSetUp = () => { useBugsHFont(); VALUE.w = VALUE_WIDTH }

const reserves = () => {
  const reserve = Number.parseFloat(bar().querySelector('.odc-filterbar-plus-reserve').style.getPropertyValue('--odc-plus-reserve')) || 0
  const moreReserve = Number.parseFloat(bar().querySelector('.odc-filterbar-more > *').style.getPropertyValue('--odc-more-reserve')) || 0
  return reserve + moreReserve
}

export const RENDER_SWEEP = {
  title: '%s with a value, a sweep of 1px from 520 to 780 (the band is around 600-675): with «Clear filters» parked the row is empty only when not even the bare label fits',
  timeout: 120000,
  run: async (lead) => {
    const empty = []
    for (const main of sweep(520, 780, 1)) {
      const { unmount } = render(<Harness main={main} pills={LEAD_PILLS(lead)} />)
      pick(lead)
      await narrow(1)
      if (parked() && rowNames().length === 0 && rowWidth() + reserves() + BARE_WIDTH + 4 <= main) empty.push(main)
      unmount()
    }
    expect(empty).toEqual([])
  }
}

export const WIDENING = {
  title: '%s with a value, widening in steps of 1px: no pill that is in the row leaves, and «Clear filters» goes back once',
  timeout: 60000,
  run: async (lead) => {
    render(<Harness main={400} pills={LEAD_PILLS(lead)} />)
    pick(lead)
    await narrow(1)
    const series = []
    const left = []
    const empties = []
    let row = new Set(rowNames())
    for (const main of sweep(400, 1500, 1)) {
      resize(main)
      const next = new Set(rowNames())
      ;[...row].filter(name => !next.has(name)).forEach(name => left.push(`${main}: ${name}`))
      row = next
      series.push(parked())
      if (parked() && next.size === 0 && rowWidth() + reserves() + BARE_WIDTH + 4 <= main) empties.push(main)
    }
    expect(left).toEqual([])
    expect(empties).toEqual([])
    expect(flips(series)).toBeLessThanOrEqual(1)
    expect(series[series.length - 1]).toBe(false)
  }
}

export const NARROWING = {
  title: '%s with a value, narrowing in steps of 1px: no pill that is out comes in, and «Clear filters» leaves once',
  timeout: 60000,
  run: async (lead) => {
    render(<Harness main={1500} pills={LEAD_PILLS(lead)} />)
    pick(lead)
    await narrow(1)
    const series = []
    const came = []
    let row = new Set(rowNames())
    for (const main of sweep(1499, 400, 1)) {
      resize(main)
      const next = new Set(rowNames())
      ;[...next].filter(name => !row.has(name)).forEach(name => came.push(`${main}: ${name}`))
      row = next
      series.push(parked())
    }
    expect(came).toEqual([])
    expect(flips(series)).toBeLessThanOrEqual(1)
  }
}

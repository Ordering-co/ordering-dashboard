import React, { useEffect, useState } from 'react'
import { act, screen } from '@testing-library/react'

import { Button } from '../Button'
import { FilterBar, FilterPill } from '../FilterBar'
import { POSITION, WIDTHS, installFilterBarLayout, useFont } from './filterBarLayout'

// redesign tramo A r5 (W0-QA3-01, W0-QA3-05, W0-PA3-01, W0-PA3-02, W0-PA3-03): the harness of the FilterBar.r5*.test.jsx files (the
// heavy sweeps are in files of their own so that they run side by side). The layout stubs are ./filterBarLayout.js, as W0-4b's.
export const installR5Layout = () => installFilterBarLayout({ styleMarker: 'data-w04b' })
export const useR5Font = () => useFont('data-w04b')

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
export const parkedNames = () => [...bar().querySelectorAll('.odc-filterbar-filters > [data-overflowed]')].map(node => node.textContent)
export const trigger = () => bar().querySelector('[data-filterbar-overflow]')
export const clearButton = () => bar().querySelector('.odc-filterbar-clear > *')
export const parked = () => bar().hasAttribute('data-clear-parked')

// The pill keeps its own state, like FilterPopover: the bar's owner does not render when it opens or closes. A value arrives
// from outside (`pick(name)`) as a choice made in a popover does, and a pill with a value is `wide` px.
export const Pill = ({ name, base = 100, wide }) => {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  useEffect(() => {
    const handler = event => { if (event.detail === name) setValue('x') }
    const clearHandler = event => { if (event.detail === name) setValue('') }
    window.addEventListener('w04b-pick', handler)
    window.addEventListener('r5-unpick', clearHandler)
    return () => {
      window.removeEventListener('w04b-pick', handler)
      window.removeEventListener('r5-unpick', clearHandler)
    }
  }, [name])
  return (
    <span data-w={value ? wide : base}>
      <FilterPill label={name} value={value} expanded={open} onClick={() => setOpen(current => !current)} />
    </span>
  )
}
export const pick = name => act(() => { window.dispatchEvent(new CustomEvent('w04b-pick', { detail: name })) })
export const unpick = name => act(() => { window.dispatchEvent(new CustomEvent('r5-unpick', { detail: name })) })
export const press = async name => {
  const unit = [...bar().querySelectorAll('.odc-filterbar-filters > *')].find(node => node.querySelector('.odc-pill-label').textContent === name)
  await act(async () => { unit.querySelector('button').click() })
}
// What the list does when a filter is set outside the pills (the sheet): «Filters N» says how many, «Clear filters» appears.
export const narrow = count => act(() => { window.dispatchEvent(new CustomEvent('w04b-count', { detail: count })) })

// Widths with a value: 80+20, 80+20, 90+20, 100+20, 90+20, 110+32 (as the pilot's six).
const PILLS = () => [
  <Pill key='Status' name='Status' base={80} wide={100} />,
  <Pill key='SLA' name='SLA' base={80} wide={100} />,
  <Pill key='Driver' name='Driver' base={90} wide={110} />,
  <Pill key='Driver group' name='Driver group' base={100} wide={120} />,
  <Pill key='Date' name='Date' base={90} wide={110} />,
  <Pill key='Business' name='Business' base={110} wide={142} />
]

export const Harness = ({ main, reserve = true, pills = PILLS(), onClear = () => {}, tools = <span>tools</span> }) => {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const handler = event => setCount(event.detail)
    window.addEventListener('w04b-count', handler)
    return () => window.removeEventListener('w04b-count', handler)
  }, [])
  WIDTHS.main = main
  POSITION.plusLeft = main - 300
  return (
    <FilterBar
      label='Order filters'
      overflowLabel={overflowLabel}
      overflowActiveLabel={overflowActiveLabel}
      moreReserve={reserve ? '99' : undefined}
      clearReserve={reserve ? 'Clear filters' : undefined}
      search={<span data-search style={{ '--od-x-search-min': `${WIDTHS.search}px` }}>search</span>}
      filters={pills}
      more={<Button>Filters{count > 0 && <>{' '}<span data-filterbar-count>{count}</span></>}</Button>}
      clear={count > 0 ? <Button variant='ghost' onClick={onClear}>Clear filters</Button> : undefined}
      tools={tools}
    />
  )
}

// The row as the bar measures it: the search at its floor, the pills in the row, «+N» (when it is there or holds its place),
// «Filters», «Clear filters» (when it is in the row) and the tools. It is what has to fit the bar.
export const rowWidth = () => {
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

export const stateOf = () => ({ row: rowNames().join('|'), clear: parked() ? 'parked' : 'row', plus: trigger()?.textContent ?? '', cut: bar().querySelector('[data-cut]') ? 'cut' : '' })

// The width of the value of a pill, as the stylesheet draws it (the bar cuts it down to 5em: 16px each)
export const VALUE_WIDTH = 129
export const FONT = 16

// Widths of the first pill (the one that goes first): 100 without a value, 240 with it (value 129)
export const LEAD_PILLS = (lead = 'Status') => PILLS().map(pillNode => pillNode.props.name === lead
  ? <Pill key={lead} name={lead} base={pillNode.props.base} wide={240} />
  : pillNode)

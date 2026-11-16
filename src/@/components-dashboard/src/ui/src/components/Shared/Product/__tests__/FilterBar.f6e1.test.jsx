import React, { useEffect, useState } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Button } from '../Button'
import { FilterBar, FilterPill } from '../FilterBar'

// redesign F6e-1 (Q4-01): the layout of the bar with active pills, and what happens to it while a popover is open.
// jsdom has no layout, so the widths the bar measures are stubbed, like FilterBar.f6d1.test.jsx; «+N» is the one
// difference: its width follows its text (as the real button's does), 20px + 7px a character, so the growth of
// «+4» to «+4 · 1 active» is real in the stub too and the reserved width (the longest label) is what is tested.
const WIDTHS = { main: 0, search: 0, more: 0, clear: 0, tools: 0 }
const PLUS_BASE = 20
const PLUS_CHAR = 7
const plusWidth = text => PLUS_BASE + PLUS_CHAR * text.length
let observers = []
class FakeResizeObserver {
  constructor (callback) {
    this.callback = callback
    this.targets = new Set()
    observers.push(this)
  }

  observe (node) { this.targets.add(node) }
  unobserve (node) { this.targets.delete(node) }
  disconnect () { this.targets.clear() }
}
const fireResize = () => act(() => observers.forEach(observer => observer.callback([], observer)))
const widths = next => Object.assign(WIDTHS, next)

const widthOf = node => {
  if (node.parentElement?.classList.contains('odc-filterbar-filters')) return Number(node.getAttribute('data-w')) || 100
  if (node.parentElement?.classList.contains('odc-filterbar-overflow')) {
    // the trigger, or the unseen copy the bar measures for the longest label
    return node.hasAttribute('data-filterbar-overflow') || node.hasAttribute('data-filterbar-probe') ? plusWidth(node.textContent) : 0
  }
  if (node.parentElement?.classList.contains('odc-filterbar-more')) return WIDTHS.more
  if (node.parentElement?.classList.contains('odc-filterbar-clear')) return WIDTHS.clear
  if (node.classList.contains('odc-filterbar-tools')) return WIDTHS.tools
  return 0
}

beforeEach(() => {
  observers = []
  // search floor 200 + «Filters» 90 + tools 80 = 370 of the bar; room for pills and «+N» is `main − 370`
  widths({ main: 0, search: 200, more: 90, clear: 0, tools: 80 })
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function () {
    if (this.classList.contains('odc-filterbar') || this.classList.contains('odc-filterbar-main')) return WIDTHS.main
    return 0
  })
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
    const width = widthOf(this)
    return { width, height: 0, top: 0, left: 0, right: width, bottom: 0, x: 0, y: 0, toJSON () {} }
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const overflowLabel = count => `+${count} more filters`
const overflowActiveLabel = count => `${count} active`
const bar = () => screen.getByRole('group', { name: 'Order filters' })
const rowNames = () => [...bar().querySelectorAll('.odc-filterbar-filters > :not([data-overflowed])')].map(node => node.textContent)
const parkedNames = () => [...bar().querySelectorAll('.odc-filterbar-filters > [data-overflowed]')].map(node => node.textContent)
const trigger = () => bar().querySelector('[data-filterbar-overflow]')
const room = pills => widths({ main: pills + 200 + 90 + 80 })

// The pill keeps its own state, like FilterPopover: the bar's owner does not render when it opens or closes. A value
// arrives from outside (`pick(name)`) as a choice made in a popover does, and a pill with a value is `wide` px.
const Pill = ({ name, base = 100, wide, initial = '' }) => {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(initial)
  useEffect(() => {
    const handler = event => { if (event.detail === name) setValue('x') }
    window.addEventListener('f6e1-pick', handler)
    return () => window.removeEventListener('f6e1-pick', handler)
  }, [name])
  return (
    <span data-w={value ? wide : base}>
      <FilterPill label={name} value={value} expanded={open} onClick={() => setOpen(current => !current)} />
    </span>
  )
}
const pick = name => act(() => { window.dispatchEvent(new CustomEvent('f6e1-pick', { detail: name })) })
const press = async name => {
  const unit = [...bar().querySelectorAll('.odc-filterbar-filters > *')].find(node => node.querySelector('.odc-pill-label').textContent === name)
  await act(async () => { unit.querySelector('button').click() })
}

const renderBar = pills => render(
  <FilterBar
    label='Order filters'
    overflowLabel={overflowLabel}
    overflowActiveLabel={overflowActiveLabel}
    search={<span style={{ '--od-x-search-min': `${WIDTHS.search}px` }}>search</span>}
    filters={pills}
    more={<Button>Filters</Button>}
    tools={<span>tools</span>}
  />
)

// The 1440 combination of the report (hands-on-qa-4 N1), at the scale of the stub: Status and Driver group have a
// value (280 and 298 px), SLA, Driver, Date and Business are 80, 90, 90 and 110 px, and 142 with a value.
const reportPills = () => [
  <Pill key='Status' name='Status' base={80} wide={280} initial='Delivery completed' />,
  <Pill key='SLA' name='SLA' base={80} wide={120} />,
  <Pill key='Driver' name='Driver' base={90} wide={150} />,
  <Pill key='Driver group' name='Driver group' base={100} wide={298} initial='Shipday' />,
  <Pill key='Date' name='Date' base={90} wide={150} />,
  <Pill key='Business' name='Business' base={110} wide={142} />
]

describe('FilterBar · the pills fill the room best-fit, not in a prefix cut (F6e-1, Q4-01)', () => {
  it('a pill that does not fit does not stop a smaller one after it', () => {
    // 280 (Status) + 142 (Business) + «+N» at its longest (111) = 533 of 560; Driver group (298) does not fit
    room(560)
    renderBar([
      <Pill key='Status' name='Status' initial='x' wide={280} />,
      <Pill key='SLA' name='SLA' base={80} />,
      <Pill key='Driver' name='Driver' base={90} />,
      <Pill key='Driver group' name='Driver group' initial='x' wide={298} />,
      <Pill key='Date' name='Date' base={90} />,
      <Pill key='Business' name='Business' initial='x' wide={142} />
    ])
    expect(rowNames()).toEqual(['Status x', 'Business x'])
    expect(parkedNames()).toEqual(['SLA', 'Driver', 'Driver group x', 'Date'])
  })

  it('the row keeps the bar order, whatever the order in which the pills were placed', () => {
    room(660)
    renderBar([
      <Pill key='Status' name='Status' base={80} />,
      <Pill key='SLA' name='SLA' base={80} />,
      <Pill key='Driver' name='Driver' base={90} initial='x' wide={150} />,
      <Pill key='Driver group' name='Driver group' base={100} />,
      <Pill key='Date' name='Date' base={90} initial='x' wide={150} />,
      <Pill key='Business' name='Business' base={110} />
    ])
    // actives first (Driver, Date), then the inactive ones in the bar's order that still fit: Status, SLA
    expect(rowNames()).toEqual(['Status', 'SLA', 'Driver x', 'Date x'])
  })

  it('after the popover closes, the pill that took a value comes back into the row when there is room', async () => {
    room(620)
    renderBar(reportPills())
    await press('Business')
    pick('Business')
    await act(async () => {})
    expect(parkedNames().some(name => name.startsWith('Business'))).toBe(true)
    await press('Business')
    await waitFor(() => expect(rowNames()).toContain('Business x'))
    // Driver group (298) never fit with it: the actives are not hidden for one that is too wide
    expect(parkedNames().some(name => name.startsWith('Driver group'))).toBe(true)
    expect(trigger()).toHaveTextContent(/^\+\d+ · 1 active$/)
  })
})

describe('FilterBar · a popover that is open freezes the layout (F6e-1, Q4-01)', () => {
  it('marking a value in a popover opened from «+N» does not park or release any pill', async () => {
    room(620)
    renderBar(reportPills())
    const row = rowNames()
    const parked = parkedNames().map(name => name.replace(/ x$/, ''))
    expect(parked).toContain('Business')
    await press('Business')
    pick('Business')
    fireResize()
    await act(async () => {})
    expect(rowNames()).toEqual(row)
    expect(parkedNames().map(name => name.replace(/ x$/, ''))).toEqual(parked)
    // the label did grow (Driver group has a value too), and the row did not notice
    expect(trigger()).toHaveTextContent(/^\+\d+ · 2 active$/)
  })

  it('the same when the pill is opened and marked twice in a row', async () => {
    room(620)
    renderBar(reportPills())
    const row = rowNames()
    await press('Business')
    pick('Business')
    await act(async () => {})
    await press('Business')
    await waitFor(() => expect(rowNames()).toContain('Business x'))
    await press('Business')
    fireResize()
    await act(async () => {})
    expect(rowNames().filter(name => row.includes(name))).toEqual(row.filter(name => rowNames().includes(name)))
    expect(rowNames()).toContain('Business x')
  })

  // redesign W0-4b (D-27): the pills in the row and in «+N» stay as they were placed, but the parked pill the popover is anchored
  // to follows «+N» when it moves (FilterBar.w04b.test.jsx); here «+N» is at 0, so that is where it goes.
  it('keeps the parked pills parked: the pill the popover is anchored to is placed where «+N» is', async () => {
    room(620)
    renderBar(reportPills())
    const unit = [...bar().querySelectorAll('.odc-filterbar-filters > [data-overflowed]')].find(node => node.textContent === 'Business')
    unit.style.setProperty('--odc-overflow-x', '777px')
    await press('Business')
    pick('Business')
    fireResize()
    await act(async () => {})
    expect(unit).toHaveAttribute('data-overflowed')
    expect(unit.style.getPropertyValue('--odc-overflow-x')).toBe('0px')
  })

  it('a pill in the row that grows beyond the room places the row again instead of overflowing the bar', async () => {
    // five 100px pills and «+N» (111) = 611 of 640; Status taking a 220px value needs 731
    room(640)
    renderBar(['Status', 'SLA', 'Driver', 'Driver group', 'Date', 'Business'].map(name => <Pill key={name} name={name} base={100} wide={220} />))
    expect(rowNames()).toEqual(['Status', 'SLA', 'Driver', 'Driver group', 'Date', 'Business'])
    room(590)
    fireResize()
    expect(rowNames()).toEqual(['Status', 'SLA', 'Driver', 'Driver group'])
    await press('Status')
    pick('Status')
    fireResize()
    await act(async () => {})
    expect(rowNames()).toEqual(['Status x', 'SLA', 'Driver'])
  })
})

describe('FilterBar · «+N» reserves the width of its longest label (F6e-1, Q4-01)', () => {
  it('a parked pill taking a value (the label grows) does not change how many pills fit, with no popover open', async () => {
    room(620)
    renderBar(reportPills().map(pill => pill.key === 'Driver group' ? <Pill key='Driver group' name='Driver group' base={100} wide={298} /> : pill))
    const row = rowNames()
    const parked = parkedNames()
    expect(trigger()).toHaveTextContent(/^\+\d+$/)
    pick('Driver group')
    fireResize()
    await act(async () => {})
    expect(trigger()).toHaveTextContent(/^\+\d+ · 1 active$/)
    expect(rowNames()).toEqual(row)
    expect(parkedNames().map(name => name.replace(/ x$/, ''))).toEqual(parked.map(name => name.replace(/ x$/, '')))
  })

  it('measures a copy of the button that is gone when the measure ends', () => {
    room(620)
    renderBar(reportPills())
    expect(bar().querySelector('[data-filterbar-probe]')).toBeNull()
    expect(bar().querySelectorAll('[data-filterbar-overflow]')).toHaveLength(1)
  })

  it('without a label for the active ones there is nothing to reserve', () => {
    room(620)
    render(
      <FilterBar
        label='Order filters'
        overflowLabel={overflowLabel}
        search={<span style={{ '--od-x-search-min': `${WIDTHS.search}px` }}>search</span>}
        filters={reportPills()}
        more={<Button>Filters</Button>}
        tools={<span>tools</span>}
      />
    )
    expect(bar().querySelector('[data-filterbar-probe]')).toBeNull()
  })
})

// e2e stage close (gallery F1b guard «it does not flip back and forth»): best-fit let a pill that was out (Date, with
// a value) take the room of two smaller ones that were in (SLA, Driver) when the bar grew by 10px, so growing parked
// one more pill. Resizing alone (the same pills, the same values) now moves «+N» one way: growing only brings pills
// back, shrinking only parks them. A new value, an open popover or a new pill places the row again from scratch.
describe('FilterBar · resizing moves «+N» one way (F1b guard after F6e-1)', () => {
  const sweepPills = () => [
    <Pill key='Status' name='Status' base={80} wide={120} initial='x' />,
    <Pill key='SLA' name='SLA' base={50} />,
    <Pill key='Driver' name='Driver' base={50} />,
    <Pill key='Driver group' name='Driver group' base={100} />,
    <Pill key='Date' name='Date' base={90} wide={150} initial='x' />,
    <Pill key='Business' name='Business' base={110} wide={140} initial='x' />
  ]
  const sweep = values => values.map(value => {
    room(value)
    fireResize()
    return [value, parkedNames().length]
  })
  const range = (from, to) => Array.from({ length: Math.abs(to - from) / 10 + 1 }, (_, index) => from + Math.sign(to - from) * 10 * index)

  it('growing never parks one more pill and shrinking never brings one back', () => {
    room(200)
    renderBar(sweepPills())
    const up = sweep(range(200, 900))
    const down = sweep(range(900, 200))
    up.forEach(([value, parked], index) => { if (index) expect(parked, `grew to ${value}`).toBeLessThanOrEqual(up[index - 1][1]) })
    down.forEach(([value, parked], index) => { if (index) expect(parked, `shrank to ${value}`).toBeGreaterThanOrEqual(down[index - 1][1]) })
    expect(up[0][1]).toBeGreaterThan(0)
    expect(up.at(-1)[1]).toBe(0)
    // fila 48: 142 resize steps, each one a full layout pass inside act(): 1.9s alone, 6.2s on a loaded machine,
    // so it gets its own budget instead of the 5s default.
  }, 30000)

  it('a pill taking a value still places the row again from scratch: the active ones go first', async () => {
    // Status (120) and Date (150) in the row, SLA and Driver (50) fill the rest while Business has no value:
    // 370 + «+N» (111) of 560. With its value (140) Business goes before them: 410 + 111.
    room(560)
    renderBar(sweepPills().map(pill => pill.key === 'Business' ? <Pill key='Business' name='Business' base={110} wide={140} /> : pill))
    expect(parkedNames()).toContain('Business')
    pick('Business')
    fireResize()
    await act(async () => {})
    await waitFor(() => expect(rowNames()).toContain('Business x'))
  })
})

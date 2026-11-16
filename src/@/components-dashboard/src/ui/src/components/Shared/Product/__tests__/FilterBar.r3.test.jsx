import React, { useEffect, useState } from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Button } from '../Button'
import { FilterBar, FilterPill } from '../FilterBar'

// redesign tramo A r3 (W0-QA1-06, W0-QA1-08), same harness as FilterBar.w04b.test.jsx.
// (was) redesign W0-4b (T0-14, decision 18; D-25, D-26, D-27): with the order panel open the list is narrow, and «Clear filters»
// goes to «+N» (one more entry, with its action) before the search goes below 200px. jsdom has no layout, so the widths the
// bar measures are stubbed, like FilterBar.f6f1.test.jsx: the buttons follow their text (20px + 7px a character), the pills
// carry theirs in `data-w`, the search is its floor (200) and the tools are 80.
const WIDTHS = { main: 0, search: 200, tools: 80 }
const POSITION = { plusLeft: 0, originLeft: 0 }
const BASE = 20
const CHAR = 7
const textWidth = node => BASE + CHAR * node.textContent.length
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

const widthOf = node => {
  const parent = node.parentElement
  if (node.hasAttribute('data-search')) return WIDTHS.search
  if (parent?.classList.contains('odc-filterbar-filters')) {
    // redesign tramo A r3 (W0-QA1-06): the stylesheet holds the width of the pill whose popover is open (filter-bar.css)
    const held = node.querySelector('[data-hold]')
    if (held) return Number.parseFloat(held.style.getPropertyValue('--odc-pill-hold'))
    return Number(node.getAttribute('data-w')) || 100
  }
  if (parent?.classList.contains('odc-filterbar-overflow')) {
    return node.hasAttribute('data-filterbar-overflow') || node.hasAttribute('data-filterbar-probe') ? textWidth(node) : 0
  }
  if (parent?.classList.contains('odc-filterbar-more') || parent?.classList.contains('odc-filterbar-clear')) return textWidth(node)
  if (node.classList.contains('odc-filterbar-tools')) return WIDTHS.tools
  return 0
}

beforeEach(() => {
  observers = []
  Object.assign(WIDTHS, { main: 0, search: 200, tools: 80 })
  Object.assign(POSITION, { plusLeft: 0, originLeft: 0 })
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function () {
    if (this.classList.contains('odc-filterbar') || this.classList.contains('odc-filterbar-main')) return WIDTHS.main
    return 0
  })
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
    const width = widthOf(this)
    const left = this.hasAttribute('data-filterbar-overflow') ? POSITION.plusLeft : this.classList.contains('odc-filterbar-start') ? POSITION.originLeft : 0
    return { width, height: 0, top: 0, left, right: left + width, bottom: 0, x: left, y: 0, toJSON () {} }
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.head.querySelectorAll('style[data-w04b]').forEach(node => node.remove())
})

const overflowLabel = count => `+${count} more filters`
const overflowActiveLabel = count => `${count} active`
const bar = () => screen.getByRole('group', { name: 'Order filters' })
const rowNames = () => [...bar().querySelectorAll('.odc-filterbar-filters > :not([data-overflowed])')].map(node => node.textContent)
const parkedNames = () => [...bar().querySelectorAll('.odc-filterbar-filters > [data-overflowed]')].map(node => node.textContent)
const trigger = () => bar().querySelector('[data-filterbar-overflow]')
const clearButton = () => bar().querySelector('.odc-filterbar-clear > *')

// The pill keeps its own state, like FilterPopover: the bar's owner does not render when it opens or closes. A value arrives
// from outside (`pick(name)`) as a choice made in a popover does, and a pill with a value is `wide` px.
const Pill = ({ name, base = 100, wide }) => {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  useEffect(() => {
    const handler = event => { if (event.detail === name) setValue('x') }
    window.addEventListener('w04b-pick', handler)
    return () => window.removeEventListener('w04b-pick', handler)
  }, [name])
  return (
    <span data-w={value ? wide : base}>
      <FilterPill label={name} value={value} expanded={open} onClick={() => setOpen(current => !current)} />
    </span>
  )
}
const pick = name => act(() => { window.dispatchEvent(new CustomEvent('w04b-pick', { detail: name })) })
const press = async name => {
  const unit = [...bar().querySelectorAll('.odc-filterbar-filters > *')].find(node => node.querySelector('.odc-pill-label').textContent === name)
  await act(async () => { unit.querySelector('button').click() })
}

// Widths with a value: 80+20, 80+20, 90+20, 100+20, 90+20, 110+32 (as the pilot's six).
const PILLS = () => [
  <Pill key='Status' name='Status' base={80} wide={100} />,
  <Pill key='SLA' name='SLA' base={80} wide={100} />,
  <Pill key='Driver' name='Driver' base={90} wide={110} />,
  <Pill key='Driver group' name='Driver group' base={100} wide={120} />,
  <Pill key='Date' name='Date' base={90} wide={110} />,
  <Pill key='Business' name='Business' base={110} wide={142} />
]

const Harness = ({ main, reserve = true, pills = PILLS(), onClear = () => {}, tools = <span>tools</span> }) => {
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

// 592 = search 200 + «Filters 99» 90 + «Clear filters» 111 + «+7 · 1 active» 111 + tools 80 (the minimal row: every pill in
// «+N»). Without the words of «Clear filters» it is 481. PANEL (590) is a list beside the open order: it does not take the
// words, and not even one pill.

const strip = file => readFileSync(path.resolve(__dirname, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const css = strip('../filter-bar.css')
const PANEL_WIDTH = 590

// Six pills of 80, 80, 90, 100, 90 and 110px fit the row at 1040 and not at 1020. A value makes «Status» 20px wider.
const TIGHT = 1040
const statusButton = () => bar().querySelector('.odc-filterbar-filters > :first-child button')

describe('FilterBar · the pill with the popover open keeps its width, so the row and the popover do not move (W0-QA1-06)', () => {
  it('a value taken while the popover is open does not park a pill or move the row', async () => {
    render(<Harness main={TIGHT} />)
    expect(parkedNames()).toEqual([])
    const row = rowNames()
    await press('Status')
    expect(statusButton()).toHaveAttribute('aria-expanded', 'true')
    expect(statusButton()).toHaveAttribute('data-hold')
    expect(statusButton().style.getPropertyValue('--odc-pill-hold')).toBe('80px')
    pick('Status')
    expect(parkedNames()).toEqual([])
    expect(rowNames().map(name => name.replace(/ x$/, ''))).toEqual(row)
    expect(trigger().closest('.odc-filterbar-overflow')).toHaveAttribute('data-empty')
    // and a second value keeps the width it had when it opened, not the width of the first value
    pick('Status')
    expect(statusButton().style.getPropertyValue('--odc-pill-hold')).toBe('80px')
  })

  it('takes its natural width back, and the row is measured again, when the popover closes', async () => {
    render(<Harness main={TIGHT} />)
    await press('Status')
    pick('Status')
    expect(statusButton()).toHaveAttribute('data-hold')
    await press('Status')
    expect(statusButton()).toHaveAttribute('aria-expanded', 'false')
    expect(statusButton()).not.toHaveAttribute('data-hold')
    expect(statusButton().style.getPropertyValue('--odc-pill-hold')).toBe('')
    // with the value (100px) the six no longer fit this row: the one that has to leave does it now, not before
    expect(parkedNames().length).toBeGreaterThan(0)
    expect(rowNames()[0]).toMatch(/^Status/)
  })

  it('holds nothing for a pill parked in «+N» (it is not in the row) and nothing on a phone', async () => {
    render(<Harness main={1000} />)
    await press('Business')
    expect(bar().querySelector('[data-hold]')).toBeNull()
  })

  it('the stylesheet gives the held pill that width', () => {
    expect(css).toMatch(/\.odc-filterbar \.odc-pill\[data-hold\]\s*\{[^}]*inline-size:\s*var\(--odc-pill-hold\)/)
  })
})

// redesign tramo A r4 (W0-PA2-05, W0-QA2-06): the held pill never leaves its value at 0px with the separator hanging («Status ·»).
describe('FilterBar · a pill held without a value paints neither the separator nor the 0px value (W0-PA2-05)', () => {
  it('marks a pill that opens without a value, and keeps the mark while the value arrives, until it closes', async () => {
    render(<Harness main={TIGHT} />)
    await press('Status')
    expect(statusButton()).toHaveAttribute('data-hold-bare')
    pick('Status')
    expect(statusButton()).toHaveAttribute('data-hold-bare')
    await press('Status')
    expect(statusButton()).not.toHaveAttribute('data-hold')
    expect(statusButton()).not.toHaveAttribute('data-hold-bare')
  })

  it('does not mark a pill that already had a value when it opened: it paints it, cut with its ellipsis', async () => {
    render(<Harness main={TIGHT} />)
    pick('Status')
    await press('Status')
    expect(statusButton()).toHaveAttribute('data-hold')
    expect(statusButton()).not.toHaveAttribute('data-hold-bare')
  })

  it('the stylesheet takes the separator out and clips the value (still read) for the marked pill, and does not give it more width', () => {
    expect(css).toMatch(/\.odc-pill\[data-hold\]\[data-hold-bare\]\s*\.odc-pill-sep\s*\{[^}]*display:\s*none/)
    expect(css).toMatch(/\.odc-pill\[data-hold\]\[data-hold-bare\]\s*\.odc-pill-value\s*\{[^}]*position:\s*absolute[^}]*clip:\s*rect\(0 0 0 0\)/)
    expect(css).toMatch(/\.odc-filterbar \.odc-pill\[data-hold\]\s*\{\s*inline-size:\s*var\(--odc-pill-hold\);\s*\}/)
  })
})

describe('FilterBar · 0 to 1 filter does not move the search or «+N» (W0-QA1-08)', () => {
  it('the stand-in of «Clear filters» takes no room (no gap either) while «Clear filters» is parked', () => {
    expect(css).toMatch(/\.odc-filterbar\[data-clear-parked\]\s*\.odc-filterbar-clear-reserve\s*\{[^}]*display:\s*none/)
  })

  it('the bar marks the level for the bar without a filter too, which is the case the stand-in lives in', async () => {
    render(<Harness main={PANEL_WIDTH} />)
    expect(clearButton()).toBeNull()
    expect(bar()).toHaveAttribute('data-clear-parked')
    expect(bar().querySelector('.odc-filterbar-clear-reserve')).not.toBeNull()
  })
})

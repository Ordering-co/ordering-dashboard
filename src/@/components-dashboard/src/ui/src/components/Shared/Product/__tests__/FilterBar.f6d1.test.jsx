import React, { useEffect, useState } from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Button } from '../Button'
import { FilterBar, FilterPill } from '../FilterBar'

// redesign F6d-1 (Q3-02): what the bar does when active pills fill the row. jsdom has no layout, so the widths the
// bar measures are stubbed per class name (the harness of FilterBar.f6c2.test.jsx).
const WIDTHS = { main: 0, search: 0, more: 0, clear: 0, tools: 0, pill: 0, plus: 0 }
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
  if (node.parentElement?.classList.contains('odc-filterbar-filters')) return Number(node.getAttribute('data-w')) || WIDTHS.pill
  if (node.parentElement?.classList.contains('odc-filterbar-overflow')) return node.hasAttribute('data-filterbar-overflow') ? WIDTHS.plus : 0
  if (node.parentElement?.classList.contains('odc-filterbar-more')) return WIDTHS.more
  if (node.parentElement?.classList.contains('odc-filterbar-clear')) return WIDTHS.clear
  if (node.classList.contains('odc-filterbar-tools')) return WIDTHS.tools
  return 0
}

beforeEach(() => {
  observers = []
  widths({ main: 900, search: 200, more: 90, clear: 0, tools: 80, pill: 100, plus: 40 })
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

const PILLS = ['Status', 'SLA', 'Driver', 'Driver group', 'Date', 'Business']
const overflowLabel = count => `+${count} more filters`
const overflowActiveLabel = count => `${count} active`
const bar = () => screen.getByRole('group', { name: 'Order filters' })
const hiddenNames = () => [...bar().querySelectorAll('.odc-filterbar-filters > [data-overflowed]')].map(node => node.textContent)
const trigger = () => bar().querySelector('[data-filterbar-overflow]')

const renderBar = ({ pills, ...props } = {}) => render(
  <FilterBar
    label='Order filters'
    overflowLabel={overflowLabel}
    overflowActiveLabel={overflowActiveLabel}
    search={<span style={{ '--od-x-search-min': `${WIDTHS.search}px` }}>search</span>}
    filters={pills ?? PILLS.map(name => <span key={name}><FilterPill label={name} /></span>)}
    more={<Button>Filters</Button>}
    tools={<span>tools</span>}
    {...props}
  />
)

const stylesheet = file => readFileSync(path.resolve(__dirname, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

describe('FilterBar · «+N» says when it hides an active filter (F6d-1, Q3-02)', () => {
  const active = (name, value, w) => <span key={name} data-w={w}><FilterPill label={name} value={value} /></span>
  const inactive = (name) => <span key={name}><FilterPill label={name} /></span>

  it('plain «+N» while only inactive pills are parked', () => {
    renderBar({ pills: [inactive('Status'), inactive('SLA'), inactive('Driver'), inactive('Driver group'), inactive('Date'), inactive('Business')] })
    expect(hiddenNames().length).toBeGreaterThan(0)
    expect(trigger()).toHaveTextContent(/^\+\d+$/)
    expect(trigger()).toHaveAccessibleName(/^\+\d+ more filters$/)
  })

  it('writes how many active pills are inside, in the text and in the accessible name', () => {
    // 900 of room: search 200 + more 90 + «+N» 40 + tools 80 leave 490 for pills; the three active ones are 200 each
    widths({ main: 900 })
    renderBar({ pills: [inactive('Status'), active('Driver', 'Carlos', 200), active('Driver group', 'Shipday', 200), inactive('Date'), active('Business', 'Fast Bite', 200)] })
    const parked = hiddenNames()
    expect(parked.some(name => /Business|Driver/.test(name))).toBe(true)
    const activeParked = parked.filter(name => /Fast Bite|Carlos|Shipday/.test(name)).length
    expect(activeParked).toBeGreaterThan(0)
    expect(trigger()).toHaveTextContent(`+${parked.length} · ${activeParked} active`)
    expect(trigger()).toHaveAccessibleName(`+${parked.length} · ${activeParked} active: +${parked.length} more filters`) // redesign tramo A r4 (W0-PA2-03): the name starts with the visible text (WCAG 2.5.3)
  })

  it('parks every inactive pill before the first active one', () => {
    widths({ main: 900 })
    renderBar({ pills: [inactive('Status'), active('Driver', 'Carlos', 200), active('Driver group', 'Shipday', 200), inactive('Date'), active('Business', 'Fast Bite', 200)] })
    const parked = hiddenNames()
    const activeParked = parked.some(name => /Fast Bite|Carlos|Shipday/.test(name))
    if (activeParked) expect(parked).toEqual(expect.arrayContaining(['Status', 'Date']))
  })
})

describe('FilterBar · a popover that is open keeps its pill where it is (F6d-1, Q3-02)', () => {
  // The pill keeps its own state, like FilterPopover: the bar's owner does not render when it opens or closes.
  // The value arrives from outside the bar (`pick(name)`), as a choice made in a popover does.
  const Pill = ({ name }) => {
    const [open, setOpen] = useState(false)
    const [value, setValue] = useState('')
    useEffect(() => {
      const handler = (event) => { if (event.detail === name) setValue('Today') }
      window.addEventListener('f6d1-pick', handler)
      return () => window.removeEventListener('f6d1-pick', handler)
    }, [name])
    return (
      <span data-w={value ? 220 : undefined}>
        <FilterPill label={name} value={value} expanded={open} onClick={() => setOpen(current => !current)} />
      </span>
    )
  }
  const pick = (name) => act(() => { window.dispatchEvent(new CustomEvent('f6d1-pick', { detail: name })) })
  const plain = name => <span key={name}><FilterPill label={name} /></span>
  const unit = (position) => bar().querySelector(`.odc-filterbar-filters > :${position}-child`)
  const pillButton = (position) => unit(position).querySelector('button[aria-expanded]')

  beforeEach(() => widths({ main: 950 }))

  it('a parked pill stays parked (under «+N») while it is open, even when it takes a value', async () => {
    renderBar({ pills: [plain('Status'), plain('SLA'), plain('Driver'), plain('Driver group'), plain('Business'), <Pill key='Date' name='Date' />] })
    expect(hiddenNames()).toEqual(['Date'])
    await act(async () => { pillButton('last').click() })
    pick('Date')
    fireResize()
    await act(async () => {})
    expect(unit('last')).toHaveAttribute('data-overflowed')
    expect(unit('last').querySelector('[aria-expanded="true"]')).not.toBeNull()
    expect(hiddenNames()).toEqual(['Date Today'])
  })

  it('takes its place in the row once the popover closes, with no render of the bar', async () => {
    renderBar({ pills: [plain('Status'), plain('SLA'), plain('Driver'), plain('Driver group'), plain('Business'), <Pill key='Date' name='Date' />] })
    await act(async () => { pillButton('last').click() })
    pick('Date')
    await act(async () => { pillButton('last').click() })
    await waitFor(() => expect(unit('last')).not.toHaveAttribute('data-overflowed'))
    expect(trigger()).toHaveTextContent(/^\+\d+$/)
  })

  it('an open pill that is in the row stays in the row', async () => {
    renderBar({ pills: [<Pill key='Status' name='Status' />, plain('SLA'), plain('Driver'), plain('Driver group'), plain('Date'), plain('Business')] })
    await act(async () => { pillButton('first').click() })
    pick('Status')
    fireResize()
    await act(async () => {})
    expect(unit('first')).not.toHaveAttribute('data-overflowed')
  })
})

describe('FilterBar · the stylesheet (F6d-1, Q3-02)', () => {
  const css = stylesheet('../filter-bar.css')
  const candidates = readFileSync(path.resolve(__dirname, '../../../../../../../../../brand/candidates.css'), 'utf8')

  it('the search of the bar has a floor of 200px, a token, not the 180px the other screens use', () => {
    expect(css).toMatch(/\.odc-filterbar\s*\{[^}]*--od-x-search-min:\s*var\(--od-x-filterbar-search-min\)/)
    expect(candidates).toMatch(/\/\* F6d-1 light \*\/[\s\S]*--od-x-filterbar-search-min:\s*200px/)
  })

  it('a pill value is cut at 160px with an ellipsis', () => {
    const rule = css.match(/\.odc-pill-value\s*\{([^}]*)\}/)
    expect(rule).not.toBeNull()
    expect(rule[1]).toMatch(/max-inline-size:\s*var\(--od-x-pill-value-max\)/)
    expect(rule[1]).toMatch(/overflow:\s*hidden/)
    expect(rule[1]).toMatch(/text-overflow:\s*ellipsis/)
    expect(rule[1]).toMatch(/white-space:\s*nowrap/)
    expect(candidates).toMatch(/\/\* F6d-1 light \*\/[\s\S]*--od-x-pill-value-max:\s*160px/)
  })
})

describe('FilterPill · the cut value keeps its words (F6d-1, Q3-02)', () => {
  it('carries the whole value as a title and as its accessible name', () => {
    render(<FilterPill label='Driver group' value='Shipday Delivery Integration' />)
    const button = screen.getByRole('button', { name: /Driver group.*Shipday Delivery Integration/ })
    expect(button.querySelector('.odc-pill-value')).toHaveAttribute('title', 'Shipday Delivery Integration')
  })

  it('has no title when it has no value', () => {
    render(<FilterPill label='Driver' />)
    expect(screen.getByRole('button', { name: 'Driver' }).querySelector('.odc-pill-value')).toBeNull()
  })
})

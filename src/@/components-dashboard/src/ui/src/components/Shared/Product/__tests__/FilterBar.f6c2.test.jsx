import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Button } from '../Button'
import { FilterBar, FilterPill } from '../FilterBar'

// redesign F6c-2 (Q2-06): which pills the «+N» takes. (F1b, D-06: the bar is always one row. The pills that do not fit leave the row and are listed in
// a «+N» menu; each one still opens its own popover from there. jsdom has no layout, so the widths the bar
// measures are stubbed per class name.
const WIDTHS = { main: 0, search: 0, more: 0, clear: 0, tools: 0, toolsCollapsed: 0, pill: 0, plus: 0 }
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
  if (node.classList.contains('odc-filterbar-tools')) return node.closest('.odc-filterbar').hasAttribute('data-tools-collapsed') ? WIDTHS.toolsCollapsed : WIDTHS.tools
  return 0
}

beforeEach(() => {
  observers = []
  // redesign tramo A r5 (W0-PA3-01): the props of a pill were left over from the test before (a value that the next test's rerender
  // dropped, which is a change of ranks and places the bar as on load)
  Object.keys(PILL_PROPS).forEach(name => { delete PILL_PROPS[name] })
  widths({ main: 1200, search: 180, more: 90, clear: 0, tools: 80, toolsCollapsed: 80, pill: 100, plus: 40 })
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function () {
    if (this.classList.contains('odc-filterbar')) return WIDTHS.main
    if (this.classList.contains('odc-filterbar-main')) return WIDTHS.main
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
const pill = (name, props = {}) => <span key={name} data-w={props['data-w']}><FilterPill label={name} {...props} /></span>
const PILL_PROPS = {}
const renderBar = ({ pills = PILLS, tools = <span>tools</span>, clear, ...props } = {}) => render(
  <FilterBar
    label='Order filters'
    overflowLabel={overflowLabel}
    search={<span style={{ '--od-x-search-min': `${WIDTHS.search}px` }}>search</span>}
    filters={pills.map(name => pill(name, PILL_PROPS[name]))}
    more={<Button>Filters</Button>}
    clear={clear}
    tools={tools}
    {...props}
  />
)
const bar = () => screen.getByRole('group', { name: 'Order filters' })
const hiddenNames = () => [...bar().querySelectorAll('.odc-filterbar-filters > [data-overflowed]')].map(node => node.textContent)
const trigger = () => bar().querySelector('[data-filterbar-overflow]')

const SORT = 'Earliest delivery first'
const sortLabel = () => bar().querySelector('.odc-orders-sort')

describe('FilterBar · what «+N» takes (F6c-2, Q2-06)', () => {
  beforeEach(() => { Object.keys(PILL_PROPS).forEach(key => delete PILL_PROPS[key]) })

  it('parks the inactive pills first: a pill with a value keeps its place even when it is the last one', () => {
    // 900 of room holds 5 of the 6 pills; Business is the last one but it has a value
    widths({ main: 900 })
    PILL_PROPS.Business = { value: 'Fast Bite' }
    renderBar()
    expect(hiddenNames()).toEqual(['Date'])
  })

  it('keeps every active pill and then the first inactive ones, in their own order', () => {
    widths({ main: 640 })
    // room for 2 pills: the two active ones (Driver group, Business), the row keeps the bar's order
    PILL_PROPS['Driver group'] = { value: 'Night' }
    PILL_PROPS.Business = { value: 'Fast Bite' }
    renderBar()
    expect(hiddenNames()).toEqual(['Status', 'SLA', 'Driver', 'Date'])
  })

  it('never parks the pill whose popover is open', () => {
    widths({ main: 900 })
    PILL_PROPS.Business = { expanded: true }
    renderBar()
    expect(hiddenNames()).toEqual(['Date'])
  })

  it('gives the room back in the bar order once nothing needs it', () => {
    widths({ main: 900 })
    PILL_PROPS.Business = { value: 'Fast Bite' }
    const { rerender } = renderBar()
    expect(hiddenNames()).toEqual(['Date'])
    widths({ main: 1200 })
    rerender(
      <FilterBar
        label='Order filters'
        overflowLabel={overflowLabel}
        search={<span style={{ '--od-x-search-min': `${WIDTHS.search}px` }}>search</span>}
        filters={PILLS.map(name => pill(name, PILL_PROPS[name]))}
        more={<Button>Filters</Button>}
        tools={<span>tools</span>}
      />
    )
    expect(hiddenNames()).toEqual([])
  })

  it('lists the parked pills in «+N» under their own position, not the position in the row', async () => {
    widths({ main: 900 })
    PILL_PROPS.Business = { value: 'Fast Bite' }
    renderBar()
    const user = userEvent.setup()
    await user.click(trigger())
    expect(await screen.findByRole('menuitem', { name: /Date/ })).toBeInTheDocument()
  })
})

describe('FilterBar · the sort label gives way before any pill (F6c-2, Q2-06)', () => {
  const tools = <span className='odc-orders-sort'>{SORT}</span>
  beforeEach(() => widths({ tools: 212, toolsCollapsed: 80 }))

  it('stays written out while everything fits', () => {
    renderBar({ tools })
    expect(hiddenNames()).toEqual([])
    expect(bar()).not.toHaveAttribute('data-tools-collapsed')
    expect(sortLabel()).not.toHaveAttribute('title')
  })

  it('collapses to an icon (text kept for readers, tooltip with the same words) before a pill is parked', () => {
    // 180 + 600 + 90 = 870 + tools: 212 does not fit 960, 80 does
    widths({ main: 960 })
    renderBar({ tools })
    expect(bar()).toHaveAttribute('data-tools-collapsed')
    expect(hiddenNames()).toEqual([])
    expect(sortLabel()).toHaveTextContent(SORT)
    expect(sortLabel()).toHaveAttribute('title', SORT)
  })

  it('opens again with room to spare, and the tooltip it added goes', () => {
    widths({ main: 960 })
    const { rerender } = renderBar({ tools })
    expect(bar()).toHaveAttribute('data-tools-collapsed')
    widths({ main: 1300 })
    rerender(
      <FilterBar
        label='Order filters'
        overflowLabel={overflowLabel}
        search={<span style={{ '--od-x-search-min': `${WIDTHS.search}px` }}>search</span>}
        filters={PILLS.map(name => pill(name))}
        more={<Button>Filters</Button>}
        tools={tools}
      />
    )
    fireResize()
    expect(bar()).not.toHaveAttribute('data-tools-collapsed')
    expect(sortLabel()).not.toHaveAttribute('title')
  })

  it('does not oscillate at the edge: it opens again only with HYSTERESIS to spare', () => {
    widths({ main: 960 })
    const { rerender } = renderBar({ tools })
    expect(bar()).toHaveAttribute('data-tools-collapsed')
    // 180 + 600 + 90 + 212 = 1082 + margin 4: it fits 1090, but not with the hysteresis
    widths({ main: 1090 })
    rerender(
      <FilterBar
        label='Order filters'
        overflowLabel={overflowLabel}
        search={<span style={{ '--od-x-search-min': `${WIDTHS.search}px` }}>search</span>}
        filters={PILLS.map(name => pill(name))}
        more={<Button>Filters</Button>}
        tools={tools}
      />
    )
    fireResize()
    expect(bar()).toHaveAttribute('data-tools-collapsed')
  })

  it('still parks pills when collapsing is not enough', () => {
    widths({ main: 800 })
    renderBar({ tools })
    expect(bar()).toHaveAttribute('data-tools-collapsed')
    expect(hiddenNames().length).toBeGreaterThan(0)
  })

  it('collapses nothing when the tools hold no collapsible label', () => {
    widths({ main: 900 })
    renderBar()
    expect(bar()).not.toHaveAttribute('data-tools-collapsed')
  })
})

describe('FilterBar · the sort label and the pill value in the stylesheet (F6c-2)', () => {
  const css = readFileSync(path.resolve(__dirname, '../filter-bar.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

  it('draws the collapsed label as a control-sized icon with its words moved out of sight, not removed', () => {
    const rule = css.match(/\[data-tools-collapsed\][^{]*odc-orders-sort[^{]*\{([^}]*)\}/)
    expect(rule).not.toBeNull()
    expect(rule[1]).toMatch(/overflow:\s*hidden/)
    expect(rule[1]).toMatch(/text-indent:/)
    expect(rule[1]).not.toMatch(/display:\s*none/)
  })

  it('writes the pill value after a middle dot', () => {
    expect(css).toMatch(/\.odc-pill-sep::before\s*\{[^}]*content:\s*'·'/)
  })
})

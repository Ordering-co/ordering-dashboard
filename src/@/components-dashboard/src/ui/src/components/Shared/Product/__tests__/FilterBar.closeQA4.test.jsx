import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Button } from '../Button'
import { FilterBar, FilterPill } from '../FilterBar'

// redesign cierre W0 (W0-QA4-02): a bar with no filters that was narrowed and widened back to the same width is placed as on load
// once its width stays still, but only if no pill that is in the row leaves (D-26). jsdom has no layout: the widths are stubbed.
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
  widths({ main: 1200, search: 180, more: 90, clear: 0, tools: 80, pill: 100, plus: 40 })
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
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const PILLS = ['Status', 'SLA', 'Driver', 'Driver group', 'Date', 'Business']
const overflowLabel = count => `+${count} more filters`
const pill = (name, props = {}) => <span key={name} data-w={props['data-w']}><FilterPill label={name} {...props} /></span>
const renderBar = ({ pills = PILLS, tools = <span>tools</span>, clear, ...props } = {}) => render(
  <FilterBar
    label='Order filters'
    overflowLabel={overflowLabel}
    search={<span style={{ '--od-x-search-min': `${WIDTHS.search}px` }}>search</span>}
    filters={pills.map(name => pill(name))}
    more={<Button>Filters</Button>}
    clear={clear}
    tools={tools}
    {...props}
  />
)
const bar = () => screen.getByRole('group', { name: 'Order filters' })
const hiddenNames = () => [...bar().querySelectorAll('.odc-filterbar-filters > [data-overflowed]')].map(node => node.textContent)

const settle = () => act(() => { vi.advanceTimersByTime(600) })

describe('FilterBar · placed as on load once the width stays still (W0-QA4-02)', () => {
  it('after 900 -> 960 the pill that the hysteresis kept out comes in when the width has stayed 500ms, and not before', () => {
    vi.useFakeTimers()
    widths({ main: 900 })
    renderBar()
    expect(hiddenNames()).toEqual(['Business'])
    // six pills need 950: 960 fits them but not with the hysteresis (F1b), and that does not change at once
    widths({ main: 960 })
    fireResize()
    expect(hiddenNames()).toEqual(['Business'])
    act(() => { vi.advanceTimersByTime(300) })
    expect(hiddenNames()).toEqual(['Business'])
    settle()
    expect(hiddenNames()).toEqual([])
    // placed once for that width: nothing is measured again until it changes
    settle()
    expect(hiddenNames()).toEqual([])
  })

  it('a width that keeps changing never settles: the timer starts again with every change', () => {
    vi.useFakeTimers()
    widths({ main: 900 })
    renderBar()
    widths({ main: 960 })
    fireResize()
    act(() => { vi.advanceTimersByTime(400) })
    widths({ main: 961 })
    fireResize()
    act(() => { vi.advanceTimersByTime(400) })
    expect(hiddenNames()).toEqual(['Business'])
    settle()
    expect(hiddenNames()).toEqual([])
  })

  it('never takes a pill out of the row: when placing as on load would swap one for another, it stays as it is (D-26)', () => {
    vi.useFakeTimers()
    // A (84) and B (69) with 350 of search, «Filters» and tools and a «+N» of 40: A alone needs 474 + 4; B alone 459 + 4, +24 to come back.
    widths({ main: 300, search: 180, more: 90, tools: 80, plus: 40, pill: 100 })
    const pills = [pill('A', { 'data-w': 84 }), pill('B', { 'data-w': 69 })]
    const { rerender } = render(
      <FilterBar label='Order filters' overflowLabel={overflowLabel} search={<span style={{ '--od-x-search-min': '180px' }}>search</span>} filters={pills} more={<Button>Filters</Button>} tools={<span>tools</span>} />
    )
    expect(hiddenNames()).toEqual(['A', 'B'])
    widths({ main: 485 })
    rerender(
      <FilterBar label='Order filters' overflowLabel={overflowLabel} search={<span style={{ '--od-x-search-min': '180px' }}>search</span>} filters={pills} more={<Button>Filters</Button>} tools={<span>tools</span>} />
    )
    fireResize()
    // widening brought B in first (it fits first); on load, with this width, A would be the one in the row
    expect(hiddenNames()).toEqual(['A'])
    settle()
    expect(hiddenNames()).toEqual(['A'])
  })

  it('does not run after the bar is gone', () => {
    vi.useFakeTimers()
    widths({ main: 900 })
    const { unmount } = renderBar()
    widths({ main: 960 })
    fireResize()
    unmount()
    expect(() => settle()).not.toThrow()
  })
})

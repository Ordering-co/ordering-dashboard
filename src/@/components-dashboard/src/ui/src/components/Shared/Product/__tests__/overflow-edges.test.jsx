import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FilterBar, FilterPill } from '../FilterBar'
import { TabPanel, Tabs } from '../Tabs'

// jsdom has no layout: the scroller's measures are stubbed per class name.
const LAYOUT = { scrollWidth: 0, clientWidth: 0, scrollLeft: 0 }
const SCROLLERS = ['odc-filterbar-filters', 'odc-tabs-list']
const isScroller = node => SCROLLERS.some(name => node.classList.contains(name))

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

const layout = next => Object.assign(LAYOUT, next)
const fireResize = () => act(() => observers.forEach(observer => observer.callback([], observer)))
const scrollTo = (node, scrollLeft) => {
  layout({ scrollLeft })
  act(() => { node.dispatchEvent(new Event('scroll')) })
}

beforeEach(() => {
  observers = []
  layout({ scrollWidth: 0, clientWidth: 0, scrollLeft: 0 })
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  for (const property of Object.keys(LAYOUT)) {
    vi.spyOn(Element.prototype, property, 'get').mockImplementation(function () {
      return isScroller(this) ? LAYOUT[property] : 0
    })
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const PILLS = ['Date', 'Business', 'Driver group', 'SLA']
const renderBar = props => render(
  <FilterBar
    label='Order filters'
    filters={PILLS.map(name => <FilterPill key={name} label={name} />)}
    {...props}
  />
)
const pillsSlot = () => document.querySelector('.odc-filterbar-filters')

const TAB_ITEMS = [
  { value: 'pending', label: 'Pending', count: 3 },
  { value: 'progress', label: 'In progress', count: 12 },
  { value: 'done', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' }
]
const renderTabs = () => render(
  <Tabs value='pending' onValueChange={() => {}} label='Order status' items={TAB_ITEMS}>
    <TabPanel value='pending'>Pending orders</TabPanel>
  </Tabs>
)
const tabList = () => screen.getByRole('tablist', { name: 'Order status' })

const edges = node => ({
  start: node.hasAttribute('data-overflow-start'),
  end: node.hasAttribute('data-overflow-end')
})

describe('FilterBar overflow edges (FA-1)', () => {
  it('marks only the end edge while the pills continue past it', () => {
    layout({ scrollWidth: 620, clientWidth: 300, scrollLeft: 0 })
    renderBar()
    expect(edges(pillsSlot())).toEqual({ start: false, end: true })
  })

  it('marks nothing when every pill fits', () => {
    layout({ scrollWidth: 300, clientWidth: 300, scrollLeft: 0 })
    renderBar()
    expect(edges(pillsSlot())).toEqual({ start: false, end: false })
  })

  it('marks both edges mid-scroll and only the start edge at the far end', () => {
    layout({ scrollWidth: 620, clientWidth: 300, scrollLeft: 0 })
    renderBar()
    scrollTo(pillsSlot(), 120)
    expect(edges(pillsSlot())).toEqual({ start: true, end: true })
    scrollTo(pillsSlot(), 320)
    expect(edges(pillsSlot())).toEqual({ start: true, end: false })
    scrollTo(pillsSlot(), 0)
    expect(edges(pillsSlot())).toEqual({ start: false, end: true })
  })

  it('reads the same logical edges in RTL, where scrollLeft runs negative', () => {
    layout({ scrollWidth: 620, clientWidth: 300, scrollLeft: 0 })
    render(
      <div dir='rtl'>
        <FilterBar label='Order filters' filters={PILLS.map(name => <FilterPill key={name} label={name} />)} />
      </div>
    )
    expect(edges(pillsSlot())).toEqual({ start: false, end: true })
    scrollTo(pillsSlot(), -120)
    expect(edges(pillsSlot())).toEqual({ start: true, end: true })
    scrollTo(pillsSlot(), -320)
    expect(edges(pillsSlot())).toEqual({ start: true, end: false })
  })

  it('measures again when the slot or a pill changes size', () => {
    layout({ scrollWidth: 300, clientWidth: 300, scrollLeft: 0 })
    renderBar()
    expect(edges(pillsSlot())).toEqual({ start: false, end: false })
    layout({ scrollWidth: 620 })
    fireResize()
    expect(edges(pillsSlot())).toEqual({ start: false, end: true })
    layout({ scrollWidth: 300 })
    fireResize()
    expect(edges(pillsSlot())).toEqual({ start: false, end: false })
  })

  it('measures again when the bar re-renders with other pills', () => {
    layout({ scrollWidth: 300, clientWidth: 300, scrollLeft: 0 })
    const { rerender } = renderBar()
    layout({ scrollWidth: 620 })
    rerender(
      <FilterBar label='Order filters' filters={[...PILLS, 'Zone'].map(name => <FilterPill key={name} label={name} />)} />
    )
    expect(edges(pillsSlot())).toEqual({ start: false, end: true })
  })

  it('hides nothing: Tab still reaches every pill', async () => {
    const user = userEvent.setup()
    layout({ scrollWidth: 620, clientWidth: 300, scrollLeft: 0 })
    renderBar()
    for (const name of PILLS) {
      await user.tab()
      expect(screen.getByRole('button', { name })).toHaveFocus()
    }
  })

  it('stops listening and observing on unmount', () => {
    layout({ scrollWidth: 620, clientWidth: 300, scrollLeft: 0 })
    const { unmount } = renderBar()
    const node = pillsSlot()
    const remove = vi.spyOn(node, 'removeEventListener')
    unmount()
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function))
    expect(observers.every(observer => observer.targets.size === 0)).toBe(true)
  })

  it('works where there is no ResizeObserver', () => {
    vi.unstubAllGlobals()
    layout({ scrollWidth: 620, clientWidth: 300, scrollLeft: 0 })
    renderBar()
    expect(edges(pillsSlot())).toEqual({ start: false, end: true })
  })

  it('fades the edge with tokens, logically, and keeps the focused pill clear of the fade', () => {
    const css = readFileSync(path.join(__dirname, '../overflow-fade.css'), 'utf8')
    expect(css).toMatch(/\[data-overflow-start\]\s*{[^}]*--odc-fade-start:\s*var\(--od-x-fade-size\)/)
    expect(css).toMatch(/\[data-overflow-end\]\s*{[^}]*--odc-fade-end:\s*var\(--od-x-fade-size\)/)
    expect(css).toMatch(/mask-image:\s*linear-gradient\(\s*var\(--odc-fade-to\)/)
    // The gradient flips with the reading direction instead of hard-coding left/right.
    expect(css).toMatch(/:dir\(rtl\)\s*{[^}]*--odc-fade-to:\s*to left/)
    expect(css).toMatch(/scroll-padding-inline:\s*var\(--od-x-fade-size\)/)
    // The hook that sets the attributes also brings the rules that read them.
    expect(readFileSync(path.join(__dirname, '../useOverflowEdges.js'), 'utf8')).toMatch(/import '\.\/overflow-fade\.css'/)
    expect(readFileSync(path.join(__dirname, '../FilterBar.jsx'), 'utf8')).toMatch(/odc-filterbar-filters odc-fade-x/)
  })
})

describe('Tabs overflow edges (FA-3)', () => {
  it('marks the end edge when the tabs do not fit, and clears it at the end', () => {
    layout({ scrollWidth: 464, clientWidth: 280, scrollLeft: 0 })
    renderTabs()
    expect(edges(tabList())).toEqual({ start: false, end: true })
    scrollTo(tabList(), 100)
    expect(edges(tabList())).toEqual({ start: true, end: true })
    scrollTo(tabList(), 184)
    expect(edges(tabList())).toEqual({ start: true, end: false })
  })

  it('marks nothing when the tabs fit', () => {
    layout({ scrollWidth: 280, clientWidth: 280, scrollLeft: 0 })
    renderTabs()
    expect(edges(tabList())).toEqual({ start: false, end: false })
  })

  it('reads logical edges in RTL', () => {
    layout({ scrollWidth: 464, clientWidth: 280, scrollLeft: 0 })
    render(
      <div dir='rtl'>
        <Tabs value='pending' onValueChange={() => {}} label='Order status' items={TAB_ITEMS} dir='rtl' />
      </div>
    )
    expect(edges(tabList())).toEqual({ start: false, end: true })
    scrollTo(tabList(), -184)
    expect(edges(tabList())).toEqual({ start: true, end: false })
  })

  it('measures again when the counts change the width', () => {
    layout({ scrollWidth: 280, clientWidth: 280, scrollLeft: 0 })
    renderTabs()
    layout({ scrollWidth: 464 })
    fireResize()
    expect(edges(tabList())).toEqual({ start: false, end: true })
  })

  it('shares the fade rules with the filter bar and keeps every tab reachable by Tab and arrows', async () => {
    const user = userEvent.setup()
    layout({ scrollWidth: 464, clientWidth: 280, scrollLeft: 0 })
    renderTabs()
    expect(tabList()).toHaveClass('odc-fade-x')
    expect(pillsSlot()).toBeNull()
    await user.tab()
    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: /^Cancelled/ })).toHaveFocus()
  })
})

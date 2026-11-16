import React, { Profiler } from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Button } from '../Button'
import { FilterBar, FilterPill } from '../FilterBar'

// redesign F1b (D-06): the bar is always one row. The pills that do not fit leave the row and are listed in
// a «+N» menu; each one still opens its own popover from there. jsdom has no layout, so the widths the bar
// measures are stubbed per class name.
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
const trigger = () => bar().querySelector('[data-filterbar-overflow]')
const emptied = () => bar().querySelector('.odc-filterbar-overflow').hasAttribute('data-empty')

describe('FilterBar · one row with «+N» (F1b, D-06)', () => {
  it('keeps every pill in the row while search, pills, «more» and tools fit, and draws no «+N»', () => {
    // 180 + 4 × 100 + 90 + 80 = 750 of 1200
    renderBar({ pills: PILLS.slice(0, 4) })
    expect(hiddenNames()).toEqual([])
    expect(emptied()).toBe(true)
    expect(bar()).not.toHaveAttribute('data-layout')
  })

  it('moves the pills that do not fit to «+N», from the end, and says how many', () => {
    // 6 pills: 180 + 600 + 90 + 80 = 950 of 900. With «+N» (40): 5 pills → 180 + 500 + 40 + 90 + 80 = 890.
    widths({ main: 900 })
    renderBar()
    expect(hiddenNames()).toEqual(['Business'])
    expect(emptied()).toBe(false)
    expect(trigger()).toHaveTextContent('+1')
    expect(screen.getByRole('button', { name: '+1 more filters' })).toBeInTheDocument()
  })

  it('hides more pills as the bar narrows, always the last ones', () => {
    widths({ main: 640 })
    renderBar()
    // room for 640 − (180 + 90 + 80) − 40 = 250 → 2 pills
    expect(hiddenNames()).toEqual(['Driver', 'Driver group', 'Date', 'Business'])
    expect(trigger()).toHaveTextContent('+4')
  })

  it('never hides the search, «more», «clear» or the tools: with no room at all every pill is in «+N»', () => {
    widths({ main: 300 })
    renderBar({ clear: <Button variant='ghost'>Clear filters</Button> })
    expect(hiddenNames()).toEqual(PILLS)
    expect(trigger()).toHaveTextContent('+6')
    expect(within(bar()).getByText('search')).toBeInTheDocument()
    expect(within(bar()).getByRole('button', { name: 'Filters' })).toBeInTheDocument()
    expect(within(bar()).getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
    expect(within(bar()).getByText('tools')).toBeInTheDocument()
  })

  it('counts the clear button and the tools only when they are there', () => {
    widths({ main: 700 })
    // 180 + 4 × 100 + 90 + 80 = 750 > 700: the fourth pill goes to «+N»
    const { unmount } = renderBar({ pills: PILLS.slice(0, 4) })
    expect(hiddenNames()).toEqual(['Driver group'])
    unmount()
    // Without tools: 670 of 700, all four stay
    renderBar({ pills: PILLS.slice(0, 4), tools: null })
    expect(hiddenNames()).toEqual([])
  })

  it('measures again when the bar is resized and when a pill is added', () => {
    widths({ main: 760 })
    const { rerender } = renderBar({ pills: PILLS.slice(0, 2) })
    expect(hiddenNames()).toEqual([])
    widths({ main: 400 })
    fireResize()
    expect(hiddenNames().length).toBeGreaterThan(0)
    widths({ main: 760 })
    fireResize()
    rerender(
      <FilterBar
        label='Order filters'
        overflowLabel={overflowLabel}
        search={<span style={{ '--od-x-search-min': `${WIDTHS.search}px` }}>search</span>}
        filters={PILLS.map(name => pill(name))}
        more={<Button>Filters</Button>}
        tools={<span>tools</span>}
      />
    )
    expect(hiddenNames().length).toBeGreaterThan(0)
  })

  it('does not oscillate: a pill comes back only with room to spare', () => {
    widths({ main: 900 })
    renderBar()
    expect(hiddenNames()).toEqual(['Business'])
    // Six pills need 950: 960 fits them but not with the hysteresis, so it stays in «+N».
    widths({ main: 960 })
    fireResize()
    expect(hiddenNames()).toEqual(['Business'])
    fireResize()
    expect(hiddenNames()).toEqual(['Business'])
    widths({ main: 1100 })
    fireResize()
    expect(hiddenNames()).toEqual([])
    fireResize()
    expect(hiddenNames()).toEqual([])
  })

  it('measures «+N» by its own mark: the focus guards an open menu leaves beside it have no width', () => {
    // 4 pills + «+N» (40) = 180 + 400 + 40 + 90 + 80 = 790; a fifth needs 890 + margin: 880 holds four
    widths({ main: 880 })
    renderBar()
    expect(hiddenNames()).toEqual(['Date', 'Business'])
    // An open menu puts its focus guards (1px, fixed) in front of the trigger; opening it measures again.
    const guard = document.createElement('span')
    guard.setAttribute('data-base-ui-focus-guard', '')
    guard.style.position = 'fixed'
    bar().querySelector('.odc-filterbar-overflow').prepend(guard)
    fireResize()
    expect(hiddenNames()).toEqual(['Date', 'Business'])
    expect(trigger()).toHaveTextContent('+2')
  })

  it('keeps its layout while nobody can see the bar (no width, as behind a full-screen order on a phone)', () => {
    widths({ main: 900 })
    renderBar()
    expect(hiddenNames()).toEqual(['Business'])
    widths({ main: 0 })
    fireResize()
    expect(hiddenNames()).toEqual(['Business'])
    widths({ main: 1200 })
    fireResize()
    expect(hiddenNames()).toEqual([])
  })

  it('leaves the phone layout alone: where «+N» is not displayed nothing is hidden', () => {
    widths({ main: 300 })
    const original = window.getComputedStyle
    vi.spyOn(window, 'getComputedStyle').mockImplementation((node, ...rest) => {
      const style = original(node, ...rest)
      return node.classList?.contains('odc-filterbar-overflow')
        ? new Proxy(style, { get: (target, key) => key === 'display' ? 'none' : Reflect.get(target, key) })
        : style
    })
    renderBar()
    expect(hiddenNames()).toEqual([])
  })

  it('without an overflowLabel the pills just scroll: no «+N», nothing hidden', () => {
    widths({ main: 300 })
    render(
      <FilterBar
        label='Order filters'
        search={<span>search</span>}
        filters={PILLS.map(name => pill(name))}
        more={<Button>Filters</Button>}
      />
    )
    expect(bar().querySelector('.odc-filterbar-overflow')).toBeNull()
    expect(hiddenNames()).toEqual([])
    expect(bar()).not.toHaveAttribute('data-overflow-menu')
  })

  it('marks «+N» active when a pill inside it is', () => {
    widths({ main: 900 })
    render(
      <FilterBar
        label='Order filters'
        overflowLabel={overflowLabel}
        search={<span style={{ '--od-x-search-min': '180px' }}>search</span>}
        // redesign F6c: every pill has a value, so the one in «+N» is the last, not the only active one
        filters={PILLS.map(name => pill(name, { value: name === 'Business' ? 'Fast Bite' : 'on' }))}
        more={<Button>Filters</Button>}
        tools={<span>tools</span>}
      />
    )
    expect(hiddenNames()).toEqual(['Business Fast Bite'])
    expect(trigger()).toHaveAttribute('data-active', '')
  })

  it('also handles pills that are direct children of the slot (no anchor span around them)', async () => {
    const user = userEvent.setup()
    const onBusiness = vi.fn()
    widths({ main: 900 })
    render(
      <FilterBar
        label='Order filters'
        overflowLabel={overflowLabel}
        search={<span style={{ '--od-x-search-min': '180px' }}>search</span>}
        // redesign F6c: every pill has a value (an active pill is parked last)
        filters={PILLS.map(name => <FilterPill key={name} label={name} {...(name === 'Business' ? { value: 'Fast Bite', onClick: onBusiness } : { value: 'on' })} />)}
        more={<Button>Filters</Button>}
        tools={<span>tools</span>}
      />
    )
    expect(trigger()).toHaveAttribute('data-active', '')
    await user.click(screen.getByRole('button', { name: '+1 more filters' }))
    const item = await screen.findByRole('menuitem', { name: /Business/ })
    expect(item).toHaveAccessibleDescription('Fast Bite')
    await user.click(item)
    await vi.waitFor(() => expect(onBusiness).toHaveBeenCalledTimes(1))
  })

  it('lists the pills in «+N» with their value and opens each one from there', async () => {
    const user = userEvent.setup()
    const onBusiness = vi.fn()
    widths({ main: 900 })
    render(
      <FilterBar
        label='Order filters'
        overflowLabel={overflowLabel}
        search={<span style={{ '--od-x-search-min': '180px' }}>search</span>}
        filters={PILLS.map(name => name === 'Business'
          ? <span key={name}><FilterPill label={name} value='Fast Bite' onClick={onBusiness} /></span>
          : pill(name, { value: 'on' }))} // redesign F6c: every pill has a value
        more={<Button>Filters</Button>}
        tools={<span>tools</span>}
      />
    )
    await user.click(screen.getByRole('button', { name: '+1 more filters' }))
    const item = await screen.findByRole('menuitem', { name: /Business/ })
    expect(item).toHaveTextContent('Business')
    expect(item).toHaveTextContent('Fast Bite')
    await user.click(item)
    await vi.waitFor(() => expect(onBusiness).toHaveBeenCalledTimes(1))
  })

  it('renders nothing when a measure finds the same pills (a repeated measure must never loop)', () => {
    widths({ main: 900 })
    const onRender = vi.fn()
    render(
      <Profiler id='bar' onRender={onRender}>
        <FilterBar
          label='Order filters'
          overflowLabel={overflowLabel}
          search={<span style={{ '--od-x-search-min': `${WIDTHS.search}px` }}>search</span>}
          filters={PILLS.map(name => pill(name))}
          more={<Button>Filters</Button>}
          tools={<span>tools</span>}
        />
      </Profiler>
    )
    expect(hiddenNames()).toEqual(['Business'])
    onRender.mockClear()
    fireResize()
    fireResize()
    fireResize()
    expect(onRender).not.toHaveBeenCalled()
  })

  it('does not count the focus guards a popover leaves next to a pill: they are not pills', () => {
    widths({ main: 900 })
    const guard = <span key='guard' data-base-ui-focus-guard='' style={{ position: 'fixed' }} />
    render(
      <FilterBar
        label='Order filters'
        overflowLabel={overflowLabel}
        search={<span style={{ '--od-x-search-min': `${WIDTHS.search}px` }}>search</span>}
        filters={[...PILLS.slice(0, 3).map(name => pill(name)), guard, ...PILLS.slice(3).map(name => pill(name))]}
        more={<Button>Filters</Button>}
        tools={<span>tools</span>}
      />
    )
    expect(hiddenNames()).toEqual(['Business'])
    expect(bar().querySelector('[data-base-ui-focus-guard]')).not.toHaveAttribute('data-overflowed')
  })

  it('draws no text of its own: the name of «+N» comes from the prop', () => {
    widths({ main: 900 })
    renderBar({ overflowLabel: count => `${count} filtros más` })
    expect(screen.getByRole('button', { name: '1 filtros más' })).toBeInTheDocument()
  })

  it('stops observing on unmount', () => {
    const { unmount } = renderBar()
    unmount()
    expect(observers.every(observer => observer.targets.size === 0)).toBe(true)
  })
})

describe('FilterBar · one row in the stylesheet (F1b)', () => {
  const css = readFileSync(path.join(__dirname, '../filter-bar.css'), 'utf8')

  it('has no stacked layout and no 600–759px block any more', () => {
    expect(css).not.toMatch(/data-layout/)
    expect(css).not.toMatch(/'pills pills pills pills'/)
  })

  it('takes the overflowed pills out of the flow without removing them, invisible and out of the tab order', () => {
    expect(css).toMatch(/\[data-overflowed\]\s*{[^}]*position:\s*absolute/)
    expect(css).toMatch(/\[data-overflowed\]\s*{[^}]*visibility:\s*hidden/)
    expect(css).toMatch(/\[data-measuring\][^{]*\[data-overflowed\]\s*{[^}]*position:\s*static/)
  })

  it('keeps the phone layout only for a phone: the narrow container rules sit inside a max-width 767px media query', () => {
    const phone = css.match(/@container\s*\(max-width:\s*599px\)\s*{\s*@media\s*\(max-width:\s*767px\)\s*{([\s\S]*?)\n {2}}\n}/)
    expect(phone).not.toBeNull()
    expect(phone[1]).toMatch(/grid-template-areas:[^;]*'search more'[^;]*'pills pills'/)
    expect(phone[1]).toMatch(/odc-filterbar-overflow\s*{[^}]*display:\s*none/)
  })
})

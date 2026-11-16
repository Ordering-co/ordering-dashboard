import React, { useEffect, useState } from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Button } from '../Button'
import { FilterBar, FilterPill } from '../FilterBar'

// redesign F6f-1 (Q5-01, Q5-02): the first filter makes «Filters 1» and «Clear filters» appear, and the row had no
// room reserved for them. jsdom has no layout, so the widths the bar measures are stubbed, like
// FilterBar.f6e1.test.jsx; here the buttons follow their text (20px + 7px a character) so the growth of «Filters»
// to «Filters 1» and the size of «Clear filters» are real in the stub too.
const WIDTHS = { main: 0, search: 200, searchNow: 200, tools: 80 }
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
const fireResize = () => act(() => observers.forEach(observer => observer.callback([], observer)))

const widthOf = node => {
  const parent = node.parentElement
  // while the bar measures every pill is back in the row and the search is squeezed to its floor
  if (node.hasAttribute('data-search')) return node.closest('.odc-filterbar')?.hasAttribute('data-measuring') ? WIDTHS.search : WIDTHS.searchNow
  if (parent?.classList.contains('odc-filterbar-filters')) return Number(node.getAttribute('data-w')) || 100
  if (parent?.classList.contains('odc-filterbar-overflow')) {
    return node.hasAttribute('data-filterbar-overflow') || node.hasAttribute('data-filterbar-probe') ? textWidth(node) : 0
  }
  if (parent?.classList.contains('odc-filterbar-more')) {
    // the button itself, or the unseen copies the bar measures (the longest count, «Clear filters», the icon)
    return textWidth(node)
  }
  if (parent?.classList.contains('odc-filterbar-clear')) return textWidth(node)
  if (node.classList.contains('odc-filterbar-tools')) return WIDTHS.tools
  return 0
}

beforeEach(() => {
  observers = []
  Object.assign(WIDTHS, { main: 0, search: 200, searchNow: 200, tools: 80 })
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
  document.head.querySelectorAll('style[data-f6f1]').forEach(node => node.remove())
})

const overflowLabel = count => `+${count} more filters`
const overflowActiveLabel = count => `${count} active`
const bar = () => screen.getByRole('group', { name: 'Order filters' })
const rowNames = () => [...bar().querySelectorAll('.odc-filterbar-filters > :not([data-overflowed])')].map(node => node.textContent)
const parkedNames = () => [...bar().querySelectorAll('.odc-filterbar-filters > [data-overflowed]')].map(node => node.textContent)
const trigger = () => bar().querySelector('[data-filterbar-overflow]')
const offsets = () => [...bar().querySelectorAll('.odc-filterbar-filters > [data-overflowed]')].map(node => node.style.getPropertyValue('--odc-overflow-x'))

// The pill keeps its own state, like FilterPopover: the bar's owner does not render when it opens or closes. A value
// arrives from outside (`pick(name)`) as a choice made in a popover does, and a pill with a value is `wide` px.
const Pill = ({ name, base = 100, wide, initial = '' }) => {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(initial)
  useEffect(() => {
    const handler = event => { if (event.detail === name) setValue('x') }
    window.addEventListener('f6f1-pick', handler)
    return () => window.removeEventListener('f6f1-pick', handler)
  }, [name])
  return (
    <span data-w={value ? wide : base}>
      <FilterPill label={name} value={value} expanded={open} onClick={() => setOpen(current => !current)} />
    </span>
  )
}
const pick = name => act(() => { window.dispatchEvent(new CustomEvent('f6f1-pick', { detail: name })) })
const press = async name => {
  const unit = [...bar().querySelectorAll('.odc-filterbar-filters > *')].find(node => node.querySelector('.odc-pill-label').textContent === name)
  await act(async () => { unit.querySelector('button').click() })
}

const PILLS = () => [
  <Pill key='Status' name='Status' base={80} wide={100} />,
  <Pill key='SLA' name='SLA' base={80} wide={100} />,
  <Pill key='Driver' name='Driver' base={90} wide={110} />,
  <Pill key='Driver group' name='Driver group' base={100} wide={120} />,
  <Pill key='Date' name='Date' base={90} wide={110} />,
  <Pill key='Business' name='Business' base={110} wide={142} />
]

// What the orders list does: the first value makes «Filters» say its count and «Clear filters» appear.
const Harness = ({ main, reserve = true, pills = PILLS() }) => {
  const [narrowing, setNarrowing] = useState(false)
  useEffect(() => {
    const handler = () => setNarrowing(true)
    window.addEventListener('f6f1-pick', handler)
    return () => window.removeEventListener('f6f1-pick', handler)
  }, [])
  WIDTHS.main = main
  return (
    <FilterBar
      label='Order filters'
      overflowLabel={overflowLabel}
      overflowActiveLabel={overflowActiveLabel}
      moreReserve={reserve ? '99' : undefined}
      clearReserve={reserve ? 'Clear filters' : undefined}
      search={<span data-search style={{ '--od-x-search-min': `${WIDTHS.search}px` }}>search</span>}
      filters={pills}
      more={<Button>Filters{narrowing && <>{' '}<span data-filterbar-count>1</span></>}</Button>}
      clear={narrowing ? <Button variant='ghost'>Clear filters</Button> : undefined}
      tools={<span>tools</span>}
    />
  )
}

// The row as the bar measures it: the search at its floor, the pills in the row, «+N», «Filters», «Clear filters»
// and the tools, one after the other. It is what has to fit the bar: nothing is laid over anything else.
const rowWidth = () => {
  const root = bar()
  const width = node => (node ? node.getBoundingClientRect().width : 0)
  const parts = [
    WIDTHS.search,
    ...[...root.querySelectorAll('.odc-filterbar-filters > :not([data-overflowed])')].map(width),
    root.querySelector('.odc-filterbar-overflow[data-empty]') ? 0 : width(trigger()),
    width(root.querySelector('.odc-filterbar-more > *')),
    // redesign W0-4b (T0-14, decision 18): parked, «Clear filters» is not in the row (it is an entry of «+N»)
    root.hasAttribute('data-clear-parked') ? 0 : width(root.querySelector('.odc-filterbar-clear > *')),
    width(root.querySelector('.odc-filterbar-tools'))
  ]
  return parts.reduce((sum, part) => sum + part, 0)
}

// 592 = search 200 + «Filters 99» 90 + «Clear filters» 111 + «+6 · 1 active» 111 + tools 80: the pills get the rest.
const MAIN = 882

describe('FilterBar · the first filter does not move the row while a popover is open (F6f-1, Q5-02)', () => {
  it('reserves the room of «Filters N» and «Clear filters» with no filter on: the pills that fit are the ones that fit with them', () => {
    // 842 = search 200 + «Filters 99» 90 + «Clear filters» 111 + «+6 · 1 active» 111 + tools 80 + Status, SLA, Driver 250
    render(<Harness main={MAIN} />)
    expect(rowNames()).toEqual(['Status', 'SLA', 'Driver'])
    expect(parkedNames()).toEqual(['Driver group', 'Date', 'Business'])
  })

  it('a parked pill that takes the first value with its popover open leaves the row and the parked pills where they are', async () => {
    render(<Harness main={MAIN} />)
    const row = rowNames()
    const parked = parkedNames()
    const spots = offsets()
    expect(parked).toContain('Business')
    await press('Business')
    pick('Business')
    fireResize()
    await act(async () => {})
    // «Filters 1» and «Clear filters» are there now
    expect(bar().querySelector('.odc-filterbar-clear')).not.toBeNull()
    expect(rowNames()).toEqual(row)
    expect(parkedNames().map(name => name.replace(/ x$/, ''))).toEqual(parked)
    expect(offsets()).toEqual(spots)
    expect(trigger()).toHaveTextContent(/^\+\d+ · 1 active$/)
  })

  it('a pill in the row that takes the first value with its popover open leaves the row where it is', async () => {
    render(<Harness main={MAIN} />)
    const row = rowNames()
    const parked = parkedNames()
    await press('Status')
    pick('Status')
    fireResize()
    await act(async () => {})
    expect(bar().querySelector('.odc-filterbar-clear')).not.toBeNull()
    expect(rowNames().map(name => name.replace(/ x$/, ''))).toEqual(row)
    expect(parkedNames()).toEqual(parked)
  })

  it('after the popover closes the pills are placed best-fit again, the one with a value first', async () => {
    render(<Harness main={MAIN} />)
    await press('Business')
    pick('Business')
    await act(async () => {})
    await press('Business')
    // Business with its value (142) first, then the ones that still fit: Status; SLA (80) does not
    await waitFor(() => expect(rowNames()).toEqual(['Status', 'Business x']))
    expect(trigger()).toHaveTextContent(/^\+4$/)
  })

  it('holds the room of «Clear filters» with an empty box while it is not there, and gives it back when the button arrives', async () => {
    render(<Harness main={MAIN} />)
    const holder = bar().querySelector('.odc-filterbar-clear-reserve')
    expect(holder).not.toBeNull()
    expect(holder).toHaveAttribute('aria-hidden', 'true')
    expect(holder).toBeEmptyDOMElement()
    expect(holder.style.getPropertyValue('--odc-clear-reserve')).toBe('111px')
    pick('Business')
    await act(async () => {})
    expect(bar().querySelector('.odc-filterbar-clear-reserve')).toBeNull()
  })

  it('holds the room «Filters» gains with its count on the button, so the buttons after it do not move', async () => {
    render(<Harness main={MAIN} />)
    const more = () => bar().querySelector('.odc-filterbar-more > *')
    // «Filters» is 69 and «Filters 99» is 90
    expect(more().style.getPropertyValue('--odc-more-reserve')).toBe('21px')
    pick('Business')
    await act(async () => {})
    // «Filters 1» is 83: 7 left
    expect(more().style.getPropertyValue('--odc-more-reserve')).toBe('7px')
  })

  it('holds at the end of the row the room «+N» gains when a parked pill takes a value, so the search and the pills do not move', async () => {
    render(<Harness main={MAIN} />)
    const spare = () => bar().querySelector('.odc-filterbar-plus-reserve')
    expect(spare()).toHaveAttribute('aria-hidden', 'true')
    // «+3» is 34 and «+6 · 1 active» (the longest it gets) is 111
    expect(spare().style.getPropertyValue('--odc-plus-reserve')).toBe('77px')
    await press('Business')
    pick('Business')
    fireResize()
    await act(async () => {})
    expect(trigger()).toHaveTextContent('+3 · 1 active')
    expect(spare().style.getPropertyValue('--odc-plus-reserve')).toBe('0px')
  })

  it('a bar without reserves behaves as before: nothing is held', () => {
    render(<Harness main={MAIN} reserve={false} />)
    expect(bar().querySelector('.odc-filterbar-clear-reserve')).toBeNull()
    expect(bar().querySelector('.odc-filterbar-more > *').style.getPropertyValue('--odc-more-reserve')).toBe('')
    expect(rowNames()).toEqual(['Status', 'SLA', 'Driver', 'Driver group'])
  })
})

describe('FilterBar · the tools never overlap anything: they are part of the measured row (F6f-1, Q5-01)', () => {
  it('with room, «Clear filters» keeps its words and everything fits', async () => {
    render(<Harness main={MAIN} />)
    pick('Business')
    await act(async () => {})
    expect(bar()).not.toHaveAttribute('data-clear-collapsed')
    expect(rowWidth()).toBeLessThanOrEqual(MAIN)
  })

  // redesign W0-4b (T0-14, decision 18): it was an icon (F6f-1); now it goes to «+N», and the search never goes below 200px.
  it('when not even every pill in «+N» leaves room for the words of «Clear filters», it is parked and «+N» lists it', async () => {
    // 592 does not fit 560; without the words (111) the row is 481
    render(<Harness main={560} />)
    pick('Business')
    await act(async () => {})
    expect(rowNames()).toEqual([])
    expect(bar()).toHaveAttribute('data-clear-parked')
    expect(bar().querySelector('.odc-filterbar-clear > *')).not.toHaveAttribute('title')
    expect(trigger()).toHaveTextContent(/^\+6 · 1 active$/) // redesign tramo A r4 (W0-PA2-03): «+N» counts the hidden filters, not «Clear filters»
    expect(rowWidth()).toBeLessThanOrEqual(560)
  })

  it('the words come back as the bar widens, with room to spare', async () => {
    render(<Harness main={560} />)
    pick('Business')
    await act(async () => {})
    expect(bar()).toHaveAttribute('data-clear-parked')
    // the words need 592; taking them back asks for the hysteresis (24) on top: one pixel short keeps it parked
    WIDTHS.main = 592 + 24 - 1
    fireResize()
    expect(bar()).toHaveAttribute('data-clear-parked')
    // redesign tramo A r5 (W0-PA3-01): and the pill that has the value (the first of the row) must fit beside the words, with the same
    // hysteresis: they do not come back to an empty row to leave again when the pill comes in. They come back with the pill in the row.
    let back
    for (let main = 592 + 24; main <= 900 && back === undefined; main++) {
      WIDTHS.main = main
      fireResize()
      if (!bar().hasAttribute('data-clear-parked')) back = main
    }
    expect(back).toBeGreaterThanOrEqual(592 + 24)
    expect(rowNames()).toEqual(['Business x'])
    expect(rowWidth()).toBeLessThanOrEqual(WIDTHS.main)
    // fila 48: up to ~280 one-pixel resize steps, each one a full layout pass inside act(): 1.4s alone, 6.7s on a
    // loaded machine, so it gets its own budget instead of the 5s default.
  }, 30000)

  it('the room of «Clear filters» is not held while it is parked: the box that stands for it is empty, and the first filter moves nothing', async () => {
    render(<Harness main={560} />)
    const holder = bar().querySelector('.odc-filterbar-clear-reserve')
    expect(holder.style.getPropertyValue('--odc-clear-reserve')).toBe('0px')
    const row = rowNames()
    pick('Business')
    await act(async () => {})
    expect(rowNames()).toEqual(row)
    expect(bar().querySelector('.odc-filterbar-clear-reserve')).toBeNull()
  })

  it('the search never goes below its floor: when even the minimal row is too narrow, only «Clear filters» gives way', async () => {
    // the row without the words is 481: 470 cannot take it, and the search is still the 200 floor, not a lower one
    render(<Harness main={470} />)
    pick('Business')
    await act(async () => {})
    expect(bar()).toHaveAttribute('data-clear-parked')
    expect(bar()).not.toHaveAttribute('data-search-tight')
    expect(bar().querySelector('[data-search]').style.getPropertyValue('--od-x-search-min')).toBe('200px')
  })

  it('the search does not go below its floor while «Clear filters» still fits in its words', async () => {
    render(<Harness main={MAIN} />)
    pick('Business')
    await act(async () => {})
    expect(bar()).not.toHaveAttribute('data-clear-parked')
    expect(bar()).not.toHaveAttribute('data-search-tight')
  })

  it('a bar with no «Clear filters» of its own never collapses anything', () => {
    render(<Harness main={400} reserve={false} />)
    expect(bar()).not.toHaveAttribute('data-clear-collapsed')
    expect(bar()).not.toHaveAttribute('data-search-tight')
  })
})

describe('FilterBar · the search keeps its width while a popover is open (F6f-1, Q5-02)', () => {
  it('pins the width the search had when the popover opened, and lets it go when it closes', async () => {
    WIDTHS.searchNow = 250
    // the row has four pills (350): with the search at 250 it is 992, 1012 when Status takes its value; the bar is 1020
    render(<Harness main={1020} />)
    const search = () => bar().querySelector('[data-search]')
    expect(search()).not.toHaveAttribute('data-pinned')
    await press('Status')
    await act(async () => {})
    expect(search()).toHaveAttribute('data-pinned')
    expect(search().style.getPropertyValue('--odc-search-pin')).toBe('250px')
    pick('Status')
    fireResize()
    await act(async () => {})
    expect(search().style.getPropertyValue('--odc-search-pin')).toBe('250px')
    await press('Status')
    await waitFor(() => expect(search()).not.toHaveAttribute('data-pinned'))
  })

  it('when the pill that is open grows past the room, «Clear filters», at the right of it, goes to «+N» before the search gives way (W0-4b)', async () => {
    WIDTHS.searchNow = 250
    // the row has four pills (350), the search at 250: 992; Status taking a 140px value (60 more) makes 1052 of 1020:
    // with «Clear filters» as an icon (32 instead of 111) it is 973
    const [, ...rest] = PILLS()
    render(<Harness main={1020} pills={[<Pill key='Status' name='Status' base={80} wide={140} />, ...rest]} />)
    const search = () => bar().querySelector('[data-search]')
    await press('Status')
    pick('Status')
    fireResize()
    await act(async () => {})
    expect(search()).toHaveAttribute('data-pinned')
    expect(search().style.getPropertyValue('--odc-search-pin')).toBe('250px')
    expect(bar()).toHaveAttribute('data-clear-parked')
    // closed: the words come back and the search is free
    await press('Status')
    await waitFor(() => expect(bar()).not.toHaveAttribute('data-clear-parked'))
    expect(search()).not.toHaveAttribute('data-pinned')
  })

  it('does not hold the search wider than the row can take: it goes back to its floor and the pills stay', async () => {
    // the search is 340 now; the row with the search at its floor fits (842), with it at 340 it does not, not even
    // with «Clear filters» as an icon (842 + 140 - 79 + 20 > 882)
    WIDTHS.searchNow = 340
    render(<Harness main={MAIN} />)
    const row = rowNames()
    await press('Status')
    pick('Status')
    fireResize()
    await act(async () => {})
    expect(rowNames().map(name => name.replace(/ x$/, ''))).toEqual(row)
    expect(bar().querySelector('[data-search]')).not.toHaveAttribute('data-pinned')
  })
})

describe('FilterBar · stylesheet of the reserve and the collapse (F6f-1)', () => {
  const css = readFileSync(path.resolve(__dirname, '../filter-bar.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

  it('the placeholder of «Clear filters» and the room of «Filters» come from the measured custom properties', () => {
    expect(css).toMatch(/\.odc-filterbar-clear-reserve\s*\{[^}]*inline-size:\s*var\(--odc-clear-reserve/)
    expect(css).toMatch(/\.odc-filterbar-more\s*>\s*\*[^{]*\{[^}]*margin-inline-end:\s*var\(--odc-more-reserve/)
  })

  it('the room held for «+N» is a box at the end of the row that cancels the gap before it', () => {
    expect(css).toMatch(/\.odc-filterbar-plus-reserve\s*\{[^}]*inline-size:\s*var\(--odc-plus-reserve[^}]*margin-inline-start:\s*calc\(var\(--od-space-2\) \* -1\)/)
  })

  it('the pinned search is a fixed basis from its custom property', () => {
    expect(css).toMatch(/\.odc-filterbar-search\s*>\s*\[data-pinned\]\s*\{[^}]*flex:\s*0 0 var\(--odc-search-pin/)
  })

  // redesign W0-4b (T0-14): the icon of «Clear filters» and the lower floor of the search are gone (decision 18); their
  // stylesheet is checked, as gone and as the parked button, in FilterBar.w04b.test.jsx.
})

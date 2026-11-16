import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Button } from '../Button'
import { FilterBar, FilterPill } from '../FilterBar'
import { POSITION, WIDTHS, installFilterBarLayout, resize } from './filterBarLayout'

// redesign W0-4b (T0-14, decision 18; D-25, D-26, D-27): with the order panel open the list is narrow, and «Clear filters»
// goes to «+N» (one more entry, with its action) before the search goes below 200px. jsdom has no layout, so the widths the
// bar measures are stubbed, like FilterBar.f6f1.test.jsx: the buttons follow their text (20px + 7px a character), the pills
// carry theirs in `data-w`, the search is its floor (200) and the tools are 80. The stubs are shared: ./filterBarLayout.js.
installFilterBarLayout({ styleMarker: 'data-w04b' })

const overflowLabel = count => `+${count} more filters`
const overflowActiveLabel = count => `${count} active`
const bar = () => screen.getByRole('group', { name: 'Order filters' })
const rowNames = () => [...bar().querySelectorAll('.odc-filterbar-filters > :not([data-overflowed])')].map(node => node.textContent)
const parkedNames = () => [...bar().querySelectorAll('.odc-filterbar-filters > [data-overflowed]')].map(node => node.textContent)
const trigger = () => bar().querySelector('[data-filterbar-overflow]')
const clearButton = () => bar().querySelector('.odc-filterbar-clear > *')
const parked = () => bar().hasAttribute('data-clear-parked')

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
// What the list does when a filter is set outside the pills (the sheet): «Filters N» says how many, «Clear filters» appears.
const narrow = count => act(() => { window.dispatchEvent(new CustomEvent('w04b-count', { detail: count })) })

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

// The row as the bar measures it: the search at its floor, the pills in the row, «+N» (when it is there or holds its place),
// «Filters», «Clear filters» (when it is in the row) and the tools. It is what has to fit the bar.
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

// 592 = search 200 + «Filters 99» 90 + «Clear filters» 111 + «+7 · 1 active» 111 + tools 80 (the minimal row: every pill in
// «+N»). Without the words of «Clear filters» it is 481. PANEL (590) is a list beside the open order: it does not take the
// words, and not even one pill.
const PANEL = 590

describe('FilterBar · «Clear filters» goes to «+N» before the search goes below 200px (W0-4b, T0-14, decision 18)', () => {
  it('with room for its words, it stays in the row and «+N» holds no entry for it', async () => {
    render(<Harness main={900} />)
    await narrow(1)
    expect(parked()).toBe(false)
    expect(trigger()).not.toHaveTextContent(/\+7/)
    expect(rowWidth()).toBeLessThanOrEqual(900)
  })

  it('with the order panel open (a narrow list) and one filter, it is one more entry of «+N» and the row fits with the search at 200', async () => {
    render(<Harness main={PANEL} />)
    await narrow(1)
    expect(parked()).toBe(true)
    // six pills in «+N» (not even one fits with the words reserved), and «Clear filters»
    expect(rowNames()).toEqual([])
    expect(parkedNames()).toHaveLength(6)
    // redesign tramo A r4 (W0-PA2-03, WCAG 2.5.3): r2 showed «+7» and read «+6 more filters» (the name did not contain the visible
    // text). Now both count the hidden FILTERS: «Clear filters» parked beside them does not change the number
    expect(trigger()).toHaveTextContent(/^\+6$/)
    expect(trigger()).toHaveAttribute('aria-label', '+6 more filters')
    expect(trigger().getAttribute('aria-label')).toContain(trigger().textContent)
    // the search is its 200 floor: nothing is squeezed and nothing is laid over anything
    expect(rowWidth()).toBeLessThanOrEqual(PANEL)
    expect(bar()).not.toHaveAttribute('data-search-tight')
    expect(bar().querySelector('[data-search]').style.getPropertyValue('--od-x-search-min')).toBe('200px')
  })

  // redesign tramo A r4 (W0-PA2-03, WCAG 2.5.3): with a hidden filter that has a value, the visible text «+6 · 1 active» is inside the name
  it('with an active filter in «+N» and «Clear filters» parked, the accessible name contains the visible text and both say 6', async () => {
    render(<Harness main={PANEL} />)
    pick('Business')
    await narrow(1)
    expect(parked()).toBe(true)
    expect(trigger()).toHaveTextContent(/^\+6 · 1 active$/)
    expect(trigger()).toHaveAttribute('aria-label', '+6 · 1 active: +6 more filters')
    expect(trigger().getAttribute('aria-label')).toContain(trigger().textContent)
  })

  // redesign tramo A r4 (W0-QA2-07): the pill with a value is not parked by its own value. Without the panel at 1024-1279 «Status ·
  // Completed by admin» did not fit beside the words of «Clear filters» and went to «+N» itself.
  it.each([660, 700])('the pill with the value stays in the row at %i and «Clear filters» goes to «+N» for it', async (main) => {
    render(<Harness main={main} />)
    pick('Business')
    await narrow(1)
    expect(rowNames()).toEqual(['Business x'])
    expect(parked()).toBe(true)
    expect(rowWidth()).toBeLessThanOrEqual(main)
  })

  it('lists «Clear filters» last in the menu, and choosing it presses the button the owner drew', async () => {
    const onClear = vi.fn()
    const user = userEvent.setup()
    render(<Harness main={PANEL} onClear={onClear} />)
    await narrow(1)
    await user.click(trigger())
    const items = await screen.findAllByRole('menuitem')
    expect(items.map(item => item.textContent)).toEqual([
      'Status', 'SLA', 'Driver', 'Driver group', 'Date', 'Business', 'Clear filters'
    ].map(name => expect.stringContaining(name)))
    await user.click(screen.getByRole('menuitem', { name: 'Clear filters' }))
    await vi.waitFor(() => expect(onClear).toHaveBeenCalledTimes(1))
  })

  it('without a filter, nothing is listed for it: «+N» counts only the pills, and the menu has no entry for it', async () => {
    const user = userEvent.setup()
    render(<Harness main={PANEL} />)
    expect(parked()).toBe(true)
    expect(trigger()).toHaveTextContent(/^\+6$/)
    await user.click(trigger())
    expect(await screen.findAllByRole('menuitem')).toHaveLength(6)
    expect(screen.queryByRole('menuitem', { name: 'Clear filters' })).toBeNull()
  })

  it('takes its words back with the hysteresis, and the pills come in after them, never the other way round', async () => {
    render(<Harness main={PANEL} />)
    await narrow(1)
    expect(parked()).toBe(true)
    // the minimal row with the words is 592; taking them back asks for the hysteresis (24) on top
    resize(592 + 24 - 1)
    expect(parked()).toBe(true)
    resize(592 + 24)
    expect(parked()).toBe(false)
    expect(rowNames()).toEqual([])
    // the first pill (Status, 80) comes in with its own hysteresis; the words stay
    resize(592 + 80 + 24 - 1)
    expect(rowNames()).toEqual([])
    resize(592 + 80 + 24)
    expect(rowNames()).toEqual(['Status'])
    expect(parked()).toBe(false)
    expect(rowWidth()).toBeLessThanOrEqual(WIDTHS.main)
  })

  it('the focus that was on «Clear filters» goes to «+N» when it leaves the row', async () => {
    render(<Harness main={900} />)
    await narrow(1)
    clearButton().focus()
    expect(document.activeElement).toBe(clearButton())
    resize(PANEL)
    expect(parked()).toBe(true)
    expect(document.activeElement).toBe(trigger())
  })

  it('a bar that keeps no room for «Clear filters» (no `clearReserve`) and has none drawn parks nothing', () => {
    render(<Harness main={400} reserve={false} />)
    expect(parked()).toBe(false)
  })

  it('a phone keeps its own row of pills and no «+N»: nothing is parked', async () => {
    const style = document.createElement('style')
    style.setAttribute('data-w04b', '')
    style.textContent = '.odc-filterbar-overflow { display: none; }'
    document.head.appendChild(style)
    render(<Harness main={PANEL} />)
    await narrow(1)
    expect(parked()).toBe(false)
  })
})

describe('FilterBar · the first filter, and one more, never change what fits (W0-4b, the trap of F1b: 0 to 1 and n to n+1)', () => {
  const widthsToTry = []
  for (let main = 420; main <= 1100; main += 20) widthsToTry.push(main)

  const snapshot = () => ({
    row: rowNames(),
    parked: parkedNames(),
    clear: parked(),
    layout: rowWidth() <= WIDTHS.main
  })

  it.each(widthsToTry)('at %ipx: no filter, one, two, nine and ten leave the same pills in the row, the same in «+N» and «Clear filters» where it was', async main => {
    render(<Harness main={main} />)
    const none = snapshot()
    await narrow(1)
    const one = snapshot()
    expect(one).toEqual(none)
    for (const count of [2, 9, 10, 11]) {
      await narrow(count)
      expect(snapshot()).toEqual(one)
    }
    await narrow(0)
    expect(snapshot()).toEqual(none)
  })

  it('«+N» keeps its width, and its number, when «Clear filters» becomes one more of its entries (W0-PA2-03: the number counts filters)', async () => {
    render(<Harness main={PANEL} />)
    const width = () => trigger().getBoundingClientRect().width
    const before = width()
    await narrow(1)
    expect(trigger()).toHaveTextContent(/^\+6$/)
    expect(width()).toBe(before)
  })

  it('the digit «+N» could gain (9 pills and «Clear filters» are 10 entries) is held at the end of the row, and «+N» says +9 (W0-PA2-03)', async () => {
    const nine = () => Array.from({ length: 9 }, (_, index) => <Pill key={index} name={`P${index}`} base={100} wide={100} />)
    render(<Harness main={PANEL} pills={nine()} />)
    expect(trigger()).toHaveTextContent(/^\+9$/)
    const width = trigger().getBoundingClientRect().width
    const held = Number.parseFloat(bar().querySelector('.odc-filterbar-plus-reserve').style.getPropertyValue('--odc-plus-reserve'))
    await narrow(1)
    expect(trigger()).toHaveTextContent(/^\+9$/)
    // the held room (7px for the longest label) is more than the nothing «+N» grows now
    expect(trigger().getBoundingClientRect().width - width).toBeLessThanOrEqual(held)
  })
})

describe('FilterBar · widening a few px at a time never takes a pill out of the row (W0-4b, D-26)', () => {
  const sweep = (from, to, step) => {
    const list = []
    for (let main = from; to > from ? main <= to : main >= to; main += to > from ? step : -step) list.push(main)
    return list
  }

  it.each([
    ['with no filter', 0],
    ['with a filter', 1]
  ])('%s: from 400 to 1500 in steps of 10px, no pill that is in the row leaves it', async (_, count) => {
    render(<Harness main={400} />)
    if (count) await narrow(count)
    let row = new Set(rowNames())
    const events = []
    for (const main of sweep(410, 1500, 10)) {
      resize(main)
      const next = new Set(rowNames())
      const left = [...row].filter(name => !next.has(name))
      if (left.length > 0) events.push(`${main}: ${left.join(', ')} left`)
      row = next
    }
    expect(events).toEqual([])
  }, 30000)

  it('narrowing, in the same steps (10px), no pill that is out of the row comes in', async () => {
    render(<Harness main={1500} />)
    await narrow(1)
    let row = new Set(rowNames())
    const events = []
    for (const main of sweep(1490, 400, 10)) {
      resize(main)
      const next = new Set(rowNames())
      const came = [...next].filter(name => !row.has(name))
      if (came.length > 0) events.push(`${main}: ${came.join(', ')} came in`)
      row = next
    }
    expect(events).toEqual([])
  }, 30000)

  it('the pills that fit are the same widening in steps as in one jump, for the widths where the row is full', async () => {
    // Business (142) is wide: placing the row again at every step would swap it for Date and Driver group and back
    const pills = () => [
      <Pill key='A' name='A' base={100} wide={100} />,
      <Pill key='B' name='B' base={60} wide={60} />,
      <Pill key='C' name='C' base={100} wide={100} />,
      <Pill key='D' name='D' base={60} wide={60} />
    ]
    render(<Harness main={700} pills={pills()} />)
    const seen = []
    for (const main of sweep(700, 1100, 5)) {
      resize(main)
      seen.push(rowNames().join(''))
    }
    // it only ever gains letters: each row contains the one before
    seen.reduce((before, next) => {
      expect([...before].every(letter => next.includes(letter)), `${before} then ${next}`).toBe(true)
      return next
    })
  })
})

describe('FilterBar · a popover of «+N» that is open follows «+N» when the bar changes width (W0-4b, D-27)', () => {
  it('the parked pill with the popover open is moved to where «+N» is now, and nothing else changes', async () => {
    render(<Harness main={1000} />)
    const unit = () => [...bar().querySelectorAll('.odc-filterbar-filters > [data-overflowed]')].find(node => node.querySelector('.odc-pill-label').textContent === 'Business')
    expect(unit()).toBeTruthy()
    const row = rowNames()
    const names = parkedNames()
    await press('Business')
    expect(unit().querySelector('button')).toHaveAttribute('aria-expanded', 'true')
    expect(unit().style.getPropertyValue('--odc-overflow-x')).toBe(`${1000 - 300}px`)
    // a value is marked in the popover, as the user does: «+N» says «1 active» and the pill stays where it is
    pick('Business')
    resize(985)
    // «+N» is at 685 now: the anchor of the popover goes with it, the pills in the row and in «+N» stay as they were
    expect(unit()).toHaveAttribute('data-overflowed')
    expect(unit().style.getPropertyValue('--odc-overflow-x')).toBe(`${985 - 300}px`)
    expect(rowNames()).toEqual(row)
    expect(parkedNames().map(name => name.replace(/ x$/, ''))).toEqual(names)
    resize(1100)
    expect(unit().style.getPropertyValue('--odc-overflow-x')).toBe(`${1100 - 300}px`)
  })

  it('in right-to-left it follows the right edge of «+N»', async () => {
    const style = document.createElement('style')
    style.setAttribute('data-w04b', '')
    style.textContent = '.odc-filterbar-start { direction: rtl; }'
    document.head.appendChild(style)
    render(<Harness main={1000} />)
    await press('Business')
    const unit = [...bar().querySelectorAll('.odc-filterbar-filters > [data-overflowed]')].find(node => node.textContent === 'Business')
    // the origin's right edge is its width (0 here) and «+N» ends at left + its width
    const before = unit.style.getPropertyValue('--odc-overflow-x')
    resize(940)
    expect(unit.style.getPropertyValue('--odc-overflow-x')).not.toBe(before)
  })
})

describe('FilterBar · a pill that takes the focus in a row that scrolls comes into view (W0-4b, D-25)', () => {
  const scrollIntoView = vi.fn()
  beforeEach(() => {
    scrollIntoView.mockClear()
    Element.prototype.scrollIntoView = scrollIntoView
  })
  afterEach(() => { delete Element.prototype.scrollIntoView })

  const scroller = () => {
    const style = document.createElement('style')
    style.setAttribute('data-w04b', '')
    style.textContent = '.odc-filterbar-filters { overflow-x: auto; }'
    document.head.appendChild(style)
  }

  it('scrolls the focused pill to the nearest edge, clear of the fade, when the slot is a scroller', () => {
    scroller()
    render(<Harness main={PANEL} />)
    const button = bar().querySelector('.odc-filterbar-filters button')
    act(() => { button.focus() })
    expect(scrollIntoView).toHaveBeenCalledWith({ inline: 'nearest', block: 'nearest' })
    expect(scrollIntoView.mock.contexts[0]).toBe(button)
  })

  it('does nothing when the row does not scroll (the pills of the desktop row)', () => {
    render(<Harness main={900} />)
    act(() => { bar().querySelector('.odc-filterbar-filters button').focus() })
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('does not follow the focus of what is inside a popover (it is portaled, but React bubbles it through the pill)', () => {
    scroller()
    const Popover = () => (
      <>
        <Pill name='Business' base={100} wide={100} />
        {createPortal(<input aria-label='inside the popover' />, document.body)}
      </>
    )
    render(<Harness main={PANEL} pills={[<Popover key='p' />]} />)
    scrollIntoView.mockClear()
    act(() => { screen.getByLabelText('inside the popover').focus() })
    expect(scrollIntoView).not.toHaveBeenCalled()
  })
})

describe('FilterBar · stylesheet (W0-4b)', () => {
  const strip = file => readFileSync(path.resolve(__dirname, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const css = strip('../filter-bar.css')

  it('the search keeps the bar\'s floor of 200px and there is no lower one for the last resort any more', () => {
    expect(css).toMatch(/\.odc-filterbar\s*\{[^}]*--od-x-search-min:\s*var\(--od-x-filterbar-search-min\)/)
    expect(strip('../../../../../../../../../brand/candidates.css')).toMatch(/--od-x-filterbar-search-min:\s*200px/)
    expect(css).not.toMatch(/data-search-tight/)
    expect(css).not.toMatch(/data-clear-collapsed/)
  })

  it('«Clear filters» parked is invisible and untouchable, and back in its row while the bar measures', () => {
    expect(css).toMatch(/\.odc-filterbar\[data-clear-parked\]\s*\.odc-filterbar-clear\s*>\s*\*\s*\{[^}]*position:\s*absolute[^}]*visibility:\s*hidden[^}]*pointer-events:\s*none/)
    expect(css).toMatch(/\.odc-filterbar\[data-measuring\]\s*\.odc-filterbar-clear\s*>\s*\*\s*\{[^}]*position:\s*static[^}]*visibility:\s*visible/)
  })

  it('the row of pills that scrolls keeps the fade\'s room for a focused pill', () => {
    expect(strip('../overflow-fade.css')).toMatch(/\.odc-fade-x\s*\{[^}]*scroll-padding-inline:\s*var\(--od-x-fade-size\)/)
  })
})

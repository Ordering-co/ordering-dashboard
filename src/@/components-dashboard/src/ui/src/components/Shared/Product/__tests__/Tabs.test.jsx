import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TabPanel, Tabs } from '../Tabs'

const ITEMS = [
  { value: 'pending', label: 'Pending', count: 3, countLabel: '3 pending orders', attention: true },
  { value: 'progress', label: 'In progress', count: 12, countLabel: '12 orders in progress' },
  { value: 'done', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' }
]

const setup = ({ value = 'pending', items = ITEMS, dir, ...props } = {}) => {
  const onValueChange = vi.fn()
  const ui = (
    <div dir={dir}>
      <Tabs value={value} onValueChange={onValueChange} label='Order status' items={items} dir={dir} {...props}>
        <TabPanel value={value}>Orders of {value}</TabPanel>
      </Tabs>
    </div>
  )
  const view = render(ui)
  return { onValueChange, ...view }
}

const tabs = () => screen.getAllByRole('tab')

describe('Product Tabs', () => {
  it('exposes tablist, tab and tabpanel with their names', () => {
    setup()
    expect(screen.getByRole('tablist', { name: 'Order status' })).toBeInTheDocument()
    expect(tabs()).toHaveLength(4)
    expect(screen.getByRole('tab', { name: /^In progress/ })).toBeInTheDocument()
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Orders of pending')
  })

  it('marks only the current tab as selected, with a roving tabindex', () => {
    setup({ value: 'progress' })
    const [pending, progress, done, cancelled] = tabs()
    expect(progress).toHaveAttribute('aria-selected', 'true')
    for (const other of [pending, done, cancelled]) expect(other).toHaveAttribute('aria-selected', 'false')
    expect(progress).toHaveAttribute('tabindex', '0')
    for (const other of [pending, done, cancelled]) expect(other).toHaveAttribute('tabindex', '-1')
  })

  it('moves focus with arrows, Home and End without activating', async () => {
    const user = userEvent.setup()
    const { onValueChange } = setup()
    const [pending, progress, done, cancelled] = tabs()
    await user.tab()
    expect(pending).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(progress).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(done).toHaveFocus()
    await user.keyboard('{End}')
    expect(cancelled).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(done).toHaveFocus()
    await user.keyboard('{Home}')
    expect(pending).toHaveFocus()
    expect(onValueChange).not.toHaveBeenCalled()
    expect(pending).toHaveAttribute('aria-selected', 'true')
  })

  it('activates the focused tab with Enter and with Space', async () => {
    const user = userEvent.setup()
    const { onValueChange } = setup()
    await user.tab()
    await user.keyboard('{ArrowRight}{Enter}')
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange).toHaveBeenLastCalledWith('progress')
    await user.keyboard('{ArrowRight} ')
    expect(onValueChange).toHaveBeenCalledTimes(2)
    expect(onValueChange).toHaveBeenLastCalledWith('done')
  })

  it('activates on arrow focus only when asked to', async () => {
    const user = userEvent.setup()
    const { onValueChange } = setup({ activateOnFocus: true })
    await user.tab()
    await user.keyboard('{ArrowRight}')
    expect(onValueChange).toHaveBeenLastCalledWith('progress')
  })

  it('inverts the arrows in RTL', async () => {
    const user = userEvent.setup()
    const { onValueChange } = setup({ dir: 'rtl' })
    const [pending, progress] = tabs()
    await user.tab()
    expect(pending).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(progress).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(pending).toHaveFocus()
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('takes the direction from useProductDir when no dir prop is given', async () => {
    const user = userEvent.setup()
    document.documentElement.dir = 'rtl'
    try {
      setup()
      const [pending, progress] = tabs()
      await user.tab()
      await user.keyboard('{ArrowLeft}')
      expect(progress).toHaveFocus()
      expect(pending).not.toHaveFocus()
    } finally {
      document.documentElement.removeAttribute('dir')
    }
  })

  it('keeps the arrows natural in LTR', async () => {
    const user = userEvent.setup()
    setup({ dir: 'ltr' })
    const [pending, progress] = tabs()
    await user.tab()
    await user.keyboard('{ArrowRight}')
    expect(progress).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(pending).toHaveFocus()
  })

  it('skips a disabled tab', async () => {
    const user = userEvent.setup()
    const items = ITEMS.map(item => item.value === 'progress' ? { ...item, disabled: true } : item)
    const { onValueChange } = setup({ items })
    const [pending, progress, done] = tabs()
    expect(progress).toBeDisabled()
    expect(progress).toHaveAttribute('aria-disabled', 'true')
    await user.tab()
    expect(pending).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(done).toHaveFocus()
    await user.click(progress)
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('reads the count with its meaning and draws nothing without one', () => {
    setup()
    const [pending, progress, done] = tabs()
    expect(pending).toHaveAccessibleName('Pending 3 pending orders')
    expect(progress).toHaveAccessibleName('In progress 12 orders in progress')
    expect(pending.querySelector('.odc-count')).toHaveAttribute('data-attention')
    expect(progress.querySelector('.odc-count')).not.toHaveAttribute('data-attention')
    expect(done.querySelector('.odc-count')).toBeNull()
    expect(done).toHaveAccessibleName('Completed')
  })

  it('draws a zero count', () => {
    setup({ items: [{ value: 'a', label: 'Alpha', count: 0, countLabel: 'none' }], value: 'a' })
    expect(screen.getByRole('tab')).toHaveAccessibleName('Alpha none')
  })

  it('refuses a tablist without a label', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Tabs value='pending' onValueChange={() => {}} items={ITEMS} />)).toThrow('Tabs needs a label')
  })

  it('ties a single panel with the current value to the active tab', () => {
    const { rerender, onValueChange } = setup()
    const panel = screen.getByRole('tabpanel')
    expect(panel).toHaveAttribute('aria-labelledby', tabs()[0].id)
    expect(panel).toHaveAccessibleName(/^Pending/)
    rerender(
      <div>
        <Tabs value='done' onValueChange={onValueChange} label='Order status' items={ITEMS}>
          <TabPanel value='done'>Orders of done</TabPanel>
        </Tabs>
      </div>
    )
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Orders of done')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', tabs()[2].id)
  })

  it('has no text of its own', () => {
    setup({ items: [{ value: 'pending', label: 'Pending' }, { value: 'done', label: 'Done' }] })
    expect(screen.getByRole('tablist')).toHaveTextContent(/^PendingDone$/)
  })

  it('sizes the list with data-size', () => {
    setup({ size: 'sm' })
    expect(screen.getByRole('tablist')).toHaveAttribute('data-size', 'sm')
  })

  // redesign F6d-4b (Q3-04): the count sits in a slot of fixed room, so the tabs beside do not slide when the totals arrive
  // or change; the numbers are tabular so two digits take the same room whichever they are.
  describe('count slot and focus room (redesign F6d-4b)', () => {
    const css = readFileSync(resolve(__dirname, '../tabs.css'), 'utf8')
    const rule = selector => {
      const escaped = selector.replace(/[.[\]()]/g, '\\$&')
      return [...css.matchAll(new RegExp(`(?:^|\\n|,\\s*)${escaped}\\s*(?:,[^{]*)?\\{([^}]*)\\}`, 'g'))].map(match => match[1]).join('\n')
    }

    it('draws each count inside a slot, and a tab without a count has none', () => {
      setup()
      const [pending, progress, done] = tabs()
      expect(pending.querySelector('.odc-tab-count-slot .odc-count')).toHaveTextContent('3')
      expect(progress.querySelector('.odc-tab-count-slot .odc-count')).toHaveTextContent('12')
      expect(done.querySelector('.odc-tab-count-slot')).toBeNull()
    })

    it('keeps the slot when the count is a loading skeleton, so the width is the same before and after', () => {
      setup({ items: [{ value: 'pending', label: 'Pending', count: <span className='odc-skeleton' /> }] })
      expect(tabs()[0].querySelector('.odc-tab-count-slot .odc-skeleton')).not.toBeNull()
    })

    it('does not change the accessible name of a tab', () => {
      setup()
      expect(screen.getByRole('tab', { name: 'Pending 3 pending orders' })).toBeInTheDocument()
    })

    // redesign F6e-3 (Q4-04): the slot no longer reserves three digits for every count (a «Chat 1» left about 20px of air): it
    // fits its digits, tabular, and keeps room for two only in a list whose counts have been on their way (see below).
    it('fits the digits of the count with tabular figures, and reserves nothing by itself', () => {
      const body = rule('.odc-tab-count-slot')
      expect(body).not.toMatch(/min-inline-size/)
      expect(body).toMatch(/font-variant-numeric:\s*tabular-nums/)
      expect(body).toMatch(/font-size:\s*var\(--od-x-type-caption-size\)/)
      // the weight of the chip, so a selected (semibold) tab does not make its slot wider than the others
      expect(body).toMatch(/font-weight:\s*var\(--od-font-weight-medium\)/)
    })

    it('reserves room for two digits only when a list has counts that were loading', () => {
      expect(rule('.odc-tab-count-slot[data-reserve]')).toMatch(/min-inline-size:\s*var\(--od-x-tab-count-reserve\)/)
      const candidates = readFileSync(resolve(__dirname, '../../../../../../../../../brand/candidates.css'), 'utf8')
      expect(candidates).toMatch(/--od-x-tab-count-reserve:\s*calc\(2\.4ch \+ 2 \* var\(--od-x-space-1-5\)\)/)
    })

    it('gives the focus ring room around the label without moving the tabs or changing their height', () => {
      const tab = rule('.odc-tab')
      // 4px of padding that a negative margin of the same size gives back, so the label stays where it was.
      expect(tab).toMatch(/padding:\s*0\s+var\(--od-space-1\)/)
      expect(tab).toMatch(/margin:\s*0\s+calc\(var\(--od-space-1\)\s*\*\s*-1\)/)
      expect(tab).toMatch(/block-size:\s*var\(--od-x-tab-height\)/)
      // the first and the last tab overhang into room the list keeps for it, so the ring is not clipped at the edges
      const list = rule('.odc-tabs-list')
      expect(list).toMatch(/padding-inline:\s*var\(--od-space-1\)/)
      expect(list).toMatch(/margin-inline:\s*calc\(var\(--od-space-1\)\s*\*\s*-1\)/)
      // its hairline is a background 4px shorter on each side, so it spans the content as before
      expect(list).toMatch(/border-block-end:\s*var\(--od-x-hairline\)\s+solid\s+transparent/)
      expect(list).toMatch(/linear-gradient\(var\(--od-border\),\s*var\(--od-border\)\)[^;]*calc\(100% - 2 \* var\(--od-space-1\)\)/)
      // the ring stays inset (C3: the outside gets clipped by the scroll container)
      expect(rule('.odc-tab:focus-visible')).toMatch(/outline-offset:\s*var\(--od-x-focus-inset\)/)
    })

    it('draws the selected underline under the label only, not under the padding', () => {
      expect(css).toMatch(/\.odc-tab\[aria-selected='true'\]::after\s*\{[^}]*inset-inline:\s*var\(--od-space-1\)/)
    })
  })
})

// redesign F6e-3 (Q4-04): the room of a count follows what it is. A tab with a count that is known takes its digits and nothing
// more (the chat of the order panel: «Chat 1»). A list whose counts arrive later (they show as a placeholder first) keeps the
// room of two digits, from the placeholder on and after the numbers are there, so their arrival does not move the tabs; it may
// grow by a digit when a count has three (rare). Nothing is reserved for a list that never had a placeholder.
describe('Tabs count room (redesign F6e-3)', () => {
  const loading = <span className='odc-skeleton' />
  const slots = () => Array.from(document.querySelectorAll('.odc-tab-count-slot'))
  const view = items => (
    <Tabs value='a' onValueChange={() => {}} label='Status' items={items}>
      <TabPanel value='a'>A</TabPanel>
    </Tabs>
  )

  it('reserves nothing for counts that are known from the start (the chat of the order panel)', () => {
    render(view([{ value: 'a', label: 'Details' }, { value: 'chat', label: 'Chat', count: 1, countLabel: '1 unread message' }]))
    expect(slots()).toHaveLength(1)
    expect(slots()[0]).not.toHaveAttribute('data-reserve')
  })

  it('reserves the room of two digits from the placeholder on, and keeps it when the numbers arrive', () => {
    const { rerender } = render(view([{ value: 'a', label: 'Pending', count: loading }, { value: 'b', label: 'Done', count: loading }]))
    expect(slots()).toHaveLength(2)
    slots().forEach(slot => expect(slot).toHaveAttribute('data-reserve', ''))
    rerender(view([{ value: 'a', label: 'Pending', count: 3 }, { value: 'b', label: 'Done', count: 743 }]))
    expect(slots().map(slot => slot.textContent)).toEqual(['3', '743'])
    slots().forEach(slot => expect(slot).toHaveAttribute('data-reserve', ''))
  })

  it('reserves it for a count that is unavailable («—») in a list that was loading', () => {
    const { rerender } = render(view([{ value: 'a', label: 'Pending', count: loading }]))
    rerender(view([{ value: 'a', label: 'Pending', count: '—' }]))
    expect(slots()[0]).toHaveAttribute('data-reserve', '')
  })

  it('a list whose counts are known at its first paint never reserves, even if one later changes', () => {
    const { rerender } = render(view([{ value: 'a', label: 'Pending', count: 3 }]))
    rerender(view([{ value: 'a', label: 'Pending', count: 12 }]))
    expect(slots()[0]).not.toHaveAttribute('data-reserve')
  })
})

// redesign reviews FA1 (D2, coordinador: opción c): `wrap` is an opt-in prop. Without it the tabs are what they were (one
// row that scrolls and fades); with it they break into several lines, with no scroller, no fade and no extra control.
describe('Tabs wrap (redesign reviews FA1)', () => {
  const css = readFileSync(resolve(__dirname, '../tabs.css'), 'utf8')
  const view = (props = {}) => render(
    <Tabs value='progress' onValueChange={() => {}} label='Order status' items={ITEMS} {...props}>
      <TabPanel value='progress'>Panel</TabPanel>
    </Tabs>
  )

  it('without wrap the markup is the one of today: no data-wrap, the same classes, the fade on the list', () => {
    const { container } = view()
    expect(container.querySelector('[data-wrap]')).toBeNull()
    expect(container.firstChild).toHaveAttribute('class', 'odc-root odc-tabs')
    const list = screen.getByRole('tablist')
    expect(list).toHaveAttribute('class', 'odc-tabs-list odc-fade-x')
    expect(list).toHaveAttribute('data-size', 'md')
    expect(tabs().every(tab => tab.getAttribute('class').split(' ').includes('odc-tab'))).toBe(true)
  })

  it('wrap={false} is the same as not passing it', () => {
    const { container } = view({ wrap: false })
    expect(container.querySelector('[data-wrap]')).toBeNull()
    expect(screen.getByRole('tablist')).toHaveAttribute('class', 'odc-tabs-list odc-fade-x')
  })

  it('with wrap the container of the tablist says data-wrap and the list loses the sideways fade', () => {
    const { container } = view({ wrap: true })
    expect(container.firstChild).toHaveAttribute('data-wrap', 'true')
    expect(container.querySelectorAll('[data-wrap]')).toHaveLength(1)
    const list = screen.getByRole('tablist')
    expect(list).not.toHaveClass('odc-fade-x')
    expect(list).toHaveClass('odc-tabs-list')
    expect(list).not.toHaveAttribute('data-overflow-start')
    expect(list).not.toHaveAttribute('data-overflow-end')
  })

  it('with wrap there is one tablist, the same tabs, and nothing that scrolls: no arrow buttons, no select', () => {
    const { container } = view({ wrap: true })
    expect(screen.getAllByRole('tablist')).toHaveLength(1)
    expect(tabs()).toHaveLength(4)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(container.querySelector('.odc-fade-x')).toBeNull()
  })

  it('with wrap the arrows, Home and End move the focus in order, with one stop in the tab order', async () => {
    const user = userEvent.setup()
    const { onValueChange } = setup({ wrap: true })
    const [pending, progress, done, cancelled] = tabs()
    expect(tabs().filter(tab => tab.getAttribute('tabindex') === '0')).toHaveLength(1)
    await user.tab()
    expect(pending).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(progress).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(done).toHaveFocus()
    await user.keyboard('{End}')
    expect(cancelled).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(pending).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(cancelled).toHaveFocus()
    await user.keyboard('{Home}')
    expect(pending).toHaveFocus()
    expect(onValueChange).not.toHaveBeenCalled()
    // a single stop: Tab leaves the list
    await user.tab()
    expect(tabs().some(tab => tab === document.activeElement)).toBe(false)
  })

  it('with wrap the arrows are inverted in RTL as without it', async () => {
    const user = userEvent.setup()
    setup({ wrap: true, dir: 'rtl' })
    const [pending, progress] = tabs()
    await user.tab()
    expect(pending).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(progress).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(pending).toHaveFocus()
  })

  it('with wrap activateOnFocus and Enter work as without it', async () => {
    const user = userEvent.setup()
    const first = setup({ wrap: true })
    await user.tab()
    await user.keyboard('{ArrowRight}{Enter}')
    expect(first.onValueChange).toHaveBeenLastCalledWith('progress')
    first.unmount()
    const second = setup({ wrap: true, activateOnFocus: true })
    await user.tab()
    await user.keyboard('{ArrowRight}')
    expect(second.onValueChange).toHaveBeenLastCalledWith('progress')
  })

  it('with wrap the selected tab carries its own mark (aria-selected, which the bar of each tab reads), and only it', () => {
    view({ wrap: true })
    const [pending, progress, done, cancelled] = tabs()
    expect(progress).toHaveAttribute('aria-selected', 'true')
    for (const other of [pending, done, cancelled]) expect(other).toHaveAttribute('aria-selected', 'false')
    // one bar per tab, drawn by the tab itself: no element of the list is there to slide under them
    expect(screen.getByRole('tablist').children).toHaveLength(4)
    expect(Array.from(screen.getByRole('tablist').children).every(child => child.getAttribute('role') === 'tab')).toBe(true)
  })

  describe('css', () => {
    const wrapBlocks = () => [...css.matchAll(/\.odc-tabs\[data-wrap='true'\][^{]*\{[^}]*\}/g)].map(match => match[0])
    const wrapRule = selector => wrapBlocks().filter(block => block.includes(selector)).join('\n')

    it('breaks the list into lines and keeps it from scrolling when the tabs do not fit', () => {
      const list = wrapRule(".odc-tabs[data-wrap='true'] .odc-tabs-list")
      expect(list).toMatch(/flex-wrap:\s*wrap/)
      expect(list).toMatch(/overflow:\s*visible/)
    })

    it('keeps the lines apart with a spacing token, so the reach of a tab never meets the one below', () => {
      expect(wrapRule(".odc-tabs[data-wrap='true'] .odc-tabs-list")).toMatch(/row-gap:\s*var\(--od-space-\d+\)/)
    })

    it('draws the selected bar on the tab itself (the base ::after, not a sliding one), cut at the tab foot as the scroller cuts it today', () => {
      // each tab clips its own foot, where the scroller of the base list clips it, so a bar on any line looks as the one of today
      expect(wrapRule(".odc-tabs[data-wrap='true'] .odc-tab {")).toMatch(/overflow:\s*clip/)
      // the base bar stays what draws it: under the label, in the text colour, at the foot of its own tab
      expect(css).toMatch(/\.odc-tab\[aria-selected='true'\]::after\s*\{[^}]*inset-inline:\s*var\(--od-space-1\)[^}]*inset-block-end:\s*calc\(var\(--od-x-hairline\) \* -1\)[^}]*background:\s*var\(--od-text\)/)
      // nothing in wrap mode repositions, moves or restyles it
      expect(wrapBlocks().join('\n')).not.toMatch(/::after|inset-block|inset-inline|transform|translate|anchor|clip-path/)
    })

    it('keeps the 44px of the tabs on a phone and a coarse pointer: wrap does not touch the size of a tab', () => {
      expect(css).toMatch(/@media \(pointer: coarse\), \(max-width: 767px\)\s*\{[^@]*block-size:\s*var\(--od-x-target-coarse\)/)
      expect(wrapBlocks().join('\n')).not.toMatch(/block-size|inline-size|padding|margin|z-index/)
    })

    it('keeps the hairline of the list under the last line (the base background and border are not overridden)', () => {
      const list = wrapRule(".odc-tabs[data-wrap='true'] .odc-tabs-list")
      expect(list).not.toMatch(/background|border/)
    })
  })
})

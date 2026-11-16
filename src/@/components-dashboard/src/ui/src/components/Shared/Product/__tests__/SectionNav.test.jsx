import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SectionNav } from '../SectionNav'

// redesign W0-7 (T0-27)
const ITEMS = [
  { id: 'basic', label: 'Basic info', group: 'Store' },
  { id: 'hours', label: 'Opening hours', group: 'Store' },
  { id: 'delivery', label: 'Delivery zones', group: 'Operation', count: 3, countLabel: '3 zones', attention: true },
  { id: 'payments', label: 'Payment methods', group: 'Operation', disabled: true },
  { id: 'taxes', label: 'Taxes', group: 'Operation', description: 'Per country' }
]

/*
 * jsdom has no layout. The root's width is simulated through clientWidth, and the viewport through matchMedia,
 * and both are re-read when the fake ResizeObserver fires.
 */
const layout = { width: 0, viewportWide: false }
const observers = new Set()

class FakeResizeObserver {
  constructor (callback) {
    this.callback = callback
    observers.add(this)
  }

  observe () {}
  unobserve () {}
  disconnect () { observers.delete(this) }
}

const resize = async (next) => {
  Object.assign(layout, next)
  await act(async () => {
    for (const observer of observers) observer.callback([], observer)
  })
}

beforeEach(() => {
  layout.width = 0
  layout.viewportWide = false
  observers.clear()
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  vi.stubGlobal('matchMedia', query => ({
    get matches () { return layout.viewportWide && /min-width/.test(query) },
    addEventListener: () => {},
    removeEventListener: () => {}
  }))
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () {
    return this.classList.contains('odc-sectionnav') ? layout.width : 0
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const setup = ({ value = 'hours', items = ITEMS, ...props } = {}) => {
  const onValueChange = vi.fn()
  const view = render(
    <SectionNav label='Store sections' compactLabel='Section' items={items} value={value} onValueChange={onValueChange} {...props} />
  )
  return { onValueChange, ...view }
}

const rows = () => screen.getAllByRole('button')

describe('Product SectionNav (W0-7)', () => {
  describe('list (wide)', () => {
    it('is a navigation named by its label, with one button per section and group headers', () => {
      setup()
      const nav = screen.getByRole('navigation', { name: 'Store sections' })
      expect(within(nav).getAllByRole('button').map(button => button.textContent)).toEqual([
        'Basic info', 'Opening hours', 'Delivery zones33 zones', 'Payment methods', 'TaxesPer country'
      ])
      expect(within(nav).getByRole('list', { name: 'Store' })).toBeInTheDocument()
      expect(within(nav).getByRole('list', { name: 'Operation' })).toBeInTheDocument()
      expect(screen.queryByRole('tablist')).toBeNull()
    })

    it('marks only the current section with aria-current', () => {
      setup({ value: 'delivery' })
      const marked = rows().filter(row => row.getAttribute('aria-current') === 'page')
      expect(marked.map(row => row.textContent)).toEqual(['Delivery zones33 zones'])
      expect(marked[0]).toHaveAttribute('data-current')
    })

    it('marks nothing when the value is unknown, and every row stays reachable', () => {
      setup({ value: 'gone' })
      expect(rows().some(row => row.hasAttribute('aria-current'))).toBe(false)
      expect(rows().filter(row => !row.disabled)).toHaveLength(4)
    })

    it('draws no header for items without a group', () => {
      setup({ items: ITEMS.map(({ group, ...item }) => item) })
      expect(screen.queryAllByRole('list', { name: /./ })).toHaveLength(0)
      expect(rows()).toHaveLength(5)
    })

    it('draws the count as a badge that reads its meaning, and the attention state on the row', () => {
      setup()
      const row = screen.getByRole('button', { name: /Delivery zones/ })
      expect(row).toHaveAttribute('data-attention')
      expect(within(row).getByText('3')).toHaveAttribute('aria-hidden', 'true')
      expect(within(row).getByText('3 zones')).toBeInTheDocument()
    })

    it('draws a description as a second line of the row', () => {
      setup()
      const row = screen.getByRole('button', { name: /Taxes/ })
      expect(row).toHaveAttribute('data-has-description')
      expect(within(row).getByText('Per country')).toBeInTheDocument()
    })

    it('calls onValueChange with the id when a section is pressed, and not for the current one', async () => {
      const user = userEvent.setup()
      const { onValueChange } = setup()
      await user.click(screen.getByRole('button', { name: /Delivery zones/ }))
      expect(onValueChange).toHaveBeenCalledTimes(1)
      expect(onValueChange).toHaveBeenCalledWith('delivery')
      await user.click(screen.getByRole('button', { name: 'Opening hours' }))
      expect(onValueChange).toHaveBeenCalledTimes(1)
    })

    it('does nothing for a disabled section, and Tab and the arrows skip it', async () => {
      const user = userEvent.setup()
      const { onValueChange } = setup()
      const payments = screen.getByRole('button', { name: 'Payment methods' })
      expect(payments).toBeDisabled()
      await user.click(payments)
      expect(onValueChange).not.toHaveBeenCalled()
      screen.getByRole('button', { name: /Delivery zones/ }).focus()
      await user.keyboard('{ArrowDown}')
      expect(screen.getByRole('button', { name: /Taxes/ })).toHaveFocus()
      await user.keyboard('{ArrowUp}')
      expect(screen.getByRole('button', { name: /Delivery zones/ })).toHaveFocus()
    })

    it('reaches every enabled row with Tab (no roving tabindex)', async () => {
      const user = userEvent.setup()
      setup()
      const stops = []
      for (let index = 0; index < 4; index += 1) {
        await user.tab()
        stops.push(document.activeElement.textContent)
      }
      expect(stops).toEqual(['Basic info', 'Opening hours', 'Delivery zones33 zones', 'TaxesPer country'])
      expect(rows().every(row => row.getAttribute('tabindex') !== '-1')).toBe(true)
    })

    it('moves the focus with ArrowDown, ArrowUp, Home and End without activating, and stops at the ends', async () => {
      const user = userEvent.setup()
      const { onValueChange } = setup()
      await user.tab()
      expect(screen.getByRole('button', { name: 'Basic info' })).toHaveFocus()
      await user.keyboard('{ArrowUp}')
      expect(screen.getByRole('button', { name: 'Basic info' })).toHaveFocus()
      await user.keyboard('{ArrowDown}')
      expect(screen.getByRole('button', { name: 'Opening hours' })).toHaveFocus()
      await user.keyboard('{End}')
      expect(screen.getByRole('button', { name: /Taxes/ })).toHaveFocus()
      await user.keyboard('{ArrowDown}')
      expect(screen.getByRole('button', { name: /Taxes/ })).toHaveFocus()
      await user.keyboard('{Home}')
      expect(screen.getByRole('button', { name: 'Basic info' })).toHaveFocus()
      expect(onValueChange).not.toHaveBeenCalled()
    })

    it('activates the focused section with Enter and with Space', async () => {
      const user = userEvent.setup()
      const { onValueChange } = setup({ value: 'basic' })
      await user.tab()
      await user.keyboard('{ArrowDown}{Enter}')
      expect(onValueChange).toHaveBeenLastCalledWith('hours')
      await user.keyboard('{ArrowDown} ')
      expect(onValueChange).toHaveBeenLastCalledWith('delivery')
    })

    it('reads a changed value', () => {
      const { rerender, onValueChange } = setup({ value: 'basic' })
      rerender(<SectionNav label='Store sections' compactLabel='Section' items={ITEMS} value='taxes' onValueChange={onValueChange} />)
      expect(rows().filter(row => row.getAttribute('aria-current') === 'page').map(row => row.textContent)).toEqual(['TaxesPer country'])
    })
  })

  describe('selector (narrow)', () => {
    const narrow = { width: 320, viewportWide: false }

    it('keeps the list in a narrow container when the viewport is wide, and swaps it for a selector otherwise', async () => {
      layout.width = 320
      layout.viewportWide = true
      setup()
      expect(rows()).toHaveLength(5)
      await resize(narrow)
      expect(screen.getByRole('navigation', { name: 'Store sections' })).toBeInTheDocument()
      expect(screen.getAllByRole('button')).toHaveLength(1)
      await resize({ width: 640 })
      expect(rows()).toHaveLength(5)
    })

    it('shows the current section in a selector named by compactLabel, never tabs', async () => {
      Object.assign(layout, narrow)
      setup()
      const trigger = screen.getByRole('button', { name: 'Section Opening hours' })
      expect(trigger).toHaveTextContent('Opening hours')
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
      expect(screen.getByRole('navigation', { name: 'Store sections' })).toContainElement(trigger)
      expect(screen.queryByRole('tablist')).toBeNull()
    })

    it('shows the compact label when no section is current', () => {
      Object.assign(layout, narrow)
      setup({ value: 'gone' })
      expect(screen.getByRole('button', { name: /Section/ })).toHaveTextContent('Section')
    })

    it('lists every section as a radio with the current one checked, and calls onValueChange on choosing', async () => {
      Object.assign(layout, narrow)
      const user = userEvent.setup()
      const { onValueChange } = setup()
      await user.click(screen.getByRole('button', { name: /Section/ }))
      const menu = await screen.findByRole('menu')
      const radios = within(menu).getAllByRole('menuitemradio')
      expect(radios.map(item => item.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false', 'false', 'false'])
      expect(radios[3]).toHaveAttribute('aria-disabled', 'true')
      await user.click(within(menu).getByRole('menuitemradio', { name: /Delivery zones/ }))
      expect(onValueChange).toHaveBeenCalledWith('delivery')
    })

    it('chooses with the keyboard, and choosing the current section reports nothing', async () => {
      Object.assign(layout, narrow)
      const user = userEvent.setup()
      const { onValueChange } = setup()
      await user.click(screen.getByRole('button', { name: /Section/ }))
      const menu = await screen.findByRole('menu')
      await user.click(within(menu).getByRole('menuitemradio', { name: 'Opening hours' }))
      expect(onValueChange).not.toHaveBeenCalled()
      screen.getByRole('button', { name: /Section/ }).focus()
      await user.keyboard('{Enter}')
      await screen.findByRole('menu')
      await user.keyboard('{End}{Enter}')
      expect(onValueChange).toHaveBeenCalledTimes(1)
      expect(onValueChange).toHaveBeenCalledWith('taxes')
    })
  })

  describe('contract', () => {
    it.each([['label', { label: undefined }], ['label (null)', { label: null }], ['compactLabel', { compactLabel: undefined }], ['compactLabel (null)', { compactLabel: null }]])(
      'throws without a %s',
      (_, missing) => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const props = { label: 'Store sections', compactLabel: 'Section', items: ITEMS, value: 'basic', ...missing }
        expect(() => render(<SectionNav {...props} />)).toThrow(/SectionNav needs a (label|compactLabel)/)
      }
    )

    it('names the missing prop in the error', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      expect(() => render(<SectionNav compactLabel='Section' items={ITEMS} value='basic' />)).toThrow('SectionNav needs a label')
      expect(() => render(<SectionNav label='Sections' items={ITEMS} value='basic' />)).toThrow('SectionNav needs a compactLabel')
    })

    it('an empty string is a text translated to nothing: it draws empty and does not throw', () => {
      render(<SectionNav label='' compactLabel='' items={ITEMS} value='basic' />)
      expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', '')
      expect(rows()).toHaveLength(5)
    })

    it('forwards data attributes and a class to its root, and has no text of its own', () => {
      const { container } = setup({ className: 'host', 'data-testid': 'nav' })
      expect(screen.getByTestId('nav')).toHaveClass('odc-sectionnav', 'host')
      expect(container.textContent).toBe('StoreBasic infoOpening hoursOperationDelivery zones33 zonesPayment methodsTaxesPer country')
    })
  })

  // redesign settings 0: collapsible groups, listOnly and activateOnFocus (all opt-in)
  describe('groups (collapsible)', () => {
    const GROUPS = [
      { id: 'store', label: 'Store', description: 'Name and hours' },
      { id: 'ops', label: 'Operation', description: 'Delivery and payments' },
      { id: 'empty', label: 'Nothing yet' }
    ]
    const GROUPED = [
      { id: 'basic', label: 'Basic info', group: 'store' },
      { id: 'hours', label: 'Opening hours', group: 'store' },
      { id: 'delivery', label: 'Delivery zones', group: 'ops' },
      { id: 'payments', label: 'Payment methods', group: 'ops', disabled: true },
      { id: 'taxes', label: 'Taxes', group: 'ops' }
    ]
    const grouped = (props = {}) => {
      const onGroupSelect = vi.fn()
      const view = setup({ items: GROUPED, groups: GROUPS, openGroups: ['store'], onGroupSelect, value: 'hours', ...props })
      return { onGroupSelect, ...view }
    }
    const groupRow = name => screen.getByRole('button', { name: new RegExp(`^${name}`) })

    it('draws a group row per group, with label and description in two lines, even when closed', () => {
      grouped()
      const row = groupRow('Store')
      expect(row).toHaveAttribute('data-has-description')
      expect(within(row).getByText('Name and hours')).toBeInTheDocument()
      expect(within(groupRow('Operation')).getByText('Delivery and payments')).toBeInTheDocument()
      expect(groupRow('Nothing yet')).not.toHaveAttribute('data-has-description')
    })

    it('exposes aria-expanded and data-expanded on the group row, true only for the open group', () => {
      grouped()
      expect(groupRow('Store')).toHaveAttribute('aria-expanded', 'true')
      expect(groupRow('Store')).toHaveAttribute('data-expanded')
      expect(groupRow('Operation')).toHaveAttribute('aria-expanded', 'false')
      expect(groupRow('Operation')).not.toHaveAttribute('data-expanded')
    })

    it('mounts the list of a group only when its id is in openGroups, and aria-controls points at it', () => {
      grouped()
      expect(screen.getByRole('button', { name: 'Basic info' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Opening hours' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Delivery zones/ })).toBeNull()
      const list = document.getElementById(groupRow('Store').getAttribute('aria-controls'))
      expect(list).not.toBeNull()
      expect(within(list).getAllByRole('button').map(button => button.textContent)).toEqual(['Basic info', 'Opening hours'])
      expect(screen.getByRole('list', { name: /^Store/ })).toBe(list)
      expect(document.getElementById(groupRow('Operation').getAttribute('aria-controls'))).toBeNull()
    })

    it('mounts several open groups, and none when openGroups is empty or missing', () => {
      const { rerender, onGroupSelect } = grouped({ openGroups: ['store', 'ops'] })
      expect(rows().map(row => row.textContent)).toEqual([
        'StoreName and hours', 'Basic info', 'Opening hours', 'OperationDelivery and payments', 'Delivery zones', 'Payment methods', 'Taxes', 'Nothing yet'
      ])
      rerender(<SectionNav label='Store sections' compactLabel='Section' items={GROUPED} groups={GROUPS} onGroupSelect={onGroupSelect} />)
      expect(rows()).toHaveLength(3)
    })

    it('draws a group without items as a row with no list and no aria-controls', () => {
      grouped({ openGroups: ['empty'] })
      const row = groupRow('Nothing yet')
      expect(row).toHaveAttribute('aria-expanded', 'true')
      expect(row).not.toHaveAttribute('aria-controls')
      expect(screen.queryAllByRole('list', { name: /Nothing/ })).toHaveLength(0)
    })

    it('keeps the order of groups, and an item belongs to the group whose id it names', () => {
      grouped({ openGroups: ['ops', 'store'], items: [...GROUPED].reverse() })
      // the items arrive reversed, the groups keep the order of `groups`, the items the order of `items` inside
      expect(rows().map(row => row.textContent)).toEqual([
        'StoreName and hours', 'Opening hours', 'Basic info', 'OperationDelivery and payments', 'Taxes', 'Payment methods', 'Delivery zones', 'Nothing yet'
      ])
    })

    it('calls onGroupSelect with the id when a group row is pressed (open or closed), and keeps no state of its own', async () => {
      const user = userEvent.setup()
      const { onGroupSelect, onValueChange } = grouped()
      await user.click(groupRow('Operation'))
      expect(onGroupSelect).toHaveBeenLastCalledWith('ops')
      expect(screen.queryByRole('button', { name: /Delivery zones/ })).toBeNull()
      await user.click(groupRow('Store'))
      expect(onGroupSelect).toHaveBeenLastCalledWith('store')
      expect(onGroupSelect).toHaveBeenCalledTimes(2)
      expect(onValueChange).not.toHaveBeenCalled()
    })

    it('still marks the current section with aria-current and calls onValueChange for the others', async () => {
      const user = userEvent.setup()
      const { onValueChange } = grouped()
      expect(screen.getByRole('button', { name: 'Opening hours' })).toHaveAttribute('aria-current', 'page')
      expect(groupRow('Store')).not.toHaveAttribute('aria-current')
      await user.click(screen.getByRole('button', { name: 'Basic info' }))
      expect(onValueChange).toHaveBeenCalledWith('basic')
    })

    it('uses the same row class as a section row, so it shares the focus ring and the row height', () => {
      grouped()
      expect(groupRow('Store')).toHaveClass('odc-sectionnav-row')
      expect(groupRow('Store')).toHaveAttribute('type', 'button')
    })

    it('moves the focus through group and section rows together, skipping the disabled ones', async () => {
      const user = userEvent.setup()
      const { onValueChange, onGroupSelect } = grouped({ openGroups: ['store', 'ops'] })
      groupRow('Store').focus()
      const seen = []
      for (let index = 0; index < 7; index += 1) {
        await user.keyboard('{ArrowDown}')
        seen.push(document.activeElement.textContent)
      }
      expect(seen).toEqual(['Basic info', 'Opening hours', 'OperationDelivery and payments', 'Delivery zones', 'Taxes', 'Nothing yet', 'Nothing yet'])
      expect(onValueChange).not.toHaveBeenCalled()
      expect(onGroupSelect).not.toHaveBeenCalled()
    })

    it('throws without a label or compactLabel, as without groups', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      expect(() => render(<SectionNav compactLabel='Section' items={GROUPED} groups={GROUPS} />)).toThrow('SectionNav needs a label')
      expect(() => render(<SectionNav label='Sections' items={GROUPED} groups={GROUPS} />)).toThrow('SectionNav needs a compactLabel')
    })

    it('ignores groups-only props without groups: a plain list with caption headers, as today', () => {
      setup({ openGroups: ['x'], onGroupSelect: vi.fn() })
      expect(rows()).toHaveLength(5)
      expect(screen.getByRole('list', { name: 'Store' })).toBeInTheDocument()
    })
  })

  describe('listOnly', () => {
    it('stays a list in a narrow container and a narrow viewport, where it would become a selector', async () => {
      Object.assign(layout, { width: 320, viewportWide: false })
      const { container } = setup({ listOnly: true })
      await resize({ width: 320 })
      expect(rows()).toHaveLength(5)
      expect(container.querySelector('.odc-sectionnav')).toHaveAttribute('data-mode', 'list')
      expect(screen.queryByRole('button', { name: /Section/ })).toBeNull()
    })

    it('without it the same container still becomes a selector', async () => {
      Object.assign(layout, { width: 320, viewportWide: false })
      const { container } = setup()
      await resize({ width: 320 })
      expect(container.querySelector('.odc-sectionnav')).toHaveAttribute('data-mode', 'selector')
    })
  })

  // redesign stores 5.1b (decision 35): the subsections of one section are a selector at every width
  describe('selectorOnly', () => {
    it('is the selector in a wide container and a wide viewport, where it would be a list', async () => {
      Object.assign(layout, { width: 900, viewportWide: true })
      const { container } = setup({ selectorOnly: true })
      await resize({ width: 900 })
      expect(container.querySelector('.odc-sectionnav')).toHaveAttribute('data-mode', 'selector')
      expect(screen.queryAllByRole('button', { name: 'Basic info' })).toHaveLength(0)
    })

    it('is the selector even with nothing laid out (no width), where the list is kept', () => {
      const { container } = setup({ selectorOnly: true })
      expect(container.querySelector('.odc-sectionnav')).toHaveAttribute('data-mode', 'selector')
    })

    it('without it the same container is a list', async () => {
      Object.assign(layout, { width: 900, viewportWide: true })
      const { container } = setup()
      await resize({ width: 900 })
      expect(container.querySelector('.odc-sectionnav')).toHaveAttribute('data-mode', 'list')
    })
  })

  describe('activateOnFocus', () => {
    const GROUPS = [{ id: 'store', label: 'Store' }, { id: 'ops', label: 'Operation' }]
    const GROUPED = [
      { id: 'basic', label: 'Basic info', group: 'store' },
      { id: 'hours', label: 'Opening hours', group: 'store' },
      { id: 'taxes', label: 'Taxes', group: 'ops' }
    ]
    const focusable = (props = {}) => {
      const onGroupSelect = vi.fn()
      const view = setup({ items: GROUPED, groups: GROUPS, openGroups: ['store'], onGroupSelect, value: 'basic', ...props })
      return { onGroupSelect, ...view }
    }

    it('activates the section reached with the arrows, Home and End', async () => {
      const user = userEvent.setup()
      const { onValueChange, onGroupSelect } = focusable({ activateOnFocus: true })
      screen.getByRole('button', { name: 'Basic info' }).focus()
      await user.keyboard('{ArrowDown}')
      expect(onValueChange).toHaveBeenLastCalledWith('hours')
      await user.keyboard('{ArrowUp}')
      expect(onValueChange).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('button', { name: 'Basic info' })).toHaveFocus()
      await user.keyboard('{End}')
      expect(onGroupSelect).toHaveBeenLastCalledWith('ops')
      await user.keyboard('{Home}')
      expect(onGroupSelect).toHaveBeenLastCalledWith('store')
    })

    it('activates a group row it moves to with onGroupSelect', async () => {
      const user = userEvent.setup()
      const { onValueChange, onGroupSelect } = focusable({ activateOnFocus: true })
      screen.getByRole('button', { name: 'Opening hours' }).focus()
      await user.keyboard('{ArrowDown}')
      expect(document.activeElement).toHaveTextContent('Operation')
      expect(onGroupSelect).toHaveBeenCalledTimes(1)
      expect(onGroupSelect).toHaveBeenCalledWith('ops')
      expect(onValueChange).not.toHaveBeenCalled()
    })

    it('does not activate when the focus cannot move (an end of the list)', async () => {
      const user = userEvent.setup()
      const { onValueChange, onGroupSelect } = focusable({ activateOnFocus: true, openGroups: [] })
      screen.getByRole('button', { name: 'Store' }).focus()
      await user.keyboard('{ArrowUp}{Home}')
      expect(onGroupSelect).not.toHaveBeenCalled()
      expect(onValueChange).not.toHaveBeenCalled()
    })

    it('without it, the arrows, Home and End only move the focus', async () => {
      const user = userEvent.setup()
      const { onValueChange, onGroupSelect } = focusable()
      screen.getByRole('button', { name: 'Basic info' }).focus()
      await user.keyboard('{ArrowDown}{ArrowDown}{End}{Home}')
      expect(onValueChange).not.toHaveBeenCalled()
      expect(onGroupSelect).not.toHaveBeenCalled()
    })

    it('activates sections in a plain list too (no groups)', async () => {
      const user = userEvent.setup()
      const { onValueChange } = setup({ value: 'basic', activateOnFocus: true })
      screen.getByRole('button', { name: 'Basic info' }).focus()
      await user.keyboard('{ArrowDown}{End}')
      expect(onValueChange.mock.calls.map(call => call[0])).toEqual(['hours', 'taxes'])
    })
  })

  describe('styles', () => {
    const css = readFileSync(resolve(__dirname, '../section-nav.css'), 'utf8')
    const rule = selector => {
      const escaped = selector.replace(/[.[\]()]/g, '\\$&')
      return [...css.matchAll(new RegExp(`(?:^|\\n|,\\s*)${escaped}\\s*(?:,[^{]*)?\\{([^}]*)\\}`, 'g'))].map(match => match[1]).join('\n')
    }

    it('keeps rows at the 32px control height and an inset focus ring', () => {
      expect(rule('.odc-sectionnav-row')).toMatch(/min-block-size:\s*var\(--od-x-control-height\)/)
      expect(rule('.odc-sectionnav-row:focus-visible')).toMatch(/outline:\s*var\(--od-focus-ring-width\) solid var\(--od-focus-ring-color\)/)
      expect(rule('.odc-sectionnav-row:focus-visible')).toMatch(/outline-offset:\s*var\(--od-x-focus-inset\)/)
    })

    it('makes stacked rows 44px visible on a coarse pointer or under 768px, so hit areas never cross', () => {
      expect(css).toMatch(/@media \(pointer: coarse\), \(max-width: 767px\) \{[^@]*min-block-size:\s*var\(--od-x-target-coarse\)/)
    })

    it('never breaks a word', () => {
      expect(rule('.odc-sectionnav-text')).toMatch(/overflow-wrap:\s*normal/)
      expect(css).not.toMatch(/overflow-wrap:\s*anywhere|word-break:\s*break-all/)
    })
  })
})

/* eslint-disable import/first */
// redesign F6c-1 (Q2-03, Q2-07, Q2-15): the lists of the pill popovers (Status, Driver, Driver group,
// Business) answer the arrows like the C18 selects, the rows reach 44px below 768px and every list foot says
// «Clear» with a hit area of at least 24×24.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { Checkbox } from '../../../Shared/Product/Checkbox'
import { ChecklistPopover, FilterPopover } from '../FilterPopover'

afterEach(() => document.getElementById('app-modals')?.remove())

const ITEMS = [
  { id: 1, name: 'Ada Lovelace' },
  { id: 2, name: 'Alan Turing' },
  { id: 3, name: 'Grace Hopper' },
  { id: 4, name: 'Marcus Hill' }
]

const openChecklist = async (user, props = {}) => {
  const onToggle = vi.fn()
  const onClear = vi.fn()
  render(
    <ChecklistPopover
      label='Driver'
      items={ITEMS}
      selected={[]}
      onToggle={onToggle}
      onClear={onClear}
      // redesign W0-2a (T0-4): the texts are props now; the English the mock of `t` gave
      searchLabel='Search' clearSearchLabel='Clear search' loadingLabel='Loading...' noResultsLabel='No results found' clearLabel='Clear'
      {...props}
    />
  )
  await user.click(screen.getByRole('button', { name: /^Driver/ }))
  const popup = await screen.findByRole('dialog', { name: 'Driver', hidden: true })
  return { popup, onToggle, onClear }
}

const rowOf = (popup, name) => within(popup).getByRole('checkbox', { name, hidden: true })

describe('pill popover lists · keyboard (Q2-03)', () => {
  it('ArrowDown from the search field goes to the first row, and the arrows move between rows', async () => {
    const user = userEvent.setup()
    const { popup } = await openChecklist(user)
    const search = within(popup).getByRole('searchbox', { hidden: true })
    await waitFor(() => expect(search).toHaveFocus())
    await user.keyboard('{ArrowDown}')
    expect(rowOf(popup, 'Ada Lovelace')).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(rowOf(popup, 'Alan Turing')).toHaveFocus()
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}')
    expect(rowOf(popup, 'Marcus Hill')).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(rowOf(popup, 'Grace Hopper')).toHaveFocus()
  })

  it('Home and End jump to the first and the last row; ArrowUp on the first row goes back to the search', async () => {
    const user = userEvent.setup()
    const { popup } = await openChecklist(user)
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{End}')
    expect(rowOf(popup, 'Marcus Hill')).toHaveFocus()
    await user.keyboard('{Home}')
    expect(rowOf(popup, 'Ada Lovelace')).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(within(popup).getByRole('searchbox', { hidden: true })).toHaveFocus()
  })

  it('Home and End inside the search field keep moving the caret', async () => {
    const user = userEvent.setup()
    const { popup } = await openChecklist(user)
    const search = within(popup).getByRole('searchbox', { hidden: true })
    await user.type(search, 'al')
    await user.keyboard('{Home}')
    expect(search).toHaveFocus()
  })

  it('Enter and Space toggle the focused row', async () => {
    const user = userEvent.setup()
    const { popup, onToggle } = await openChecklist(user)
    await user.keyboard('{ArrowDown}{ArrowDown}')
    await user.keyboard('{Enter}')
    expect(onToggle).toHaveBeenLastCalledWith(2)
    await user.keyboard('{ArrowDown}')
    await user.keyboard(' ')
    expect(onToggle).toHaveBeenLastCalledWith(3)
    expect(rowOf(popup, 'Grace Hopper')).toHaveFocus()
  })

  it('arrows follow the search: only the rows that match are reachable', async () => {
    const user = userEvent.setup()
    const { popup } = await openChecklist(user)
    await user.type(within(popup).getByRole('searchbox', { hidden: true }), 'a')
    await user.keyboard('{ArrowDown}')
    expect(rowOf(popup, 'Ada Lovelace')).toHaveFocus()
    await user.keyboard('{End}')
    expect(rowOf(popup, 'Marcus Hill')).toHaveFocus()
  })

  it('is a roving tab stop: one row in the Tab order, the one with the focus', async () => {
    const user = userEvent.setup()
    const { popup } = await openChecklist(user, { selected: [3] })
    const rows = within(popup).getAllByRole('checkbox', { hidden: true })
    await waitFor(() => expect(rows.filter(row => row.tabIndex === 0)).toHaveLength(1))
    expect(rowOf(popup, 'Grace Hopper').tabIndex).toBe(0)
    // ArrowDown from the search enters the list at its first row, which then becomes the tab stop
    await user.keyboard('{ArrowDown}')
    expect(rowOf(popup, 'Ada Lovelace')).toHaveFocus()
    expect(rows.filter(row => row.tabIndex === 0)).toEqual([rowOf(popup, 'Ada Lovelace')])
    await user.keyboard('{End}')
    expect(rows.filter(row => row.tabIndex === 0)).toEqual([rowOf(popup, 'Marcus Hill')])
    await user.tab()
    expect(within(popup).getByRole('button', { name: 'Clear', hidden: true })).toHaveFocus()
  })

  it('Escape closes only the popover and gives the focus back to the pill', async () => {
    const user = userEvent.setup()
    const { popup } = await openChecklist(user)
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(rowOf(popup, 'Alan Turing')).toHaveFocus()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Driver', hidden: true })).toBeNull(), { timeout: 4000 })
    expect(screen.getByRole('button', { name: /^Driver/ })).toHaveFocus()
  })

  it('the Status list (plain checkboxes in a FilterPopover) answers the arrows too', async () => {
    const user = userEvent.setup()
    render(
      <FilterPopover label='Status'>
        <div role='group' aria-label='Status'>
          {['Pending', 'In progress', 'Ready'].map(name => <Checkbox key={name}>{name}</Checkbox>)}
        </div>
      </FilterPopover>
    )
    await user.click(screen.getByRole('button', { name: /^Status/ }))
    const popup = await screen.findByRole('dialog', { name: 'Status', hidden: true })
    await waitFor(() => expect(rowOf(popup, 'Pending')).toHaveFocus())
    await user.keyboard('{ArrowDown}')
    expect(rowOf(popup, 'In progress')).toHaveFocus()
    await user.keyboard('{End}')
    expect(rowOf(popup, 'Ready')).toHaveFocus()
    await user.keyboard('{Home}')
    expect(rowOf(popup, 'Pending')).toHaveFocus()
  })
})

describe('pill popover lists · foot (Q2-15)', () => {
  it('the list foot says «Clear» and empties the filter', async () => {
    const user = userEvent.setup()
    const { popup, onClear } = await openChecklist(user, { selected: [1] })
    await user.click(within(popup).getByRole('button', { name: 'Clear', hidden: true }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})

describe('pill popover lists · stylesheet (Q2-07, Q2-15)', () => {
  const css = readFileSync(resolve(__dirname, '../filter-popover.css'), 'utf8')
  const coarse = css.split('@media (pointer: coarse), (max-width: 767px)').slice(1).join('\n')
  const outside = css.split('@media (pointer: coarse), (max-width: 767px)')[0]

  it('rows are 44px below 768px (or with a coarse pointer), and keep the control height with a mouse', () => {
    expect(coarse).toMatch(/\.odc-orders-popover \.odc-checkbox-labelled\s*\{[^}]*min-block-size:\s*var\(--od-x-target-coarse\)/)
    expect(outside).not.toMatch(/\.odc-orders-popover \.odc-checkbox-labelled/)
  })

  // redesign W0-3d (T0-12, decision 12): the foot button no longer grows to 44 wide below 768px; its box keeps the fine minimum
  // and the 44px is the centered area of .odc-btn (product.css, touch.w03d1/d2 tests)
  it('the foot button is at least 24 wide; below 768px its box does not grow (the 44px is an area)', () => {
    expect(outside).toMatch(/\.odc-orders-popover-foot \.odc-btn\s*\{[^}]*min-inline-size:\s*var\(--od-x-target-fine\)/)
    expect(coarse).not.toMatch(/\.odc-orders-popover-foot \.odc-btn/)
  })
})

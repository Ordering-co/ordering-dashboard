/* eslint-disable import/first */
// (part 2, shifts): where the focus lands when a shift dialog closes after the agenda reloaded. The grid, the block dialog,
// the confirmation and the Product Dialog are the real ones; only the contexts and the two bars are stand-ins. The harness plays the
// controller: a save or a delete puts the grid in its loading state (skeleton rows) and brings the new rows back, so the button that
// opened the dialog is gone when the dialog closes. Before the fix the focus fell on <body>.
import React, { useState } from 'react'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useConfig: () => [{ configs: { general_hour_format: { value: 'HH:mm' } } }],
  useUtils: () => [{ parseDate: (value) => `day(${String(value).slice(0, 10)})` }]
}))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: vi.fn() }]
}))
vi.mock('../../../Shared/LearnDropDown', () => ({ LearnDropDown: () => <span>Learn</span> }))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => false }))
vi.mock('../ScopePills', () => ({ ScopePills: () => <span /> }))
vi.mock('../DateNav', () => ({ DateNav: () => <span /> }))

import { TimeCalendarListingUI } from '../TimeCalendarListing'

const block = (id, hour, extra = {}) => ({
  id,
  name: `Shift ${id}`,
  description: '',
  start: `2030-09-17 ${String(hour).padStart(2, '0')}:00:00`,
  end: `2030-09-17 ${String(hour).padStart(2, '0')}:30:00`,
  break_start: null,
  break_end: null,
  rrule: null,
  until: null,
  ...extra
})
const carlos = (blocks) => ({ id: 67, name: 'Carlos', lastname: 'Mendoza', email: 'carlos@example.com', delivery_blocks: blocks })

const WEEK = { from: '2030-09-16', to: '2030-09-22' }
const DAY = { from: '2030-09-17', to: '2030-09-17' }

const Harness = ({ range = WEEK, blocks }) => {
  const [state, setState] = useState({ users: [carlos(blocks)], loading: false })
  // the controller: loading, then the new rows (fresh objects, so every button of the grid is a new node)
  const reload = async (next) => {
    setState(current => ({ ...current, loading: true }))
    await new Promise(resolve => setTimeout(resolve, 15))
    setState({ users: [carlos(next)], loading: false })
    return { ok: true }
  }
  return (
    <TimeCalendarListingUI
      range={range}
      setRange={vi.fn()}
      driverIds={[]}
      driversList={{ users: state.users, loading: state.loading, error: null }}
      paginationProps={{ currentPage: 1, pageSize: 10, totalPages: 1, totalItems: 1 }}
      addBlock={() => reload([...blocks, block(99, 12)])}
      editBlock={() => reload(blocks.map(item => ({ ...item, name: 'Edited' })))}
      deleteBlock={() => reload(blocks.slice(1))}
    />
  )
}

const page = () => document.querySelector('.odc-dtd-page')
const expectStableFocus = async (name) => {
  await waitFor(() => {
    expect(document.activeElement).not.toBe(document.body)
    expect(page().contains(document.activeElement)).toBe(true)
    // a week: the «add» button of that driver and day (the cell of the shift); a day: the tab stop of the driver's lane
    if (name) expect(document.activeElement).toBe(screen.getByRole('button', { name }))
  })
}
const ADD_ON_17 = 'Add shift for Carlos Mendoza on day(2030-09-17)'

afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
})
beforeEach(() => {
  document.body.focus()
})

describe('focus after a shift dialog closes and the agenda reloads', () => {
  it('deleting a shift from its cell leaves the focus inside the agenda', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness blocks={[block(1, 9), block(2, 10)]} />)
    await user.click(screen.getByRole('button', { name: /^Shift 1, 09:00 – 09:30/ }))
    const edit = await screen.findByRole('dialog', { name: 'Edit shift' })
    await user.click(within(edit).getByRole('button', { name: 'Delete shift' }))
    const confirm = await screen.findByRole('dialog', { name: 'Delete this shift?' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete shift' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit shift' })).toBeNull())
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Delete this shift?' })).toBeNull())
    await expectStableFocus(ADD_ON_17)
  })

  it('deleting a shift opened from «+1 more» leaves the focus inside the agenda', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness blocks={[block(1, 9), block(2, 10), block(3, 11)]} />)
    await user.click(screen.getByRole('button', { name: '+1 more' }))
    const list = await screen.findByRole('dialog', { name: 'Stacked shifts' })
    await user.click(within(list).getByRole('button', { name: /09:00 – 09:30/ }))
    const edit = await screen.findByRole('dialog', { name: 'Edit shift' })
    await user.click(within(edit).getByRole('button', { name: 'Delete shift' }))
    const confirm = await screen.findByRole('dialog', { name: 'Delete this shift?' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete shift' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit shift' })).toBeNull())
    await expectStableFocus(ADD_ON_17)
  })

  it('«Save shift» on an edited shift leaves the focus inside the agenda', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness blocks={[block(1, 9), block(2, 10)]} />)
    await user.click(screen.getByRole('button', { name: /^Shift 1, 09:00 – 09:30/ }))
    const edit = await screen.findByRole('dialog', { name: 'Edit shift' })
    await user.click(within(edit).getByRole('button', { name: 'Save' }))
    const confirm = await screen.findByRole('dialog', { name: 'Save changes to this shift?' })
    await user.click(within(confirm).getByRole('button', { name: 'Save shift' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit shift' })).toBeNull())
    await expectStableFocus(ADD_ON_17)
  })

  it('adding a shift from an hour slot leaves the focus inside the agenda', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness range={DAY} blocks={[block(1, 9)]} />)
    await user.click(screen.getByRole('button', { name: 'Add shift for Carlos Mendoza at 10:00' }))
    const add = await screen.findByRole('dialog', { name: 'Add new shift' })
    await user.click(within(add).getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add new shift' })).toBeNull())
    await expectStableFocus()
  })

  it('cancelling an add with Escape still returns to the button that opened it', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness range={DAY} blocks={[block(1, 9)]} />)
    const opener = screen.getByRole('button', { name: 'Add shift for Carlos Mendoza at 10:00' })
    await user.click(opener)
    await screen.findByRole('dialog', { name: 'Add new shift' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add new shift' })).toBeNull())
    await waitFor(() => expect(opener).toHaveFocus())
  })
})

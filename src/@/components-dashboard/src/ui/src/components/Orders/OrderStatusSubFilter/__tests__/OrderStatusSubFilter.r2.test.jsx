/* eslint-disable import/first */
// redesign W0-2 r2 (W0-Q1-04): after «Clear» in the Status pill (the PopoverFoot of OrderStatusSubFilter) the focus stays
// in the popover, on its first row (no search field there). Moved here from Shared/Product so Product tests never import
// from Orders (scripts/redesign/orders-import-guard.mjs).
import React, { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { SubStatusPill } from '..'

afterEach(() => document.getElementById('app-modals')?.remove())

const rowsOf = dialog => Array.from(dialog.querySelectorAll('button[role="checkbox"]'))
const open = async (user, name) => {
  await user.click(screen.getByRole('button', { name: new RegExp(`^${name}`), hidden: true }))
  return screen.findByRole('dialog', { name, hidden: true })
}

describe('W0-Q1-04 · the focus stays in the Status popover after «Clear»', () => {
  it('a popover without a search field puts it on the first row (Status, through OrderStatusSubFilter)', async () => {
    const user = userEvent.setup()
    const Status = () => {
      const [selected, setSelected] = useState({ completed: [1] })
      return (
        <SubStatusPill
          ordersStatusGroup='completed'
          selectedSubOrderStatus={selected}
          handleSelectedSubOrderStatus={setSelected}
        />
      )
    }
    render(<Status />)
    const dialog = await open(user, 'Status')
    const clear = within(dialog).getByRole('button', { name: 'Clear', hidden: true })
    await user.click(clear)
    await waitFor(() => expect(within(dialog).queryByRole('button', { name: 'Clear', hidden: true })).toBeNull())
    expect(document.activeElement).toBe(rowsOf(dialog)[0])
    expect(screen.getByRole('button', { name: /^Status/, hidden: true })).not.toHaveFocus()
  })
})

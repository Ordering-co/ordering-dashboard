/* eslint-disable import/first */
// redesign F1b (D-11): a click outside an open pill popover closes it and reaches what was under it. The
// shared host `#app-modals` is full screen; it must let the pointer through while the popover is the only
// layer, and the popup (its portal) must take it back. jsdom has no hit testing, so the structure is checked
// here and the real click in e2e/brand-system-app/orders-pill-checklists.spec.js.
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { FilterPopover } from '../FilterPopover'

afterEach(() => document.getElementById('app-modals')?.remove())

describe('FilterPopover · outside click (D-11)', () => {
  it('lets the pointer through the host and keeps it on the popup', async () => {
    const user = userEvent.setup()
    render(<FilterPopover label='Driver'><p>Body</p></FilterPopover>)
    await user.click(screen.getByRole('button', { name: 'Driver' }))
    const popup = await screen.findByRole('dialog', { name: 'Driver', hidden: true })
    expect(document.getElementById('app-modals').style.pointerEvents).toBe('none')
    expect(popup.closest('.odc-overlay-portal').style.pointerEvents).toBe('auto')
  })

  it('one click on another pill closes the open popover and opens the next one', async () => {
    const user = userEvent.setup()
    render(
      <>
        <FilterPopover label='Driver'><p>Driver body</p></FilterPopover>
        <FilterPopover label='Business'><p>Business body</p></FilterPopover>
      </>
    )
    await user.click(screen.getByRole('button', { name: 'Driver' }))
    await screen.findByRole('dialog', { name: 'Driver', hidden: true })
    await user.click(screen.getByRole('button', { name: 'Business' }))
    await screen.findByRole('dialog', { name: 'Business', hidden: true })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Driver', hidden: true })).toBeNull())
  })
})

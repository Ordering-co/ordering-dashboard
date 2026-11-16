/* eslint-disable import/first */
// redesign fix-qa C3 (B13): the pill popover registers its overlay layer, so one Escape closes only the
// topmost surface: the popover never takes a panel behind it down with it, and a surface opened above it
// is the one that answers.
import React, { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { Dialog } from '../../../Shared/Product/Dialog'
import { hasActiveDialogLayer } from '../../../Shared/UI/dialog-layer'
import { FilterPopover } from '../FilterPopover'

afterEach(() => document.getElementById('app-modals')?.remove())

// The exit transitions of the overlays take a moment in jsdom: wait for them with room to spare.
const EXIT = { timeout: 4000 }

// `hidden`: a modal panel behind marks the rest of the page as hidden from the accessibility tree.
const pill = () => screen.getByRole('button', { name: /^Driver/, hidden: true })
const popup = () => screen.queryByRole('dialog', { name: 'Driver', hidden: true })

describe('FilterPopover · overlay layer (C3 B13)', () => {
  it('is a layer while it is open and releases it once it closes', async () => {
    const user = userEvent.setup()
    render(<FilterPopover label='Driver'><p>Body</p></FilterPopover>)
    expect(hasActiveDialogLayer()).toBe(false)
    await user.click(pill())
    expect(await screen.findByRole('dialog', { name: 'Driver', hidden: true })).toBeInTheDocument()
    expect(hasActiveDialogLayer()).toBe(true)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(popup()).toBeNull(), EXIT)
    await waitFor(() => expect(hasActiveDialogLayer()).toBe(false), EXIT)
  })

  it('an Escape inside the popover does not close the dialog behind it', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <>
        <Dialog open onOpenChange={onOpenChange} title='Panel' closeLabel='Close'>
          <p>Panel body</p>
        </Dialog>
        <FilterPopover label='Driver'><p>Body</p></FilterPopover>
      </>
    )
    await screen.findByRole('dialog', { name: 'Panel' })
    await user.click(pill())
    expect(await screen.findByRole('dialog', { name: 'Driver', hidden: true })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(popup()).toBeNull(), EXIT)
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Panel' })).toBeInTheDocument()
    // with the popover gone, the next Escape is the panel's again
    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('a surface opened above the popover answers the Escape, and the popover stays', async () => {
    const user = userEvent.setup()
    const Harness = () => {
      const [confirm, setConfirm] = useState(false)
      return (
        <>
          <FilterPopover label='Driver'><button type='button' onClick={() => setConfirm(true)}>Open above</button></FilterPopover>
          <Dialog open={confirm} onOpenChange={next => setConfirm(next)} title='Above' closeLabel='Close'>
            <p>Over the popover</p>
          </Dialog>
        </>
      )
    }
    render(<Harness />)
    await user.click(pill())
    await user.click(await within(await screen.findByRole('dialog', { name: 'Driver', hidden: true })).findByRole('button', { name: 'Open above' }))
    const above = await screen.findByRole('dialog', { name: 'Above' })
    // the focus has moved into the surface above: that is where the Escape goes
    await waitFor(() => expect(above.contains(document.activeElement)).toBe(true))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Above' })).toBeNull(), EXIT)
    expect(popup()).toBeInTheDocument()
  })
})

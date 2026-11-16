/* eslint-disable import/first */
// redesign fix-qa D1: the rows of a pill popover (Status, Driver, Driver group) opened and ignored every click.
// The popover is an overlay layer, so it creates the shared host `#app-modals` (fixed, full screen, z-index 3000
// in the app); a popup mounted in `body` sits under that host and the host takes the pointer. jsdom has no hit
// testing, so the check is structural: the popup is inside the host, stacked with the order of its layer, and a
// press / release / click sequence on a row (what the browser sends) reaches the controller's handler once.
import React, { useState } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { ChecklistPopover, FilterPopover } from '../FilterPopover'

afterEach(() => document.getElementById('app-modals')?.remove())

const ITEMS = [{ id: 1, name: 'Ada Lovelace' }, { id: 2, name: 'Grace Hopper' }]

const Harness = ({ onToggle }) => {
  const [selected, setSelected] = useState([])
  return (
    <ChecklistPopover
      label='Driver'
      items={ITEMS}
      selected={selected}
      onToggle={(id) => {
        onToggle(id)
        setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
      }}
      onClear={() => setSelected([])}
      // redesign W0-2a (T0-4): the texts are props now; the English the mock of `t` gave
      searchLabel='Search' clearSearchLabel='Clear search' loadingLabel='Loading...' noResultsLabel='No results found' clearLabel='Clear'
    />
  )
}

describe('FilterPopover · popup under the shared host (D1)', () => {
  it('mounts the popup inside #app-modals, with the order of its layer, never in body under the host', async () => {
    const user = userEvent.setup()
    render(<FilterPopover label='Driver'><p>Body</p></FilterPopover>)
    await user.click(screen.getByRole('button', { name: 'Driver' }))
    const popup = await screen.findByRole('dialog', { name: 'Driver', hidden: true })
    const host = document.getElementById('app-modals')
    expect(host).not.toBeNull()
    expect(host.contains(popup)).toBe(true)
    const portal = popup.closest('.odc-overlay-portal')
    expect(portal).not.toBeNull()
    expect(host.contains(portal)).toBe(true)
    expect(portal.style.getPropertyValue('--od-dialog-layer')).not.toBe('')
  })

  it('a pointerdown / pointerup / click on a row checks it and calls the handler once; the popover stays open', async () => {
    const onToggle = vi.fn()
    render(<Harness onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('button', { name: 'Driver' }))
    const popup = await screen.findByRole('dialog', { name: 'Driver', hidden: true })
    const row = within(popup).getByRole('checkbox', { name: 'Grace Hopper', hidden: true })
    fireEvent.pointerDown(row, { pointerType: 'mouse', button: 0 })
    fireEvent.mouseDown(row)
    fireEvent.pointerUp(row, { pointerType: 'mouse', button: 0 })
    fireEvent.mouseUp(row)
    fireEvent.click(row)
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onToggle).toHaveBeenCalledWith(2)
    await waitFor(() => expect(within(popup).getByRole('checkbox', { name: 'Grace Hopper', hidden: true })).toHaveAttribute('aria-checked', 'true'))
    expect(screen.getByRole('dialog', { name: 'Driver', hidden: true })).toBeInTheDocument()
    // a second press unchecks it
    fireEvent.click(within(popup).getByRole('checkbox', { name: 'Grace Hopper', hidden: true }))
    expect(onToggle).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(within(popup).getByRole('checkbox', { name: 'Grace Hopper', hidden: true })).toHaveAttribute('aria-checked', 'false'))
  })
})

/* eslint-disable import/first */
// redesign fix-qa E5: the clone content on the brand, inside the Product Dialog the panel opens it in. No
// second title (the dialog is already named «Clone order»), the two options as a radio group, Cancel then
// Clone at the end. What is chosen and sent stays asserted in CloneOrder.test.jsx.
import React from 'react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('~components', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { Dialog } from '../../../Shared/Product'
import { CloneOrder } from '..'

afterEach(() => document.getElementById('app-modals')?.remove())

const mount = (props = {}) => {
  const handlers = { setCloneState: vi.fn(), handleCloneOrder: vi.fn(), onOpenChange: vi.fn() }
  renderWithProviders(
    <Dialog open onOpenChange={handlers.onOpenChange} title='Clone order' closeLabel='Close' size='sm'>
      <CloneOrder
        cloneState={{ type: 1, loading: false }}
        setCloneState={handlers.setCloneState}
        handleCloneOrder={handlers.handleCloneOrder}
        {...props}
      />
    </Dialog>
  )
  return handlers
}

describe('CloneOrder · brand content', () => {
  it('has no second title: the dialog heading is the only «Clone order» heading', async () => {
    mount()
    const dialog = await screen.findByRole('dialog', { name: 'Clone order' })
    expect(within(dialog).getAllByRole('heading').map(heading => heading.textContent)).toEqual(['Clone order'])
  })

  it('offers the two options as one radio group with the chosen one checked', async () => {
    const { setCloneState } = mount({ cloneState: { type: 2, loading: false } })
    const group = await screen.findByRole('radiogroup', { name: 'Clone order' })
    const radios = within(group).getAllByRole('radio')
    expect(radios.map(radio => radio.closest('label').textContent)).toEqual(['Clone full order', 'Clone order without products'])
    expect(radios.map(radio => radio.checked)).toEqual([false, true])
    fireEvent.click(radios[0])
    expect(setCloneState).toHaveBeenCalledWith({ type: 1, loading: false })
  })

  it('ends with Cancel and then Clone, the primary action', async () => {
    mount()
    const dialog = await screen.findByRole('dialog', { name: 'Clone order' })
    const actions = within(dialog).getAllByRole('button').filter(button => ['Cancel', 'Clone'].includes(button.textContent))
    expect(actions.map(button => button.textContent)).toEqual(['Cancel', 'Clone'])
    expect(actions[1]).toHaveAttribute('data-variant', 'primary')
  })

  it('Cancel asks the dialog to close and never clones', async () => {
    const user = userEvent.setup()
    const { handleCloneOrder, onOpenChange } = mount()
    const dialog = await screen.findByRole('dialog', { name: 'Clone order' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(handleCloneOrder).not.toHaveBeenCalled()
  })

  it('uses onCancel when the opener gives one', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const { onOpenChange } = mount({ onCancel })
    const dialog = await screen.findByRole('dialog', { name: 'Clone order' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('Clone calls the clone handler once; while it runs it is busy and cannot repeat', async () => {
    const user = userEvent.setup()
    const { handleCloneOrder } = mount()
    const dialog = await screen.findByRole('dialog', { name: 'Clone order' })
    await user.click(within(dialog).getByRole('button', { name: 'Clone' }))
    expect(handleCloneOrder).toHaveBeenCalledTimes(1)
  })

  it('shows Clone busy and off while loading', async () => {
    mount({ cloneState: { type: 1, loading: true } })
    const dialog = await screen.findByRole('dialog', { name: 'Clone order' })
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Clone' })).toBeDisabled())
    expect(within(dialog).getByRole('button', { name: 'Clone' })).toHaveAttribute('aria-busy', 'true')
  })
})

/* eslint-disable import/first */
// redesign (owner decision 31 A): switching a store off asks first; switching it on does not.
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { useStoreDeactivateConfirm } from '../useStoreDeactivateConfirm'

const Host = ({ next, name, onAnswer }) => {
  const { confirmChange, dialog } = useStoreDeactivateConfirm()
  return (
    <>
      <button type='button' onClick={async () => onAnswer(await confirmChange(next, name))}>press</button>
      {dialog}
    </>
  )
}

describe('useStoreDeactivateConfirm', () => {
  it('answers yes at once when the store is switched on, with no dialog', async () => {
    const onAnswer = vi.fn()
    render(<Host next name='Fast Bite' onAnswer={onAnswer} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'press' }))
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(true))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('asks before switching off, naming the store, with the focus on Cancel; Cancel answers no', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()
    render(<Host next={false} name='Fast Bite $&' onAnswer={onAnswer} />)
    await user.click(screen.getByRole('button', { name: 'press' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Deactivate Fast Bite $&?' })
    expect(within(dialog).getByText("Customers won't be able to order from it until you turn it back on.")).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(onAnswer).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false))
  })

  it('answers yes on «Deactivate store»', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()
    render(<Host next={false} name='Fast Bite' onAnswer={onAnswer} />)
    await user.click(screen.getByRole('button', { name: 'press' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate store' }))
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(true))
  })
})

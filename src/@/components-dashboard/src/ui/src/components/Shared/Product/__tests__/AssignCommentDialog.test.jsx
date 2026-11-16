/* eslint-disable import/first */
// redesign deliveries-followups P3: the comment a project can require before a driver is assigned, one Product piece for
// the order panel and the /deliveries board (they were two copies). Its words are its own; the field is required and a comment of
// spaces only is empty.
import React, { useState } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, fallback) => fallback]
}))

import { AssignCommentDialog } from '..'

afterEach(() => document.getElementById('app-modals')?.remove())

const mount = (props = {}) => {
  const handlers = { onSubmit: vi.fn(), onCancel: vi.fn() }
  render(<AssignCommentDialog open {...handlers} {...props} />)
  return handlers
}
const footer = dialog => within(dialog.querySelector('.odc-overlay-foot')).getAllByRole('button').map(button => button.textContent)

describe('P/AssignCommentDialog', () => {
  it('is a dialog named Assignment comment with Cancel first and Assign driver last, and a Close', async () => {
    mount()
    const dialog = await screen.findByRole('dialog', { name: 'Assignment comment' })
    expect(footer(dialog)).toEqual(['Cancel', 'Assign driver'])
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('starts the focus on the comment, which has a visible label', async () => {
    mount()
    const dialog = await screen.findByRole('dialog', { name: 'Assignment comment' })
    const field = within(dialog).getByRole('textbox', { name: /Manual driver assigment comment/ })
    await waitFor(() => expect(field).toHaveFocus())
  })

  it.each([['empty', ''], ['spaces only', '   ']])('a comment %s is not sent: the field is invalid and the error is tied to it', async (_name, text) => {
    const user = userEvent.setup()
    const { onSubmit } = mount()
    const dialog = await screen.findByRole('dialog', { name: 'Assignment comment' })
    const field = within(dialog).getByRole('textbox')
    if (text) await user.type(field, text)
    await user.click(within(dialog).getByRole('button', { name: 'Assign driver' }))
    await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'))
    expect(field).toHaveAccessibleDescription(expect.stringContaining('This field is required'))
    expect(onSubmit).not.toHaveBeenCalled()
    // review r1 R-2: the focus goes to the field, as the order panel's form did (react-hook-form shouldFocusError)
    expect(field).toHaveFocus()
  })

  it('Assign driver sends the comment as typed, once', async () => {
    const user = userEvent.setup()
    const { onSubmit } = mount()
    const dialog = await screen.findByRole('dialog', { name: 'Assignment comment' })
    await user.type(within(dialog).getByRole('textbox'), 'Pick up at the side door')
    await user.click(within(dialog).getByRole('button', { name: 'Assign driver' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith('Pick up at the side door')
  })

  it('Escape and Cancel call onCancel without sending', async () => {
    const user = userEvent.setup()
    const { onSubmit, onCancel } = mount()
    const dialog = await screen.findByRole('dialog', { name: 'Assignment comment' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(2))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('draws nothing while closed', () => {
    mount({ open: false })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

// redesign bugs-d row 58 (deliveries-followups R-3): the dialog is opened from a listbox option of the driver selector, which unmounts when
// the driver is picked, so the opener is gone on close. The opt-in `returnFocus` says where the focus goes then.
describe('P/AssignCommentDialog · returnFocus', () => {
  const Harness = ({ withReturnFocus = true }) => {
    const [open, setOpen] = useState(false)
    const [optionShown, setOptionShown] = useState(true)
    return (
      <>
        <button type='button' aria-haspopup='listbox'>Driver trigger</button>
        {optionShown && (
          <button
            type='button'
            role='option'
            aria-selected='false'
            onClick={() => { setOpen(true); setOptionShown(false) }}
          >
            Driver option
          </button>
        )}
        <AssignCommentDialog
          open={open}
          onSubmit={() => {}}
          onCancel={() => setOpen(false)}
          returnFocus={withReturnFocus ? () => document.querySelector('[aria-haspopup="listbox"]') : undefined}
        />
      </>
    )
  }
  const openFromOption = async (user) => {
    await act(async () => { screen.getByRole('option', { name: 'Driver option' }).focus() })
    await user.click(screen.getByRole('option', { name: 'Driver option' }))
    return screen.findByRole('dialog', { name: 'Assignment comment' })
  }
  const closers = {
    Escape: async (user) => { await user.keyboard('{Escape}') },
    Cancel: async (user) => { await user.click(screen.getByRole('button', { name: 'Cancel' })) }
  }

  it.each(Object.keys(closers))('on %s the focus goes to returnFocus when the opener is gone', async (way) => {
    const user = userEvent.setup()
    render(<Harness />)
    await openFromOption(user)
    await closers[way](user)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Driver trigger' })))
  })

  it('without returnFocus the focus is lost to <body> once the opener is gone (as before)', async () => {
    const user = userEvent.setup()
    render(<Harness withReturnFocus={false} />)
    await openFromOption(user)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(document.body)
  })
})

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ConfirmDialog } from '../Dialog'

// redesign stores 2.A (decision 4): the opt-in middle action of ConfirmDialog («Keep editing · Save · Discard»).

afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

const renderDialog = (props = {}) => render(
  <ConfirmDialog
    open
    title='Leave this page?'
    confirmLabel='Discard changes'
    cancelLabel='Keep editing'
    closeLabel='Close confirmation'
    onConfirm={vi.fn()}
    onCancel={vi.fn()}
    {...props}
  >
    You have unsaved changes.
  </ConfirmDialog>
)

const footButtons = async () => {
  const dialog = await screen.findByRole('alertdialog')
  return [...dialog.querySelector('.odc-overlay-foot').querySelectorAll('button')]
}

const names = buttons => buttons.map(button => button.textContent)

describe('ConfirmDialog — opt-in extra action (stores 2.A)', () => {
  it('without extraLabel it keeps the two buttons it always had', async () => {
    renderDialog({ onExtra: vi.fn(), busyAction: 'extra' })
    const buttons = await footButtons()
    expect(names(buttons)).toEqual(['Keep editing', 'Discard changes'])
  })

  it('without extraLabel busyAction is ignored: busy puts the spinner on Confirm and disables Cancel', async () => {
    renderDialog({ busy: true, busyAction: 'extra' })
    const [cancel, confirm] = await footButtons()
    expect(cancel).toBeDisabled()
    expect(confirm).toHaveAttribute('aria-busy', 'true')
    expect(confirm.querySelector('.odc-spin')).not.toBeNull()
    expect(confirm).not.toBeDisabled()
  })

  it('draws the extra action between Cancel and Confirm, as a plain secondary button', async () => {
    renderDialog({ extraLabel: 'Save changes', onExtra: vi.fn() })
    const buttons = await footButtons()
    expect(names(buttons)).toEqual(['Keep editing', 'Save changes', 'Discard changes'])
    expect(buttons[1]).toHaveAttribute('data-variant', 'secondary')
    expect(buttons[2]).toHaveAttribute('data-variant', 'danger')
  })

  it('an empty extraLabel is a translation that paints empty, not a missing one', async () => {
    renderDialog({ extraLabel: '', onExtra: vi.fn() })
    const buttons = await footButtons()
    expect(names(buttons)).toEqual(['Keep editing', '', 'Discard changes'])
  })

  it('keeps the initial focus on Cancel', async () => {
    renderDialog({ extraLabel: 'Save changes', onExtra: vi.fn() })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Keep editing' })).toHaveFocus())
  })

  it('calls onExtra once, and neither onConfirm nor onCancel', async () => {
    const user = userEvent.setup()
    const onExtra = vi.fn()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    renderDialog({ extraLabel: 'Save changes', onExtra, onConfirm, onCancel })
    await user.click(await screen.findByRole('button', { name: 'Save changes' }))
    expect(onExtra).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('busy (default action) keeps the spinner on Confirm and disables Cancel and the extra action', async () => {
    const onExtra = vi.fn()
    renderDialog({ extraLabel: 'Save changes', onExtra, busy: true })
    const [cancel, extra, confirm] = await footButtons()
    expect(cancel).toBeDisabled()
    expect(extra).toBeDisabled()
    expect(extra).not.toHaveAttribute('aria-busy')
    expect(confirm).toHaveAttribute('aria-busy', 'true')
    expect(confirm.querySelector('.odc-spin')).not.toBeNull()
  })

  it('busyAction="extra" puts aria-busy and the spinner on the extra action and disables the others', async () => {
    const user = userEvent.setup()
    const onExtra = vi.fn()
    const onConfirm = vi.fn()
    renderDialog({ extraLabel: 'Save changes', onExtra, onConfirm, busy: true, busyAction: 'extra' })
    const [cancel, extra, confirm] = await footButtons()
    expect(extra).toHaveAttribute('aria-busy', 'true')
    expect(extra.querySelector('.odc-spin')).not.toBeNull()
    expect(extra).toHaveTextContent('Save changes')
    expect(cancel).toBeDisabled()
    expect(confirm).toBeDisabled()
    expect(confirm).not.toHaveAttribute('aria-busy')
    expect(confirm.querySelector('.odc-spin')).toBeNull()
    // a busy button blocks repeats
    await user.click(extra)
    await user.click(confirm)
    expect(onExtra).not.toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('while busy nothing cancels: Escape and the close button are blocked as before', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    renderDialog({ extraLabel: 'Save changes', onExtra: vi.fn(), onCancel, busy: true, busyAction: 'extra' })
    await screen.findByRole('alertdialog')
    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Close confirmation' })).toBeDisabled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('confirmDisabled still disables Confirm with the extra action present', async () => {
    renderDialog({ extraLabel: 'Save changes', onExtra: vi.fn(), confirmDisabled: true })
    const [, extra, confirm] = await footButtons()
    expect(confirm).toBeDisabled()
    expect(extra).not.toBeDisabled()
  })
})

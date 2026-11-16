/* eslint-disable import/first */
// redesign DT-B2 (decision 12 | C8): the confirmation of saving or deleting a block, with the propagation. The real Product Dialog and
// RadioGroup; only the language context is a stand-in (the default text of every key).
import React from 'react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, text) => text]
}))

import { BlockConfirmDialog } from '../BlockConfirmDialog'

afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
})

const SUMMARY = 'Carlos Mendoza · 09:00 – 17:00 · 20/10/2026'

const setup = (props = {}) => {
  const spies = { onPropagationChange: vi.fn(), onConfirm: vi.fn(), onCancel: vi.fn() }
  const view = render(
    <BlockConfirmDialog open kind='edit' summary={SUMMARY} propagation='none' busy={false} {...spies} {...props} />
  )
  return { ...spies, ...view, user: userEvent.setup() }
}

describe('BlockConfirmDialog · save', () => {
  it('asks «Save changes to this shift?» and says which shift (driver, hours, day)', async () => {
    setup()
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Save changes to this shift?' })).toBeInTheDocument()
    expect(dialog).toHaveTextContent(SUMMARY)
  })

  it('puts the initial focus on Cancel, never on the action', async () => {
    setup()
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
  })

  it('offers the four propagations as a radio group, each with its hint, and marks the current one', async () => {
    setup({ propagation: 'from_now' })
    const group = await screen.findByRole('radiogroup', { name: 'Select a propagation option' })
    const radios = within(group).getAllByRole('radio')
    expect(radios.map(radio => radio.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true', 'false'])
    expect(within(group).getByRole('radio', { name: 'None' })).toHaveAccessibleDescription('Only this shift')
    expect(within(group).getByRole('radio', { name: 'All' })).toHaveAccessibleDescription('Every shift of the series')
    expect(within(group).getByRole('radio', { name: 'From now' })).toHaveAccessibleDescription('From today on')
    expect(within(group).getByRole('radio', { name: 'From event' })).toHaveAccessibleDescription('This shift and the ones after it')
  })

  it('choosing a radio reports its value', async () => {
    const { user, onPropagationChange } = setup()
    await user.click(await screen.findByRole('radio', { name: 'All' }))
    expect(onPropagationChange).toHaveBeenCalledWith('all')
    await user.click(screen.getByRole('radio', { name: 'From event' }))
    expect(onPropagationChange).toHaveBeenLastCalledWith('from_event')
  })

  it('«Save shift» is the primary action and confirms; Cancel cancels', async () => {
    const { user, onConfirm, onCancel } = setup()
    const save = await screen.findByRole('button', { name: 'Save shift' })
    expect(save).toHaveAttribute('data-variant', 'primary')
    await user.click(save)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('Escape and the close button cancel too', async () => {
    const { user, onCancel } = setup()
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onCancel).toHaveBeenCalledTimes(2)
  })
})

describe('BlockConfirmDialog · delete', () => {
  it('asks «Delete this shift?» and the action is a «Delete shift» in danger tone', async () => {
    setup({ kind: 'delete' })
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Delete this shift?' })).toBeInTheDocument()
    const remove = within(dialog).getByRole('button', { name: 'Delete shift' })
    expect(remove).toHaveAttribute('data-variant', 'danger')
    expect(within(dialog).queryByRole('button', { name: 'Save shift' })).toBeNull()
  })

  it('keeps the propagation choice and confirms', async () => {
    const { user, onConfirm, onPropagationChange } = setup({ kind: 'delete' })
    await user.click(await screen.findByRole('radio', { name: 'From now' }))
    expect(onPropagationChange).toHaveBeenCalledWith('from_now')
    await user.click(screen.getByRole('button', { name: 'Delete shift' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('has the focus on Cancel here too', async () => {
    setup({ kind: 'delete' })
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
  })
})

// (row 34, drivers-time-display P-3): a block that does not repeat has no series to ask about. The dialog stays (it is the
// confirmation of a destructive delete), only the propagation question goes.
describe('BlockConfirmDialog · a block that does not repeat', () => {
  it('save: no propagation radio group, the summary and Cancel / Save shift stay', async () => {
    const { user, onConfirm } = setup({ repeats: false })
    const dialog = await screen.findByRole('dialog')
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(screen.queryByRole('radio')).toBeNull()
    expect(dialog).not.toHaveTextContent('Select a propagation option')
    expect(dialog).toHaveTextContent(SUMMARY)
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Save shift' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('delete: still asks «Delete this shift?», no radio group, the danger action confirms', async () => {
    const { user, onConfirm } = setup({ kind: 'delete', repeats: false })
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Delete this shift?' })).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup')).toBeNull()
    await user.click(within(dialog).getByRole('button', { name: 'Delete shift' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('repeats defaults to true: the radio group is there when the prop is not passed', async () => {
    setup()
    expect(await screen.findByRole('radiogroup', { name: 'Select a propagation option' })).toBeInTheDocument()
  })
})

describe('BlockConfirmDialog · busy', () => {
  it('shows the action busy and lets nothing cancel while it works', async () => {
    const { user, onCancel, onConfirm } = setup({ busy: true })
    const save = await screen.findByRole('button', { name: 'Save shift' })
    expect(save).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await user.click(save)
    expect(onConfirm).not.toHaveBeenCalled()
    await user.keyboard('{Escape}')
    expect(onCancel).not.toHaveBeenCalled()
  })
})

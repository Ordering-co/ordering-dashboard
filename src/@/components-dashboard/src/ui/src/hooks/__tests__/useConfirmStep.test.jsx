/* eslint-disable import/first */
// redesign (owner decision 25, C8): the confirmation step the later screens reuse. `ask({ title, body, confirmLabel,
// tone })` opens one ConfirmDialog (initial focus on Cancel) and resolves true on confirm, false on Cancel, Close or Escape.
import React, { useState } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))

import { useConfirmStep } from '../useConfirmStep'

const step = { title: 'Delete Ana?', body: 'She loses access.', confirmLabel: 'Delete user' }

// The host: every press asks and writes the answer down, so a test reads what each ask resolved to
const Host = ({ options = [step], onAnswer = () => {}, showDialog = true }) => {
  const { ask, dialog } = useConfirmStep()
  const [count, setCount] = useState(0)
  return (
    <>
      <button
        type='button'
        onClick={() => {
          const index = count
          setCount(index + 1)
          ask(options[Math.min(index, options.length - 1)]).then(answer => onAnswer(index, answer))
        }}
      >
        Ask
      </button>
      {showDialog && dialog}
    </>
  )
}

const openAsk = async (user) => {
  await user.click(screen.getByRole('button', { name: 'Ask' }))
  return screen.findByRole('alertdialog')
}

afterEach(() => document.getElementById('app-modals')?.remove())

describe('useConfirmStep', () => {
  it('shows the title, the body and the confirm label, and starts with the focus on Cancel', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const dialog = await openAsk(user)
    expect(within(dialog).getByText('Delete Ana?')).toBeInTheDocument()
    expect(within(dialog).getByText('She loses access.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Delete user' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
  })

  it('resolves true on confirm and closes', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()
    render(<Host onAnswer={onAnswer} />)
    const dialog = await openAsk(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete user' }))
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(0, true))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('resolves false on Cancel', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()
    render(<Host onAnswer={onAnswer} />)
    const dialog = await openAsk(user)
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(0, false))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('resolves false on the Close button', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()
    render(<Host onAnswer={onAnswer} />)
    const dialog = await openAsk(user)
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(0, false))
  })

  it('resolves false on Escape', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()
    render(<Host onAnswer={onAnswer} />)
    const dialog = await openAsk(user)
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    await user.keyboard('{Escape}')
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(0, false))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('keeps the texts while the dialog fades out: the title does not go blank', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()
    render(<Host onAnswer={onAnswer} />)
    const dialog = await openAsk(user)
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(onAnswer).toHaveBeenCalled())
    const leaving = screen.queryByRole('alertdialog')
    if (leaving) expect(within(leaving).getByText('Delete Ana?')).toBeInTheDocument()
  })

  it('a second ask while one is open resolves the first false and shows the second', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()
    const second = { title: 'Delete Marco?', body: 'He loses access.', confirmLabel: 'Delete Marco' }
    render(<Host options={[step, second]} onAnswer={onAnswer} />)
    await openAsk(user)
    // the page behind the open dialog is inert, so the second ask comes from code, not from a click: press through the DOM
    act(() => { screen.getByRole('button', { name: 'Ask', hidden: true }).click() })
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(0, false))
    const dialog = await screen.findByRole('alertdialog')
    await waitFor(() => expect(within(dialog).getByText('Delete Marco?')).toBeInTheDocument())
    await user.click(within(dialog).getByRole('button', { name: 'Delete Marco' }))
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(1, true))
    expect(onAnswer).toHaveBeenCalledTimes(2)
  })

  it('passes the tone to the dialog (danger by default, primary when asked)', async () => {
    const user = userEvent.setup()
    const options = [step, { ...step, tone: 'primary' }]
    render(<Host options={options} />)
    let dialog = await openAsk(user)
    expect(within(dialog).getByRole('button', { name: 'Delete user' })).toHaveAttribute('data-variant', 'danger')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    dialog = await openAsk(user)
    expect(within(dialog).getByRole('button', { name: 'Delete user' })).toHaveAttribute('data-variant', 'primary')
  })

  it('resolves false when the host unmounts with an ask pending', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()
    const { unmount } = render(<Host onAnswer={onAnswer} />)
    await openAsk(user)
    unmount()
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(0, false))
  })
})

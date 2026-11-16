/* eslint-disable import/first */
// redesign stores 1.B (G4-25): Stripe Link's Twilio secrets and a wallet's password config used to POST on
// every keystroke. They save once, on leaving the field or Enter, only if the value changed; a failure is shown.
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ toasts: [] }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useToast: () => [{}, { showToast: (type, message) => mocks.toasts.push([type, message]) }],
  ToastType: { Error: 'error' }
}))

import { commitOnBlur, commitOnKeyDown, useConfigSaveError } from '../configField'

const SecretField = ({ saved, onCommit }) => (
  <>
    <input type='password' aria-label='Twilio token' defaultValue={saved} onBlur={commitOnBlur(saved, onCommit)} onKeyDown={commitOnKeyDown(saved, onCommit)} />
    <button type='button'>Next</button>
  </>
)

const ErrorProbe = ({ error }) => {
  useConfigSaveError(error)
  return null
}

beforeEach(() => {
  mocks.toasts.length = 0
})

describe('commitOnBlur / commitOnKeyDown (G4-25)', () => {
  it('typing saves nothing; leaving the field saves the whole value once', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<SecretField saved='' onCommit={onCommit} />)
    await user.type(screen.getByLabelText('Twilio token'), 'abc123')
    expect(onCommit).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith('abc123')
  })

  it('Enter saves once and does not submit anything else', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<SecretField saved='old' onCommit={onCommit} />)
    const field = screen.getByLabelText('Twilio token')
    await user.clear(field)
    await user.type(field, 'new{Enter}')
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith('new')
    expect(field).not.toHaveFocus()
  })

  it('Escape saves what was typed (it may close the editor before the field blurs), and only once', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<SecretField saved='' onCommit={onCommit} />)
    await user.type(screen.getByLabelText('Twilio token'), 'tok{Escape}')
    expect(onCommit).toHaveBeenCalledWith('tok')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('leaving an unchanged field saves nothing', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<SecretField saved='same' onCommit={onCommit} />)
    await user.click(screen.getByLabelText('Twilio token'))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(onCommit).not.toHaveBeenCalled()
  })
})

describe('useConfigSaveError (G4-25)', () => {
  it('shows the API message of a failed save', () => {
    const { rerender } = render(<ErrorProbe error={null} />)
    expect(mocks.toasts).toEqual([])
    rerender(<ErrorProbe error={['Invalid value']} />)
    expect(mocks.toasts).toEqual([['error', 'Invalid value']])
  })
})

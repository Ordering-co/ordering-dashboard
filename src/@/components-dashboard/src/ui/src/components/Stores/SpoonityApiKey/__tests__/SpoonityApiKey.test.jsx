/* eslint-disable import/first */
// redesign stores 5.16 (; G2-36, defect 5.16-A): the Spoonity key on Product.
// - without a Spoonity config the section says so (main: Save threw a TypeError reading `spoonityConfig.id`);
// - the key is a P/SecretField: hidden by default, Show reveals it, the last four characters show once it is long enough;
// - it is a draft saved by the P/SaveBar (decision 4): nothing is sent on typing, an empty key is not sent, a failed save
//   says why and never says «Saved», leaving with the draft asks (2.A).
import React from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { LeaveGuardContext } from '../../../Shared/Product'
import { SpoonityApiKey } from '../index'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const STORED = 'abcdEFGH1234zz'

const renderSection = ({ spoonityConfig = { id: 9, value: STORED }, update, host } = {}) => {
  const handleUpdateSpoonityKey = update || vi.fn().mockResolvedValue({ ok: true, result: { id: 9, value: 'x' } })
  render(
    <LeaveGuardContext.Provider value={host || null}>
      <SpoonityApiKey
        spoonityConfig={spoonityConfig}
        handleUpdateSpoonityKey={handleUpdateSpoonityKey}
        spoonityKeyState={{ loading: false, key: '', result: { error: false } }}
      />
    </LeaveGuardContext.Provider>
  )
  return { handleUpdateSpoonityKey }
}
const input = () => screen.getByLabelText('Api key', { selector: 'input' })
const bar = () => screen.queryByRole('group', { name: 'Save changes' })
const save = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) }) }

describe('SpoonityApiKey · without a Spoonity config', () => {
  it('says Spoonity is not set up and draws no form, no field and no Save', () => {
    renderSection({ spoonityConfig: null })
    expect(screen.getByRole('heading', { level: 1, name: 'Spoonity key' })).toBeInTheDocument()
    expect(screen.getByText('Spoonity is not set up for this store')).toBeInTheDocument()
    expect(screen.queryByLabelText('Api key')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(bar()).toBeNull()
  })

  it('does the same for a config without id', () => {
    renderSection({ spoonityConfig: { value: 'abc' } })
    expect(screen.getByText('Spoonity is not set up for this store')).toBeInTheDocument()
    expect(screen.queryByLabelText('Api key')).toBeNull()
  })
})

describe('SpoonityApiKey · the secret field', () => {
  it('hides the key by default and Show reveals it', async () => {
    const user = userEvent.setup()
    renderSection()
    expect(input()).toHaveAttribute('type', 'password')
    expect(input()).toHaveValue(STORED)
    await user.click(screen.getByRole('button', { name: /Show/ }))
    expect(input()).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: /Hide/ })).toBeInTheDocument()
  })

  it('shows how the key ends', () => {
    renderSection()
    expect(screen.getByText(/Ends in/)).toHaveTextContent('Ends in …34zz')
  })

  it('starts empty when the config has no value', () => {
    renderSection({ spoonityConfig: { id: 9 } })
    expect(input()).toHaveValue('')
  })

  it('only lets letters and digits be typed, as main', async () => {
    const user = userEvent.setup()
    renderSection({ spoonityConfig: { id: 9, value: '' } })
    await user.type(input(), 'ab-c_ 1!2')
    expect(input()).toHaveValue('abc12')
  })
})

describe('SpoonityApiKey · save (decision 4)', () => {
  it('has no bar until the key changes; typing writes nothing', async () => {
    const user = userEvent.setup()
    const { handleUpdateSpoonityKey } = renderSection()
    expect(bar()).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    await user.type(input(), 'Q')
    expect(handleUpdateSpoonityKey).not.toHaveBeenCalled()
    expect(within(bar()).getByText(/1 unsaved change/)).toBeTruthy()
    expect(within(bar()).getByText(/Api key/)).toBeTruthy()
  })

  it('Discard goes back to the stored key and removes the bar', async () => {
    const user = userEvent.setup()
    renderSection()
    await user.type(input(), 'Q')
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(input()).toHaveValue(STORED)
    expect(bar()).toBeNull()
  })

  it('typing the stored key back leaves nothing to save', async () => {
    const user = userEvent.setup()
    renderSection()
    await user.type(input(), 'Q')
    await user.keyboard('{Backspace}')
    expect(bar()).toBeNull()
  })

  it('Save sends the trimmed key with the config id, then says Saved and clears it later', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { handleUpdateSpoonityKey } = renderSection()
    fireEvent.change(input(), { target: { value: '  NewKey99  ' } })
    await save()
    expect(handleUpdateSpoonityKey).toHaveBeenCalledTimes(1)
    expect(handleUpdateSpoonityKey).toHaveBeenCalledWith('NewKey99', 9)
    expect(screen.getByText('Saved')).toBeInTheDocument()
    expect(input()).toHaveValue('NewKey99')
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    act(() => { vi.advanceTimersByTime(5000) })
    expect(screen.queryByText('Saved')).toBeNull()
  })

  it('Enter in the field saves too', async () => {
    const user = userEvent.setup()
    const { handleUpdateSpoonityKey } = renderSection()
    await user.type(input(), 'Q{Enter}')
    expect(handleUpdateSpoonityKey).toHaveBeenCalledWith(`${STORED}Q`, 9)
  })

  it('a whitespace-only key is not sent and says it is required', async () => {
    const { handleUpdateSpoonityKey } = renderSection()
    fireEvent.change(input(), { target: { value: '   ' } })
    await save()
    expect(handleUpdateSpoonityKey).not.toHaveBeenCalled()
    expect(screen.getByText('Spoonity key is required')).toBeInTheDocument()
    expect(input()).toBeInvalid()
    expect(screen.queryByText('Saved')).toBeNull()
  })

  it('an emptied key is not sent either, and typing again clears the message', async () => {
    const { handleUpdateSpoonityKey } = renderSection()
    fireEvent.change(input(), { target: { value: '' } })
    await save()
    expect(handleUpdateSpoonityKey).not.toHaveBeenCalled()
    expect(screen.getByText('Spoonity key is required')).toBeInTheDocument()
    fireEvent.change(input(), { target: { value: 'k' } })
    expect(screen.queryByText('Spoonity key is required')).toBeNull()
  })

  it('a failed save says why, keeps the draft, never says Saved, and Try again sends it again', async () => {
    const update = vi.fn().mockResolvedValueOnce({ ok: false, error: ['Invalid key'] }).mockResolvedValueOnce({ ok: true, result: {} })
    renderSection({ update })
    fireEvent.change(input(), { target: { value: 'Bad' } })
    await save()
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid key')
    expect(screen.queryByText('Saved')).toBeNull()
    expect(input()).toHaveValue('Bad')
    expect(bar()).not.toBeNull()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })) })
    expect(update).toHaveBeenCalledTimes(2)
    expect(update).toHaveBeenLastCalledWith('Bad', 9)
    expect(screen.getByText('Saved')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a failed save without a message says the generic one', async () => {
    const update = vi.fn().mockResolvedValue({ ok: false })
    renderSection({ update })
    fireEvent.change(input(), { target: { value: 'Bad' } })
    await save()
    expect(screen.getByRole('alert')).toHaveTextContent('Spoonity key error')
  })

  it('a handler that throws is a failed save, not a crash', async () => {
    const update = vi.fn().mockRejectedValue(new Error('boom'))
    renderSection({ update })
    fireEvent.change(input(), { target: { value: 'Bad' } })
    await save()
    expect(screen.getByRole('alert')).toHaveTextContent('boom')
    expect(screen.queryByText('Saved')).toBeNull()
  })

  it('shows the bar as saving while the request runs and sends once', async () => {
    let finish
    const update = vi.fn(() => new Promise(resolve => { finish = resolve }))
    renderSection({ update })
    fireEvent.change(input(), { target: { value: 'Slow' } })
    await save()
    expect(bar()).toHaveAttribute('data-saving')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(update).toHaveBeenCalledTimes(1)
    await act(async () => { finish({ ok: true, result: {} }) })
    expect(bar()).not.toHaveAttribute('data-saving')
  })
})

describe('SpoonityApiKey · leave guard (2.A)', () => {
  it('registers: dirty with a draft, and its save works', async () => {
    let entry
    const host = { register: vi.fn(ref => { entry = ref; return () => {} }), requestLeave: vi.fn() }
    const { handleUpdateSpoonityKey } = renderSection({ host })
    expect(host.register).toHaveBeenCalledTimes(1)
    expect(entry.current.isDirty()).toBe(false)
    fireEvent.change(input(), { target: { value: 'Draft1' } })
    expect(entry.current.isDirty()).toBe(true)
    await act(async () => { await entry.current.save() })
    expect(handleUpdateSpoonityKey).toHaveBeenCalledWith('Draft1', 9)
  })
})

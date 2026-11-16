/* eslint-disable import/first */
// redesign AB-B3 (decision 2; defect M-AB07, auditor 1): the self-saving name of the banner panel. Only the language context is mocked
// (the text of `t` is its default); TextField is the real Product wrapper. Nothing is ever sent: `onSave` is a spy.
import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text]
}))

import { BannerNameField } from '../BannerNameField'

const DEBOUNCE = 750

const deferred = () => {
  let resolve
  const promise = new Promise(_resolve => { resolve = _resolve })
  return { promise, resolve }
}

const type = (value) => fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value } })
const advance = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const liveLine = (container) => container.querySelector('[aria-live="polite"]')

let onSave

beforeEach(() => {
  vi.useFakeTimers()
  onSave = vi.fn().mockResolvedValue({ ok: true, error: null })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('BannerNameField saves by itself, as main does, 750 ms after the last keystroke', () => {
  it('starts with the name and sends nothing until the person types', async () => {
    render(<BannerNameField name='Burger week' onSave={onSave} />)
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Burger week')
    await advance(5000)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('waits for the pause: only the last text is sent, once', async () => {
    render(<BannerNameField name='Burger week' onSave={onSave} />)
    type('Burger week 2')
    await advance(DEBOUNCE - 50)
    type('Burger week 20')
    await advance(DEBOUNCE - 1)
    expect(onSave).not.toHaveBeenCalled()
    await advance(1)
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith('Burger week 20')
  })

  it('does not send a text that is the stored one', async () => {
    render(<BannerNameField name='Burger week' onSave={onSave} />)
    type('Burger weeks')
    type('Burger week')
    await advance(DEBOUNCE * 2)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('has no Save button: the field is the whole control', () => {
    render(<BannerNameField name='Burger week' onSave={onSave} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('BannerNameField says what it is doing (M-AB07)', () => {
  it('has a polite live line from the start, empty', () => {
    const { container } = render(<BannerNameField name='Burger week' onSave={onSave} />)
    expect(liveLine(container)).not.toBeNull()
    expect(liveLine(container)).toHaveTextContent('')
  })

  it('says «Saving…» while the call is in flight and «Saved» when it works', async () => {
    const call = deferred()
    onSave.mockReturnValue(call.promise)
    const { container } = render(<BannerNameField name='Burger week' onSave={onSave} />)
    type('Burger week 2')
    await advance(DEBOUNCE)
    expect(liveLine(container)).toHaveTextContent('Saving…')
    await act(async () => { call.resolve({ ok: true, error: null }) })
    expect(liveLine(container)).toHaveTextContent('Saved')
  })

  it('«Saved» goes away when the person types again', async () => {
    const { container } = render(<BannerNameField name='Burger week' onSave={onSave} />)
    type('Burger week 2')
    await advance(DEBOUNCE)
    expect(liveLine(container)).toHaveTextContent('Saved')
    type('Burger week 23')
    expect(liveLine(container)).toHaveTextContent('')
  })

  it('a controller that resolves nothing (the legacy one) counts as saved', async () => {
    onSave.mockResolvedValue(undefined)
    const { container } = render(<BannerNameField name='Burger week' onSave={onSave} />)
    type('Burger week 2')
    await advance(DEBOUNCE)
    expect(liveLine(container)).toHaveTextContent('Saved')
  })

  it('a failed save is the error of the field, translated, and the text stays', async () => {
    onSave.mockResolvedValue({ ok: false, error: ['The name is already in use'] })
    render(<BannerNameField name='Burger week' onSave={onSave} />)
    type('Fries')
    await advance(DEBOUNCE)
    expect(screen.getByRole('alert')).toHaveTextContent('The name is already in use')
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Fries')
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByText('Saved')).toBeNull()
  })

  it('a failed save with no text, or a rejected call, still says something', async () => {
    onSave.mockResolvedValue({ ok: false, error: null })
    render(<BannerNameField name='Burger week' onSave={onSave} />)
    type('Fries')
    await advance(DEBOUNCE)
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't save the name. Try again.")
    cleanup()

    onSave.mockRejectedValue(new Error('Network down'))
    render(<BannerNameField name='Burger week' onSave={onSave} />)
    type('Fries')
    await advance(DEBOUNCE)
    expect(screen.getByRole('alert')).toHaveTextContent('Network down')
  })

  it('typing after a failure clears the error', async () => {
    onSave.mockResolvedValueOnce({ ok: false, error: ['Nope'] })
    render(<BannerNameField name='Burger week' onSave={onSave} />)
    type('Fries')
    await advance(DEBOUNCE)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    type('Fries 2')
    expect(screen.queryByRole('alert')).toBeNull()
    await advance(DEBOUNCE)
    expect(onSave).toHaveBeenLastCalledWith('Fries 2')
  })
})

describe('BannerNameField does not save a blank name (M-AB07)', () => {
  it('says «Enter a name.» and sends nothing', async () => {
    render(<BannerNameField name='Burger week' onSave={onSave} />)
    type('')
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name.')
    await advance(DEBOUNCE * 2)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('spaces only are blank too', async () => {
    render(<BannerNameField name='Burger week' onSave={onSave} />)
    type('   ')
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name.')
    await advance(DEBOUNCE * 2)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('cancels the pending save of the text before it (today it still fired)', async () => {
    render(<BannerNameField name='Burger week' onSave={onSave} />)
    type('Fries')
    await advance(DEBOUNCE - 100)
    type('')
    await advance(DEBOUNCE * 2)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('and unmounting while it is blank sends nothing either', async () => {
    const { unmount } = render(<BannerNameField name='Burger week' onSave={onSave} />)
    type('Fries')
    type('')
    unmount()
    await advance(DEBOUNCE * 2)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('the error goes away when a name is typed', () => {
    render(<BannerNameField name='Burger week' onSave={onSave} />)
    type('')
    expect(screen.getByRole('alert')).toBeInTheDocument()
    type('Fries')
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('BannerNameField loses nothing when the panel goes away (auditor 1)', () => {
  it('unmounting with a pending save sends it at once, once', async () => {
    const { unmount } = render(<BannerNameField name='Burger week' onSave={onSave} />)
    type('Fries')
    await advance(DEBOUNCE - 100)
    expect(onSave).not.toHaveBeenCalled()
    unmount()
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith('Fries')
    await advance(DEBOUNCE * 2)
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('unmounting with nothing pending sends nothing', async () => {
    const { unmount } = render(<BannerNameField name='Burger week' onSave={onSave} />)
    unmount()
    await advance(DEBOUNCE * 2)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('unmounting after the save went out sends nothing more', async () => {
    const { unmount } = render(<BannerNameField name='Burger week' onSave={onSave} />)
    type('Fries')
    await advance(DEBOUNCE)
    expect(onSave).toHaveBeenCalledTimes(1)
    unmount()
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('the pending save goes through the onSave the field had last', () => {
    const first = vi.fn().mockResolvedValue({ ok: true })
    const second = vi.fn().mockResolvedValue({ ok: true })
    const { rerender, unmount } = render(<BannerNameField name='Burger week' onSave={first} />)
    type('Fries')
    rerender(<BannerNameField name='Burger week' onSave={second} />)
    unmount()
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith('Fries')
  })
})

describe('BannerNameField and a new name from outside', () => {
  it('replaces the text when the person has no unsaved edit', () => {
    const { rerender } = render(<BannerNameField name='Burger week' onSave={onSave} />)
    rerender(<BannerNameField name='Pizza week' onSave={onSave} />)
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Pizza week')
  })

  it('keeps the text when there is an unsaved edit', async () => {
    const { rerender } = render(<BannerNameField name='Burger week' onSave={onSave} />)
    type('Fries')
    rerender(<BannerNameField name='Pizza week' onSave={onSave} />)
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Fries')
    await advance(DEBOUNCE)
    expect(onSave).toHaveBeenCalledWith('Fries')
  })

  it('keeps a failed edit too, so the person can fix it', async () => {
    onSave.mockResolvedValue({ ok: false, error: ['Nope'] })
    const { rerender } = render(<BannerNameField name='Burger week' onSave={onSave} />)
    type('Fries')
    await advance(DEBOUNCE)
    rerender(<BannerNameField name='Pizza week' onSave={onSave} />)
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Fries')
  })

  it('takes the name the save just stored without flicker (the host passes it back)', async () => {
    const { rerender } = render(<BannerNameField name='Burger week' onSave={onSave} />)
    type('Fries')
    await advance(DEBOUNCE)
    rerender(<BannerNameField name='Fries' onSave={onSave} />)
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Fries')
    rerender(<BannerNameField name='Pizza week' onSave={onSave} />)
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Pizza week')
  })

  it('a banner with no name starts empty, without the blank error', () => {
    render(<BannerNameField name={undefined} onSave={onSave} />)
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('')
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

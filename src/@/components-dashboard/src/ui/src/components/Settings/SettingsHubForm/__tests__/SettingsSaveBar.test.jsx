import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))

import { SettingsSaveBar } from '../SettingsSaveBar'

// redesign settings B

const renderBar = (props = {}) => render(<SettingsSaveBar count={0} onDiscard={vi.fn()} onSave={vi.fn()} {...props} />)

describe('SettingsSaveBar', () => {
  it('draws nothing while there is nothing to say', () => {
    const { container } = renderBar()
    expect(container).toBeEmptyDOMElement()
  })

  it('counts the changes (one and other) and lists up to three names with «+n»', () => {
    const view = renderBar({ count: 1, names: ['Tax'] })
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
    expect(screen.getByText(/Tax/)).toBeInTheDocument()

    view.rerender(<SettingsSaveBar count={5} names={['A', 'B', 'C', 'D', 'E']} onDiscard={vi.fn()} onSave={vi.fn()} />)
    expect(screen.getByText('5 unsaved changes')).toBeInTheDocument()
    expect(screen.getByText(/A, B, C \+2/)).toBeInTheDocument()
    expect(screen.queryByText(/\bD\b/)).toBeNull()
  })

  it('offers Discard and Save changes and calls their handlers', async () => {
    const onDiscard = vi.fn()
    const onSave = vi.fn()
    renderBar({ count: 2, names: ['A', 'B'], onDiscard, onSave })

    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(onDiscard).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('is fixed to the foot of the content (a sticky group named by its action)', () => {
    renderBar({ count: 1, names: ['A'] })
    const bar = screen.getByRole('group', { name: 'Save changes' })
    expect(bar).toHaveClass('odc-hub-savebar')
  })

  it('marks the save button busy and blocks Discard and repeated saves while saving', async () => {
    const onDiscard = vi.fn()
    const onSave = vi.fn()
    renderBar({ count: 2, saving: true, onDiscard, onSave })

    const save = screen.getByRole('button', { name: 'Save changes' })
    expect(save).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Discard' })).toBeDisabled()
    await userEvent.click(save)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('says how many fields to fix (validation), with plural forms, as an alert', () => {
    const view = renderBar({ count: 2, error: { kind: 'validation', invalidCount: 1 } })
    expect(screen.getByRole('alert')).toHaveTextContent('Fix 1 field to save.')

    view.rerender(<SettingsSaveBar count={2} error={{ kind: 'validation', invalidCount: 3 }} onDiscard={vi.fn()} onSave={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Fix 3 fields to save.')
  })

  it('says the API failed with its message', () => {
    renderBar({ count: 2, error: { kind: 'api', message: 'Server unavailable' } })
    expect(screen.getByRole('alert')).toHaveTextContent('We couldn\'t save your changes. Server unavailable')
  })

  it('says how many were stored and which one failed (partial)', () => {
    // 3 changes in the batch: 1 stored, 2 still pending (the failed one and the one after it)
    renderBar({ count: 2, error: { kind: 'partial', savedCount: 1, failedName: 'Tax rate', message: 'Invalid value' } })
    expect(screen.getByRole('alert')).toHaveTextContent('Saved 1 of 3. Tax rate failed: Invalid value')
  })

  it('does not show an error while a save is running', () => {
    renderBar({ count: 2, saving: true, error: { kind: 'api', message: 'old' } })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows «Saved» as a status when the changes are stored, and not next to new unsaved changes', () => {
    const view = renderBar({ count: 0, saved: true })
    expect(screen.getByRole('status')).toHaveTextContent('Saved')
    expect(screen.queryByRole('button')).toBeNull()

    view.rerender(<SettingsSaveBar count={1} names={['A']} saved onDiscard={vi.fn()} onSave={vi.fn()} />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('moves the focus to the «Saved» status when the save button that had it goes away', async () => {
    const view = renderBar({ count: 1, names: ['A'] })
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    view.rerender(<SettingsSaveBar count={0} saved onDiscard={vi.fn()} onSave={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveFocus()
  })

  // redesign settings R-02
  it('gives the focus back to its form when «Saved» ends with the focus inside the bar', async () => {
    const Form = (props) => (
      <div>
        <div className='odc-hub-form' tabIndex={-1} data-testid='form' />
        <SettingsSaveBar onDiscard={vi.fn()} onSave={vi.fn()} {...props} />
      </div>
    )
    const view = render(<Form count={1} names={['A']} />)
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    view.rerender(<Form count={0} saved />)
    expect(screen.getByRole('status')).toHaveFocus()
    view.rerender(<Form count={0} saved={false} />)
    expect(screen.getByTestId('form')).toHaveFocus()
  })
})

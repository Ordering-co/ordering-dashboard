import React, { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Button } from '../Button'
import { SelectionBar } from '../SelectionBar'

const renderBar = (props = {}) => render(
  <SelectionBar
    label='Bulk actions'
    countLabel='3 selected'
    selectAllLabel='Select all 744'
    onSelectAll={vi.fn()}
    actions={
      <>
        <Button size='sm'>Assign driver</Button>
        <Button size='sm' data-tone='danger'>Cancel orders</Button>
      </>
    }
    clearLabel='Clear selection'
    onClear={vi.fn()}
    {...props}
  />
)

describe('SelectionBar (C6)', () => {
  it('is a named region with a polite status counter', () => {
    const { container } = renderBar()
    const region = screen.getByRole('region', { name: 'Bulk actions' })
    expect(region).toHaveClass('odc-selbar')
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('3 selected')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(region).toContainElement(status)
    expect(container.querySelector('.odc-selbar-separator')).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders the actions and the danger tone hook', () => {
    renderBar()
    expect(screen.getByRole('button', { name: 'Assign driver' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel orders' })).toHaveAttribute('data-tone', 'danger')
  })

  it('selects everything and clears from named buttons', async () => {
    const onSelectAll = vi.fn()
    const onClear = vi.fn()
    renderBar({ onSelectAll, onClear })
    await userEvent.click(screen.getByRole('button', { name: 'Select all 744' }))
    expect(onSelectAll).toHaveBeenCalledOnce()
    const clear = screen.getByRole('button', { name: 'Clear selection' })
    expect(clear).toHaveAttribute('data-icon-only')
    await userEvent.click(clear)
    expect(onClear).toHaveBeenCalledOnce()
  })

  it('leaves out the select-all link when there is nothing to select', () => {
    renderBar({ selectAllLabel: undefined, onSelectAll: undefined })
    expect(screen.queryByRole('button', { name: /Select all/ })).toBeNull()
  })

  it('clears with Escape from inside the bar', async () => {
    const onClear = vi.fn()
    renderBar({ onClear })
    screen.getByRole('button', { name: 'Assign driver' }).focus()
    await userEvent.keyboard('{Escape}')
    expect(onClear).toHaveBeenCalledOnce()
  })

  it('requires a region label and a clear label', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderBar({ label: undefined })).toThrow('SelectionBar needs a label')
    expect(() => renderBar({ clearLabel: undefined })).toThrow('SelectionBar needs a clearLabel')
  })

  it('has no interface text of its own', () => {
    const { container } = renderBar({ countLabel: '', selectAllLabel: undefined, onSelectAll: undefined, actions: null })
    expect(container.textContent).toBe('')
  })
})

// Select all N matching (decision 3 of the orders pilot): the same bar carries a busy state,
// an inline message and keeps the keyboard where the link was when the link goes away.
describe('SelectionBar · select all matching', () => {
  it('while busy it is marked aria-busy and the link stays focusable but does nothing', async () => {
    const onSelectAll = vi.fn()
    renderBar({ busy: true, onSelectAll })
    expect(screen.getByRole('region', { name: 'Bulk actions' })).toHaveAttribute('aria-busy', 'true')
    const link = screen.getByRole('button', { name: 'Select all 744' })
    expect(link).toHaveAttribute('aria-disabled', 'true')
    expect(link).not.toBeDisabled()
    await userEvent.click(link)
    expect(onSelectAll).not.toHaveBeenCalled()
  })

  it('is not busy by default', () => {
    renderBar()
    expect(screen.getByRole('region', { name: 'Bulk actions' })).not.toHaveAttribute('aria-busy')
    expect(screen.getByRole('button', { name: 'Select all 744' })).not.toHaveAttribute('aria-disabled')
  })

  it('shows an inline message as an alert next to the count, and none by default', () => {
    const { rerender } = renderBar()
    expect(screen.queryByRole('alert')).toBeNull()
    rerender(
      <SelectionBar label='Bulk actions' countLabel='3 selected' message='Could not select all' clearLabel='Clear selection' onClear={vi.fn()} />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Could not select all')
    expect(screen.getByRole('region', { name: 'Bulk actions' })).toContainElement(screen.getByRole('alert'))
  })

  it('puts the link right after the count in the tab order', async () => {
    renderBar()
    const user = userEvent.setup()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Select all 744' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Assign driver' })).toHaveFocus()
  })

  it('moves the focus to Clear selection when the link that had it goes away', async () => {
    const Harness = () => {
      const [all, setAll] = useState(false)
      return (
        <SelectionBar
          label='Bulk actions'
          countLabel={all ? 'All 744 selected' : '3 selected'}
          selectAllLabel={all ? undefined : 'Select all 744'}
          onSelectAll={all ? undefined : () => setAll(true)}
          clearLabel='Clear selection'
          onClear={vi.fn()}
        />
      )
    }
    render(<Harness />)
    const user = userEvent.setup()
    await user.tab()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('status')).toHaveTextContent('All 744 selected')
    expect(screen.getByRole('button', { name: 'Clear selection' })).toHaveFocus()
  })

  it('leaves the focus alone when the link was not the focused element', async () => {
    const Harness = () => {
      const [all, setAll] = useState(false)
      return (
        <>
          <button type='button' onClick={() => setAll(true)}>outside</button>
          <SelectionBar
            label='Bulk actions'
            countLabel='3 selected'
            selectAllLabel={all ? undefined : 'Select all 744'}
            onSelectAll={all ? undefined : () => {}}
            clearLabel='Clear selection'
            onClear={vi.fn()}
          />
        </>
      )
    }
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'outside' }))
    expect(screen.getByRole('button', { name: 'Clear selection' })).not.toHaveFocus()
  })
})

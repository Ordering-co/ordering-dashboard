import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import { HubOverview } from '../HubOverview'

// redesign settings A: the landing. Presentational: texts arrive translated.

const tasks = [
  { key: 'reject', label: 'Let drivers reject assigned orders' },
  { key: 'tips', label: 'Change the driver tip amounts' },
  { key: 'dates', label: 'Change how dates and times look' }
]

const groups = [
  {
    key: 'payments',
    label: 'Payments',
    description: 'Card payments, wallets and gateways.',
    sections: [
      { key: 'stripe', label: 'Card payments (Stripe)' },
      { key: 'apple', label: 'Apple Pay' },
      { key: 'gift', label: 'Gift cards' }
    ],
    moreCount: 5,
    moreLabel: '+5'
  },
  {
    key: 'languages',
    label: 'Languages',
    description: 'Available languages.',
    sections: [{ key: 'lm', label: 'Language manager' }],
    moreCount: 0,
    moreLabel: '+0'
  }
]

const setup = (props = {}) => {
  const handlers = { onTaskSelect: vi.fn(), onSectionSelect: vi.fn(), onGroupSelect: vi.fn() }
  render(<HubOverview title='What do you want to do?' tasks={tasks} groups={groups} {...handlers} {...props} />)
  return handlers
}

describe('HubOverview', () => {
  it('lists the tasks as buttons under the title', () => {
    setup()
    expect(screen.getByRole('heading', { level: 2, name: 'What do you want to do?' })).toBeInTheDocument()
    for (const task of tasks) {
      expect(screen.getByRole('button', { name: task.label })).toBeInTheDocument()
    }
  })

  it('opens a task with its key', () => {
    const { onTaskSelect } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Change the driver tip amounts' }))
    expect(onTaskSelect).toHaveBeenCalledWith('tips')
  })

  it('moves the focus between tasks with the arrows without opening one', () => {
    const { onTaskSelect } = setup()
    const first = screen.getByRole('button', { name: tasks[0].label })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    expect(screen.getByRole('button', { name: tasks[1].label })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('button', { name: tasks[1].label }), { key: 'ArrowUp' })
    expect(first).toHaveFocus()
    // wraps around
    fireEvent.keyDown(first, { key: 'ArrowUp' })
    expect(screen.getByRole('button', { name: tasks[2].label })).toHaveFocus()
    expect(onTaskSelect).not.toHaveBeenCalled()
  })

  it('draws a card per group with its label, description and sections', () => {
    setup()
    const card = screen.getByRole('heading', { level: 3, name: 'Payments' }).closest('section')
    expect(within(card).getByText('Card payments, wallets and gateways.')).toBeInTheDocument()
    expect(within(card).getAllByRole('button').map(button => button.textContent)).toEqual([
      'Card payments (Stripe)',
      'Apple Pay',
      'Gift cards',
      '+5'
    ])
  })

  it('opens a section of a card with its group and key', () => {
    const { onSectionSelect } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Apple Pay' }))
    expect(onSectionSelect).toHaveBeenCalledWith('payments', 'apple')
  })

  it('«+n» opens the group, and is named with the group', () => {
    const { onGroupSelect } = setup()
    fireEvent.click(screen.getByRole('button', { name: '+5 Payments' }))
    expect(onGroupSelect).toHaveBeenCalledWith('payments')
  })

  it('has no «+n» when the card already shows every section', () => {
    setup()
    const card = screen.getByRole('heading', { level: 3, name: 'Languages' }).closest('section')
    expect(within(card).getAllByRole('button')).toHaveLength(1)
  })

  it('draws only the tasks when it has no groups (the phone)', () => {
    setup({ groups: [] })
    expect(screen.getByRole('button', { name: tasks[0].label })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument()
  })
})

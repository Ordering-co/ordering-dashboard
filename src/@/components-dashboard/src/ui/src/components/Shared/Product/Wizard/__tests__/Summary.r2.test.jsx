// redesign W0-2 r2 (W0-Q1-09): the Edit buttons of the summary were all named «Edit». The accessible name is the visible
// «Edit» plus the label of its block («Edit Customer»), built from props the summary already has (editLabel, block.label).
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Summary } from '../Summary'

const blocks = [
  { id: 'customer', label: 'Customer', lines: ['Ada Lovelace'], step: 1 },
  { id: 'business', label: 'Business', lines: ['Fast Bite'], step: 2 },
  { id: 'items', label: 'Items', lines: null, step: 3 }
]

const setup = (props = {}) => render(
  <Summary label='Order summary' blocks={blocks} total={null} totalLabel='Total' editLabel='Edit' notSetLabel='Not set yet' {...props} />
)

describe('Summary · accessible name of the Edit buttons (W0-Q1-09)', () => {
  it('names each Edit button with its block: «Edit Customer», «Edit Business»', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Edit Customer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit Business' })).toBeInTheDocument()
  })

  it('keeps the visible text as «Edit» and gives the buttons different names', () => {
    setup()
    const names = screen.getAllByRole('button', { name: /^Edit / }).map(button => button.textContent)
    expect(names).toEqual(['Edit', 'Edit'])
    const accessible = screen.getAllByRole('button', { name: /^Edit / }).map(button => button.getAttribute('aria-label'))
    expect(accessible).toEqual(['Edit Customer', 'Edit Business'])
  })

  it('has no Edit button for a block without data', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Edit Items' })).not.toBeInTheDocument()
  })

  it('uses the labels it is given, so a translation carries through', () => {
    setup({ editLabel: 'Editar', blocks: [{ id: 'customer', label: 'Cliente', lines: ['Ada'], step: 1 }] })
    expect(screen.getByRole('button', { name: 'Editar Cliente' })).toBeInTheDocument()
  })

  it('still calls onEdit with the step of its block', async () => {
    const calls = []
    setup({ onEdit: step => calls.push(step) })
    screen.getByRole('button', { name: 'Edit Business' }).click()
    expect(calls).toEqual([2])
  })
})

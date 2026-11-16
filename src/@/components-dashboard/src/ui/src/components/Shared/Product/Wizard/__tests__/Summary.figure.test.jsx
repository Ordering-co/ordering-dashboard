// redesign W0-3a (T0-9, decisión 11a): the total of the summary is a figure (mono, tabular digits); its label, and the
// lines of text above it, are not.
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Summary } from '../Summary'

const blocks = [{ id: 'customer', label: 'Customer', lines: ['Ada Lovelace'], step: 1 }]

const setup = (props = {}) => render(
  <Summary label='Order summary' blocks={blocks} total='$42.50' totalLabel='Total' editLabel='Edit' notSetLabel='Not set yet' {...props} />
)

describe('Summary · the total is a figure (W0-3a, T0-9)', () => {
  it('puts odc-figure on the total value and not on its label', () => {
    setup()
    expect(screen.getByText('$42.50')).toHaveClass('odc-figure')
    expect(screen.getByText('Total')).not.toHaveClass('odc-figure')
    expect(screen.getByText('Ada Lovelace')).not.toHaveClass('odc-figure')
  })

  it('has no figure when the total is not set yet', () => {
    const { container } = setup({ total: null })
    expect(container.querySelector('.odc-figure')).toBeNull()
  })
})

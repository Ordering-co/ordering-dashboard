/* eslint-disable import/first */
// redesign (B1b, decision 4): the professionals' occupation row: «All» and one button per occupation, `aria-pressed`, one click
// (main's U/OccupationsFilter, less the sideways drag). It draws what it is given and reports each click once.
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text]
}))

import { OccupationFilter } from '../OccupationFilter'

const OCCUPATIONS = [{ id: 1, name: 'Stylist' }, { id: 2, name: 'Barber' }, { id: 3, name: 'Masseur' }]

const draw = (props = {}) => {
  const onChange = vi.fn()
  const view = render(<OccupationFilter label='Occupation' occupations={OCCUPATIONS} loading={false} value={null} onChange={onChange} {...props} />)
  return { onChange, ...view }
}

describe('OccupationFilter', () => {
  it('is a group named by its label, with «All» and one button per occupation, in order', () => {
    draw()
    const group = screen.getByRole('group', { name: 'Occupation' })
    expect(within(group).getAllByRole('button').map(button => button.textContent)).toEqual(['All', 'Stylist', 'Barber', 'Masseur'])
  })

  it('«All» is pressed with no value, and nothing else is', () => {
    draw()
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    ;['Stylist', 'Barber', 'Masseur'].forEach(name => expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false'))
  })

  it('the chosen occupation is pressed and «All» is not', () => {
    draw({ value: 2 })
    expect(screen.getByRole('button', { name: 'Barber' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Stylist' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('one click on «Barber» calls onChange(2): the id, as a number', async () => {
    const { onChange } = draw()
    await userEvent.click(screen.getByRole('button', { name: 'Barber' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('«All» calls onChange(null)', async () => {
    const { onChange } = draw({ value: 2 })
    await userEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('the keyboard works as a click (native buttons)', async () => {
    const { onChange } = draw()
    screen.getByRole('button', { name: 'Masseur' }).focus()
    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('draws nothing without occupations, and nothing while they are not loading', () => {
    const { container } = draw({ occupations: [] })
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('group')).toBeNull()
  })

  it('nothing for a missing list either', () => {
    const { container } = draw({ occupations: undefined })
    expect(container).toBeEmptyDOMElement()
  })

  it('while it loads: three skeletons announced as a busy status, and no buttons', () => {
    const { container } = draw({ loading: true, occupations: [] })
    expect(container.querySelectorAll('.odc-skeleton')).toHaveLength(3)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })

  it('the group wraps: it is not a scroller (no sideways drag)', () => {
    draw()
    const group = screen.getByRole('group', { name: 'Occupation' })
    expect(group).toHaveClass('odc-occ-filter')
    expect(group.hasAttribute('tabindex')).toBe(false)
  })
})

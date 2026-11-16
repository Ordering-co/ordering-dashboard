/* eslint-disable import/first */
// redesign F6i-2 (A3-02): the trigger of a C18 select carries the name of its field and its current value, e.g.
// «Order status Delivery completed by driver». The legacy select renders exactly as before (no `aria-label` and no
// `aria-labelledby` unless the consumer passes one).
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: null }]
}))

import { FirstSelect, SelectFieldLabelContext } from './FirstSelect'
import { MultiSelect } from './MultiSelect'
import { SelectSurfaceContext } from './selectPlacement'

const text = value => <span>{value}</span>
const statuses = [
  { value: 'default', content: text('Select status'), disabled: true, showDisable: true },
  { value: 1, content: text('Accepted by business') },
  { value: 2, content: text('Delivery completed by driver') }
]
const people = ['Alba', 'Bruno', 'Berta'].map((name, index) => ({ value: index + 1, name, content: text(name) }))

const wrap = (ui, surface = { fitTrigger: true }, labelId = null) => (
  <ThemeProvider theme={createDashboardTheme(theme)}>
    <SelectSurfaceContext.Provider value={surface}>
      <SelectFieldLabelContext.Provider value={labelId}>
        {labelId && <span id={labelId}>Visible label</span>}
        {ui}
      </SelectFieldLabelContext.Provider>
    </SelectSurfaceContext.Provider>
  </ThemeProvider>
)
const first = (props = {}) => <FirstSelect placeholder='Select driver' options={statuses} defaultValue={2} onChange={vi.fn()} {...props} />
const multi = (props = {}) => <MultiSelect placeholder='Any' options={people} defaultValue={[]} onChange={vi.fn()} {...props} />

describe('FirstSelect trigger name, C18 (A3-02)', () => {
  it('is the aria label and the current value', () => {
    render(wrap(first({ ariaLabel: 'Order status' })))
    expect(screen.getByRole('button', { name: 'Order status Delivery completed by driver' })).toBeInTheDocument()
  })

  it('is the label and the placeholder while nothing is chosen', () => {
    render(wrap(first({ ariaLabel: 'Driver', defaultValue: undefined, options: [] })))
    expect(screen.getByRole('button', { name: 'Driver Select driver' })).toBeInTheDocument()
  })

  it('uses the visible label of the surrounding field before the aria label', () => {
    render(wrap(first({ ariaLabel: 'Other' }), { fitTrigger: true }, 'field-label'))
    const trigger = screen.getByRole('button', { name: 'Visible label Delivery completed by driver' })
    expect(trigger.getAttribute('aria-labelledby').split(' ')[0]).toBe('field-label')
  })

  it('an explicit ariaLabelledBy wins over the surrounding label', () => {
    render(wrap(<><span id='mine'>Mine</span>{first({ ariaLabelledBy: 'mine' })}</>, { fitTrigger: true }, 'field-label'))
    expect(screen.getByRole('button', { name: 'Mine Delivery completed by driver' })).toBeInTheDocument()
  })

  it('names the trigger from its value alone when there is no label at all', () => {
    render(wrap(first()))
    expect(screen.getByRole('button', { name: 'Delivery completed by driver' })).toBeInTheDocument()
  })

  it('legacy: no aria-label and no aria-labelledby unless passed', () => {
    render(wrap(first({ ariaLabel: 'Order status' }), {}, 'field-label'))
    const trigger = document.querySelector('.od-first-select-trigger')
    expect(trigger).not.toHaveAttribute('aria-labelledby')
    expect(trigger).not.toHaveAttribute('aria-label')
    expect(trigger).not.toHaveAttribute('id')
  })

  it('legacy: passes aria-labelledby through as before', () => {
    render(wrap(first({ ariaLabelledBy: 'mine' }), {}))
    expect(document.querySelector('.od-first-select-trigger')).toHaveAttribute('aria-labelledby', 'mine')
  })
})

describe('MultiSelect trigger name, C18 (A3-02)', () => {
  it('without chips: the aria label and the placeholder', () => {
    render(wrap(multi({ ariaLabel: 'Driver group' })))
    expect(screen.getByRole('button', { name: 'Driver group Any' })).toBeInTheDocument()
  })

  it('without chips: the visible label of the surrounding field and the placeholder', () => {
    render(wrap(multi(), { fitTrigger: true }, 'field-label'))
    expect(screen.getByRole('button', { name: 'Visible label Any' })).toBeInTheDocument()
  })

  it('with chips: the visible label of the surrounding field and the chosen values', () => {
    render(wrap(multi({ defaultValue: [1, 2] }), { fitTrigger: true }, 'field-label'))
    expect(screen.getByRole('button', { name: 'Visible label Alba, Bruno' })).toBeInTheDocument()
  })

  it('with chips: the aria label and the chosen values', () => {
    render(wrap(multi({ defaultValue: [1], ariaLabel: 'Business' })))
    expect(screen.getByRole('button', { name: 'Business Alba' })).toBeInTheDocument()
  })

  it('names its listbox with the visible label too', () => {
    render(wrap(multi(), { fitTrigger: true }, 'field-label'))
    fireEvent.click(screen.getByRole('button', { name: 'Visible label Any' }))
    expect(screen.getByRole('listbox')).toHaveAccessibleName('Visible label')
  })

  it('legacy: no aria-label and no aria-labelledby on the trigger', () => {
    render(wrap(multi({ ariaLabel: 'Driver group' }), {}, 'field-label'))
    const trigger = document.querySelector('.od-multi-select-trigger')
    expect(trigger).not.toHaveAttribute('aria-labelledby')
    expect(trigger).not.toHaveAttribute('aria-label')
    expect(trigger).not.toHaveAttribute('id')
  })
})

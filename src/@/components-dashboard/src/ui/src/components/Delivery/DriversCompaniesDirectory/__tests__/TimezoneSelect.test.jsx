/* eslint-disable import/first */
// redesign DC-B3 (decision 3 | M-DC10): the time zone of a driver company, a C18 select with a search. Only the language is
// simulated; the select (U/FirstSelect), its search field and the list of zones are the real ones.
import React, { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text]
}))

import { TimezoneSelect } from '../TimezoneSelect'

afterEach(() => cleanup())

const draw = (props = {}) => {
  const onChange = vi.fn()
  const view = render(
    <TimezoneSelect label='Timezone' placeholder='Select a timezone' onChange={onChange} {...props} />
  )
  return { onChange, ...view }
}
// The panel hands the select the zone on screen (the pending change, else the company's): a host that keeps what was chosen
const Host = ({ initial, onChange }) => {
  const [zone, setZone] = useState(initial)
  return (
    <TimezoneSelect
      label='Timezone'
      placeholder='Select a timezone'
      value={zone}
      onChange={(next) => { setZone(next); onChange(next) }}
    />
  )
}
const trigger = () => screen.getByRole('button', { name: /Timezone/ })

describe('TimezoneSelect label and trigger', () => {
  it('has a visible label and the trigger is named after it plus the value', () => {
    draw({ value: 'America/Bogota' })
    expect(document.querySelector('.odc-field-label-text')).toHaveTextContent('Timezone')
    expect(trigger()).toHaveAccessibleName('Timezone America/Bogota')
    expect(trigger()).toHaveAttribute('aria-haspopup', 'listbox')
  })

  it('without a value it shows the placeholder', () => {
    draw()
    expect(trigger()).toHaveTextContent('Select a timezone')
  })

  it('a click on the visible label puts the focus on the trigger', async () => {
    const user = userEvent.setup()
    draw({ value: 'UTC' })
    await user.click(document.querySelector('.odc-field-label-text'))
    expect(trigger()).toHaveFocus()
  })

  it('a required field marks it for the eye and says Required to a screen reader', () => {
    draw({ required: true, requiredLabel: 'Required' })
    expect(document.querySelector('.odc-field-required')).toHaveAttribute('aria-hidden', 'true')
    expect(document.querySelector('.odc-sr-only')).toHaveTextContent('Required')
    expect(document.querySelector('.odc-dc-timezone')).toHaveAttribute('data-required')
  })

  it('an optional field has no mark', () => {
    draw()
    expect(document.querySelector('.odc-field-required')).toBeNull()
    expect(document.querySelector('.odc-dc-timezone')).not.toHaveAttribute('data-required')
  })

  // The pointer is shut out by `pointer-events: none` in first-select.css (not loaded in jsdom): the keyboard path is what runs here
  it('disabled: the trigger says so and the keyboard does not open the list', () => {
    draw({ value: 'UTC', disabled: true })
    expect(trigger()).toHaveAttribute('aria-disabled', 'true')
    expect(trigger()).toHaveAttribute('tabindex', '-1')
    fireEvent.keyDown(trigger(), { key: 'Enter' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})

describe('TimezoneSelect list', () => {
  const open = async (user) => {
    await user.click(trigger())
    return screen.findByRole('listbox')
  }

  it('opens a list of zones with a search field', async () => {
    const user = userEvent.setup()
    draw({ value: 'UTC' })
    const list = await open(user)
    expect(within(list).getAllByRole('option').length).toBeGreaterThan(100)
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument()
  })

  it('the search filters the zones without regard to case', async () => {
    const user = userEvent.setup()
    draw({ value: 'UTC' })
    await open(user)
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'bogOTA')
    await waitFor(() => {
      const names = within(screen.getByRole('listbox')).getAllByRole('option').map(option => option.textContent)
      expect(names).toEqual(['America/Bogota'])
    })
  })

  it('a search with no match leaves the list empty', async () => {
    const user = userEvent.setup()
    draw({ value: 'UTC' })
    await open(user)
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'zzz-nothing')
    await waitFor(() => expect(within(screen.getByRole('listbox')).queryAllByRole('option')).toHaveLength(0))
  })

  it('choosing a zone calls onChange with the zone and closes the list', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Host initial='UTC' onChange={onChange} />)
    await open(user)
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'bogota')
    await user.click(await screen.findByRole('option', { name: 'America/Bogota' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('America/Bogota')
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    expect(trigger()).toHaveAccessibleName('Timezone America/Bogota')
  })

  it('the search is cleared after a choice: the next opening lists every zone again', async () => {
    const user = userEvent.setup()
    render(<Host initial='UTC' onChange={vi.fn()} />)
    await open(user)
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'bogota')
    await user.click(await screen.findByRole('option', { name: 'America/Bogota' }))
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    const list = await open(user)
    expect(within(list).getAllByRole('option').length).toBeGreaterThan(100)
  })

  it('the selected zone is marked in the list', async () => {
    const user = userEvent.setup()
    draw({ value: 'Europe/Madrid' })
    const list = await open(user)
    expect(within(list).getByRole('option', { name: 'Europe/Madrid' })).toHaveAttribute('aria-selected', 'true')
  })
})

describe('TimezoneSelect error', () => {
  it('shows the message under the field as an alert and points the trigger at it', () => {
    draw({ error: 'Value is required' })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Value is required')
    expect(trigger()).toHaveAttribute('aria-describedby', alert.id)
    expect(document.querySelector('.odc-dc-timezone')).toHaveAttribute('data-invalid')
  })

  it('without an error there is no alert and nothing is described', () => {
    draw({ value: 'UTC' })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(trigger()).not.toHaveAttribute('aria-describedby')
    expect(document.querySelector('.odc-dc-timezone')).not.toHaveAttribute('data-invalid')
  })
})

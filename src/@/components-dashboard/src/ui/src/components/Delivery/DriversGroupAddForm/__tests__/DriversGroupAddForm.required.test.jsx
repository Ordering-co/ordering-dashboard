/* eslint-disable import/first */
// the add form's checks say what is missing; the catalog's «Value is required» had no field in it.
// (P-2 of batch R): each local check shows under its own field (never in the global Alert, which is for the API), links the control
// with aria-describedby, takes the focus to the first field with an error on Save, and goes away when the field is valid.
import React, { useState } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from 'styled-components'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

// The session must be the same object on every render: the legacy select refreshes its popper when it changes, and a new one each time never settles
const mocks = vi.hoisted(() => ({ add: null, schedule: false, apiError: null, Controller: null, session: [{ user: { level: 0 } }] }))
// The live catalog value, without `_attribute_`: what made every check read «Value is required»
const DICTIONARY = { VALIDATION_ERROR_REQUIRED: 'Value is required' }

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (key, fallback) => DICTIONARY[key] ?? fallback],
  useConfig: () => [{ configs: {} }],
  useSession: () => mocks.session,
  DriversGroupDetails: (props) => mocks.Controller(props)
}))
vi.mock('../../../Shared', () => ({
  Alert: (props) => (props.open ? <div data-testid='global-alert'>{[].concat(props.content).join(' | ')}</div> : null),
  SearchBar: () => null,
  Pagination: () => null,
  Modal: () => null,
  Schedule: () => null
}))
vi.mock('../../DriverTemporalSchedule', () => ({ DriverTemporalSchedule: () => null }))
vi.mock('../PaymethodsForm', () => ({ PaymethodsForm: () => null }))
vi.mock('../AdvancedLogisticsForm', () => ({ AdvancedLogisticsForm: () => null }))

import { DriversGroupAddForm } from '..'

// A stateful stand-in for the controller: the selections feed `changesState` the way the real one does.
function StatefulController ({ UIComponent, changes, ...props }) {
  const [state, setState] = useState(changes)
  const merge = patch => setState(current => ({ ...current, ...patch }))
  const pick = key => (id, checked) => setState(current => {
    const ids = (current[key] ?? []).filter(item => item !== id)
    return { ...current, [key]: checked ? [...ids, id] : (ids.length ? ids : undefined) }
  })
  return (
    <UIComponent
      {...props}
      changesState={state}
      actionState={{ loading: false, error: mocks.apiError }}
      isScheduleEnabled={mocks.schedule}
      handleAddDriversGroup={mocks.add}
      driversManagers={[{ id: 9, name: 'Mia', lastname: 'Manager' }]}
      drivers={[{ id: 1, name: 'Ann' }, { id: 5, name: 'Bo' }]}
      companies={[{ id: 3, name: 'Fleet' }]}
      businesses={[{ id: 2, name: 'Shop' }]}
      selectedDriverIds={state.drivers ?? []}
      selectedDriverTemporaryIds={[]}
      selectedDriversCompanyIds={state.driver_companies ?? []}
      selectedBusinessIds={state.business ?? []}
      handleChangesState={merge}
      handleChangeType={type => merge({ type })}
      handleSelectDriver={pick('drivers')}
      handleSelectDriversCompany={pick('driver_companies')}
      handleSelectBusiness={pick('business')}
      handleSelectAllDriver={() => {}}
      handleSelectAllDriversCompany={() => {}}
      handleSelectAllBusiness={() => {}}
      handleChangeScheduleEnabled={() => {}}
      handleChangeScheduleState={() => {}}
      driversGroupState={{}}
    />
  )
}
mocks.Controller = StatefulController

const wrap = node => <ThemeProvider theme={createDashboardTheme(theme)}>{node}</ThemeProvider>
const draw = changes => render(wrap(<DriversGroupAddForm changes={{ administrator_id: 9, ...changes }} />))
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }))
const describedBy = element => element.getAttribute('aria-describedby')
const messageOf = element => document.getElementById(describedBy(element))
const noGlobalAlert = () => expect(screen.queryByTestId('global-alert')).toBeNull()

beforeEach(() => {
  mocks.add = vi.fn()
  mocks.schedule = false
  mocks.apiError = null
})

describe('DriversGroupAddForm required checks ()', () => {
  it('no drivers: the message sits above the drivers list (not under its pages), which it describes, and not in the Alert', async () => {
    draw({ type: 0, name: 'North', business: [2] })
    save()
    const group = await screen.findByRole('group', { name: 'Drivers' })
    expect(messageOf(group)).toHaveTextContent('You must choose at least one driver.')
    expect(messageOf(group)).toHaveAttribute('role', 'alert')
    // the group is the list's fieldset now; the message sits inside it, above its rows
    expect(group.querySelector('ul').compareDocumentPosition(messageOf(group)) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    noGlobalAlert()
    expect(mocks.add).not.toHaveBeenCalled()
  })

  it('no driver company: the message sits under the companies list', async () => {
    draw({ type: 1, name: 'North', business: [2] })
    save()
    const group = await screen.findByRole('group', { name: 'Driver companies' })
    expect(messageOf(group)).toHaveTextContent('Choose at least one driver company.')
    noGlobalAlert()
  })

  it('no stores: the message sits under the stores list', async () => {
    draw({ type: 0, name: 'North', drivers: [1] })
    save()
    const group = await screen.findByRole('group', { name: 'Businesses' })
    expect(messageOf(group)).toHaveTextContent('Select at least one business.')
    noGlobalAlert()
  })

  it('no time zone with a schedule: the message sits under the timezone select, which it describes', async () => {
    mocks.schedule = true
    draw({ type: 0, name: 'North', drivers: [1], business: [2] })
    save()
    const trigger = await screen.findByRole('button', { name: /^Timezone/ })
    expect(messageOf(trigger)).toHaveTextContent('Select a timezone')
    noGlobalAlert()
  })

  it('no driver manager: the message sits under the manager select, which it describes, and the group is not added', async () => {
    draw({ type: 0, name: 'North', drivers: [1], business: [2], administrator_id: undefined })
    save()
    const field = await screen.findByRole('group', { name: /^Driver manager/ })
    await waitFor(() => expect(messageOf(field)).toHaveTextContent('Choose a driver manager.'))
    expect(messageOf(field)).toHaveAttribute('role', 'alert')
    expect(field.compareDocumentPosition(messageOf(field)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(within(field).getByRole('button')))
    noGlobalAlert()
    expect(mocks.add).not.toHaveBeenCalled()
  })

  it('choosing a driver manager takes its message away and the group is added', async () => {
    draw({ type: 0, name: 'North', drivers: [1], business: [2], administrator_id: undefined })
    save()
    await screen.findByText('Choose a driver manager.')
    const field = screen.getByRole('group', { name: /^Driver manager/ })
    fireEvent.click(within(field).getByRole('button'))
    fireEvent.click(await screen.findByText('Mia Manager'))
    await waitFor(() => expect(screen.queryByText('Choose a driver manager.')).toBeNull())
    save()
    await waitFor(() => expect(mocks.add).toHaveBeenCalledTimes(1))
  })

  it('no name: the react-hook-form message sits under the Name input, which is invalid and described by it', async () => {
    draw({ type: 0, drivers: [1], business: [2] })
    save()
    const input = await screen.findByRole('textbox', { name: /^Name/ })
    await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'))
    expect(messageOf(input)).toHaveTextContent('Value is required')
    expect(document.activeElement).toBe(input)
    noGlobalAlert()
    expect(mocks.add).not.toHaveBeenCalled()
  })

  // (tanda AK): «Name» was the legacy 32 px input next to 52 px selects; it is the Product text field now (44 px on a
  // phone, from the field frame), with the same check, the same message and the same save
  it('the name is a Product text field: its frame, its required mark, and the message in the field', async () => {
    draw({ type: 0, drivers: [1], business: [2] })
    const input = screen.getByRole('textbox', { name: /^Name/ })
    expect(input).toHaveClass('odc-field-input')
    const field = input.closest('.odc-field')
    expect(field).not.toBeNull()
    expect(field).toHaveAttribute('data-required')
    expect(input).toHaveAttribute('aria-required', 'true')
    save()
    await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'))
    expect(messageOf(input)).toHaveClass('odc-field-error')
    expect(messageOf(input)).toHaveTextContent('Value is required')
    expect(mocks.add).not.toHaveBeenCalled()
  })

  it('the name typed in is what the group saves', async () => {
    draw({ type: 0, drivers: [1], business: [2] })
    fireEvent.change(screen.getByRole('textbox', { name: /^Name/ }), { target: { value: 'North' } })
    save()
    await waitFor(() => expect(mocks.add).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('textbox', { name: /^Name/ })).not.toHaveAttribute('aria-invalid')
  })

  it('shows every missing field at once (the name too) instead of one at a time', async () => {
    mocks.schedule = true
    draw({ type: 0 })
    save()
    await screen.findByText('You must choose at least one driver.')
    expect(screen.getAllByRole('alert').map(node => node.textContent)).toEqual([
      'Value is required',
      'You must choose at least one driver.',
      'Select at least one business.',
      'Select a timezone'
    ])
    expect(screen.getByRole('textbox', { name: /^Name/ })).toHaveAttribute('aria-invalid', 'true')
    noGlobalAlert()
  })

  it('the missing driver manager is listed with the rest, after the name', async () => {
    mocks.schedule = true
    draw({ type: 0, administrator_id: undefined })
    save()
    await screen.findByText('Choose a driver manager.')
    expect(screen.getAllByRole('alert').map(node => node.textContent)).toEqual([
      'Value is required',
      'Choose a driver manager.',
      'You must choose at least one driver.',
      'Select at least one business.',
      'Select a timezone'
    ])
  })

  // (review, live): the lists are long, so after a click on Save the message was far below the screen and the focus
  // (from a click, not the keyboard) had no ring: Save looked like it did nothing
  it('on Save the message of the first error is brought into view and the focus is drawn as from the keyboard', async () => {
    const scrolled = []
    const scrollIntoView = vi.fn(function () { scrolled.push(this.id) })
    Element.prototype.scrollIntoView = scrollIntoView
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    try {
      draw({ type: 0, name: 'North' })
      save()
      const message = await screen.findByText('You must choose at least one driver.')
      await waitFor(() => expect(scrollIntoView).toHaveBeenCalled())
      expect(scrolled[0]).toBe(message.closest('[id]').id)
      expect(focus).toHaveBeenCalledWith(expect.objectContaining({ focusVisible: true }))
    } finally {
      delete Element.prototype.scrollIntoView
      focus.mockRestore()
    }
  })

  it('on Save the focus goes to the first field with an error', async () => {
    draw({ type: 0, name: 'North' })
    save()
    await screen.findByText('You must choose at least one driver.')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('checkbox', { name: /Ann/ })))
  })

  it('on Save with only a store missing, the focus goes to the stores list', async () => {
    draw({ type: 0, name: 'North', drivers: [1] })
    save()
    await screen.findByText('Select at least one business.')
    const group = screen.getByRole('group', { name: 'Businesses' })
    await waitFor(() => expect(group).toContainElement(document.activeElement))
    expect(document.activeElement).toHaveAttribute('type', 'checkbox')
  })

  it('on Save with only the time zone missing, the focus goes to the select', async () => {
    mocks.schedule = true
    draw({ type: 0, name: 'North', drivers: [1], business: [2] })
    save()
    const trigger = await screen.findByRole('button', { name: /^Timezone/ })
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('an error goes away when its field becomes valid, and the others stay', async () => {
    draw({ type: 0, name: 'North' })
    save()
    await screen.findByText('You must choose at least one driver.')
    expect(screen.getByText('Select at least one business.')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: /Ann/ }))
    await waitFor(() => expect(screen.queryByText('You must choose at least one driver.')).toBeNull())
    expect(screen.getByText('Select at least one business.')).toBeTruthy()
    const stores = screen.getByRole('group', { name: 'Businesses' })
    fireEvent.click(within(stores).getByRole('checkbox'))
    await waitFor(() => expect(screen.queryByText('Select at least one business.')).toBeNull())
    expect(screen.queryByRole('group', { name: 'Businesses' })).toBeNull()
  })

  it('an error of a field that stops existing goes away (drivers list to companies)', async () => {
    draw({ type: 0, name: 'North', business: [2] })
    save()
    await screen.findByText('You must choose at least one driver.')
    fireEvent.click(screen.getAllByText('In house drivers')[0])
    fireEvent.click(screen.getAllByText('Driver companies').at(-1))
    expect(await screen.findByRole('checkbox', { name: 'Fleet' })).toBeTruthy()
    await waitFor(() => expect(screen.queryByText('You must choose at least one driver.')).toBeNull())
    expect(screen.queryByText('Choose at least one driver company.')).toBeNull()
  })

  it('the Alert stays for an error of the API', async () => {
    mocks.apiError = ['The API said no']
    draw({ type: 0, name: 'North', drivers: [1], business: [2] })
    expect(await screen.findByTestId('global-alert')).toHaveTextContent('The API said no')
  })

  it('with everything it adds the group, as before', async () => {
    draw({ type: 0, name: 'North', drivers: [1], business: [2] })
    save()
    await waitFor(() => expect(mocks.add).toHaveBeenCalledTimes(1))
    noGlobalAlert()
  })
})

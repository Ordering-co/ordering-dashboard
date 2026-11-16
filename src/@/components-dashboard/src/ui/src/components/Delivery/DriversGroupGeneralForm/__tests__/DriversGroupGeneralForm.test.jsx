/* eslint-disable import/first */
// redesign (AD-1, AD-2, AD-7): the General section of a delivery group on the Product pieces. Same fields, same saves,
// same checks as main; the name is told under its field, Type and Priority are P/SelectField, Save is a P/Button.
import React from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from 'styled-components'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

// the session is the same object on every render: a legacy select refreshes its popper when it changes and never settles otherwise
const mocks = vi.hoisted(() => ({ session: [{ user: { id: 1, level: 0 } }] }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => mocks.session
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../DriversGroupDrivers', () => ({ DriversGroupDrivers: () => <div data-testid='drivers-branch' /> }))
vi.mock('../../DriversGroupCompanies', () => ({ DriversGroupCompanies: () => <div data-testid='companies-branch' /> }))

import { DriversGroupGeneralForm } from '..'

const GROUP = { id: 7, name: 'Downtown couriers', type: 0, priority: 0, driver_available_max_distance: 5 }

let handlers
const tree = (props = {}) => (
  <ThemeProvider theme={createDashboardTheme(theme)}>
    <DriversGroupGeneralForm
      driversGroupState={{ driversGroup: GROUP }}
      driversManagers={[]}
      changesState={{}}
      actionState={{ loading: false }}
      selectedDriverManager={[3]}
      useAdvanced={false}
      {...handlers}
      {...props}
    />
  </ThemeProvider>
)
const draw = (props = {}) => render(tree(props))

beforeEach(() => {
  handlers = {
    handleChangesState: vi.fn(),
    handleUpdateDriversGroup: vi.fn(),
    handleAddDriversGroup: vi.fn(),
    handleNextClick: vi.fn(),
    handleSelectDriverManager: vi.fn(),
    handleSelectAllManagers: vi.fn(),
    handleChangeMaxDistance: vi.fn(),
    handleLogistic: vi.fn()
  }
})
afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
})

const save = () => screen.getByRole('button', { name: /^(Save|Add|Next)$/ })

describe('DriversGroupGeneralForm · name (AD-7)', () => {
  it('tells an empty name under the field and does not save', async () => {
    draw({ changesState: { name: '' } })
    await userEvent.click(save())
    const field = screen.getByRole('textbox', { name: /^Name/ })
    await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'))
    expect(screen.getByText('Name is required.')).toBeInTheDocument()
    expect(handlers.handleUpdateDriversGroup).not.toHaveBeenCalled()
  })

  // review AD-R2: Save sits at the foot of a long section; the field it blocks on must come into view with the focus
  it('takes the focus to the empty name and brings it into view', async () => {
    const scroll = vi.fn()
    const original = HTMLElement.prototype.scrollIntoView
    HTMLElement.prototype.scrollIntoView = scroll
    try {
      draw({ changesState: { name: '' } })
      await userEvent.click(save())
      const field = screen.getByRole('textbox', { name: /^Name/ })
      await waitFor(() => expect(field).toHaveFocus())
      expect(scroll).toHaveBeenCalled()
    } finally {
      HTMLElement.prototype.scrollIntoView = original
    }
  })

  it('treats a blank name as empty, and clears the message when the name changes', async () => {
    draw({ changesState: { name: '   ' } })
    await userEvent.click(save())
    expect(await screen.findByText('Name is required.')).toBeInTheDocument()
    expect(handlers.handleUpdateDriversGroup).not.toHaveBeenCalled()
    await userEvent.type(screen.getByRole('textbox', { name: /^Name/ }), 'x')
    expect(handlers.handleChangesState).toHaveBeenCalledWith({ name: '   x' })
    await waitFor(() => expect(screen.queryByText('Name is required.')).not.toBeInTheDocument())
  })

  it('shows the group name, marks it required and sends every change to handleChangesState', async () => {
    draw()
    const field = screen.getByRole('textbox', { name: /^Name/ })
    expect(field).toHaveValue('Downtown couriers')
    expect(field).toBeRequired()
    await userEvent.type(field, '!')
    expect(handlers.handleChangesState).toHaveBeenLastCalledWith({ name: 'Downtown couriers!' })
  })

  it('sends the max distance to handleChangeMaxDistance', async () => {
    draw()
    const field = screen.getByRole('textbox', { name: 'Driver available max distance' })
    expect(field).toHaveValue('5')
    expect(field).toHaveAttribute('placeholder', 'Without restrictions')
    await userEvent.type(field, '0')
    expect(handlers.handleChangeMaxDistance).toHaveBeenLastCalledWith('50')
  })
})

describe('DriversGroupGeneralForm · type and priority (AD-2)', () => {
  it('draws Type and Priority as comboboxes with the value of the group', () => {
    draw()
    expect(screen.getByRole('combobox', { name: /^Type/ })).toHaveAccessibleName('Type In house drivers')
    expect(screen.getByRole('combobox', { name: /^Priority/ })).toHaveAccessibleName('Priority Normal')
  })

  it('choosing «Driver companies» stores the NUMBER 1', async () => {
    draw()
    await userEvent.click(screen.getByRole('combobox', { name: /^Type/ }))
    await userEvent.click(await screen.findByRole('option', { name: 'Driver companies', hidden: true }))
    expect(handlers.handleChangesState).toHaveBeenCalledWith({ type: 1 })
    expect(typeof handlers.handleChangesState.mock.calls[0][0].type).toBe('number')
  })

  it('choosing «Urgent» and «Low» stores the numbers 2 and -1', async () => {
    draw()
    await userEvent.click(screen.getByRole('combobox', { name: /^Priority/ }))
    await userEvent.click(await screen.findByRole('option', { name: 'Urgent', hidden: true }))
    expect(handlers.handleChangesState).toHaveBeenLastCalledWith({ priority: 2 })
    await waitFor(() => expect(screen.queryByRole('option', { hidden: true })).not.toBeInTheDocument())
    await userEvent.click(screen.getByRole('combobox', { name: /^Priority/ }))
    await userEvent.click(await screen.findByRole('option', { name: 'Low', hidden: true }))
    expect(handlers.handleChangesState).toHaveBeenLastCalledWith({ priority: -1 })
  })

  it('the pending change wins over the group, and decides the branch', () => {
    draw({ changesState: { type: 1, priority: 2 } })
    expect(screen.getByRole('combobox', { name: /^Type/ })).toHaveAccessibleName('Type Driver companies')
    expect(screen.getByRole('combobox', { name: /^Priority/ })).toHaveAccessibleName('Priority Urgent')
    expect(screen.getByTestId('companies-branch')).toBeInTheDocument()
    expect(screen.queryByTestId('drivers-branch')).not.toBeInTheDocument()
  })

  it('a group of type 0 shows the drivers', () => {
    draw()
    expect(screen.getByTestId('drivers-branch')).toBeInTheDocument()
    expect(screen.queryByTestId('companies-branch')).not.toBeInTheDocument()
  })
})

describe('DriversGroupGeneralForm · logistics and save', () => {
  it('«Use advanced logistics» is a checkbox that calls handleLogistic with the next value', async () => {
    draw()
    const box = screen.getByRole('checkbox', { name: 'Use advanced logistics' })
    expect(box).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(box)
    expect(handlers.handleLogistic).toHaveBeenCalledWith(true)
  })

  it('Save is disabled while nothing changed', () => {
    draw()
    expect(save()).toBeDisabled()
  })

  it('Save calls handleUpdateDriversGroup with the changes', async () => {
    draw({ changesState: { priority: 2 } })
    expect(save()).toBeEnabled()
    await userEvent.click(save())
    expect(handlers.handleUpdateDriversGroup).toHaveBeenCalledWith({ priority: 2 })
  })

  it('Save says it is busy while the controller saves', () => {
    draw({ changesState: { priority: 2 }, actionState: { loading: true } })
    expect(save()).toHaveAttribute('aria-busy', 'true')
  })

  it('says Add without a group, Next during the tour', async () => {
    draw({ driversGroupState: { driversGroup: null }, changesState: { name: 'New', type: 1, driver_companies: '[1]' } })
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(handlers.handleAddDriversGroup).toHaveBeenCalledTimes(1)
    cleanup()
    draw({ isTourOpen: true, changesState: { name: 'New', type: 1, driver_companies: '[1]' }, driversGroupState: { driversGroup: null } })
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(handlers.handleNextClick).toHaveBeenCalledTimes(1)
  })

  it('«You must choose at least one driver.» opens a dialog and does not save', async () => {
    draw({ changesState: { drivers: '[]' } })
    await userEvent.click(save())
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('You must choose at least one driver.')
    expect(handlers.handleUpdateDriversGroup).not.toHaveBeenCalled()
  })

  it('the add flow tells a missing drivers or companies selection in a dialog', async () => {
    draw({ driversGroupState: { driversGroup: null }, changesState: { name: 'New', type: 0 } })
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('The drivers is required.')
    expect(handlers.handleAddDriversGroup).not.toHaveBeenCalled()
  })

  it('keeps the tour anchor on the form', () => {
    const { container } = draw()
    expect(container.querySelector('form[data-tour="tour_fill_group"]')).not.toBeNull()
  })
})

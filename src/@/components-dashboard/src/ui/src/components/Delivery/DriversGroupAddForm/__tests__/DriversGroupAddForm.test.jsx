/* eslint-disable import/first */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const state = vi.hoisted(() => ({ user: { level: 0 } }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useConfig: () => [{ configs: {} }],
  useSession: () => [{ user: state.user }],
  DriversGroupDetails: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))

vi.mock('../../../Shared', () => ({
  Alert: ({ open, content }) => open
    ? <div role='alert'>{[].concat(content).map(message => <p key={message}>{message}</p>)}</div>
    : null
}))

vi.mock('../../../../styles', async () => {
  const ReactModule = await vi.importActual('react')
  return {
    Button: ({ children, type, onClick, disabled }) => (
      <button type={type} onClick={onClick} disabled={disabled}>{children}</button>
    ),
    Input: ReactModule.forwardRef(({ name, defaultValue, onChange, placeholder }, ref) => (
      <input ref={ref} name={name} defaultValue={defaultValue} onChange={onChange} placeholder={placeholder} />
    )),
    SecondSelect: ({ placeholder }) => <div data-testid='select'>{placeholder}</div>
  }
})

vi.mock('../../DriversGroupDrivers', () => ({
  // the list draws the message of its own check (`selectionError`) as an alert
  DriversGroupDrivers: ({ selectionError }) => (
    <div data-testid='drivers-list'>{selectionError && <p role='alert'>{selectionError.message}</p>}</div>
  )
}))

vi.mock('../../DriversGroupCompanies', () => ({
  DriversGroupCompanies: () => <div data-testid='companies-list' />
}))

vi.mock('../BusinessesForm', () => ({ BusinessesForm: () => null }))
vi.mock('../PaymethodsForm', () => ({ PaymethodsForm: () => null }))
vi.mock('../ScheduleForm', () => ({ ScheduleForm: () => null }))
vi.mock('../AdvancedLogisticsForm', () => ({ AdvancedLogisticsForm: () => null }))

import { DriversGroupAddForm } from '../index'

const NO_DRIVERS = 'There are no drivers yet. A group of in house drivers needs at least one driver: add a driver first, or change the type to Driver companies.'
const NO_COMPANIES = 'There are no driver companies yet. A group of driver companies needs at least one company: add a driver company first, or change the type to In house drivers.'
const NO_MANAGERS = 'There are no driver managers yet. A group needs a driver manager: add a driver manager first.'
const CHOOSE_MANAGER = 'Choose a driver manager.'
// the redesign's own words for an empty selection; an empty list says why instead
const SELECT_DRIVERS = 'You must choose at least one driver.'

const DRIVER = { id: 4, name: 'Ana', lastname: 'Ruiz' }
const MANAGER = { id: 5, name: 'Leo', lastname: 'Paz' }

const renderForm = (overrides = {}) => {
  const props = {
    drivers: [],
    driversLoaded: true,
    driversManagers: [],
    driversManagersLoaded: true,
    companies: [],
    companiesLoaded: true,
    changesState: { type: 0 },
    actionState: { loading: false, error: null },
    handleAddDriversGroup: vi.fn(),
    handleChangesState: vi.fn(),
    handleChangeType: vi.fn(),
    onClose: vi.fn(),
    ...overrides
  }
  renderWithProviders(<DriversGroupAddForm {...props} />)
  return props
}

const submit = () => {
  fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Downtown' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
}

describe('DriversGroupAddForm missing resources', () => {
  beforeEach(() => {
    state.user = { level: 0 }
  })

  it('explains both gaps up front and blocks the save when there are no drivers and no driver managers', async () => {
    const props = renderForm({ changesState: { type: 0, business: '[1]' } })

    expect(screen.getByText(NO_DRIVERS)).toBeInTheDocument()
    expect(screen.getByText(NO_MANAGERS)).toBeInTheDocument()
    expect(screen.queryByTestId('drivers-list')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add driver' })).toHaveAttribute('href', '/delivery/drivers-list?add=1')
    expect(screen.getByRole('link', { name: 'Add driver manager' })).toHaveAttribute('href', '/delivery/drivers-managers?add=1')

    submit()

    const alerts = await screen.findAllByRole('alert')
    expect(alerts.map(alert => alert.textContent)).toEqual([NO_MANAGERS, NO_DRIVERS])
    expect(props.handleAddDriversGroup).not.toHaveBeenCalled()
  })

  it('does not create the group when there is no driver manager: it says so and links to add one', async () => {
    const props = renderForm({
      drivers: [DRIVER],
      changesState: { type: 0, drivers: '[4]', business: '[1]' }
    })

    expect(screen.getByText(NO_MANAGERS)).toBeInTheDocument()
    expect(screen.queryByText(NO_DRIVERS)).not.toBeInTheDocument()
    expect(screen.getByTestId('drivers-list')).toBeInTheDocument()
    expect(screen.queryByText('Select driver manager')).not.toBeInTheDocument()

    submit()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(NO_MANAGERS)
    const field = screen.getByRole('group', { name: /^Driver manager/ })
    expect(field).toHaveAttribute('aria-describedby', alert.id)
    expect(field).toContainElement(screen.getByRole('link', { name: 'Add driver manager' }))
    expect(props.handleAddDriversGroup).not.toHaveBeenCalled()
  })

  it('does not create the group when driver managers exist and none is chosen', async () => {
    const props = renderForm({
      drivers: [DRIVER],
      driversManagers: [MANAGER],
      changesState: { type: 0, drivers: '[4]', business: '[1]' }
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByText('Select driver manager')).toBeInTheDocument()

    submit()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(CHOOSE_MANAGER)
    expect(screen.getByRole('group', { name: /^Driver manager/ })).toHaveAttribute('aria-describedby', alert.id)
    expect(props.handleAddDriversGroup).not.toHaveBeenCalled()
  })

  it('marks the driver manager as required', () => {
    renderForm({ driversManagers: [MANAGER] })

    const label = screen.getByText('Driver manager', { selector: 'label' })
    expect(label.querySelector('.odc-field-required')).toHaveTextContent('*')
    expect(label).toHaveTextContent('Required')
  })

  it('points to drivers when only a driver manager exists', async () => {
    const props = renderForm({
      driversManagers: [MANAGER],
      changesState: { type: 0, administrator_id: 5, business: '[1]' }
    })

    expect(screen.getByText(NO_DRIVERS)).toBeInTheDocument()
    expect(screen.queryByText(NO_MANAGERS)).not.toBeInTheDocument()
    expect(screen.getByText('Select driver manager')).toBeInTheDocument()

    submit()

    expect(await screen.findByRole('alert')).toHaveTextContent(NO_DRIVERS)
    expect(props.handleAddDriversGroup).not.toHaveBeenCalled()
  })

  it('shows no notice when drivers and driver managers exist, and asks to pick a driver', async () => {
    const props = renderForm({
      drivers: [DRIVER],
      driversManagers: [MANAGER],
      changesState: { type: 0, drivers: '[]', administrator_id: 5, business: '[1]' }
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByTestId('drivers-list')).toBeInTheDocument()

    submit()

    expect(await screen.findByRole('alert')).toHaveTextContent(SELECT_DRIVERS)
    expect(props.handleAddDriversGroup).not.toHaveBeenCalled()
  })

  it('saves when drivers and driver managers exist and the form is complete', async () => {
    const props = renderForm({
      drivers: [DRIVER],
      driversManagers: [MANAGER],
      changesState: { type: 0, drivers: '[4]', administrator_id: 5, business: '[1]' }
    })

    submit()

    await waitFor(() => expect(props.handleAddDriversGroup).toHaveBeenCalledTimes(1))
  })

  it('does not save with an empty business selection', async () => {
    const props = renderForm({
      drivers: [DRIVER],
      driversManagers: [MANAGER],
      changesState: { type: 0, drivers: '[4]', administrator_id: 5, business: '[]' }
    })

    submit()

    // BusinessesForm (stubbed here) draws its own message; an empty selection ("[]") never reaches the API
    await waitFor(() => expect(props.handleAddDriversGroup).not.toHaveBeenCalled())
  })

  it('explains missing driver companies for a driver companies group', async () => {
    const props = renderForm({
      drivers: [DRIVER],
      driversManagers: [MANAGER],
      changesState: { type: 1, administrator_id: 5, business: '[1]' }
    })

    expect(screen.getByText(NO_COMPANIES)).toBeInTheDocument()
    expect(screen.queryByTestId('companies-list')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add driver company' })).toHaveAttribute('href', '/delivery/drivers-companies?add=1')

    submit()

    expect(await screen.findByRole('alert')).toHaveTextContent(NO_COMPANIES)
    expect(props.handleAddDriversGroup).not.toHaveBeenCalled()
  })

  it('shows no notice while the lists are still loading or failed to load', () => {
    renderForm({
      driversLoaded: false,
      driversManagersLoaded: false,
      companiesLoaded: false
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByTestId('drivers-list')).toBeInTheDocument()
    expect(screen.getByText('Select driver manager')).toBeInTheDocument()
  })

  it('does not tell a driver manager about missing managers, and links them only where they can go', () => {
    state.user = { level: 5 }
    renderForm()

    expect(screen.getByText(NO_DRIVERS)).toBeInTheDocument()
    expect(screen.queryByText(NO_MANAGERS)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add driver' })).toHaveAttribute('href', '/delivery/drivers-list?add=1')
  })

  it('does not ask a driver manager for a manager: the group is theirs', async () => {
    state.user = { level: 5, id: 5 }
    const props = renderForm({
      drivers: [DRIVER],
      changesState: { type: 0, drivers: '[4]', administrator_id: 5, business: '[1]' }
    })

    expect(screen.queryByText('Driver manager', { selector: 'label' })).not.toBeInTheDocument()

    submit()

    await waitFor(() => expect(props.handleAddDriversGroup).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('hides the links from read-only admins', () => {
    state.user = { level: 0, readOnlyAdmin: true }
    renderForm()

    expect(screen.getByText(NO_DRIVERS)).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})

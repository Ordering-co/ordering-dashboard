/* eslint-disable import/first */
// redesign DC-B4 (decision 5 | M-DC15): the add panel of a driver company, a RecordPanel with General, Schedule and Webhooks stacked.
// The controller (K/DriversCompanyDetails) is a stand-in that keeps `changesState` as the real one does and answers
// `handleAddDriversCompany()` with what the test sets; the schedule editor and the time zone list are stand-ins too (the editor
// reports a schedule when it mounts, as K/Schedule does when the company has none). The Product wrappers (RecordPanel, Button,
// TextField, SegmentedControl, AlertDialog, ConfirmDialog) are the real ones. Every value is made up.
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const BASELINE = [{ enabled: true, lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 45 } }] }]
const CHANGED = [{ enabled: false, lapses: [] }]

const mocks = vi.hoisted(() => ({
  splitMode: 'split',
  handleAdd: null,
  controllerProps: null,
  uiProps: null,
  scheduleProps: null
}))

vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../Shared/Product/SplitView', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useSplitView: () => ({ ...actual.useSplitView(), mode: mocks.splitMode }) }
})
vi.mock('../../../../../../index', async () => {
  const React = await import('react')
  const Controller = (props) => {
    const { UIComponent } = props
    const [changes, setChanges] = React.useState({})
    mocks.controllerProps = props
    return (
      <UIComponent
        {...props}
        companyState={{ company: null, loading: true, error: null }}
        changesState={changes}
        actionState={{ loading: false, error: null }}
        cleanChagesState={() => setChanges({})}
        handleChangesState={(key, value) => setChanges(current => ({ ...current, [key]: value }))}
        handleChangeScheduleState={schedule => setChanges(current => ({ ...current, schedule }))}
        handleAddDriversCompany={mocks.handleAdd}
      />
    )
  }
  return {
    useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
    DriversCompanyDetails: Controller
  }
})
vi.mock('../../../Shared/Product/ScheduleEditor', async () => {
  const React = await import('react')
  return {
    ScheduleEditor: (props) => {
      mocks.scheduleProps = props
      const { handleChangeScheduleState } = props
      // K/Schedule reports the schedule it draws when it mounts without a `scheduleList`
      React.useEffect(() => { handleChangeScheduleState(BASELINE) }, [])
      return (
        <div data-testid='schedule-editor'>
          <button type='button' onClick={() => handleChangeScheduleState(CHANGED)}>change hours</button>
          <button type='button' onClick={() => handleChangeScheduleState(BASELINE)}>restore hours</button>
        </div>
      )
    }
  }
})
vi.mock('../TimezoneSelect', () => ({
  TimezoneSelect: ({ label, value, error, onChange }) => (
    <div data-field='timezone'>
      <label>
        {label}
        <input aria-label='Timezone field' value={value ?? ''} onChange={event => onChange(event.target.value)} />
      </label>
      {error && <p>{error}</p>}
    </div>
  )
}))

import { CompanyAddPanel } from '../CompanyAddPanel'

const required = 'Value is required'
const noName = { name: /^Name/ }

const setup = (props = {}) => {
  const onClose = vi.fn()
  const onAdded = vi.fn()
  const panelRef = React.createRef()
  const driversCompaniesState = { companies: [], loading: false, error: null }
  const view = render(
    <CompanyAddPanel
      driversCompaniesState={driversCompaniesState}
      setDriversCompaniesState={vi.fn()}
      panelRef={panelRef}
      onClose={onClose}
      onAdded={onAdded}
      {...props}
    />
  )
  return { onClose, onAdded, panelRef, driversCompaniesState, ...view }
}

const save = () => screen.getByRole('button', { name: 'Save' })
const cancel = () => screen.getByRole('button', { name: 'Cancel' })
const nameField = () => screen.getByRole('textbox', noName)
const field = name => screen.getByRole('textbox', { name })

const fillAll = async (user) => {
  await user.type(nameField(), 'Acme Couriers')
  await user.type(screen.getByLabelText('Timezone field'), 'America/Chicago')
  await user.type(field(/^Address/), '1 Example Street')
  await user.type(field(/^Webhook new order/), 'https://example.test/new')
  await user.type(field(/^Webhook cancel request/), 'https://example.test/cancel')
}

beforeEach(() => {
  mocks.splitMode = 'split'
  mocks.handleAdd = vi.fn(async () => ({ ok: true }))
  mocks.controllerProps = null
  mocks.scheduleProps = null
})
afterEach(cleanup)

describe('CompanyAddPanel (redesign DC-B4)', () => {
  it('shows the title and the three sections, each with its own heading', () => {
    setup()
    expect(screen.getByText('Add driver company')).toBeInTheDocument()
    const headings = screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)
    expect(headings).toEqual(['General', 'Schedule', 'Webhooks'])
    expect(screen.getByTestId('schedule-editor')).toBeInTheDocument()
    expect(field(/^Webhook order status changed/)).toBeInTheDocument()
  })

  it('gives the schedule editor no scheduleList and the webhooks no API key', () => {
    setup()
    expect(mocks.scheduleProps.scheduleList).toBeUndefined()
    expect(mocks.scheduleProps.labels.addHours).toBe('Add hours')
    expect(screen.queryByText('API Key')).not.toBeInTheDocument()
  })

  it('keeps Save disabled on mount even though the editor reports its schedule, and enables it once the name is typed', async () => {
    const user = userEvent.setup()
    setup()
    expect(save()).toBeDisabled()
    await user.type(nameField(), 'A')
    expect(save()).toBeEnabled()
  })

  it('counts the schedule as a change only when it differs from the first one the editor reported', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'restore hours' }))
    expect(save()).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'change hours' }))
    expect(save()).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'restore hours' }))
    expect(save()).toBeDisabled()
  })

  it('paints an error under every empty required field, focuses the first and does not call the controller', async () => {
    const user = userEvent.setup()
    setup()
    await user.type(nameField(), 'A')
    await user.clear(nameField())
    await user.click(save())

    expect(screen.getAllByText(required)).toHaveLength(5)
    expect(mocks.handleAdd).not.toHaveBeenCalled()
    // name, timezone, address and both webhooks: each message sits in the field that names it
    for (const name of [noName.name, /^Address/, /^Webhook new order/, /^Webhook cancel request/]) {
      expect(field(name)).toHaveAccessibleDescription(required)
    }
    expect(within(screen.getByLabelText('Timezone field').closest('[data-field]')).getByText(required)).toBeInTheDocument()
    await waitFor(() => expect(nameField()).toHaveFocus())
  })

  it('gives the focus to the first error in screen order when the name is filled', async () => {
    const user = userEvent.setup()
    setup()
    await user.type(nameField(), 'Acme Couriers')
    await user.click(save())
    expect(screen.getAllByText(required)).toHaveLength(4)
    await waitFor(() => expect(screen.getByLabelText('Timezone field')).toHaveFocus())
  })

  it('takes the error off a field when it is edited', async () => {
    const user = userEvent.setup()
    setup()
    await user.type(nameField(), 'Acme Couriers')
    await user.click(save())
    expect(field(/^Address/)).toHaveAccessibleDescription(required)
    await user.type(field(/^Address/), '1')
    expect(field(/^Address/)).not.toHaveAccessibleDescription(required)
    expect(screen.getAllByText(required)).toHaveLength(3)
  })

  it('calls handleAddDriversCompany once everything required is filled', async () => {
    const user = userEvent.setup()
    setup()
    await fillAll(user)
    await user.click(save())
    expect(mocks.handleAdd).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(required)).not.toBeInTheDocument()
  })

  // while the first save is pending, Save is busy and a second click does not submit the form again.
  it('a quick double click on Save adds the company once', async () => {
    const user = userEvent.setup()
    let finish
    mocks.handleAdd = vi.fn(() => new Promise(resolve => { finish = resolve }))
    setup()
    await fillAll(user)
    const submits = vi.fn()
    document.querySelector('form').addEventListener('submit', submits)
    await user.dblClick(save())
    await user.click(save())
    expect(save()).toHaveAttribute('aria-busy', 'true')
    expect(mocks.handleAdd).toHaveBeenCalledTimes(1)
    expect(submits).toHaveBeenCalledTimes(1)
    finish({ ok: true })
  })

  it('saves when the form is submitted (Enter in a field): Save is the form\'s submit button', async () => {
    const user = userEvent.setup()
    setup()
    await fillAll(user)
    // a browser's implicit submission (Enter in a field) presses the form's default button: the first submit button that
    // belongs to the form, also through the `form` attribute (the footer is outside the <form> element). user-event only looks inside it.
    const form = document.querySelector('form')
    expect(form).toHaveAttribute('novalidate')
    expect(save()).toHaveAttribute('type', 'submit')
    expect(save()).toHaveAttribute('form', form.id)
    fireEvent.submit(form)
    await waitFor(() => expect(mocks.handleAdd).toHaveBeenCalledTimes(1))
  })

  it('opens an alert with the API messages when the save is refused', async () => {
    const user = userEvent.setup()
    mocks.handleAdd = vi.fn(async () => ({ ok: false, error: ['The name has already been taken'] }))
    setup()
    await fillAll(user)
    await user.click(save())
    const alert = await screen.findByRole('alertdialog')
    expect(within(alert).getByText("The company wasn't added")).toBeInTheDocument()
    expect(within(alert).getByText('The name has already been taken')).toBeInTheDocument()
  })

  it('says it could not save when the API gave no text', async () => {
    const user = userEvent.setup()
    mocks.handleAdd = vi.fn(async () => ({ ok: false }))
    setup()
    await fillAll(user)
    await user.click(save())
    const alert = await screen.findByRole('alertdialog')
    expect(within(alert).getByText("We couldn't save the changes. Try again.")).toBeInTheDocument()
  })

  it('closes without asking on Cancel when nothing changed', async () => {
    const user = userEvent.setup()
    const { onClose, onAdded } = setup()
    await user.click(cancel())
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onAdded).not.toHaveBeenCalled()
    expect(screen.queryByText('Discard your changes?')).not.toBeInTheDocument()
  })

  it('asks before Cancel closes a form with changes, and closes on Discard', async () => {
    const user = userEvent.setup()
    const { onClose } = setup()
    await user.type(nameField(), 'A')
    await user.click(cancel())
    expect(onClose).not.toHaveBeenCalled()
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Discard your changes?')).toBeInTheDocument()
    expect(within(dialog).getByText('What you changed here is not saved yet.')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Discard' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps the form when the person chooses Keep editing', async () => {
    const user = userEvent.setup()
    const { onClose } = setup()
    await user.type(nameField(), 'A')
    await user.click(cancel())
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Keep editing' }))
    expect(onClose).not.toHaveBeenCalled()
    expect(nameField()).toHaveValue('A')
  })

  it('lets the page ask through panelRef.requestClose when the form has changes', async () => {
    const user = userEvent.setup()
    const { panelRef } = setup()
    await user.type(nameField(), 'A')
    const proceed = vi.fn()
    React.act(() => panelRef.current.requestClose(proceed))
    expect(await screen.findByText('Discard your changes?')).toBeInTheDocument()
    expect(proceed).not.toHaveBeenCalled()
  })

  it('says Close in the split view and Back on the phone', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    cleanup()
    mocks.splitMode = 'full'
    setup()
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })

  it('hands the controller onAdded as its onClose and keeps the page close as panelClose', () => {
    const { onClose, onAdded } = setup()
    expect(mocks.controllerProps.onClose).toBe(onAdded)
    expect(mocks.controllerProps.panelClose).toBe(onClose)
    expect(mocks.controllerProps.driversCompany).toBeUndefined()
    expect(mocks.controllerProps.driversCompanyId).toBeUndefined()
  })
})

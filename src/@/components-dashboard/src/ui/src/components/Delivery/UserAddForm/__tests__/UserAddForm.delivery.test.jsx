/* eslint-disable import/first */
// redesign UF-B4 (decision 4): the add form of Delivery (drivers, driver managers, delivery users) in Product.
// «today» tests (characterization) were written and run against the old markup first and stay green; «UF-B4» tests are what
// the batch changes. The controller is a stateful stand-in with the real one's semantics (same `formState` closure, same
// handlers, `handleAddClick` records what it would POST); the phone piece and the crop are simulated at the Shared/UI level,
// below both the old and the new form.
import React from 'react'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const runtime = vi.hoisted(() => ({
  fields: {},
  loading: false,
  level: 0,
  sent: [],
  next: { error: false, result: { id: 7 } },
  phoneValid: value => /^\+\d{8,15}$/.test(value),
  raw: null,
  zeroCalls: [],
  emitted: [],
  hold: false,
  release: null
}))

vi.mock('../../../../../../index', async () => {
  const React = await import('react')
  const dictionary = {}
  return {
    useLanguage: () => [{ dictionary }, (key, fallback) => fallback ?? key],
    useConfig: () => [{ configs: {} }],
    useSession: () => [{ auth: true, user: { level: runtime.level } }],
    useEvent: () => [{ emit: (...args) => runtime.emitted.push(args) }],
    useApi: () => [{ root: 'https://api.example.test' }],
    useUtils: () => [{ optimizeImage: value => value }],
    // the legacy crop modal (the old form) mounts its controller; a pass-through is enough for what is under test
    Popup: ({ UIComponent, ...props }) => <UIComponent {...props} />,
    DragAndDrop: ({ onDrop, children, className, disabled }) => (
      <div
        data-testid='drop-zone'
        className={className}
        onDrop={event => { if (disabled) return; event.preventDefault(); onDrop(event.dataTransfer) }}
        onDragOver={event => event.preventDefault()}
      >
        {children}
      </div>
    ),
    ExamineClick: ({ onFiles, childRef, children, accept, disabled }) => (
      <div>
        <input type='file' accept={accept} disabled={disabled} ref={childRef} onChange={event => onFiles(event.target.files)} />
        {children}
      </div>
    ),
    UserFormDetails: ({ UIComponent, ...props }) => {
      const [formState, setFormState] = React.useState({ loading: false, changes: {}, result: { error: false } })
      const [startZero, setStartZero] = React.useState(null)
      const [selectedDriverGroupIds, setSelectedDriverGroupIds] = React.useState([])
      const checkout = runtime.fields
      const validationFields = { loading: runtime.loading, fields: { checkout } }
      const showField = code => !runtime.loading && (!checkout[code] || !!checkout[code].enabled)
      const isRequiredField = code => !runtime.loading && !!checkout[code] && !!checkout[code].enabled && !!checkout[code].required
      const handleChangeInput = (e, isMany) => {
        let changes = {}
        if (isMany) Object.values(e).forEach(obj => { changes = { ...changes, [obj.name]: obj.value } })
        else changes = { [e.target.name]: e.target.value }
        setFormState({ ...formState, changes: { ...formState.changes, ...changes } })
      }
      const handleChangeSwtich = (type, value) => setFormState({ ...formState, changes: { ...formState.changes, [type]: value } })
      const handleAddClick = async () => {
        setFormState({ ...formState, loading: true })
        const changes = { ...formState.changes }
        if (startZero) changes.cellphone = startZero
        runtime.sent.push(changes)
        if (runtime.hold) await new Promise(resolve => { runtime.release = resolve })
        else await Promise.resolve()
        const content = runtime.next
        setFormState({ ...formState, changes: content.error ? formState.changes : {}, result: content, loading: false })
        if (!content.error) {
          props.handleSuccessAdd?.(content.result)
          props.onClose?.()
        }
      }
      const handleDriverGroupClick = (groupId) => {
        const next = selectedDriverGroupIds.includes(groupId)
          ? selectedDriverGroupIds.filter(id => id !== groupId)
          : [...selectedDriverGroupIds, groupId]
        setSelectedDriverGroupIds(next)
        setFormState({ ...formState, changes: { ...formState.changes, driver_groups_ids: next } })
      }
      return (
        <UIComponent
          {...props}
          formState={formState}
          userState={{ loading: false, result: { error: false, result: null } }}
          validationFields={validationFields}
          showField={showField}
          isRequiredField={isRequiredField}
          cleanFormState={values => setFormState({ ...formState, ...values })}
          handleChangeInput={handleChangeInput}
          handleChangeSwtich={handleChangeSwtich}
          handlechangeImage={file => {
            const reader = new window.FileReader()
            reader.readAsDataURL(file)
            reader.onload = () => setFormState({ ...formState, changes: { ...formState.changes, photo: reader.result } })
          }}
          handleButtonAddClick={handleAddClick}
          selectedDriverGroupIds={selectedDriverGroupIds}
          handleDriverGroupClick={handleDriverGroupClick}
          setCellphoneStartZero={value => { runtime.zeroCalls.push(value); setStartZero(value) }}
        />
      )
    }
  }
})

vi.mock('../../../Shared/UI/InputPhoneNumber', async () => {
  const React = await import('react')
  return {
    InputPhoneNumber: ({ value, setValue, handleIsValid }) => {
      React.useEffect(() => { if (value) handleIsValid && handleIsValid(runtime.phoneValid(value)) }, [value])
      return (
        <input
          className='PhoneInputInput'
          aria-label='Phone number'
          value={value ?? ''}
          onChange={event => setValue && setValue(event.target.value, runtime.phoneValid(event.target.value), runtime.raw)}
        />
      )
    }
  }
})

vi.mock('../../../Shared/UI/ImageCrop', () => ({
  ImageCrop: props => (
    <div data-testid='image-crop' data-photo={props.photo}>
      <button
        type='button'
        onClick={() => {
          props.handleChangePhoto('data:image/png;base64,CROPPED')
          props.onClose && props.onClose()
        }}
      >
        Crop
      </button>
    </div>
  )
}))

import { UserAddForm } from '../index'

const FIELDS = {
  name: { id: 1, code: 'name', name: 'Name', type: 'text', enabled: true, required: false },
  middle_name: { id: 2, code: 'middle_name', name: 'Middle name', type: 'text', enabled: true, required: false },
  lastname: { id: 3, code: 'lastname', name: 'Lastname', type: 'text', enabled: true, required: false },
  email: { id: 4, code: 'email', name: 'Email', type: 'email', enabled: true, required: false },
  cellphone: { id: 5, code: 'cellphone', name: 'Mobile phone', type: 'tel', enabled: true, required: false },
  password: { id: 6, code: 'password', name: 'Password', type: 'password', enabled: true, required: false }
}
const withFields = (changes = {}) => {
  runtime.fields = Object.fromEntries(Object.entries(FIELDS).map(([code, field]) => [code, { ...field, ...(changes[code] ?? {}) }]))
  runtime.fields.middle_name.enabled = changes.middle_name?.enabled ?? false
}

const GROUPS = { loading: false, groups: [{ id: 11, name: 'North zone' }, { id: 12, name: 'South zone' }] }
const VALID = '+14155552671'
const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 40)) })
// `hidden`: the old form opens a modal Alert (which hides the page behind it) when a rule fails
const addButton = () => screen.getByRole('button', { name: 'Add', hidden: true })
const mount = (props = {}) => renderWithProviders(<UserAddForm driversGroupsState={GROUPS} {...props} />)
const drivers = (props = {}) => mount({ isDriversPage: true, ...props })
const managers = (props = {}) => mount({ isDriversManagersPage: true, ...props })
const form = container => container.querySelector('form')
const names = container => [...form(container).querySelectorAll('input[name]')].map(input => input.name)
const field = (container, name) => form(container).querySelector(`[name="${name}"]`)
const phoneInput = container => container.querySelector('input.PhoneInputInput')
const fileInput = container => container.querySelector('input[type="file"]')
// a required field's label reads «Name *Required»: match by its start
const labelled = name => screen.getByLabelText(new RegExp(`^${name}( |$)`))
const png = (size) => {
  const file = new File(['pixels'], 'ana.png', { type: 'image/png' })
  if (size) Object.defineProperty(file, 'size', { value: size })
  return file
}

beforeEach(() => {
  runtime.fields = {}
  runtime.loading = false
  runtime.level = 0
  runtime.sent = []
  runtime.next = { error: false, result: { id: 7 } }
  runtime.raw = null
  runtime.zeroCalls = []
  runtime.emitted = []
  runtime.hold = false
  runtime.release = null
  window.localStorage.clear()
  withFields()
})

afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

// ---------------------------------------------------------------------------------------------------------------
describe('Delivery UserAddForm · today: titles and fields', () => {
  it.each([
    ['drivers', drivers, 'New driver'],
    ['driver managers', managers, 'New driver manager'],
    ['delivery users', mount, 'New user']
  ])('titles the %s form', (_label, open, title) => {
    open()
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
  })

  it('shows the checkout fields in order, then the drivers\' own, then the password', () => {
    runtime.fields.middle_name.enabled = true
    const { container } = drivers()
    expect(names(container)).toEqual(['name', 'middle_name', 'lastname', 'email', 'external_id', 'password'])
  })

  it('outside the drivers page there is no External ID and no timezone', () => {
    const { container } = managers()
    expect(names(container)).toEqual(['name', 'lastname', 'email', 'password'])
    expect(screen.queryByText('Select a timezone')).not.toBeInTheDocument()
  })

  it('has no fields and no Add button while the validation fields load', () => {
    runtime.loading = true
    const { container } = drivers()
    expect(names(container)).toEqual([])
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument()
  })

  it('shows the phone only when the checkout configures a cellphone', () => {
    const shown = mount()
    expect(phoneInput(shown.container)).toBeInTheDocument()
    shown.unmount()
    withFields({ cellphone: { enabled: false } })
    const hidden = mount()
    expect(phoneInput(hidden.container)).not.toBeInTheDocument()
  })

  it('has no user type selector (the level is the page\'s)', () => {
    mount()
    expect(screen.queryByText('Business owner')).not.toBeInTheDocument()
    expect(screen.queryByText('Administrator')).not.toBeInTheDocument()
  })

  it('hides the password in a checkout', () => {
    const { container } = mount({ isCheckout: true })
    expect(names(container)).not.toContain('password')
  })
})

describe('Delivery UserAddForm · today: what reaches the controller', () => {
  it.each([
    ['drivers', drivers, 4],
    ['driver managers', managers, 5],
    ['delivery users', mount, 3]
  ])('seeds the level of the %s page', async (_label, open, level) => {
    const user = userEvent.setup()
    const { container } = open()
    await user.type(field(container, 'name'), 'Ana')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0]).toEqual({ level, name: 'Ana' })
  })

  it('sends typed fields, the sanitized email and the password', async () => {
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(field(container, 'name'), 'Ana')
    await user.type(field(container, 'email'), 'ANA @Example.com')
    await user.type(field(container, 'password'), 'secret-12')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0]).toEqual({ level: 3, name: 'Ana', email: 'ana@example.com', password: 'secret-12' })
  })

  it('the password is optional unless the project requires it, and never under 8 characters', async () => {
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(field(container, 'name'), 'Ana')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    await user.type(field(container, 'password'), 'short')
    await user.click(addButton())
    await settle()
    expect(runtime.sent).toHaveLength(1)
  })

  it('a password the project requires blocks an empty send', async () => {
    withFields({ password: { required: true } })
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(field(container, 'name'), 'Ana')
    await user.click(addButton())
    await settle()
    expect(runtime.sent).toHaveLength(0)
  })

  it('a required checkout field left empty blocks the send', async () => {
    withFields({ name: { required: true } })
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(field(container, 'lastname'), 'Pérez')
    await user.click(addButton())
    await settle()
    expect(runtime.sent).toHaveLength(0)
  })

  it('the email is NOT required here even when the project asks for it (as in main), but a wrong one blocks', async () => {
    withFields({ email: { required: true } })
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(field(container, 'name'), 'Ana')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    await user.type(field(container, 'email'), 'not-an-email')
    await user.click(addButton())
    await settle()
    expect(runtime.sent).toHaveLength(1)
  })

  it('External ID keeps only digits', async () => {
    const user = userEvent.setup()
    const { container } = drivers()
    await user.type(field(container, 'external_id'), 'a1b2-3')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0].external_id).toBe('123')
  })

  it('the timezone is chosen from the list', async () => {
    const user = userEvent.setup()
    drivers()
    await user.click(screen.getByText('Select a timezone'))
    await user.click(await screen.findByText('Europe/Madrid'))
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0].timezone).toBe('Europe/Madrid')
  })

  it('a valid phone sends the country code and the national number, and an invalid one blocks', async () => {
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(phoneInput(container), '+123')
    await user.click(addButton())
    await settle()
    expect(runtime.sent).toHaveLength(0)
    await user.clear(phoneInput(container))
    await user.type(phoneInput(container), VALID)
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0]).toMatchObject({ country_phone_code: '1', cellphone: '4155552671' })
  })

  it('keeps the raw number when it starts with zero', async () => {
    runtime.raw = { number: '07911123456', countryCallingCode: '+44' }
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(phoneInput(container), '+447911123456')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0].cellphone).toBe('07911123456')
  })

  it('on success tells the host (handleSuccessAdd and onClose)', async () => {
    const user = userEvent.setup()
    const handleSuccessAdd = vi.fn()
    const onClose = vi.fn()
    const { container } = mount({ handleSuccessAdd, onClose })
    await user.type(field(container, 'name'), 'Ana')
    await user.click(addButton())
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(handleSuccessAdd).toHaveBeenCalledWith({ id: 7 })
  })
})

describe('Delivery UserAddForm · today: driver groups', () => {
  it('a driver manager adding a driver sees the groups and the selection goes with the creation', async () => {
    runtime.level = 5
    const user = userEvent.setup()
    const { container } = drivers()
    await user.click(screen.getByText('North zone'))
    await user.click(screen.getByText('South zone'))
    await user.click(screen.getByText('North zone'))
    await user.type(field(container, 'name'), 'Ana')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0].driver_groups_ids).toEqual([12])
  })

  it.each([
    ['another session level', () => { runtime.level = 0; drivers() }],
    ['the managers page', () => { runtime.level = 5; managers() }],
    ['the delivery users page', () => { runtime.level = 5; mount() }]
  ])('shows no groups for %s', (_label, open) => {
    open()
    expect(screen.queryByText('North zone')).not.toBeInTheDocument()
  })

  it('while the groups load shows no names', () => {
    runtime.level = 5
    drivers({ driversGroupsState: { loading: true, groups: [] } })
    expect(screen.queryByText('North zone')).not.toBeInTheDocument()
  })
})

describe('Delivery UserAddForm · today: the tour', () => {
  it('marks the form for the tour on a wide window, and the fields block on a narrow one', () => {
    const width = window.innerWidth
    const wide = drivers()
    expect(wide.container.querySelectorAll('[data-tour="tour_fill"]')).toHaveLength(1)
    expect(wide.container.querySelector('[data-tour="tour_fill"]').tagName).toBe('FORM')
    wide.unmount()
    window.innerWidth = 500
    const narrow = drivers()
    const marked = narrow.container.querySelectorAll('[data-tour="tour_fill"]')
    expect(marked).toHaveLength(1)
    expect(marked[0].tagName).not.toBe('FORM')
    expect(marked[0].contains(field(narrow.container, 'name'))).toBe(true)
    window.innerWidth = width
  })
})

describe('Delivery UserAddForm · today: the photo', () => {
  it('an image opens the crop, and the cropped photo goes with the creation', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const { container } = mount()
    await user.upload(fileInput(container), png())
    expect(await screen.findByTestId('image-crop')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Crop' }))
    await user.type(field(container, 'name'), 'Ana')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0].photo).toBe('data:image/png;base64,CROPPED')
  })

  it('a file that is not an image, or over 2 MB, opens no crop', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const { container } = mount()
    await user.upload(fileInput(container), new File(['x'], 'notes.txt', { type: 'text/plain' }))
    await user.upload(fileInput(container), png(3 * 1024 * 1024))
    await settle()
    expect(screen.queryByTestId('image-crop')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------------------------------------------
describe('Delivery UserAddForm · UF-B4 · one title', () => {
  it('paints its own title by default and none with showTitle false', () => {
    const first = drivers()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    first.unmount()
    const { container } = drivers({ showTitle: false })
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    expect(field(container, 'name')).toBeInTheDocument()
  })
})

describe('Delivery UserAddForm · UF-B4 · fields', () => {
  it('names every field with a visible label', () => {
    drivers()
    expect(labelled('Name')).toBeInTheDocument()
    expect(labelled('Last name')).toBeInTheDocument()
    expect(labelled('Email')).toBeInTheDocument()
    expect(labelled('External ID')).toBeInTheDocument()
    expect(labelled('Phone number')).toBeInTheDocument()
    expect(labelled('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Timezone/ })).toBeInTheDocument()
  })

  it('marks required only what is enforced: the email is not marked (M-UF14 stays as in main)', () => {
    withFields({ name: { required: true }, email: { required: true } })
    mount()
    expect(within(screen.getByText('Name').closest('label')).getByText('Required')).toBeInTheDocument()
    expect(screen.getByText('Email').closest('label')).not.toHaveTextContent('Required')
    expect(screen.getByText('Password').closest('label')).not.toHaveTextContent('Required')
  })

  it('marks the password required when the project requires it', () => {
    withFields({ password: { required: true } })
    mount()
    expect(within(screen.getByText('Password').closest('label')).getByText('Required')).toBeInTheDocument()
  })

  it('the timezone select searches and sends the choice', async () => {
    const user = userEvent.setup()
    const { container } = drivers()
    await user.click(screen.getByRole('button', { name: /Timezone/ }))
    const search = await screen.findByRole('searchbox')
    await user.type(search, 'madrid')
    expect(await screen.findByRole('option', { name: 'Europe/Madrid' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Europe/Paris' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: 'Europe/Madrid' }))
    await user.type(field(container, 'name'), 'Ana')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0].timezone).toBe('Europe/Madrid')
  })

  it('External ID: typing keeps the digits and a paste inserts the digits of the text at the caret', async () => {
    const user = userEvent.setup()
    const { container } = drivers()
    const input = field(container, 'external_id')
    await user.type(input, '12')
    expect(input).toHaveValue('12')
    await user.type(input, 'ab')
    expect(input).toHaveValue('12')
    input.setSelectionRange(1, 1)
    await user.paste('x9y8')
    expect(input).toHaveValue('1982')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0].external_id).toBe('1982')
  })

  it('driver groups are a named group of checkboxes, one per group, with the group name', async () => {
    runtime.level = 5
    const user = userEvent.setup()
    drivers()
    const group = screen.getByRole('group', { name: 'Driver groups' })
    const north = within(group).getByRole('checkbox', { name: 'North zone' })
    const south = within(group).getByRole('checkbox', { name: 'South zone' })
    expect(north).toHaveAttribute('aria-checked', 'false')
    await user.click(north)
    expect(north).toHaveAttribute('aria-checked', 'true')
    expect(south).toHaveAttribute('aria-checked', 'false')
  })

  it('driver groups still loading hold their place without names', () => {
    runtime.level = 5
    drivers({ driversGroupsState: { loading: true, groups: [] } })
    expect(screen.getByRole('group', { name: 'Driver groups' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('uses the Product fields, not the legacy ones', () => {
    const { container } = drivers()
    expect(container.querySelectorAll('.odc-field').length).toBeGreaterThanOrEqual(5)
    expect(container.querySelector('input.form')).toBeNull()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})

describe('Delivery UserAddForm · UF-B4 · «Add» and the errors in their fields', () => {
  it('«Add» is a primary submit button, enabled from the start', () => {
    mount()
    expect(addButton()).toBeEnabled()
    expect(addButton()).toHaveAttribute('type', 'submit')
    expect(addButton().className).toContain('odc-btn')
  })

  it('an empty submit shows the errors under their fields and moves the focus to the first', async () => {
    withFields({ name: { required: true }, lastname: { required: true }, password: { required: true } })
    const user = userEvent.setup()
    const { container } = mount()
    await user.click(addButton())
    expect(runtime.sent).toHaveLength(0)
    expect(within(field(container, 'name').closest('.odc-field')).getByRole('alert')).toHaveTextContent('Name is required')
    expect(within(field(container, 'lastname').closest('.odc-field')).getByRole('alert')).toHaveTextContent('Lastname is required')
    expect(within(field(container, 'password').closest('.odc-field')).getByRole('alert')).toHaveTextContent('The field Password is required')
    expect(field(container, 'name')).toHaveFocus()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('a short password and an invalid email say so inline, and the email is first', async () => {
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(field(container, 'email'), 'not-an-email')
    await user.type(field(container, 'password'), 'short')
    await user.click(addButton())
    expect(within(field(container, 'email').closest('.odc-field')).getByRole('alert')).toHaveTextContent('Invalid email address')
    expect(within(field(container, 'password').closest('.odc-field')).getByRole('alert')).toHaveTextContent('The Password must be at least 8 characters.')
    expect(field(container, 'email')).toHaveFocus()
    expect(runtime.sent).toHaveLength(0)
  })

  it('an empty email is accepted (not required here)', async () => {
    withFields({ email: { required: true } })
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(field(container, 'name'), 'Ana')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(within(field(container, 'email').closest('.odc-field')).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('an invalid phone blocks the send and takes the focus', async () => {
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(phoneInput(container), '+123')
    await user.click(addButton())
    expect(runtime.sent).toHaveLength(0)
    expect(phoneInput(container)).toHaveFocus()
  })

  it('shows «busy» while the API answers and does not send twice', async () => {
    runtime.hold = true
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(field(container, 'name'), 'Ana')
    await user.click(addButton())
    await waitFor(() => expect(addButton()).toHaveAttribute('aria-busy', 'true'))
    await user.click(addButton())
    expect(runtime.sent).toHaveLength(1)
    await act(async () => { runtime.release() })
    await waitFor(() => expect(addButton()).not.toHaveAttribute('aria-busy'))
  })
})

describe('Delivery UserAddForm · UF-B4 · the answer of the API in the form (M-13)', () => {
  class User { constructor () { this.id = 7; this.email = 'ana@example.com' } }
  const fallback = 'We couldn\'t save the changes. Try again.'
  const submitWith = async (result) => {
    runtime.next = { error: true, result }
    const user = userEvent.setup()
    const view = mount()
    await user.type(field(view.container, 'name'), 'Ana')
    await user.click(addButton())
    await waitFor(() => expect(view.container.querySelector('.odc-notice')).not.toBeNull())
    return view.container.querySelector('.odc-notice')
  }

  it('a string error shows as it is, in an alert of the form and not a dialog', async () => {
    const notice = await submitWith('Email already exists')
    expect(notice).toHaveTextContent('Email already exists')
    expect(notice).toHaveAttribute('role', 'alert')
    expect(notice).toHaveAttribute('data-tone', 'danger')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(notice.compareDocumentPosition(addButton()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('a list shows each message', async () => {
    const notice = await submitWith(['Email already exists', 'Phone is invalid'])
    expect(within(notice).getByText('Email already exists')).toBeInTheDocument()
    expect(within(notice).getByText('Phone is invalid')).toBeInTheDocument()
  })

  it.each([
    ['an object', { code: 500 }],
    ['a User instance (the SDK cast)', new User()],
    ['an Error', new Error('boom')],
    ['an empty list', []]
  ])('%s shows the generic message, never an empty notice', async (_label, value) => {
    const notice = await submitWith(value)
    expect(notice).toHaveTextContent(fallback)
    expect(notice.textContent).not.toMatch(/\[object|undefined|null|boom/)
  })
})

describe('Delivery UserAddForm · UF-B4 · the photo', () => {
  it('offers «Add photo» with the avatar, in the Product kit', () => {
    const { container } = mount()
    expect(screen.getByRole('button', { name: 'Add photo' })).toBeInTheDocument()
    expect(container.querySelector('.odc-avatar')).not.toBeNull()
  })

  it('a picked image opens the crop in a Product dialog, and the cropped photo shows in the avatar', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const { container } = mount()
    await user.upload(fileInput(container), png())
    const dialog = await screen.findByRole('dialog', { name: 'Image crop' })
    await user.click(within(dialog).getByRole('button', { name: 'Crop' }))
    await waitFor(() => expect(container.querySelector('.odc-avatar img')).toHaveAttribute('src', 'data:image/png;base64,CROPPED'))
  })

  it('a wrong file says so next to the photo, inline', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const { container } = mount()
    await user.upload(fileInput(container), new File(['x'], 'notes.txt', { type: 'text/plain' }))
    expect(screen.getByText('Only images can be accepted').closest('[role="alert"]')).not.toBeNull()
    await user.upload(fileInput(container), png(3 * 1024 * 1024))
    expect(await screen.findByText('The maximum image size is 2 megabytes')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('dropping an image goes through the same crop', async () => {
    const { container } = mount()
    fireEvent.drop(container.querySelector('[data-testid="drop-zone"]'), { dataTransfer: { files: [png()] } })
    expect(await screen.findByRole('dialog', { name: 'Image crop' })).toBeInTheDocument()
  })
})

describe('UserAddForm · UF integration · a cancelled crop (decision 3)', () => {
  it('closing the crop without cropping attaches no photo to the creation', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const { container } = mount()
    await user.upload(fileInput(container), png())
    expect(await screen.findByTestId('image-crop')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByTestId('image-crop')).not.toBeInTheDocument())
    await user.type(field(container, 'name'), 'Ana')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0].photo).toBeUndefined()
  })
})

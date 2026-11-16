/* eslint-disable import/first */
// redesign UF-B4 (decision 4): the add form of Users in Product. Two kinds of test in one file:
//  - «today» (characterization): what the form keeps from main (fields and order, conditions per prop, what reaches the
//    controller, the photo flow). They were written and run against the old markup first and must stay green.
//  - «UF-B4»: what the batch changes (title opt-in, labels, inline errors with the focus on the first, «Add» as today,
//    leading zero, API error in the form, photo and drag and drop, Product wrappers).
//
// The controller is a stateful stand-in that keeps the real one's semantics (the same `formState` closure, the same
// handlers, `handleAddClick` records what it would POST). The phone piece (libphonenumber) and the crop (cropperjs)
// are simulated at the Shared/UI level, below both the old and the new form, so the same file runs against each.
import React from 'react'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const runtime = vi.hoisted(() => ({
  fields: {},
  loading: false,
  sent: [],
  next: { error: false, result: { id: 7 } },
  phoneValid: value => /^\+\d{8,15}$/.test(value),
  raw: null,
  zeroCalls: [],
  hold: false,
  release: null
}))

vi.mock('../../../../../../index', async () => {
  const React = await import('react')
  const dictionary = {}
  return {
    useLanguage: () => [{ dictionary }, (key, fallback) => fallback ?? key],
    useConfig: () => [{ configs: {} }],
    useSession: () => [{ auth: true, user: { level: 0 } }],
    useEvent: () => [{ emit: () => {} }],
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
        if (props.isFromCustomOrder && changes.level !== undefined) delete changes.level
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
          handleChangeUserType={level => handleChangeSwtich('level', level)}
          handlechangeImage={file => {
            const reader = new window.FileReader()
            reader.readAsDataURL(file)
            reader.onload = () => setFormState({ ...formState, changes: { ...formState.changes, photo: reader.result } })
          }}
          handleButtonAddClick={handleAddClick}
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

// Owner decision 24 B: a stand-in for the admin confirmation (password or code); the real one is tested in Shared/UI
vi.mock('../../../Shared/ConfirmAdmin', () => ({
  ConfirmAdmin: (props) => props.open
    ? (
      <div role='dialog' aria-label={props.title ?? 'Confirm password'}>
        <p>{props.description}</p>
        <button type='button' onClick={() => props.onConfirm('code-1')}>{props.confirmLabel ?? 'Confirm'}</button>
        <button type='button' onClick={props.onClose}>Cancel admin</button>
      </div>
      )
    : null
}))

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
  cellphone: { id: 5, code: 'cellphone', name: 'Mobile phone', type: 'tel', enabled: true, required: false }
}
const withFields = (changes = {}) => {
  runtime.fields = Object.fromEntries(Object.entries(FIELDS).map(([code, field]) => [code, { ...field, ...(changes[code] ?? {}) }]))
  runtime.fields.middle_name.enabled = changes.middle_name?.enabled ?? false
}

const VALID = '+14155552671'
const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 40)) })
const mount = (props = {}) => renderWithProviders(<UserAddForm defaultUserTypesSelected={[3]} {...props} />)
const form = container => container.querySelector('form')
const names = container => [...form(container).querySelectorAll('input[name]')].map(input => input.name)
const field = (container, name) => form(container).querySelector(`[name="${name}"]`)
const phoneInput = container => container.querySelector('input.PhoneInputInput')
// `hidden`: the old form opens a modal Alert (which hides the page behind it) when a rule fails
const addButton = () => screen.getByRole('button', { name: 'Add', hidden: true })
const png = (size) => {
  const file = new File(['pixels'], 'ana.png', { type: 'image/png' })
  if (size) Object.defineProperty(file, 'size', { value: size })
  return file
}
// a required field's label reads «Name *Required»: match by its start
const labelled = name => screen.getByLabelText(new RegExp(`^${name}( |$)`))
const fileInput = container => container.querySelector('input[type="file"]')

beforeEach(() => {
  runtime.fields = {}
  runtime.loading = false
  runtime.sent = []
  runtime.next = { error: false, result: { id: 7 } }
  runtime.raw = null
  runtime.zeroCalls = []
  runtime.hold = false
  runtime.release = null
  withFields()
})

afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

// ---------------------------------------------------------------------------------------------------------------
describe('UserAddForm · today: fields and conditions', () => {
  it('shows the configured checkout fields in the order of the forms, then the password', () => {
    runtime.fields.middle_name.enabled = true
    const { container } = mount()
    expect(names(container)).toEqual(['name', 'middle_name', 'lastname', 'email', 'password'])
  })

  it('hides a field the showField rule hides', () => {
    const { container } = mount()
    expect(names(container)).toEqual(['name', 'lastname', 'email', 'password'])
  })

  it('titles the form «New user»', () => {
    mount()
    expect(screen.getByRole('heading', { level: 1, name: 'New user' })).toBeInTheDocument()
  })

  it('has no fields and no Add button while the validation fields load', () => {
    runtime.loading = true
    const { container } = mount()
    expect(names(container)).toEqual([])
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument()
  })

  it('shows the phone when the checkout configures a cellphone, and not when it does not', () => {
    const shown = mount()
    expect(phoneInput(shown.container)).toBeInTheDocument()
    shown.unmount()
    withFields({ cellphone: { enabled: false } })
    const hidden = mount()
    expect(phoneInput(hidden.container)).not.toBeInTheDocument()
  })

  it('in the custom-order wizard the phone shows even when the checkout does not configure it', () => {
    withFields({ cellphone: { enabled: false } })
    const { container } = mount({ isFromCustomOrder: true, hideUserTypeSelector: true })
    expect(phoneInput(container)).toBeInTheDocument()
  })

  // redesign (row 90, I#24): an explicit `isFromCustomOrder={false}` is «not the wizard», so the checkout configuration decides
  it('an explicit isFromCustomOrder false follows the checkout configuration for the phone', () => {
    const shown = mount({ isFromCustomOrder: false })
    expect(phoneInput(shown.container)).toBeInTheDocument()
    shown.unmount()
    withFields({ cellphone: { enabled: false } })
    const hidden = mount({ isFromCustomOrder: false })
    expect(phoneInput(hidden.container)).not.toBeInTheDocument()
    expect(names(hidden.container)).toContain('password')
  })

  it('has a password unless it is a checkout or the custom-order wizard', () => {
    const plain = mount()
    expect(names(plain.container)).toContain('password')
    plain.unmount()
    const checkout = mount({ isCheckout: true })
    expect(names(checkout.container)).not.toContain('password')
    checkout.unmount()
    const wizard = mount({ isFromCustomOrder: true, hideUserTypeSelector: true })
    expect(names(wizard.container)).not.toContain('password')
  })

  it('shows the type the host preselects and nothing when the host hides the selector', () => {
    mount({ defaultUserTypesSelected: [2] })
    expect(screen.getByText('Business owner')).toBeInTheDocument()
  })

  it('does not show the type selector when the host hides it', () => {
    mount({ hideUserTypeSelector: true })
    expect(screen.queryByText('User')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------------------------------------------
describe('UserAddForm · today: what reaches the controller', () => {
  it('sends the level of the host (the seed), as typed fields, sanitized email and password', async () => {
    const user = userEvent.setup()
    const { container } = mount({ defaultUserTypesSelected: [9] })
    await user.type(field(container, 'name'), 'Ana')
    await user.type(field(container, 'lastname'), 'Pérez')
    await user.type(field(container, 'email'), 'ANA @Example.com')
    await user.type(field(container, 'password'), 'secret-12')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0]).toEqual({ level: 9, name: 'Ana', lastname: 'Pérez', email: 'ana@example.com', password: 'secret-12' })
  })

  it('seeds level 0 for the admins list (sent once the admin confirmation passes, owner decision 24)', async () => {
    const user = userEvent.setup()
    const { container } = mount({ defaultUserTypesSelected: [0] })
    await user.type(field(container, 'password'), 'secret-12')
    await user.click(addButton())
    await user.click(within(await screen.findByRole('dialog', { name: 'Add this administrator?' })).getByRole('button', { name: 'Add admin' }))
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0].level).toBe(0)
  })

  // Owner decision 24 B (2026-10-21, ): creating an admin asks the password or a code, as deactivating one does.
  it('creating an admin asks ConfirmAdmin first and sends nothing until it passes (owner decision 24)', async () => {
    const user = userEvent.setup()
    const { container } = mount({ defaultUserTypesSelected: [0] })
    await user.type(field(container, 'password'), 'secret-12')
    await user.click(addButton())
    const dialog = await screen.findByRole('dialog', { name: 'Add this administrator?' })
    expect(dialog).toHaveTextContent('Administrators can see and change everything in this project.')
    await settle()
    expect(runtime.sent).toHaveLength(0)
    await user.click(within(dialog).getByRole('button', { name: 'Cancel admin' }))
    await settle()
    expect(runtime.sent).toHaveLength(0)
    expect(screen.queryByRole('dialog', { name: 'Add this administrator?' })).not.toBeInTheDocument()
  })

  it('choosing Administrator in the type select asks too; any other type does not (owner decision 24)', async () => {
    const user = userEvent.setup()
    mount({ defaultUserTypesSelected: undefined })
    await user.click(screen.getByRole('button', { name: /User type/ }))
    await user.click(await screen.findByRole('option', { name: 'Administrator' }))
    await user.type(labelled('Password'), 'secret-12')
    await user.click(addButton())
    expect(await screen.findByRole('dialog', { name: 'Add this administrator?' })).toBeInTheDocument()
    expect(runtime.sent).toHaveLength(0)
  })

  it('in the wizard no level is sent, and Add waits for the first change', async () => {
    const user = userEvent.setup()
    const { container } = mount({ isFromCustomOrder: true, hideUserTypeSelector: true })
    expect(addButton()).toBeDisabled()
    await user.type(field(container, 'name'), 'Ana')
    expect(addButton()).toBeEnabled()
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0]).toEqual({ name: 'Ana' })
  })

  it('the password is required here, and at least 8 characters', async () => {
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(field(container, 'name'), 'Ana')
    await user.click(addButton())
    await settle()
    expect(runtime.sent).toHaveLength(0)
    await user.type(field(container, 'password'), 'short')
    await user.click(addButton())
    await settle()
    expect(runtime.sent).toHaveLength(0)
    await user.type(field(container, 'password'), '-12345')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
  })

  it('without a password field (checkout) it sends without one', async () => {
    const user = userEvent.setup()
    const { container } = mount({ isCheckout: true })
    await user.type(field(container, 'name'), 'Ana')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
  })

  it('a required checkout field left empty does not send', async () => {
    withFields({ name: { required: true } })
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(field(container, 'password'), 'secret-12')
    await user.click(addButton())
    await settle()
    expect(runtime.sent).toHaveLength(0)
  })

  it('an invalid email does not send', async () => {
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(field(container, 'email'), 'not-an-email')
    await user.type(field(container, 'password'), 'secret-12')
    await user.click(addButton())
    await settle()
    expect(runtime.sent).toHaveLength(0)
  })

  it('a valid phone sends the country code and the national number', async () => {
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(phoneInput(container), VALID)
    await user.type(field(container, 'password'), 'secret-12')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0]).toMatchObject({ country_phone_code: '1', cellphone: '4155552671' })
  })

  it('an invalid phone does not send', async () => {
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(phoneInput(container), '+123')
    await user.type(field(container, 'password'), 'secret-12')
    await user.click(addButton())
    await settle()
    expect(runtime.sent).toHaveLength(0)
  })

  it('the wizard preloads the phone it is given', async () => {
    const user = userEvent.setup()
    const { container } = mount({ isFromCustomOrder: true, hideUserTypeSelector: true, defaultPhoneNumber: VALID })
    expect(phoneInput(container)).toHaveValue(VALID)
    await user.type(field(container, 'name'), 'Ana')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0]).toMatchObject({ name: 'Ana', country_phone_code: '1', cellphone: '4155552671' })
  })

  it('on success tells the host (handleSuccessAdd and onClose)', async () => {
    const user = userEvent.setup()
    const handleSuccessAdd = vi.fn()
    const onClose = vi.fn()
    const { container } = mount({ handleSuccessAdd, onClose })
    await user.type(field(container, 'password'), 'secret-12')
    await user.click(addButton())
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(handleSuccessAdd).toHaveBeenCalledWith({ id: 7 })
  })
})

// ---------------------------------------------------------------------------------------------------------------
describe('UserAddForm · today: the photo', () => {
  const pick = async (container, file, user = userEvent.setup({ applyAccept: false })) => {
    await user.upload(fileInput(container), file)
  }

  it('an image opens the crop, and the cropped photo goes with the creation (no upload now)', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const { container } = mount()
    await pick(container, png(), user)
    expect(await screen.findByTestId('image-crop')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Crop' }))
    await user.type(field(container, 'password'), 'secret-12')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0].photo).toBe('data:image/png;base64,CROPPED')
  })

  it('a file that is not an image opens no crop and attaches nothing', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const { container } = mount()
    await pick(container, new File(['x'], 'notes.txt', { type: 'text/plain' }), user)
    await settle()
    expect(screen.queryByTestId('image-crop')).not.toBeInTheDocument()
    await user.type(field(container, 'password'), 'secret-12')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0].photo).toBeUndefined()
  })

  it('an image over 2 MB opens no crop', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const { container } = mount()
    await pick(container, png(3 * 1024 * 1024), user)
    await settle()
    expect(screen.queryByTestId('image-crop')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------------------------------------------
describe('UserAddForm · UF-B4 · one title (M-UF9)', () => {
  it('paints its own title by default', () => {
    mount()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('paints none when the host gives one (showTitle false), and still has the form', () => {
    const { container } = mount({ showTitle: false })
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    expect(field(container, 'name')).toBeInTheDocument()
    expect(addButton()).toBeInTheDocument()
  })

  it('the title can take the focus the wizard gives it', () => {
    mount()
    const title = screen.getByRole('heading', { level: 1 })
    title.setAttribute('tabindex', '-1')
    title.focus()
    expect(title).toHaveFocus()
  })
})

describe('UserAddForm · UF-B4 · fields', () => {
  it('names every field with a visible label, not a placeholder', () => {
    mount()
    expect(labelled('Name')).toBeInTheDocument()
    expect(labelled('Last name')).toBeInTheDocument()
    expect(labelled('Email')).toBeInTheDocument()
    expect(labelled('Phone number')).toBeInTheDocument()
    expect(labelled('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /User type/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument()
  })

  it('marks as required the configured fields and the password (read by assistive tech)', () => {
    withFields({ email: { required: true } })
    mount()
    expect(within(screen.getByText('Email').closest('label')).getByText('Required')).toBeInTheDocument()
    expect(within(screen.getByText('Password').closest('label')).getByText('Required')).toBeInTheDocument()
    expect(screen.getByText('Name').closest('label')).not.toHaveTextContent('Required')
  })

  it('the wizard marks no password, and no type selector', () => {
    mount({ isFromCustomOrder: true, hideUserTypeSelector: true })
    expect(screen.queryByLabelText(/^Password/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /User type/ })).not.toBeInTheDocument()
  })

  it('the type select keeps today\'s rule: only the host\'s type, preselected and disabled', () => {
    mount({ defaultUserTypesSelected: [2] })
    const trigger = screen.getByRole('button', { name: /User type/ })
    expect(trigger).toHaveAttribute('aria-disabled', 'true')
    expect(trigger).toHaveTextContent('Business owner')
  })

  it('preselects «User» when the host gives no list, and lets the user choose', async () => {
    const user = userEvent.setup()
    mount({ defaultUserTypesSelected: undefined })
    const trigger = screen.getByRole('button', { name: /User type/ })
    expect(trigger).toHaveAttribute('aria-disabled', 'false')
    expect(trigger).toHaveTextContent('User')
    await user.click(trigger)
    await user.click(await screen.findByRole('option', { name: 'Driver' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /User type/ })).toHaveTextContent('Driver'))
    await user.type(labelled('Name'), 'Ana') // a later render keeps the choice
    expect(screen.getByRole('button', { name: /User type/ })).toHaveTextContent('Driver')
    await user.type(labelled('Password'), 'secret-12')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0].level).toBe(4)
  })

  it('shows the 8 characters rule as a hint of the password', () => {
    mount()
    expect(screen.getByText('At least 8 characters.')).toBeInTheDocument()
  })

  it('uses the Product fields, not the legacy ones', () => {
    const { container } = mount()
    expect(container.querySelectorAll('.odc-field').length).toBeGreaterThanOrEqual(5)
    expect(container.querySelector('input.form')).toBeNull()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})

describe('UserAddForm · UF-B4 · «Add» and the errors in their fields', () => {
  it('«Add» is enabled from the start, as in main', () => {
    mount()
    expect(addButton()).toBeEnabled()
    expect(addButton()).toHaveAttribute('type', 'submit')
    expect(addButton().className).toContain('odc-btn')
  })

  it('an empty submit shows the errors under their fields and moves the focus to the first', async () => {
    withFields({ name: { required: true }, email: { required: true } })
    const user = userEvent.setup()
    const { container } = mount()
    await user.click(addButton())
    expect(runtime.sent).toHaveLength(0)
    const nameField = field(container, 'name').closest('.odc-field')
    const emailField = field(container, 'email').closest('.odc-field')
    expect(within(nameField).getByRole('alert')).toHaveTextContent('Name is required')
    expect(within(emailField).getByRole('alert')).toHaveTextContent('The field Email is required')
    const passwordField = field(container, 'password').closest('.odc-field')
    expect(within(passwordField).getByRole('alert')).toHaveTextContent('The field Password is required')
    expect(field(container, 'name')).toHaveFocus()
    expect(field(container, 'name')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('the error goes away as the user fixes the field', async () => {
    withFields({ name: { required: true } })
    const user = userEvent.setup()
    const { container } = mount()
    await user.click(addButton())
    expect(within(field(container, 'name').closest('.odc-field')).getByRole('alert')).toBeInTheDocument()
    await user.type(field(container, 'name'), 'Ana')
    await waitFor(() => expect(within(field(container, 'name').closest('.odc-field')).queryByRole('alert')).not.toBeInTheDocument())
  })

  it('a short password and an invalid email say so inline', async () => {
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

  it('an invalid phone blocks the send and takes the focus', async () => {
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(phoneInput(container), '+123')
    await user.type(field(container, 'password'), 'secret-12')
    await user.click(addButton())
    expect(runtime.sent).toHaveLength(0)
    expect(phoneInput(container)).toHaveFocus()
  })

  it('shows «busy» on the button while the API answers and does not send twice', async () => {
    runtime.hold = true
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(field(container, 'password'), 'secret-12')
    await user.click(addButton())
    await waitFor(() => expect(addButton()).toHaveAttribute('aria-busy', 'true'))
    await user.click(addButton())
    await user.type(field(container, 'lastname'), 'Pérez{Enter}')
    expect(runtime.sent).toHaveLength(1)
    await act(async () => { runtime.release() })
    await waitFor(() => expect(addButton()).not.toHaveAttribute('aria-busy'))
  })

  it('Enter in a field submits the form with the same validation', async () => {
    withFields({ name: { required: true } })
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(field(container, 'lastname'), 'Pérez{Enter}')
    expect(runtime.sent).toHaveLength(0)
    expect(field(container, 'name')).toHaveFocus()
  })
})

describe('UserAddForm · UF-B4 · leading zero (M-UF15)', () => {
  it('keeps the raw number the phone piece gives back when it starts with zero', async () => {
    runtime.raw = { number: '07911123456', countryCallingCode: '+44' }
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(phoneInput(container), '+447911123456')
    await user.type(field(container, 'password'), 'secret-12')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.zeroCalls).toContain('07911123456')
    expect(runtime.sent[0].cellphone).toBe('07911123456')
  })

  it('does not keep anything when the number has no leading zero', async () => {
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(phoneInput(container), VALID)
    await user.type(field(container, 'password'), 'secret-12')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.zeroCalls[runtime.zeroCalls.length - 1]).toBeNull()
    expect(runtime.sent[0].cellphone).toBe('4155552671')
  })
})

describe('UserAddForm · UF-B4 · the answer of the API in the form (M-13)', () => {
  class User { constructor () { this.id = 7; this.email = 'ana@example.com' } }
  const fallback = 'We couldn\'t save the changes. Try again.'
  const submitWith = async (result) => {
    runtime.next = { error: true, result }
    const user = userEvent.setup()
    const view = mount()
    await user.type(field(view.container, 'password'), 'secret-12')
    await user.click(addButton())
    await waitFor(() => expect(view.container.querySelector('.odc-notice')).not.toBeNull())
    return view.container.querySelector('.odc-notice')
  }

  it('a string error shows as it is', async () => {
    const notice = await submitWith('Email already exists')
    expect(notice).toHaveTextContent('Email already exists')
    expect(notice).toHaveAttribute('role', 'alert')
    expect(notice).toHaveAttribute('data-tone', 'danger')
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

  it('sits above the button, inside the form, and not in a dialog', async () => {
    const notice = await submitWith('Email already exists')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(notice.closest('form')).not.toBeNull()
    expect(notice.compareDocumentPosition(addButton()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps what the user typed so the next try is one click', async () => {
    const notice = await submitWith('Email already exists')
    expect(notice).toBeInTheDocument()
    expect(labelled('Password')).toHaveValue('secret-12')
  })
})

describe('UserAddForm · UF-B4 · the photo', () => {
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
    expect(within(dialog).getByTestId('image-crop')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Crop' }))
    await waitFor(() => expect(container.querySelector('.odc-avatar img')).toHaveAttribute('src', 'data:image/png;base64,CROPPED'))
  })

  it('a file that is not an image says so next to the photo, and the crop does not open', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const { container } = mount()
    await user.upload(fileInput(container), new File(['x'], 'notes.txt', { type: 'text/plain' }))
    expect(await screen.findByText('Only images can be accepted')).toBeInTheDocument()
    expect(screen.getByText('Only images can be accepted').closest('[role="alert"]')).not.toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('an image over 2 MB says so, and the crop does not open', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const { container } = mount()
    await user.upload(fileInput(container), png(3 * 1024 * 1024))
    expect(await screen.findByText('The maximum image size is 2 megabytes')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('dropping an image goes through the same crop', async () => {
    const { container } = mount()
    fireEvent.drop(container.querySelector('[data-testid="drop-zone"]'), { dataTransfer: { files: [png()] } })
    expect(await screen.findByRole('dialog', { name: 'Image crop' })).toBeInTheDocument()
  })

  it('dropping a file that is not an image gets the same message', async () => {
    const { container } = mount()
    fireEvent.drop(container.querySelector('[data-testid="drop-zone"]'), { dataTransfer: { files: [new File(['x'], 'a.txt', { type: 'text/plain' })] } })
    expect(await screen.findByText('Only images can be accepted')).toBeInTheDocument()
  })

  it('the photo goes with the creation: nothing is sent until Add', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const { container } = mount()
    await user.upload(fileInput(container), png())
    await user.click(await screen.findByRole('button', { name: 'Crop' }))
    expect(runtime.sent).toHaveLength(0)
    await user.type(labelled('Password'), 'secret-12')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0].photo).toBe('data:image/png;base64,CROPPED')
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
    await user.type(labelled('Password'), 'secret-12')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0].photo).toBeUndefined()
  })
})

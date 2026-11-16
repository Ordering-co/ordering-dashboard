/* eslint-disable import/first */
// redesign (P-UF5): the add form of professionals in the composition gave `UserAddForm`. It is shared by two
// hosts: the staff directory's sheet already titles the form «Add professional» (`showTitle={false}`, `occupations` from the list),
// Stores (BusinessServiceProfessionalDetail) shows the title «New professional» and its own close (`isService`, no `occupations`:
// the selector fetches its own list).
//
// Two kinds of test, as in UserAddForm.test.jsx:
//  - «kept»: what main does and the migration must not lose (title and close rules, the 24/7 schedule as the only mount write,
//    the password optional, no level from the UI, the photo as picked, the birthday string, the answer of the API).
//  - «P-UF5»: how it reads now (labelled Product fields, errors in their fields with the focus on the first, the API error in the
//    form, the photo flow inline, the specialist always there).
//
// The controller is a stateful stand-in with the semantics of the real one (the same stale `formState` closure in every handler);
// `handleAddClick` records what it would POST (the real one adds `level: 8` for `isProfessional`: the UI must not seed it). The phone
// piece (libphonenumber) is simulated at Shared/UI level, below both the old and the new form; the occupation selector is a stub
// (it has its own tests).
import React from 'react'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const runtime = vi.hoisted(() => ({
  fields: {},
  loading: false,
  configs: {},
  passwordRequired: false,
  sent: [],
  writes: [],
  images: [],
  controllerProps: null,
  occupationProps: [],
  next: { error: false, result: { id: 7 } },
  phoneValid: value => /^\+\d{8,15}$/.test(value),
  raw: null,
  zeroCalls: [],
  hold: false,
  release: null,
  keys: []
}))

vi.mock('../../../../../../index', async () => {
  const React = await import('react')
  const dictionary = {}
  return {
    useLanguage: () => [{ dictionary }, (key, fallback) => { runtime.keys.push(key); return fallback ?? key }],
    useConfig: () => [{ configs: runtime.configs }],
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
    // the legacy photo picker of the old form (the new one has its own button and input)
    ExamineClick: ({ onFiles, childRef, children, accept, disabled }) => (
      <div>
        <input type='file' accept={accept} disabled={disabled} ref={childRef} onChange={event => onFiles(event.target.files)} />
        {children}
      </div>
    ),
    UserFormDetails: ({ UIComponent, ...props }) => {
      runtime.controllerProps = props
      const [formState, setFormState] = React.useState({ loading: false, changes: {}, result: { error: false } })
      const [startZero, setStartZero] = React.useState(null)
      const checkout = runtime.fields
      const validationFields = { loading: runtime.loading, fields: { checkout } }
      const showField = code => !runtime.loading && (!checkout[code] || !!checkout[code].enabled)
      const isRequiredField = code => {
        if (runtime.loading) return false
        if (code === 'password') return runtime.passwordRequired
        return !!checkout[code] && !!checkout[code].enabled && !!checkout[code].required
      }
      const handleChangeInput = (e, isMany) => {
        let changes = {}
        if (isMany) Object.values(e).forEach(obj => { changes = { ...changes, [obj.name]: obj.value } })
        else changes = { [e.target.name]: e.target.value }
        runtime.writes.push(['input', ...Object.keys(changes)])
        setFormState({ ...formState, changes: { ...formState.changes, ...changes } })
      }
      const handleChangeSwtich = (type, value) => {
        runtime.writes.push(['switch', type])
        setFormState({ ...formState, changes: { ...formState.changes, [type]: value } })
      }
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
      return (
        <UIComponent
          {...props}
          formState={formState}
          validationFields={validationFields}
          showField={showField}
          isRequiredField={isRequiredField}
          cleanFormState={values => { runtime.writes.push(['clean']); setFormState({ ...formState, ...values }) }}
          handleChangeInput={handleChangeInput}
          handleChangeSwtich={handleChangeSwtich}
          handlechangeImage={file => {
            runtime.images.push(file)
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

vi.mock('../../OccupationSelector', () => ({
  OccupationSelector: props => {
    runtime.occupationProps.push(props)
    return (
      <div data-testid='occupation' data-count={props.occupations?.length ?? 'none'} data-selected={props.occupationId ?? ''}>
        <button type='button' onClick={() => props.handleChangeOccupation(5)}>Pick occupation</button>
      </div>
    )
  }
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

import { ProfessionalAddForm } from '../index'

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

const OCCUPATIONS = [{ id: 5, name: 'Barber' }, { id: 6, name: 'Stylist' }]
const VALID = '+14155552671'
const mount = (props = {}) => renderWithProviders(<ProfessionalAddForm occupations={OCCUPATIONS} {...props} />)
const form = container => container.querySelector('form')
const names = container => [...form(container).querySelectorAll('input[name]')].map(input => input.name)
const field = (container, name) => form(container).querySelector(`[name="${name}"]`)
const phoneInput = container => container.querySelector('input.PhoneInputInput')
const addButton = () => screen.getByRole('button', { name: 'Add' })
const png = (size) => {
  const file = new File(['pixels'], 'ana.png', { type: 'image/png' })
  if (size) Object.defineProperty(file, 'size', { value: size })
  return file
}
// a required field's label reads «Name *Required»: match by its start
const labelled = name => screen.getByLabelText(new RegExp(`^${name}( |$)`))
const fileInput = container => container.querySelector('input[type="file"]')
const follows = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

beforeEach(() => {
  runtime.keys = []
  runtime.fields = {}
  runtime.loading = false
  runtime.configs = {}
  runtime.passwordRequired = false
  runtime.sent = []
  runtime.writes = []
  runtime.images = []
  runtime.controllerProps = null
  runtime.occupationProps = []
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
describe('ProfessionalAddForm · kept: title and close (decision 12, auditor 12)', () => {
  it('shows the «New professional» title by default (Stores does not change)', () => {
    mount()
    expect(screen.getByRole('heading', { level: 1, name: 'New professional' })).toBeInTheDocument()
  })

  it('shows it when showTitle is true', () => {
    mount({ showTitle: true })
    expect(screen.getByRole('heading', { level: 1, name: 'New professional' })).toBeInTheDocument()
  })

  it('does not render it with showTitle={false}, and the form is still there', () => {
    const { container } = mount({ showTitle: false })
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.queryByText('New professional')).toBeNull()
    expect(screen.getByTestId('occupation')).toBeInTheDocument()
    expect(field(container, 'name')).toBeInTheDocument()
    expect(addButton()).toBeInTheDocument()
  })

  it('as a service (Stores) the close button stays in the header row with the title by default', async () => {
    const onClose = vi.fn()
    mount({ isService: true, onClose })
    const title = screen.getByRole('heading', { name: 'New professional' })
    const close = within(title.parentElement).getByRole('button', { name: 'Close' })
    await userEvent.setup().click(close)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('without a title the close button of a service is not lost', async () => {
    const onClose = vi.fn()
    mount({ isService: true, onClose, showTitle: false })
    expect(screen.queryByRole('heading')).toBeNull()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('a host that is not a service gets no close button of its own', () => {
    mount({ onClose: () => {} })
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  })
})

// ---------------------------------------------------------------------------------------------------------------
describe('ProfessionalAddForm · P-UF5 · composition', () => {
  it('is the add-form composition: a root, a form that does not validate natively, the tour anchor', () => {
    const { container } = mount()
    const root = container.querySelector('div.odc-uf-add')
    expect(root).not.toBeNull()
    const el = root.querySelector(':scope > form.odc-uf-form')
    expect(el).not.toBeNull()
    expect(el).toHaveAttribute('novalidate')
    expect(el).toHaveAttribute('autocomplete', 'off')
    expect(el).toHaveAttribute('data-tour', 'tour_fill')
  })

  it('asks the controller for a professional: no session user, validation fields, isProfessional', () => {
    mount()
    expect(runtime.controllerProps).toMatchObject({ useSessionUser: false, useValidationFields: true, isProfessional: true })
  })

  it('uses the Product fields, not the legacy ones, and no modal', () => {
    const { container } = mount()
    expect(container.querySelectorAll('.odc-field').length).toBeGreaterThanOrEqual(4)
    expect(container.querySelector('input.form')).toBeNull()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' }).className).toContain('odc-btn')
  })

  it('shows the fields in the order: photo, specialist, checkout fields, phone, password, birthday, Add', () => {
    const { container } = mount()
    expect(names(container)).toEqual(['name', 'lastname', 'email', 'password'])
    const chain = [
      screen.getByRole('button', { name: 'Add photo' }),
      screen.getByRole('group', { name: 'Occupation' }),
      field(container, 'name'),
      field(container, 'lastname'),
      field(container, 'email'),
      phoneInput(container),
      field(container, 'password'),
      screen.getByRole('combobox', { name: /Date of birth/ }),
      addButton()
    ]
    chain.slice(1).forEach((node, index) => expect(follows(chain[index], node)).toBe(true))
  })

  it('hides a field the showField rule hides and shows the middle name when it is configured', () => {
    runtime.fields.middle_name.enabled = true
    const { container } = mount()
    expect(names(container)).toEqual(['name', 'middle_name', 'lastname', 'email', 'password'])
  })

  it('has no fields and no Add button while the validation fields load, only skeleton rows', () => {
    runtime.loading = true
    const { container } = mount()
    expect(names(container)).toEqual([])
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument()
    expect(container.querySelector('.odc-uf-skeleton')).not.toBeNull()
    expect(container.querySelectorAll('.odc-uf-skeleton-row')).toHaveLength(6)
  })

  it('names every field with a visible label, not a placeholder', () => {
    mount()
    expect(labelled('Name')).toBeInTheDocument()
    expect(labelled('Last name')).toBeInTheDocument()
    expect(labelled('Email')).toBeInTheDocument()
    expect(screen.getByText('Phone number', { selector: 'label, label *' })).toBeInTheDocument()
    expect(labelled('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument()
  })

  it('has no user type selector', () => {
    mount()
    expect(screen.queryByText('User type')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /User type/ })).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------------------------------------------
describe('ProfessionalAddForm · P-UF5 · the specialist', () => {
  it('is a labelled group with the selector, given the list of the host', () => {
    mount()
    const group = screen.getByRole('group', { name: 'Occupation' })
    expect(within(group).getByTestId('occupation')).toHaveAttribute('data-count', '2')
    expect(within(group).getByText('Occupation')).toBeVisible()
  })

  it('is there also when the host gives no list (Stores: the selector fetches its own)', () => {
    mount({ occupations: undefined, isService: true, onClose: () => {} })
    const group = screen.getByRole('group', { name: 'Occupation' })
    expect(within(group).getByTestId('occupation')).toHaveAttribute('data-count', 'none')
  })

  it('is there with an empty list too', () => {
    mount({ occupations: [] })
    expect(screen.getByRole('group', { name: 'Occupation' })).toBeInTheDocument()
  })

  it('writes the chosen occupation as occupation_id, and shows it as selected', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: 'Pick occupation' }))
    await waitFor(() => expect(screen.getByTestId('occupation')).toHaveAttribute('data-selected', '5'))
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0].occupation_id).toBe(5)
  })
})

// ---------------------------------------------------------------------------------------------------------------
describe('ProfessionalAddForm · kept: what reaches the controller', () => {
  const week = Array.from({ length: 7 }, () => ({
    enabled: true,
    lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }]
  }))

  it('the 24/7 schedule is the only write at mount (the controller handlers close over a stale state)', () => {
    mount()
    expect(runtime.writes).toEqual([['input', 'schedule']])
  })

  it('«Add» is enabled from the start (the schedule is already a change) and submits', () => {
    mount()
    expect(addButton()).toBeEnabled()
    expect(addButton()).toHaveAttribute('type', 'submit')
  })

  it('sends the schedule every day open 00:00-23:59, and no level (the controller adds it)', async () => {
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(field(container, 'name'), 'Ana')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0].schedule).toEqual(week)
    expect(runtime.sent[0]).not.toHaveProperty('level')
    expect(runtime.sent[0].name).toBe('Ana')
  })

  it('sends typed fields and the sanitized, lower-cased email', async () => {
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(field(container, 'name'), 'Ana')
    await user.type(field(container, 'lastname'), 'Pérez')
    await user.type(field(container, 'email'), 'ANA @Example.com')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0]).toMatchObject({ name: 'Ana', lastname: 'Pérez', email: 'ana@example.com' })
    expect(runtime.sent[0]).not.toHaveProperty('password')
  })

  it('without a password field (checkout) it sends without one', async () => {
    const user = userEvent.setup()
    const { container } = mount({ isCheckout: true })
    expect(names(container)).not.toContain('password')
    await user.type(field(container, 'name'), 'Ana')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
  })

  it('on success tells the host (handleSuccessAdd and onClose)', async () => {
    const user = userEvent.setup()
    const handleSuccessAdd = vi.fn()
    const onClose = vi.fn()
    mount({ handleSuccessAdd, onClose })
    await user.click(addButton())
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(handleSuccessAdd).toHaveBeenCalledWith({ id: 7 })
  })
})

describe('ProfessionalAddForm · kept: the password is optional for a professional', () => {
  it('a professional can be created without a password (main)', async () => {
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(field(container, 'name'), 'Ana')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0]).not.toHaveProperty('password')
  })

  it('is not marked as required, and says it needs 8 characters', () => {
    mount()
    expect(screen.getByText('Password').closest('label')).not.toHaveTextContent('Required')
    expect(screen.getByText('At least 8 characters.')).toBeInTheDocument()
  })

  it('once typed it needs 8 characters: says so in the field, takes the focus and does not send', async () => {
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(field(container, 'password'), 'short')
    await user.click(addButton())
    expect(runtime.sent).toHaveLength(0)
    expect(within(field(container, 'password').closest('.odc-field')).getByRole('alert')).toHaveTextContent('The Password must be at least 8 characters.')
    expect(field(container, 'password')).toHaveFocus()
    await user.type(field(container, 'password'), '-12345')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0].password).toBe('short-12345')
  })

  it('when the project requires it, it is marked, and an empty one blocks the send', async () => {
    runtime.passwordRequired = true
    const user = userEvent.setup()
    const { container } = mount()
    expect(within(screen.getByText('Password').closest('label')).getByText('Required')).toBeInTheDocument()
    await user.click(addButton())
    expect(runtime.sent).toHaveLength(0)
    expect(within(field(container, 'password').closest('.odc-field')).getByRole('alert')).toHaveTextContent('The field Password is required')
    expect(field(container, 'password')).toHaveFocus()
  })
})

describe('ProfessionalAddForm · P-UF5 · the errors in their fields', () => {
  it('an empty submit shows the required fields under their fields and moves the focus to the first', async () => {
    withFields({ name: { required: true }, email: { required: true } })
    const user = userEvent.setup()
    const { container } = mount()
    await user.click(addButton())
    expect(runtime.sent).toHaveLength(0)
    expect(within(field(container, 'name').closest('.odc-field')).getByRole('alert')).toHaveTextContent('Name is required')
    expect(within(field(container, 'email').closest('.odc-field')).getByRole('alert')).toHaveTextContent('The field Email is required')
    expect(field(container, 'name')).toHaveFocus()
    expect(field(container, 'name')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('shows no error before the first submit, and the error goes away as the user fixes the field', async () => {
    withFields({ name: { required: true } })
    const user = userEvent.setup()
    const { container } = mount()
    expect(within(field(container, 'name').closest('.odc-field')).queryByRole('alert')).not.toBeInTheDocument()
    await user.click(addButton())
    expect(within(field(container, 'name').closest('.odc-field')).getByRole('alert')).toBeInTheDocument()
    await user.type(field(container, 'name'), 'Ana')
    await waitFor(() => expect(within(field(container, 'name').closest('.odc-field')).queryByRole('alert')).not.toBeInTheDocument())
  })

  it('an invalid email says so in its field, takes the focus and does not send', async () => {
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(field(container, 'email'), 'not-an-email')
    await user.click(addButton())
    expect(within(field(container, 'email').closest('.odc-field')).getByRole('alert')).toHaveTextContent('Invalid email address')
    expect(field(container, 'email')).toHaveFocus()
    expect(runtime.sent).toHaveLength(0)
  })

  it('Enter in a field submits the form with the same validation', async () => {
    withFields({ name: { required: true } })
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(field(container, 'lastname'), 'Pérez{Enter}')
    expect(runtime.sent).toHaveLength(0)
    expect(field(container, 'name')).toHaveFocus()
  })

  // redesign (P-OF4): «Add» with only the busy state, as the user add form (main said «Loading»)
  it('shows «busy» on «Add» while the API answers and does not send twice', async () => {
    runtime.hold = true
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(field(container, 'name'), 'Ana')
    await user.click(addButton())
    await waitFor(() => expect(addButton()).toHaveAttribute('aria-busy', 'true'))
    expect(screen.queryByRole('button', { name: 'Loading' })).not.toBeInTheDocument()
    expect(addButton()).toHaveAttribute('type', 'submit')
    await user.click(addButton())
    await user.type(field(container, 'lastname'), 'Pérez{Enter}')
    expect(runtime.sent).toHaveLength(1)
    await act(async () => { runtime.release() })
    await waitFor(() => expect(addButton()).not.toHaveAttribute('aria-busy'))
  })

  // redesign (P-OF4, owner via triage): the same words as the user add form
  it('says what the user add form says: «Phone number» (PHONE_NUMBER) and «Password» (FRONT_VISUALS_PASSWORD)', () => {
    runtime.configs = {}
    mount()
    expect(runtime.keys).toContain('PHONE_NUMBER')
    expect(runtime.keys).toContain('FRONT_VISUALS_PASSWORD')
    expect(runtime.keys).not.toContain('PHONE')
    expect(runtime.keys).not.toContain('PASSWORD')
    expect(runtime.keys).not.toContain('SPECIALIST')
  })
})

describe('ProfessionalAddForm · kept: the phone', () => {
  it('shows the phone when the checkout configures a cellphone, and not when it does not', () => {
    const shown = mount()
    expect(phoneInput(shown.container)).toBeInTheDocument()
    shown.unmount()
    withFields({ cellphone: { enabled: false } })
    const hidden = mount()
    expect(phoneInput(hidden.container)).not.toBeInTheDocument()
  })

  it('a valid phone sends the country code and the national number', async () => {
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(phoneInput(container), VALID)
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0]).toMatchObject({ country_phone_code: '1', cellphone: '4155552671' })
  })

  // the legacy phone piece paints its own «invalid» message under the input (stubbed here); the form blocks the send and focuses it
  it('an invalid phone takes the focus, does not send, and opens no modal', async () => {
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(phoneInput(container), '+123')
    await user.click(addButton())
    expect(runtime.sent).toHaveLength(0)
    expect(phoneInput(container)).toHaveFocus()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('keeps the raw number the phone piece gives back when it starts with zero', async () => {
    runtime.raw = { number: '07911123456', countryCallingCode: '+44' }
    const user = userEvent.setup()
    const { container } = mount()
    await user.type(phoneInput(container), '+447911123456')
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.zeroCalls).toContain('07911123456')
    expect(runtime.sent[0].cellphone).toBe('07911123456')
  })
})

describe('ProfessionalAddForm · kept: the birthday', () => {
  it('sends nothing for the birthday until one is chosen', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0]).not.toHaveProperty('birthdate')
  })

  it('writes the same YYYY-MM-DD string through handleChangeSwtich, typed in the project format', async () => {
    runtime.configs = { dates_general_format: { value: 'DD/MM/YYYY HH:mm' } }
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('combobox', { name: /Date of birth/ }))
    const typed = await screen.findByRole('textbox', { name: 'Date of birth' })
    await user.type(typed, '15/06/1991')
    expect(runtime.writes).toContainEqual(['switch', 'birthdate'])
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.getByRole('combobox', { name: /Date of birth/ })).toHaveTextContent('15/06/1991'))
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0].birthdate).toBe('1991-06-15')
  })

  it('does not take a day before 1922', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('combobox', { name: /Date of birth/ }))
    const typed = await screen.findByRole('textbox', { name: 'Date of birth' })
    await user.type(typed, '1921-12-31')
    expect(runtime.writes).not.toContainEqual(['switch', 'birthdate'])
    expect(await screen.findByText('That date is not available.')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------------------------------------------
describe('ProfessionalAddForm · P-UF5 · the answer of the API in the form', () => {
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

  it('a string error shows as it is, as an alert of danger tone', async () => {
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
    expect(follows(notice, addButton())).toBe(true)
  })

  it('keeps what the user typed so the next try is one click', async () => {
    const notice = await submitWith('Email already exists')
    expect(notice).toBeInTheDocument()
    expect(labelled('Name')).toHaveValue('Ana')
  })
})

// redesign (P-OF1): the photo goes through the crop of the user add form; only the cropped photo goes with the creation
describe('ProfessionalAddForm · the photo (cropped, as the user add form)', () => {
  it('offers «Add photo» with the hint and the avatar, in the Product kit', () => {
    const { container } = mount()
    expect(screen.getByRole('button', { name: 'Add photo' })).toBeInTheDocument()
    expect(screen.getByText('JPG or PNG, up to 2 MB.')).toBeInTheDocument()
    expect(container.querySelector('.odc-avatar')).not.toBeNull()
    expect(fileInput(container)).toHaveAttribute('accept', 'image/png, image/jpeg, image/jpg')
    expect(fileInput(container)).toHaveAttribute('hidden')
  })

  it('«Add photo» opens the file picker', async () => {
    const user = userEvent.setup()
    const { container } = mount()
    const click = vi.spyOn(fileInput(container), 'click').mockImplementation(() => {})
    await user.click(screen.getByRole('button', { name: 'Add photo' }))
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('a picked image opens the crop in a Product dialog, and the cropped photo shows in the avatar', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const { container } = mount()
    await user.upload(fileInput(container), png())
    const dialog = await screen.findByRole('dialog', { name: 'Image crop' })
    expect(within(dialog).getByTestId('image-crop').getAttribute('data-photo')).toMatch(/^data:image\/png;base64,/)
    expect(runtime.images).toHaveLength(0)
    await user.click(within(dialog).getByRole('button', { name: 'Crop' }))
    await waitFor(() => expect(container.querySelector('.odc-avatar img')).toHaveAttribute('src', 'data:image/png;base64,CROPPED'))
  })

  it('the cropped photo goes with the creation: nothing is sent until Add', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const { container } = mount()
    await user.upload(fileInput(container), png())
    await user.click(await screen.findByRole('button', { name: 'Crop' }))
    await waitFor(() => expect(container.querySelector('.odc-avatar img')).not.toBeNull())
    expect(runtime.sent).toHaveLength(0)
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0].photo).toBe('data:image/png;base64,CROPPED')
  })

  it('closing the crop without cropping attaches no photo to the creation', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const { container } = mount()
    await user.upload(fileInput(container), png())
    expect(await screen.findByTestId('image-crop')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByTestId('image-crop')).not.toBeInTheDocument())
    await user.click(addButton())
    await waitFor(() => expect(runtime.sent).toHaveLength(1))
    expect(runtime.sent[0].photo).toBeUndefined()
  })

  it('dropping an image goes through the same crop', async () => {
    const { container } = mount()
    fireEvent.drop(container.querySelector('[data-testid="drop-zone"]'), { dataTransfer: { files: [png()] } })
    expect(await screen.findByRole('dialog', { name: 'Image crop' })).toBeInTheDocument()
  })

  it('a file that is not an image says so next to the photo, in an alert, and attaches nothing', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const { container } = mount()
    await user.upload(fileInput(container), new File(['x'], 'notes.txt', { type: 'text/plain' }))
    const message = await screen.findByText('Only images can be accepted')
    expect(message.closest('[role="alert"]')).not.toBeNull()
    expect(runtime.images).toHaveLength(0)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('an image over 2 MB says so and attaches nothing', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const { container } = mount()
    await user.upload(fileInput(container), png(3 * 1024 * 1024))
    const message = await screen.findByText('The maximum image size is 2 megabytes')
    expect(message.closest('[role="alert"]')).not.toBeNull()
    expect(message.closest('form')).not.toBeNull()
    expect(runtime.images).toHaveLength(0)
  })

  it('dropping a file that is not an image gets the same message, inline', async () => {
    const { container } = mount()
    fireEvent.drop(container.querySelector('[data-testid="drop-zone"]'), { dataTransfer: { files: [new File(['x'], 'a.txt', { type: 'text/plain' })] } })
    const message = await screen.findByText('Only images can be accepted')
    expect(message.closest('[role="alert"]')).not.toBeNull()
    expect(message.closest('form')).not.toBeNull()
    expect(runtime.images).toHaveLength(0)
  })

  it('the message goes away with the next valid image', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const { container } = mount()
    await user.upload(fileInput(container), new File(['x'], 'notes.txt', { type: 'text/plain' }))
    expect(await screen.findByText('Only images can be accepted')).toBeInTheDocument()
    await user.upload(fileInput(container), png())
    await waitFor(() => expect(screen.queryByText('Only images can be accepted')).not.toBeInTheDocument())
    expect(await screen.findByRole('dialog', { name: 'Image crop' })).toBeInTheDocument()
  })
})

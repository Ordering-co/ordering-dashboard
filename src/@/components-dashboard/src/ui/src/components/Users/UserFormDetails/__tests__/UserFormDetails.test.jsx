/* eslint-disable import/first */
// redesign UF-B2 (decisions 1-3) · the profile form of Users (`UserProfileForm` + `UserFormDetailsUI`).
//
// Part 1 characterizes what the migration keeps (fields and their order, the values sent to the controller, the validations
// and the conditions) so it passes against the old and the new UI. Part 2 covers what changes: labels, errors under the
// fields, the save bar (the «Update» button and the «Profile» Alert are gone), discard, the photo flow.
//
// The controller is a small stateful fake that works like the real one (`K/UserFormDetails`): same `formState` shape, same
// handlers, same stale-closure spreads, a save that can succeed, fail or hold. The legacy phone input and the cropper are
// stubbed (they have their own tests); everything else is the real UI of this tree.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const runtime = vi.hoisted(() => ({
  spies: null,
  save: 'ok',
  failWith: 'Email already exists',
  release: null,
  initialForm: null,
  validationFields: null,
  showField: null,
  isRequiredField: null,
  configs: {},
  userData: null
}))

vi.mock('../../../../../../index', async () => {
  const React = await import('react')
  const dictionary = {}
  return {
    useLanguage: () => [{ dictionary }, (key, fallback) => fallback ?? key],
    useConfig: () => [{ configs: runtime.configs }],
    useCustomer: () => [{}, { setUserCustomer: (...args) => runtime.spies.setUserCustomer(...args) }],
    // the drop zone hands its files to `onDrop` as a DataTransfer, as the real one does
    DragAndDrop: ({ onDrop, children, className }) => (
      <div data-testid='drop-zone' className={className} onDrop={event => onDrop(event.dataTransfer)}>{children}</div>
    ),
    UserFormDetails: ({ UIComponent, user, ...props }) => {
      const s = runtime.spies
      const [formState, setFormState] = React.useState(() => runtime.initialForm())
      const [userState, setUserState] = React.useState({ loading: false, result: { error: false, result: user } })
      const patch = (changes) => setFormState({ ...formState, changes: { ...formState.changes, ...changes } })
      const handleButtonUpdateClick = async (changes, isImage) => {
        s.update(changes, isImage)
        setFormState({ ...formState, loading: true })
        if (runtime.save === 'hold') {
          await new Promise(resolve => { runtime.release = resolve })
        } else {
          await Promise.resolve()
        }
        if (runtime.save === 'fail') {
          setFormState({ ...formState, loading: false, result: { error: true, result: runtime.failWith } })
          return
        }
        const { photo, ...rest } = formState.changes
        const saved = isImage ? { photo } : { ...rest, ...(changes || {}) }
        setUserState({ ...userState, result: { error: false, result: { ...userState.result.result, ...saved } } })
        setFormState({ ...formState, loading: false, changes: isImage ? rest : {}, result: { error: false, result: saved } })
      }
      return (
        <UIComponent
          {...props}
          formState={formState}
          userState={userState}
          validationFields={runtime.validationFields}
          showField={runtime.showField}
          isRequiredField={runtime.isRequiredField}
          cleanFormState={(values) => { s.cleanFormState(values); setFormState({ ...formState, ...values }) }}
          handleChangeInput={(e, isMany) => {
            s.input(e, isMany)
            patch(isMany ? Object.values(e).reduce((all, item) => ({ ...all, [item.name]: item.value }), {}) : { [e.target.name]: e.target.value })
          }}
          handleChangeSwtich={(type, value) => { s.swtich(type, value); patch({ [type]: value }) }}
          handleChangeUserType={(level) => { s.userType(level); patch({ level }) }}
          handleChangeOccupation={(id) => { s.occupation(id); patch({ occupation_id: id }) }}
          handlechangeImage={(file) => { s.image(file); patch({ photo: 'data:image/png;base64,RAW' }) }}
          handleButtonUpdateClick={handleButtonUpdateClick}
          setCellphoneStartZero={(value) => s.startZero(value)}
        />
      )
    }
  }
})

// the legacy phone input: a text input that reports like the real one (number, validity, raw number)
vi.mock('../../../Shared/UI/InputPhoneNumber', () => ({
  InputPhoneNumber: ({ value, setValue, handleIsValid, user, isUser }) => {
    const valid = (number) => /^\+\d{8,15}$/.test(number || '')
    React.useEffect(() => { if (value) handleIsValid?.(valid(value)) }, [value])
    return (
      <div className='phone_number' data-is-user={isUser ? 'true' : 'false'} data-user-id={user?.id}>
        <input
          className='PhoneInputInput'
          data-testid='phone'
          value={value || ''}
          onChange={event => {
            const number = event.target.value
            setValue(number, valid(number), number.startsWith('+390') ? { number: number.slice(3), countryCallingCode: '+39' } : number)
          }}
        />
        {value && !valid(value) && <span className='od-phone-input-error'>The Phone Number field is invalid</span>}
      </div>
    )
  }
}))

vi.mock('../../../Shared/UI/ImageCrop', () => ({
  ImageCrop: ({ photo, handleChangePhoto, onClose }) => (
    <div data-testid='cropper' data-photo={photo}>
      <button type='button' onClick={() => { handleChangePhoto('data:image/png;base64,CROPPED'); onClose?.() }}>Crop</button>
    </div>
  )
}))

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

vi.mock('../../OccupationSelector', () => ({
  OccupationSelector: ({ occupationId, occupations, handleChangeOccupation }) => (
    <div data-testid='occupation' data-id={String(occupationId)}>
      {occupations.map(item => (
        <button key={item.id} type='button' onClick={() => handleChangeOccupation(item.id)}>{item.name}</button>
      ))}
    </div>
  )
}))

import { UserFormDetailsUI } from '..'
import { UserProfileForm } from '../../UserProfileForm'

const field = (id, code, name, extra = {}) => ({ id, code, name, type: code === 'email' ? 'email' : 'text', enabled: true, required: false, ...extra })
const FIELDS = {
  email: field(5, 'email', 'Email'),
  second_lastname: field(4, 'second_lastname', 'Second last name'),
  lastname: field(3, 'lastname', 'Last name'),
  name: field(1, 'name', 'Name'),
  middle_name: field(2, 'middle_name', 'Middle name'),
  cellphone: field(6, 'cellphone', 'Cellphone')
}
const checkoutWith = (extra = {}) => ({ loading: false, fields: { checkout: { ...FIELDS, ...extra } } })
const USER = { id: 7, name: 'Ana', middle_name: '', lastname: 'Pérez', second_lastname: '', email: 'ana@example.com', level: 3, timezone: 'America/Bogota', photo: null }

const idleForm = () => ({ loading: false, changes: {}, result: { error: false, result: null } })

beforeEach(() => {
  runtime.spies = {
    update: vi.fn(),
    input: vi.fn(),
    swtich: vi.fn(),
    userType: vi.fn(),
    occupation: vi.fn(),
    image: vi.fn(),
    cleanFormState: vi.fn(),
    startZero: vi.fn(),
    setUserCustomer: vi.fn()
  }
  runtime.save = 'ok'
  runtime.failWith = 'Email already exists'
  runtime.release = null
  runtime.initialForm = idleForm
  runtime.validationFields = checkoutWith()
  runtime.showField = () => true
  runtime.isRequiredField = () => false
  runtime.configs = {}
})
afterEach(() => document.getElementById('app-modals')?.remove())

const mountProfile = (props = {}) => renderWithProviders(<UserProfileForm user={{ ...USER }} {...props} />)
const formOf = (container) => container.querySelector('form')
const inputByName = (container, name) => container.querySelector(`input[name="${name}"]`)
const frameOf = (container, name) => inputByName(container, name).closest('.odc-field')
const textInputNames = (container) => [...container.querySelectorAll('form input[name]')].map(node => node.getAttribute('name'))
const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 30)) })
const submit = async (container) => { fireEvent.submit(formOf(container)); await settle() }
const imageFile = (name = 'me.png', type = 'image/png') => new File(['x'], name, { type })
const bigFile = () => {
  const file = imageFile('big.png')
  Object.defineProperty(file, 'size', { value: 3 * 1024 * 1024 })
  return file
}
const choosePhoto = (container, file) => fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } })

// ---------------------------------------------------------------------------------------------------------------
// Part 1 · what the migration keeps
describe('Profile form · fields (kept)', () => {
  it('draws the configured fields in the project order, not the order of the map, then the password', () => {
    const { container } = mountProfile()
    expect(textInputNames(container)).toEqual(['name', 'middle_name', 'lastname', 'second_lastname', 'email', 'password'])
  })

  it('hides the field that showField hides', () => {
    runtime.showField = code => code !== 'middle_name'
    const { container } = mountProfile()
    expect(inputByName(container, 'middle_name')).toBeNull()
    expect(inputByName(container, 'name')).not.toBeNull()
  })

  it('shows what the user has and keeps the fields off the map out', () => {
    runtime.validationFields = { loading: false, fields: { checkout: { name: FIELDS.name, email: FIELDS.email } } }
    const { container } = mountProfile()
    expect(textInputNames(container)).toEqual(['name', 'email', 'password'])
    expect(inputByName(container, 'name')).toHaveValue('Ana')
    expect(inputByName(container, 'email')).toHaveValue('ana@example.com')
  })

  it('the email type is the one of the field; the password is hidden text', () => {
    const { container } = mountProfile()
    expect(inputByName(container, 'email')).toHaveAttribute('type', 'email')
    expect(inputByName(container, 'password')).toHaveAttribute('type', 'password')
  })

  it('tells the controller what is typed with the name of the field', async () => {
    const user = userEvent.setup()
    const { container } = mountProfile()
    await user.type(inputByName(container, 'lastname'), 'x')
    const [event] = runtime.spies.input.mock.calls.at(-1)
    expect(event.target.name).toBe('lastname')
    expect(event.target.value).toBe('Pérezx')
  })

  it('the email is lower-cased and loses the characters the API refuses', async () => {
    const user = userEvent.setup()
    const { container } = mountProfile({ user: { ...USER, email: '' } })
    await user.type(inputByName(container, 'email'), 'Ana B@Example.COM,')
    const [event] = runtime.spies.input.mock.calls.at(-1)
    expect(event).toEqual({ target: { name: 'email', value: 'anab@example.com' } })
    expect(inputByName(container, 'email')).toHaveValue('anab@example.com')
  })

  it('the password goes to the controller as typed', async () => {
    const user = userEvent.setup()
    const { container } = mountProfile()
    await user.type(inputByName(container, 'password'), 's3cretpass')
    const [event] = runtime.spies.input.mock.calls.at(-1)
    expect(event.target.name).toBe('password')
    expect(event.target.value).toBe('s3cretpass')
  })

  it('the password is not drawn at checkout', () => {
    const { container } = mountProfile({ isCheckout: true })
    expect(inputByName(container, 'password')).toBeNull()
  })

  it('the user type shows the level of the user, and is not drawn for a professional', () => {
    mountProfile({ user: { ...USER, level: 2 } })
    expect(screen.getByText('Business owner')).toBeInTheDocument()
  })

  it('a professional has no user type', () => {
    mountProfile({ user: { ...USER, level: 8 }, isProfessional: true })
    expect(screen.queryByText('Professional')).not.toBeInTheDocument()
  })

  it('the occupation is drawn for a professional with occupations, and writes occupation_id', async () => {
    const user = userEvent.setup()
    mountProfile({ user: { ...USER, level: 8, occupation_id: 2 }, isProfessional: true, occupations: [{ id: 1, name: 'Barber' }, { id: 2, name: 'Stylist' }] })
    expect(screen.getByTestId('occupation')).toHaveAttribute('data-id', '2')
    await user.click(screen.getByRole('button', { name: 'Barber' }))
    expect(runtime.spies.occupation).toHaveBeenCalledWith(1)
  })

  it('no occupation selector without occupations, or when it is not a professional', () => {
    mountProfile({ isProfessional: true, occupations: [] })
    expect(screen.queryByTestId('occupation')).not.toBeInTheDocument()
  })

  it('the driver zone switch only exists on the drivers page', () => {
    const { container } = mountProfile()
    expect(container.querySelector('[role="switch"], input[type="checkbox"]')).toBeNull()
  })
})

describe('Profile form · phone (kept)', () => {
  it('draws the phone only when the project enables it, with the props the legacy input gets', () => {
    runtime.validationFields = checkoutWith({ cellphone: field(6, 'cellphone', 'Cellphone', { enabled: false }) })
    const first = mountProfile()
    expect(screen.queryByTestId('phone')).not.toBeInTheDocument()
    first.unmount()
    runtime.validationFields = checkoutWith()
    mountProfile({ user: { ...USER, cellphone: '3001112233', country_phone_code: '57' } })
    const phone = screen.getByTestId('phone')
    expect(phone).toHaveValue('+57 3001112233')
    expect(phone.parentElement).toHaveAttribute('data-is-user', 'true')
    expect(phone.parentElement).toHaveAttribute('data-user-id', '7')
  })

  it('a valid number writes country_phone_code and cellphone together', async () => {
    const user = userEvent.setup()
    mountProfile()
    await user.type(screen.getByTestId('phone'), '+14155552671')
    const [changes, many] = runtime.spies.input.mock.calls.at(-1)
    expect(many).toBe(true)
    expect(changes.country_phone_code).toEqual({ name: 'country_phone_code', value: '1' })
    expect(changes.cellphone).toEqual({ name: 'cellphone', value: '4155552671' })
  })

  it('an invalid number writes both empty', async () => {
    const user = userEvent.setup()
    mountProfile()
    await user.type(screen.getByTestId('phone'), '+1415')
    const [changes] = runtime.spies.input.mock.calls.at(-1)
    expect(changes.country_phone_code.value).toBe('')
    expect(changes.cellphone.value).toBe('')
  })

  it('a number with a leading zero hands the raw number to setCellphoneStartZero', async () => {
    const user = userEvent.setup()
    mountProfile()
    await user.type(screen.getByTestId('phone'), '+390612345678')
    expect(runtime.spies.startZero).toHaveBeenLastCalledWith('0612345678')
  })

  it('a number without it clears the raw number', async () => {
    const user = userEvent.setup()
    mountProfile()
    await user.type(screen.getByTestId('phone'), '+1')
    expect(runtime.spies.startZero).toHaveBeenLastCalledWith(null)
  })
})

describe('Profile form · validation and the values sent (kept)', () => {
  const dirty = async (container) => {
    const user = userEvent.setup()
    await user.type(inputByName(container, 'lastname'), 'x')
  }

  it('sends the update once the form is valid, with no extra changes', async () => {
    const { container } = mountProfile()
    await dirty(container)
    await submit(container)
    expect(runtime.spies.update).toHaveBeenCalledTimes(1)
    expect(runtime.spies.update).toHaveBeenCalledWith(null, undefined)
  })

  it('a required field left empty does not send', async () => {
    runtime.isRequiredField = code => code === 'name'
    const { container } = mountProfile({ user: { ...USER, name: '' } })
    await dirty(container)
    await submit(container)
    expect(runtime.spies.update).not.toHaveBeenCalled()
  })

  it('an invalid email does not send', async () => {
    const user = userEvent.setup()
    const { container } = mountProfile()
    await user.type(inputByName(container, 'email'), '.')
    await submit(container)
    expect(runtime.spies.update).not.toHaveBeenCalled()
  })

  it('a password under 8 characters does not send', async () => {
    const user = userEvent.setup()
    const { container } = mountProfile()
    await user.type(inputByName(container, 'password'), 'short12')
    await submit(container)
    expect(runtime.spies.update).not.toHaveBeenCalled()
  })

  it('a password of 8 characters sends', async () => {
    const user = userEvent.setup()
    const { container } = mountProfile()
    await user.type(inputByName(container, 'password'), 'short123')
    await submit(container)
    expect(runtime.spies.update).toHaveBeenCalledTimes(1)
  })

  it('a required phone left empty does not send', async () => {
    runtime.validationFields = checkoutWith({ cellphone: field(6, 'cellphone', 'Cellphone', { required: true }) })
    const { container } = mountProfile()
    await dirty(container)
    await submit(container)
    expect(runtime.spies.update).not.toHaveBeenCalled()
  })

  it('an invalid phone does not send', async () => {
    const user = userEvent.setup()
    const { container } = mountProfile()
    await user.type(screen.getByTestId('phone'), '+1415')
    await submit(container)
    expect(runtime.spies.update).not.toHaveBeenCalled()
  })

  it('a phone that was saved and is now empty is sent as empty', async () => {
    const user = userEvent.setup()
    const { container } = mountProfile({ user: { ...USER, cellphone: '3001112233', country_phone_code: '57' } })
    await user.clear(screen.getByTestId('phone'))
    await submit(container)
    expect(runtime.spies.update).toHaveBeenCalledWith({ country_phone_code: '', cellphone: '' }, undefined)
  })

  it('customer mode hands the result to the customer context before it saves', async () => {
    const { container } = mountProfile({ isCustomerMode: true })
    await dirty(container)
    await submit(container)
    expect(runtime.spies.setUserCustomer).toHaveBeenCalledWith(null, true)
    expect(runtime.spies.update).toHaveBeenCalledTimes(1)
  })

  it('without changes there is nothing to send', async () => {
    const { container } = mountProfile()
    await submit(container)
    expect(runtime.spies.update).not.toHaveBeenCalled()
  })
})

describe('Profile form · onDirtyChange (kept, auditor #16)', () => {
  const profile = (props = {}) => <UserProfileForm user={{ ...USER }} {...props} />

  it('tells true when the form has changes', () => {
    runtime.initialForm = () => ({ ...idleForm(), changes: { name: 'Ana' } })
    const onDirtyChange = vi.fn()
    renderWithProviders(profile({ onDirtyChange }))
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
  })

  it('tells false when there are none, and false again after a save or a reset cleared them', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    const { container } = renderWithProviders(profile({ onDirtyChange }))
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
    await user.type(inputByName(container, 'lastname'), 'x')
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    await submit(container)
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  it('does not repeat itself while the answer is the same', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    const { container } = renderWithProviders(profile({ onDirtyChange }))
    await user.type(inputByName(container, 'lastname'), 'xyz')
    // false at mount, true at the first change, and nothing for the next two letters
    expect(onDirtyChange.mock.calls.map(call => call[0])).toEqual([false, true])
  })

  it('works through the details UI alone (the store editor and the wizard use it without the prop)', () => {
    const props = {
      formState: { ...idleForm(), changes: { name: 'Ana' } },
      userData: { ...USER },
      validationFields: checkoutWith(),
      showField: () => true,
      isRequiredField: () => false,
      cleanFormState: () => {},
      handleChangeInput: () => {},
      handleButtonUpdateClick: () => {}
    }
    expect(() => renderWithProviders(<UserFormDetailsUI {...props} />)).not.toThrow()
  })
})

describe('Profile form · photo files (kept)', () => {
  it('only images are accepted', async () => {
    const { container } = mountProfile()
    choosePhoto(container, imageFile('notes.pdf', 'application/pdf'))
    expect(await screen.findByText('Only images can be accepted')).toBeInTheDocument()
    expect(screen.queryByTestId('cropper')).not.toBeInTheDocument()
  })

  it('more than 2 megabytes is refused', async () => {
    const { container } = mountProfile()
    choosePhoto(container, bigFile())
    expect(await screen.findByText('The maximum image size is 2 megabytes')).toBeInTheDocument()
    expect(screen.queryByTestId('cropper')).not.toBeInTheDocument()
  })

  it('a dropped file goes through the same checks', async () => {
    mountProfile()
    fireEvent.drop(screen.getByTestId('drop-zone'), { dataTransfer: { files: [imageFile('notes.pdf', 'application/pdf')] } })
    expect(await screen.findByText('Only images can be accepted')).toBeInTheDocument()
  })

  it('a good image opens the crop dialog, and the crop is written as the photo', async () => {
    const user = userEvent.setup()
    const { container } = mountProfile()
    choosePhoto(container, imageFile())
    const cropper = await screen.findByTestId('cropper')
    expect(screen.getByText('Image crop')).toBeInTheDocument()
    expect(cropper).toHaveAttribute('data-photo', expect.stringMatching(/^data:image\/png;base64,/))
    await user.click(screen.getByRole('button', { name: 'Crop' }))
    expect(runtime.spies.swtich).toHaveBeenCalledWith('photo', 'data:image/png;base64,CROPPED')
  })
})

// ---------------------------------------------------------------------------------------------------------------
// Part 2 · what changes
const saveBar = () => screen.queryByRole('group', { name: 'Save changes' })
const saveButton = () => screen.getByRole('button', { name: 'Save changes' })
const trigger = (name) => screen.getByRole('button', { name })
const labelled = (name) => screen.getByLabelText(name)

describe('Profile form · labels and groups (decision 1 A, M-UF1)', () => {
  it('has a Details and an Account group, each with its heading', () => {
    const { container } = mountProfile()
    const form = formOf(container)
    expect(within(form).getByRole('heading', { level: 3, name: 'Details' })).toBeInTheDocument()
    expect(within(form).getByRole('heading', { level: 3, name: 'Account' })).toBeInTheDocument()
  })

  it('every configured field has a visible label, in the configured order', () => {
    const { container } = mountProfile()
    ;['Name', 'Middle name', 'Last name', 'Second last name', 'Email'].forEach(name => expect(labelled(name)).toBeInTheDocument())
    expect(labelled('Name')).toBe(inputByName(container, 'name'))
    expect(labelled('Email')).toBe(inputByName(container, 'email'))
    expect(textInputNames(container)).toEqual(['name', 'middle_name', 'lastname', 'second_lastname', 'email', 'password'])
  })

  it('the fields are controlled: they show the change, else the user', async () => {
    const user = userEvent.setup()
    mountProfile()
    expect(labelled('Name')).toHaveValue('Ana')
    await user.type(labelled('Name'), 'bel')
    expect(labelled('Name')).toHaveValue('Anabel')
  })

  it('Profile marks nothing as required: the controller has no validation fields there', () => {
    const { container } = mountProfile()
    expect(container.querySelectorAll('[aria-required="true"]')).toHaveLength(0)
    expect(container.querySelector('.odc-field-required')).toBeNull()
  })

  it('a field is marked only when isRequiredField says so', () => {
    runtime.isRequiredField = code => code === 'lastname'
    const { container } = mountProfile()
    expect(container.querySelectorAll('[aria-required="true"]')).toHaveLength(1)
    expect(inputByName(container, 'lastname')).toHaveAttribute('aria-required', 'true')
    expect(screen.getByText('Required')).toBeInTheDocument()
  })

  it('the account group has the user type, the password with its hint and the timezone', () => {
    const { container } = mountProfile({ user: { ...USER, level: 2 } })
    expect(trigger(/^User type Business owner$/)).toBeInTheDocument()
    expect(labelled('Password')).toBe(inputByName(container, 'password'))
    expect(labelled('Password')).toHaveAccessibleDescription('Leave empty to keep the current password.')
    expect(trigger(/^Timezone America\/Bogota$/)).toBeInTheDocument()
  })

  it('the password has a real show/hide button', async () => {
    const user = userEvent.setup()
    const { container } = mountProfile()
    expect(inputByName(container, 'password')).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(inputByName(container, 'password')).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument()
  })

  it('the user type is not drawn for a professional; the occupation and the birthday close the Details group', () => {
    const { container } = mountProfile({ user: { ...USER, level: 8, birthdate: '1990-05-04', occupation_id: 1 }, isProfessional: true, occupations: [{ id: 1, name: 'Barber' }] })
    expect(screen.queryByRole('button', { name: /^User type/ })).not.toBeInTheDocument()
    const occupation = screen.getByTestId('occupation')
    const birthday = screen.getByRole('combobox', { name: /Date of birth/ })
    const account = screen.getByRole('heading', { name: 'Account' })
    const email = inputByName(container, 'email')
    expect(email.compareDocumentPosition(occupation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(occupation.compareDocumentPosition(birthday) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(birthday.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('the user type is disabled when the type is decided by the list (defaultUserTypesSelected)', async () => {
    const user = userEvent.setup()
    mountProfile({ user: { ...USER, level: 2 }, defaultUserTypesSelected: [2] })
    const select = trigger(/^User type Business owner$/)
    expect(select).toHaveAttribute('aria-disabled', 'true')
    await user.click(select)
    expect(screen.queryByRole('option', { name: 'Administrator' })).not.toBeInTheDocument()
  })

  it('the user type of a protected account is disabled and says why', async () => {
    const user = userEvent.setup()
    mountProfile({ user: { ...USER, level: 0, protected: true } })
    const select = trigger(/^User type Administrator/)
    expect(select).toHaveAttribute('aria-disabled', 'true')
    expect(select).toHaveAttribute('data-disabled')
    expect(screen.getByText("You can't change the user type of a protected account.")).toBeInTheDocument()
    select.focus()
    await user.keyboard('{Enter}')
    await user.keyboard('{ArrowDown}')
    expect(screen.queryByRole('option', { name: 'Business owner' })).not.toBeInTheDocument()
  })

  it('the user type of an account that is not protected stays open to change', () => {
    mountProfile({ user: { ...USER, level: 0, protected: false } })
    expect(trigger(/^User type Administrator$/)).toHaveAttribute('aria-disabled', 'false')
    expect(screen.queryByText("You can't change the user type of a protected account.")).not.toBeInTheDocument()
  })

  it('choosing a user type tells the controller the level', async () => {
    const user = userEvent.setup()
    mountProfile({ user: { ...USER, level: 3 } })
    await user.click(trigger(/^User type User$/))
    await user.click(screen.getByRole('option', { name: 'Administrator' }))
    expect(runtime.spies.userType).toHaveBeenCalledWith(0)
    expect(trigger(/^User type Administrator$/)).toBeInTheDocument()
  })

  it('choosing a timezone (searching it) tells the controller the zone', async () => {
    const user = userEvent.setup()
    mountProfile()
    await user.click(trigger(/^Timezone /))
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'Madrid')
    expect(screen.queryByRole('option', { name: 'America/Bogota' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: 'Europe/Madrid' }))
    expect(runtime.spies.swtich).toHaveBeenCalledWith('timezone', 'Europe/Madrid')
  })

  it('the driver zone switch (drivers page) has a name and writes driver_zone_restriction', async () => {
    const user = userEvent.setup()
    mountProfile({ isDriversPage: true, user: { ...USER, level: 4, driver_zone_restriction: false } })
    const zone = screen.getByRole('switch', { name: 'Driver zone restriction' })
    expect(zone).toHaveAttribute('aria-checked', 'false')
    await user.click(zone)
    expect(runtime.spies.swtich).toHaveBeenCalledWith('driver_zone_restriction', true)
    expect(zone).toHaveAttribute('aria-checked', 'true')
  })

  it('while the validation fields load it draws skeletons in place of the fields and says it is busy', () => {
    runtime.validationFields = { loading: true, fields: {} }
    const { container } = mountProfile()
    expect(formOf(container)).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    expect(inputByName(container, 'name')).toBeNull()
  })

  it('when the validation fields failed it still draws the account group and does not throw', () => {
    runtime.validationFields = { loading: false, fields: {} }
    const { container } = mountProfile()
    expect(formOf(container)).not.toHaveAttribute('aria-busy')
    expect(inputByName(container, 'name')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument()
  })

  it('the professional birthday writes the same YYYY-MM-DD string, in the project format', async () => {
    runtime.configs = { dates_general_format: { value: 'DD/MM/YYYY HH:mm' } }
    const user = userEvent.setup()
    mountProfile({ user: { ...USER, level: 8, birthdate: '1990-05-04' }, isProfessional: true })
    const picker = screen.getByRole('combobox', { name: /Date of birth/ })
    expect(picker).toHaveTextContent('04/05/1990')
    await user.click(picker)
    const typed = await screen.findByRole('textbox', { name: 'Date of birth' })
    await user.clear(typed)
    await user.type(typed, '15/06/1991')
    expect(runtime.spies.swtich).toHaveBeenLastCalledWith('birthdate', '1991-06-15')
  })

  it('the birthday does not take a day before 1922', async () => {
    const user = userEvent.setup()
    mountProfile({ user: { ...USER, level: 8, birthdate: '1990-05-04' }, isProfessional: true })
    await user.click(screen.getByRole('combobox', { name: /Date of birth/ }))
    const typed = await screen.findByRole('textbox', { name: 'Date of birth' })
    await user.clear(typed)
    await user.type(typed, '1921-12-31')
    expect(runtime.spies.swtich).not.toHaveBeenCalledWith('birthdate', '1921-12-31')
    expect(await screen.findByText('That date is not available.')).toBeInTheDocument()
  })
})

describe('Profile form · errors under the fields (decision 2 A, M-UF4)', () => {
  const dirty = (user, container) => user.type(inputByName(container, 'lastname'), 'x')

  it('a required field left empty says so under the field, takes the focus and does not save', async () => {
    runtime.isRequiredField = code => code === 'name'
    const user = userEvent.setup()
    const { container } = mountProfile({ user: { ...USER, name: '' } })
    await dirty(user, container)
    await user.click(saveButton())
    expect(within(frameOf(container, 'name')).getByRole('alert')).toHaveTextContent('Name is required')
    expect(inputByName(container, 'name')).toHaveAttribute('aria-invalid', 'true')
    expect(inputByName(container, 'name')).toHaveFocus()
    expect(runtime.spies.update).not.toHaveBeenCalled()
    expect(within(saveBar()).getByRole('alert')).toHaveTextContent('Fix 1 field to save.')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('two errors: each under its field, the focus on the first, the bar counts them', async () => {
    runtime.isRequiredField = code => code === 'name'
    const user = userEvent.setup()
    const { container } = mountProfile({ user: { ...USER, name: '' } })
    await user.type(inputByName(container, 'email'), '.')
    await user.click(saveButton())
    expect(within(frameOf(container, 'email')).getByRole('alert')).toHaveTextContent('Invalid email address')
    expect(inputByName(container, 'name')).toHaveFocus()
    expect(within(saveBar()).getByRole('alert')).toHaveTextContent('Fix 2 fields to save.')
  })

  it('an error goes away when its field is corrected', async () => {
    runtime.isRequiredField = code => code === 'name'
    const user = userEvent.setup()
    const { container } = mountProfile({ user: { ...USER, name: '' } })
    await dirty(user, container)
    await user.click(saveButton())
    await user.type(inputByName(container, 'name'), 'Ana')
    expect(inputByName(container, 'name')).not.toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByText('Name is required')).not.toBeInTheDocument()
    expect(within(saveBar()).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('a password under 8 characters says so under the password', async () => {
    const user = userEvent.setup()
    const { container } = mountProfile()
    await user.type(inputByName(container, 'password'), 'short12')
    await user.click(saveButton())
    expect(within(frameOf(container, 'password')).getByRole('alert')).toHaveTextContent('The Password must be at least 8 characters.')
    expect(inputByName(container, 'password')).toHaveFocus()
  })

  it('a required phone left empty says so under the phone and takes the focus', async () => {
    runtime.validationFields = checkoutWith({ cellphone: field(6, 'cellphone', 'Cellphone', { required: true }) })
    const user = userEvent.setup()
    const { container } = mountProfile()
    await dirty(user, container)
    await user.click(saveButton())
    expect(labelled(/^Phone number/)).toBe(screen.getByTestId('phone'))
    expect(screen.getByText('The field Phone Number is required.')).toBeInTheDocument()
    expect(screen.getByTestId('phone')).toHaveFocus()
    expect(runtime.spies.update).not.toHaveBeenCalled()
  })

  it('an invalid phone is said once, takes the focus and does not save', async () => {
    const user = userEvent.setup()
    mountProfile()
    await user.type(screen.getByTestId('phone'), '+1415')
    await user.click(saveButton())
    expect(screen.getAllByText('The Phone Number field is invalid')).toHaveLength(1)
    expect(screen.getByTestId('phone')).toHaveFocus()
    expect(within(saveBar()).getByRole('alert')).toHaveTextContent('Fix 1 field to save.')
    expect(runtime.spies.update).not.toHaveBeenCalled()
  })

  it('Enter in a field saves, with the same validation as the button', async () => {
    const user = userEvent.setup()
    const { container } = mountProfile()
    await user.type(inputByName(container, 'lastname'), 'x{Enter}')
    await settle()
    expect(runtime.spies.update).toHaveBeenCalledTimes(1)
  })
})

describe('Profile form · the save bar (decision 1 A, M-UF5)', () => {
  it('has no «Update» button and no bar until something changes; the bar sits at the foot of the form', async () => {
    const user = userEvent.setup()
    const { container } = mountProfile()
    expect(screen.queryByRole('button', { name: 'Update' })).not.toBeInTheDocument()
    expect(saveBar()).not.toBeInTheDocument()
    await user.type(inputByName(container, 'lastname'), 'x')
    expect(formOf(container)).toContainElement(saveBar())
    expect(formOf(container).lastElementChild).toBe(saveBar())
    expect(saveButton()).toHaveAttribute('type', 'submit')
  })

  it('counts the changed fields and names them, the phone once', async () => {
    const user = userEvent.setup()
    const { container } = mountProfile()
    await user.type(inputByName(container, 'lastname'), 'x')
    expect(within(saveBar()).getByText('1 unsaved change')).toBeInTheDocument()
    await user.type(inputByName(container, 'name'), 'y')
    await user.type(screen.getByTestId('phone'), '+14155552671')
    const group = within(saveBar())
    expect(group.getByText('3 unsaved changes')).toBeInTheDocument()
    expect(saveBar()).toHaveTextContent('Last name, Name, Phone number')
    expect(runtime.spies.input).toHaveBeenCalled()
  })

  it('lists three names and «+n» for the rest', async () => {
    const user = userEvent.setup()
    const { container } = mountProfile()
    for (const name of ['name', 'middle_name', 'lastname', 'second_lastname', 'email']) await user.type(inputByName(container, name), '1')
    expect(saveBar()).toHaveTextContent('5 unsaved changes')
    expect(saveBar()).toHaveTextContent('Name, Middle name, Last name +2')
  })

  it('Save sends the update once; while it saves the bar says so and does not send twice', async () => {
    runtime.save = 'hold'
    const user = userEvent.setup()
    const { container } = mountProfile()
    await user.type(inputByName(container, 'lastname'), 'x')
    await user.click(saveButton())
    expect(runtime.spies.update).toHaveBeenCalledTimes(1)
    expect(runtime.spies.update).toHaveBeenCalledWith(null, undefined)
    expect(saveBar()).toHaveAttribute('data-saving')
    expect(saveButton()).toHaveAttribute('aria-busy', 'true')
    await user.click(saveButton())
    expect(runtime.spies.update).toHaveBeenCalledTimes(1)
    await act(async () => { runtime.release() })
  })

  it('after a good save it says Saved, for four seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const { container } = mountProfile()
      await user.type(inputByName(container, 'lastname'), 'x')
      await user.click(saveButton())
      expect(await within(saveBar()).findByRole('status')).toHaveTextContent('Saved')
      expect(within(saveBar()).queryByRole('button')).not.toBeInTheDocument()
      act(() => { vi.advanceTimersByTime(3900) })
      expect(saveBar()).toBeInTheDocument()
      act(() => { vi.advanceTimersByTime(300) })
      expect(saveBar()).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('Discard empties the changes through the controller and every kind of control goes back', async () => {
    const user = userEvent.setup()
    const { container } = mountProfile({ isDriversPage: true, user: { ...USER, level: 4, driver_zone_restriction: false, cellphone: '3001112233', country_phone_code: '57' } })
    await user.type(labelled('Name'), 'bel')
    await user.type(inputByName(container, 'password'), 'abc')
    await user.click(screen.getByRole('switch', { name: 'Driver zone restriction' }))
    await user.click(trigger(/^User type /))
    await user.click(screen.getByRole('option', { name: 'Administrator' }))
    await user.click(trigger(/^Timezone /))
    await user.click(screen.getByRole('option', { name: 'Europe/Madrid' }))
    await user.clear(screen.getByTestId('phone'))
    await user.type(screen.getByTestId('phone'), '+14155552671')
    expect(within(saveBar()).getByText(/unsaved changes/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Discard' }))

    expect(runtime.spies.cleanFormState).toHaveBeenLastCalledWith({ changes: {}, result: { error: false } })
    expect(labelled('Name')).toHaveValue('Ana')
    expect(inputByName(container, 'password')).toHaveValue('')
    expect(screen.getByRole('switch', { name: 'Driver zone restriction' })).toHaveAttribute('aria-checked', 'false')
    expect(trigger(/^User type /)).toHaveTextContent('Driver')
    expect(trigger(/^Timezone /)).toHaveTextContent('America/Bogota')
    expect(screen.getByTestId('phone')).toHaveValue('+57 3001112233')
    expect(saveBar()).not.toBeInTheDocument()
  })

  it('Discard also puts back the date and the occupation, clears the errors and returns the focus to the form', async () => {
    runtime.isRequiredField = code => code === 'name'
    const user = userEvent.setup()
    const { container } = mountProfile({
      user: { ...USER, name: '', level: 8, birthdate: '1990-05-04', occupation_id: 1 },
      isProfessional: true,
      occupations: [{ id: 1, name: 'Barber' }, { id: 2, name: 'Stylist' }]
    })
    await user.click(screen.getByRole('button', { name: 'Stylist' }))
    await user.click(screen.getByRole('combobox', { name: /Date of birth/ }))
    const typed = await screen.findByRole('textbox', { name: 'Date of birth' })
    await user.clear(typed)
    await user.type(typed, '1991-06-15')
    await user.keyboard('{Escape}')
    await user.click(saveButton())
    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(screen.getByTestId('occupation')).toHaveAttribute('data-id', '2')

    await user.click(screen.getByRole('button', { name: 'Discard' }))

    expect(screen.getByTestId('occupation')).toHaveAttribute('data-id', '1')
    expect(screen.getByRole('combobox', { name: /Date of birth/ })).toHaveTextContent('1990-05-04')
    expect(screen.queryByText('Name is required')).not.toBeInTheDocument()
    expect(formOf(container)).toHaveFocus()
  })

  it('onDirtyChange stays opt-in: without the prop nothing is called and the bar still follows the changes', async () => {
    const user = userEvent.setup()
    const { container } = mountProfile()
    expect(saveBar()).not.toBeInTheDocument()
    await user.type(inputByName(container, 'lastname'), 'x')
    expect(saveButton()).toBeEnabled()
  })

  it('the details UI alone (the barrel export) has the same bar as its save control', async () => {
    const user = userEvent.setup()
    const handleButtonUpdateClick = vi.fn()
    renderWithProviders(
      <UserFormDetailsUI
        formState={{ ...idleForm(), changes: { name: 'Anabel' } }}
        userData={{ ...USER }}
        validationFields={checkoutWith()}
        showField={() => true}
        isRequiredField={() => false}
        cleanFormState={() => {}}
        handleChangeInput={() => {}}
        handleButtonUpdateClick={handleButtonUpdateClick}
      />
    )
    expect(within(saveBar()).getByText('1 unsaved change')).toBeInTheDocument()
    await user.click(saveButton())
    expect(handleButtonUpdateClick).toHaveBeenCalledTimes(1)
  })
})

// The error of the API reaches the bar as text, never empty (M-13, auditor #9). The old «Profile» Alert is gone.
describe('Profile form · the API error in the save bar (M-13)', () => {
  const fallback = 'We couldn\'t save the changes. Try again.'
  class User { constructor () { this.id = 7; this.email = 'ana@example.com' } }
  const failedWith = (result) => renderWithProviders(
    <UserFormDetailsUI
      formState={{ loading: false, changes: {}, result: { error: true, result } }}
      userData={{ ...USER }}
      validationFields={checkoutWith()}
      showField={() => true}
      isRequiredField={() => false}
      cleanFormState={() => {}}
      handleChangeInput={() => {}}
      handleButtonUpdateClick={() => {}}
    />
  )
  const barAlert = () => within(saveBar()).getByRole('alert')

  it('a string error stays the string', () => {
    failedWith('Email already exists')
    expect(barAlert()).toHaveTextContent('Email already exists')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('a list of strings is joined', () => {
    failedWith(['Email already exists', 'Phone is invalid'])
    expect(barAlert()).toHaveTextContent('Email already exists')
    expect(barAlert()).toHaveTextContent('Phone is invalid')
  })

  it.each([
    ['an object', { code: 500 }],
    ['a User instance (the SDK cast)', new User()],
    ['an Error', new Error('boom')],
    ['an empty list', []],
    ['nothing', undefined]
  ])('%s says the generic message, never an empty bar', (_label, value) => {
    failedWith(value)
    expect(barAlert()).toHaveTextContent(fallback)
    expect(saveBar().textContent).not.toMatch(/\[object|undefined|null/)
  })

  it('a save that fails in the app puts the error in the bar and keeps the changes', async () => {
    runtime.save = 'fail'
    const user = userEvent.setup()
    const { container } = mountProfile()
    await user.type(inputByName(container, 'lastname'), 'x')
    await user.click(saveButton())
    expect(await within(saveBar()).findByRole('alert')).toHaveTextContent('Email already exists')
    expect(within(saveBar()).getByText('1 unsaved change')).toBeInTheDocument()
    expect(inputByName(container, 'lastname')).toHaveValue('Pérezx')
  })
})

describe('Profile form · the photo (decision 3 A, M-UF3, M-UF16, M-UF17)', () => {
  const avatar = (container) => container.querySelector('.odc-avatar')

  it('shows a 56px avatar with the initials, named, and a real Change photo button with its hint', () => {
    const { container } = mountProfile()
    expect(avatar(container)).toHaveTextContent('AP')
    expect(screen.getByRole('img', { name: 'Profile photo' })).toBe(avatar(container))
    expect(screen.getByRole('button', { name: 'Change photo' })).toBeInTheDocument()
    expect(screen.getByText('JPG or PNG, up to 2 MB. Saved when you choose it.')).toBeInTheDocument()
  })

  it('shows the saved photo', () => {
    const { container } = mountProfile({ user: { ...USER, photo: 'https://cdn.example.com/ana.png' } })
    expect(avatar(container).querySelector('img')).toHaveAttribute('src', 'https://cdn.example.com/ana.png')
  })

  it('picking a file opens the crop dialog and uploads nothing', async () => {
    const { container } = mountProfile()
    choosePhoto(container, imageFile())
    expect(await screen.findByRole('dialog', { name: 'Image crop' })).toBeInTheDocument()
    expect(runtime.spies.image).not.toHaveBeenCalled()
    expect(runtime.spies.update).not.toHaveBeenCalled()
    expect(runtime.spies.swtich).not.toHaveBeenCalled()
  })

  it('accepting the crop uploads once, the cropped image', async () => {
    const user = userEvent.setup()
    const { container } = mountProfile()
    choosePhoto(container, imageFile())
    await screen.findByRole('dialog', { name: 'Image crop' })
    await user.click(screen.getByRole('button', { name: 'Crop' }))
    await waitFor(() => expect(runtime.spies.update).toHaveBeenCalledTimes(1))
    expect(runtime.spies.update).toHaveBeenCalledWith(null, true)
    expect(runtime.spies.swtich).toHaveBeenCalledWith('photo', 'data:image/png;base64,CROPPED')
    expect(runtime.spies.image).not.toHaveBeenCalled()
    await settle()
    expect(runtime.spies.update).toHaveBeenCalledTimes(1)
    expect(avatar(container).querySelector('img')).toHaveAttribute('src', 'data:image/png;base64,CROPPED')
  })

  it('cancelling the crop writes nothing', async () => {
    const user = userEvent.setup()
    const { container } = mountProfile()
    choosePhoto(container, imageFile())
    const dialog = await screen.findByRole('dialog', { name: 'Image crop' })
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Image crop' })).not.toBeInTheDocument())
    expect(runtime.spies.update).not.toHaveBeenCalled()
    expect(runtime.spies.swtich).not.toHaveBeenCalled()
    expect(runtime.spies.image).not.toHaveBeenCalled()
  })

  it('the Change photo button opens the file chooser', async () => {
    const user = userEvent.setup()
    const { container } = mountProfile()
    const input = container.querySelector('input[type="file"]')
    const click = vi.spyOn(input, 'click')
    await user.click(screen.getByRole('button', { name: 'Change photo' }))
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('a file that is not an image says so inline, with no alert dialog, and does not crop', async () => {
    const { container } = mountProfile()
    choosePhoto(container, imageFile('notes.pdf', 'application/pdf'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Only images can be accepted')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('more than 2 megabytes says so inline and does not crop', async () => {
    const { container } = mountProfile()
    choosePhoto(container, bigFile())
    expect(await screen.findByRole('alert')).toHaveTextContent('The maximum image size is 2 megabytes')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('a good file after a bad one clears the message', async () => {
    const { container } = mountProfile()
    choosePhoto(container, imageFile('notes.pdf', 'application/pdf'))
    await screen.findByRole('alert')
    choosePhoto(container, imageFile())
    await screen.findByRole('dialog', { name: 'Image crop' })
    expect(screen.queryByText('Only images can be accepted')).not.toBeInTheDocument()
  })

  it('a dropped image goes through the same crop as a picked one', async () => {
    mountProfile()
    fireEvent.drop(screen.getByTestId('drop-zone'), { dataTransfer: { files: [imageFile()] } })
    expect(await screen.findByRole('dialog', { name: 'Image crop' })).toBeInTheDocument()
    expect(runtime.spies.image).not.toHaveBeenCalled()
  })

  it('while the photo uploads the avatar is a round skeleton', async () => {
    runtime.save = 'hold'
    const user = userEvent.setup()
    const { container } = mountProfile()
    choosePhoto(container, imageFile())
    await screen.findByRole('dialog', { name: 'Image crop' })
    await user.click(screen.getByRole('button', { name: 'Crop' }))
    await waitFor(() => expect(container.querySelector('.odc-skeleton[data-shape="round"]')).not.toBeNull())
    await act(async () => { runtime.release() })
    await waitFor(() => expect(container.querySelector('.odc-skeleton')).toBeNull())
  })

  it('an upload that fails says so under the avatar, translated and never empty, and not twice in the bar', async () => {
    runtime.save = 'fail'
    runtime.failWith = { code: 500 }
    const user = userEvent.setup()
    const { container } = mountProfile()
    choosePhoto(container, imageFile())
    await screen.findByRole('dialog', { name: 'Image crop' })
    await user.click(screen.getByRole('button', { name: 'Crop' }))
    const message = await screen.findByText('We couldn\'t save the changes. Try again.')
    expect(message.closest('[role="alert"]')).not.toBeNull()
    expect(saveBar()).toBeInTheDocument()
    expect(within(saveBar()).queryByRole('alert')).not.toBeInTheDocument()
    expect(container.querySelector('.odc-uf-photo')).toContainElement(message)
  })
})

// redesign UF-R1 (review r1 F1): at 390 the sticky bar (~96px) covered the field being edited and its error.
describe('Profile form · the sticky bar does not cover the focused field (R1 F1)', () => {
  const original = Element.prototype.scrollIntoView
  let scrolled
  beforeEach(() => {
    scrolled = []
    Element.prototype.scrollIntoView = function scrollIntoView (options) { scrolled.push({ node: this, options }) }
  })
  afterEach(() => {
    if (original) Element.prototype.scrollIntoView = original
    else delete Element.prototype.scrollIntoView
  })

  it('every control of the form keeps a scroll margin at its foot that clears the bar', () => {
    const css = readFileSync(path.join(__dirname, '..', 'user-form-details.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).toMatch(/\.odc-uf-form[^{]*\{[^}]*scroll-margin-block-end:\s*calc\(var\(--od-space-8\) \* 2/)
  })

  it('after a failed save the first invalid control takes the focus and is brought into view', async () => {
    runtime.isRequiredField = code => code === 'name'
    const user = userEvent.setup()
    const { container } = mountProfile({ user: { ...USER, name: '' } })
    await user.type(inputByName(container, 'lastname'), 'x')
    scrolled.length = 0
    await user.click(saveButton())
    expect(inputByName(container, 'name')).toHaveFocus()
    expect(scrolled).toEqual([{ node: inputByName(container, 'name'), options: { block: 'nearest' } }])
  })

  it('when the bar appears the focused control is brought into view once, and not on later keystrokes', async () => {
    const user = userEvent.setup()
    const { container } = mountProfile()
    await user.click(inputByName(container, 'email'))
    expect(scrolled).toEqual([])
    await user.keyboard('a')
    expect(saveBar()).toBeInTheDocument()
    expect(scrolled).toEqual([{ node: inputByName(container, 'email'), options: { block: 'nearest' } }])
    await user.keyboard('bc')
    expect(scrolled).toHaveLength(1)
  })

  it('does not scroll when the focus is not inside the form as the bar appears', async () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    const { container } = mountProfile()
    outside.focus()
    fireEvent.change(inputByName(container, 'lastname'), { target: { value: 'z' } })
    await settle()
    expect(saveBar()).toBeInTheDocument()
    expect(scrolled).toEqual([])
    outside.remove()
  })
})

// redesign D-11 (owner, 2026-10-19): saving a change of user type asks first (C8). The select stays where it is; the
// question comes with the save. Cancel writes nothing and keeps the change in the form.
describe('Profile form · saving a change of user type asks first (D-11)', () => {
  // Owner decision 24 B: Administrator asks ConfirmAdmin instead (below); the C8 question stays for every other type
  const chooseAdministrator = async (user) => {
    await user.click(trigger(/^User type User$/))
    await user.click(screen.getByRole('option', { name: 'Business owner' }))
  }
  const saveBar = () => screen.getByRole('button', { name: 'Save changes' })

  it('asks with the name and the type, and the focus is on Cancel', async () => {
    const user = userEvent.setup()
    mountProfile()
    await chooseAdministrator(user)
    await user.click(saveBar())
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Change Ana Pérez to Business owner?')).toBeInTheDocument()
    expect(within(dialog).getByText('What they can see and do changes as soon as you save.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Change user type' })).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(runtime.spies.update).not.toHaveBeenCalled()
  })

  it('Cancel saves nothing and the form keeps the change', async () => {
    const user = userEvent.setup()
    mountProfile()
    await chooseAdministrator(user)
    await user.click(saveBar())
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    await settle()
    expect(runtime.spies.update).not.toHaveBeenCalled()
    expect(trigger(/^User type Business owner$/)).toBeInTheDocument()
    expect(saveBar()).toBeInTheDocument()
  })

  it('Confirm saves once', async () => {
    const user = userEvent.setup()
    mountProfile()
    await chooseAdministrator(user)
    await user.click(saveBar())
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Change user type' }))
    await waitFor(() => expect(runtime.spies.update).toHaveBeenCalledTimes(1))
    expect(runtime.spies.update).toHaveBeenCalledWith(null, undefined)
    await settle()
    expect(runtime.spies.update).toHaveBeenCalledTimes(1)
  })

  it('saving after a Cancel asks again', async () => {
    const user = userEvent.setup()
    mountProfile()
    await chooseAdministrator(user)
    await user.click(saveBar())
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    await user.click(saveBar())
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(runtime.spies.update).not.toHaveBeenCalled()
  })

  it('a save without a change of user type does not ask', async () => {
    const user = userEvent.setup()
    const { container } = mountProfile()
    await user.type(inputByName(container, 'lastname'), 'x')
    await submit(container)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(runtime.spies.update).toHaveBeenCalledTimes(1)
  })

  it('a level put back to the saved one does not ask', async () => {
    const user = userEvent.setup()
    const { container } = mountProfile()
    await chooseAdministrator(user)
    await user.click(trigger(/^User type Business owner$/))
    await user.click(screen.getByRole('option', { name: 'User' }))
    await submit(container)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(runtime.spies.update).toHaveBeenCalledTimes(1)
  })

  it('a field that fails validation does not ask', async () => {
    const user = userEvent.setup()
    const { container } = mountProfile()
    await chooseAdministrator(user)
    await user.type(inputByName(container, 'email'), '.')
    await submit(container)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(runtime.spies.update).not.toHaveBeenCalled()
  })

  it('the photo upload never asks, even with a level change waiting', async () => {
    const user = userEvent.setup()
    const { container } = mountProfile()
    await chooseAdministrator(user)
    choosePhoto(container, imageFile())
    await screen.findByRole('dialog', { name: 'Image crop' })
    await user.click(screen.getByRole('button', { name: 'Crop' }))
    await waitFor(() => expect(runtime.spies.update).toHaveBeenCalledTimes(1))
    expect(runtime.spies.update).toHaveBeenCalledWith(null, true)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})

// Owner decision 24 B (2026-10-21, ): giving level 0 asks the password or a code (ConfirmAdmin), as deactivating an admin does.
// It replaces the C8 question for that type (with the same words), so two confirmations never stack (D-1).
describe('Profile form · making someone an administrator asks ConfirmAdmin (owner decision 24)', () => {
  const chooseAdministrator = async (user) => {
    await user.click(trigger(/^User type User$/))
    await user.click(screen.getByRole('option', { name: 'Administrator' }))
  }
  const saveBar = () => screen.getByRole('button', { name: 'Save changes' })

  it('asks ConfirmAdmin with the name and the type, and no C8 question', async () => {
    const user = userEvent.setup()
    mountProfile()
    await chooseAdministrator(user)
    await user.click(saveBar())
    const dialog = await screen.findByRole('dialog', { name: 'Change Ana Pérez to Administrator?' })
    expect(within(dialog).getByText('What they can see and do changes as soon as you save.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Change user type' })).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(runtime.spies.update).not.toHaveBeenCalled()
  })

  it('a confirmed password saves once', async () => {
    const user = userEvent.setup()
    mountProfile()
    await chooseAdministrator(user)
    await user.click(saveBar())
    const dialog = await screen.findByRole('dialog', { name: 'Change Ana Pérez to Administrator?' })
    await user.click(within(dialog).getByRole('button', { name: 'Change user type' }))
    await waitFor(() => expect(runtime.spies.update).toHaveBeenCalledTimes(1))
    expect(runtime.spies.update).toHaveBeenCalledWith(null, undefined)
    await settle()
    expect(runtime.spies.update).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog', { name: 'Change Ana Pérez to Administrator?' })).not.toBeInTheDocument()
  })

  it('cancelling saves nothing and the form keeps the change', async () => {
    const user = userEvent.setup()
    mountProfile()
    await chooseAdministrator(user)
    await user.click(saveBar())
    const dialog = await screen.findByRole('dialog', { name: 'Change Ana Pérez to Administrator?' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel admin' }))
    await settle()
    expect(runtime.spies.update).not.toHaveBeenCalled()
    expect(trigger(/^User type Administrator$/)).toBeInTheDocument()
  })
})

// (coordinator update): the API checks the confirmation both ways; taking level 0 away from an
// admin asks ConfirmAdmin too, not the C8 question — same as giving it (owner decision 24 B above).
describe('Profile form · taking level 0 away from an admin also asks ConfirmAdmin', () => {
  const chooseUser = async (user) => {
    await user.click(trigger(/^User type Administrator$/))
    await user.click(screen.getByRole('option', { name: 'User' }))
  }
  const saveBar = () => screen.getByRole('button', { name: 'Save changes' })

  describe('with the server check (POST /users/confirm_action)', () => {
    it('asks ConfirmAdmin with the name and the type, and no C8 question', async () => {
      const user = userEvent.setup()
      mountProfile({ user: { ...USER, level: 0 } })
      await chooseUser(user)
      await user.click(saveBar())
      const dialog = await screen.findByRole('dialog', { name: 'Change Ana Pérez to User?' })
      expect(within(dialog).getByRole('button', { name: 'Change user type' })).toBeInTheDocument()
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(runtime.spies.update).not.toHaveBeenCalled()
    })

    it('a confirmed password saves once', async () => {
      const user = userEvent.setup()
      mountProfile({ user: { ...USER, level: 0 } })
      await chooseUser(user)
      await user.click(saveBar())
      const dialog = await screen.findByRole('dialog', { name: 'Change Ana Pérez to User?' })
      await user.click(within(dialog).getByRole('button', { name: 'Change user type' }))
      await waitFor(() => expect(runtime.spies.update).toHaveBeenCalledTimes(1))
    })

    it('cancelling saves nothing and the form keeps the change', async () => {
      const user = userEvent.setup()
      mountProfile({ user: { ...USER, level: 0 } })
      await chooseUser(user)
      await user.click(saveBar())
      const dialog = await screen.findByRole('dialog', { name: 'Change Ana Pérez to User?' })
      await user.click(within(dialog).getByRole('button', { name: 'Cancel admin' }))
      await settle()
      expect(runtime.spies.update).not.toHaveBeenCalled()
      expect(trigger(/^User type User$/)).toBeInTheDocument()
    })
  })
})

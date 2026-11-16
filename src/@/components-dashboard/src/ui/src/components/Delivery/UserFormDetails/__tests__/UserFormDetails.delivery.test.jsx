/* eslint-disable import/first */
// redesign UF-B3 (decisions 1-3, M-UF5/M-UF12/M-UF18): the Delivery copy of the profile form
// (`D/UserProfileForm` + `D/UserFormDetails`) on /delivery/drivers-list and /delivery/drivers-managers.
//
// Two blocks. «characterization» pins what `main` does and what the migration must keep (fields and conditions, values
// handed to the controller, validations, the plate before the user, the photo checks); it is written so it holds for the
// old markup (placeholders, the «Profile» Alert) and for the new one (labels, inline errors, the save bar): it ran green
// against the old code first. «new behavior» pins what the migration changes.
//
// The controller is a stateful fake: it keeps `formState.changes` like the real one and records every call, so the real
// UIs of this tree (the Product wrappers included) are what is under test. cropperjs needs a canvas: the crop piece is a
// stand-in that emits a data URL, as in the ImageField tests.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const CROPPED = 'data:image/png;base64,CROPPED'
const fallbackText = 'We couldn\'t save the changes. Try again.'

const runtime = vi.hoisted(() => ({
  user: null,
  project: 'example-driver-tenant',
  plateProjects: [],
  configs: {},
  hidden: [],
  required: [],
  validationFields: null,
  metafields: [],
  plateAnswer: null,
  onUpdate: null,
  latest: null,
  setForm: null,
  calls: null,
  log: [],
  fetchCalls: []
}))

vi.mock('~/config', () => ({
  default: { get dashboard_project_allowlists () { return { driver_plate: runtime.plateProjects } } }
}))

vi.mock('../../../../../../index', async () => {
  const React = await import('react')
  const t = (_key, fallback) => fallback ?? _key
  const dictionary = {}
  const lang = [{ dictionary }, t]
  const FakeController = ({ UIComponent, ...props }) => {
    const [formState, setFormState] = React.useState({ loading: false, changes: {}, result: { error: false, result: null } })
    runtime.latest = formState
    runtime.setForm = setFormState
    const { calls } = runtime
    const merge = patch => setFormState(state => ({ ...state, changes: { ...state.changes, ...patch } }))
    return (
      <UIComponent
        {...props}
        formState={formState}
        userState={{ loading: false, result: { error: false, result: props.user } }}
        validationFields={runtime.validationFields}
        showField={code => !runtime.hidden.includes(code)}
        isRequiredField={code => runtime.required.includes(code)}
        cleanFormState={values => {
          calls.clean.push(values)
          setFormState(state => ({ ...state, ...values }))
        }}
        handleChangeInput={(event, isMany) => {
          if (isMany) {
            calls.input.push([event, true])
            merge(Object.fromEntries(Object.values(event).map(item => [item.name, item.value])))
          } else {
            calls.input.push([{ name: event.target.name, value: event.target.value }, false])
            merge({ [event.target.name]: event.target.value })
          }
        }}
        handleChangeSwtich={(key, value) => {
          calls.swtich.push([key, value])
          merge({ [key]: value })
        }}
        handleChangeUserType={level => {
          calls.userType.push(level)
          merge({ level })
        }}
        handlechangeImage={file => {
          calls.image.push(file)
          const reader = new window.FileReader()
          reader.readAsDataURL(file)
          reader.onload = () => merge({ photo: reader.result })
        }}
        setCellphoneStartZero={value => calls.startZero.push(value)}
        handleButtonUpdateClick={async (...args) => {
          calls.update.push(args)
          runtime.log.push('update')
          if (runtime.onUpdate) return runtime.onUpdate(args, setFormState)
          if (args[1]) {
            setFormState(state => {
              const { photo, ...rest } = state.changes
              return { ...state, loading: false, changes: rest, result: { error: false, result: null } }
            })
          }
        }}
      />
    )
  }
  return {
    useLanguage: () => lang,
    useConfig: () => [{ configs: runtime.configs }],
    useCustomer: () => [{}, { setUserCustomer: () => {} }],
    useApi: () => [{ project: runtime.project, root: 'https://api.example.test/v1' }],
    useSession: () => [{ token: 'tok', auth: true, user: { level: 0 } }],
    useUtils: () => [{ optimizeImage: value => value }],
    // the legacy Modal and Alert (what main used) mount through the Popup controller
    Popup: ({ UIComponent, ...props }) => (props.open ? <UIComponent {...props} /> : null),
    DragAndDrop: ({ onDrop, children, disabled, className }) => (
      <div
        data-testid='dnd'
        className={className}
        onDrop={event => {
          if (disabled) return
          event.preventDefault()
          onDrop(event.dataTransfer)
        }}
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
    UserFormDetails: FakeController
  }
})

vi.mock('react-phone-number-input', async () => {
  const React = await import('react')
  const PhoneInput = React.forwardRef(function FakePhoneInput (props, ref) {
    const InputComponent = props.inputComponent || 'input'
    return (
      <div className='PhoneInput'>
        <div className='PhoneInputCountry'>
          <select aria-label='Phone number country' className='PhoneInputCountrySelect' disabled={props.disabled}>
            <option value='US'>United States</option>
          </select>
        </div>
        <InputComponent
          ref={ref}
          className='PhoneInputInput'
          type='tel'
          disabled={props.disabled}
          placeholder={props.placeholder}
          value={props.value || ''}
          onChange={event => props.onChange(event.target.value)}
        />
      </div>
    )
  })
  return { default: PhoneInput, formatPhoneNumber: number => number }
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

import { UserProfileForm } from '../../UserProfileForm'

const lightTheme = createDashboardTheme(theme)

const checkout = (extra = {}) => ({
  name: { id: 1, code: 'name', name: 'Name', type: 'text', enabled: true, required: false },
  middle_name: { id: 2, code: 'middle_name', name: 'Middle name', type: 'text', enabled: true, required: false },
  lastname: { id: 3, code: 'lastname', name: 'Lastname', type: 'text', enabled: true, required: false },
  second_lastname: { id: 4, code: 'second_lastname', name: 'Second lastname', type: 'text', enabled: true, required: false },
  email: { id: 5, code: 'email', name: 'Email', type: 'email', enabled: true, required: false },
  cellphone: { id: 6, code: 'cellphone', name: 'Cellphone', enabled: true, required: false },
  ...extra
})

const makeUser = (extra = {}) => ({
  id: 5,
  name: 'Olivia',
  middle_name: '',
  lastname: 'Bennett',
  second_lastname: '',
  email: 'olivia@example.com',
  cellphone: '4155552671',
  country_phone_code: '1',
  level: 4,
  timezone: '',
  external_id: '12',
  driver_zone_restriction: false,
  mono_session: false,
  photo: null,
  ...extra
})

const answerPlate = (method) => {
  if (runtime.plateAnswer) return runtime.plateAnswer(method)
  return method === 'GET' ? { body: { error: false, result: runtime.metafields } } : { body: { error: false, result: { id: 77 } } }
}

beforeEach(() => {
  runtime.user = makeUser()
  runtime.project = 'example-driver-tenant'
  runtime.plateProjects = [runtime.project]
  runtime.configs = { default_country_code: { value: 'us' }, validation_phone_number_lib: { value: 1 } }
  runtime.hidden = []
  runtime.required = []
  runtime.validationFields = { loading: false, fields: { checkout: checkout() } }
  runtime.metafields = []
  runtime.plateAnswer = null
  runtime.onUpdate = null
  runtime.latest = null
  runtime.setForm = null
  runtime.calls = { clean: [], input: [], swtich: [], userType: [], image: [], startZero: [], update: [] }
  runtime.log = []
  runtime.fetchCalls = []
  global.fetch = vi.fn(async (url, init = {}) => {
    const method = init.method || 'GET'
    runtime.log.push(`plate:${method}`)
    runtime.fetchCalls.push({ url, method, body: init.body ? JSON.parse(init.body) : null })
    const answer = await answerPlate(method)
    return { ok: answer.ok ?? true, status: answer.status ?? 200, json: async () => answer.body }
  })
})

afterEach(() => {
  vi.useRealTimers()
  document.getElementById('app-modals')?.remove()
})

// settled: the plate of the drivers page is read on mount, and the form is not ready (the button is off) until it answers
const mount = async (props = {}) => {
  const view = render(
    <ThemeProvider theme={lightTheme}>
      <UserProfileForm user={runtime.user} isDriversPage handleSuccessUpdate={() => {}} {...props} />
    </ThemeProvider>
  )
  await act(async () => {})
  return view
}

// the old markup names a field by its placeholder, the new one by its label: the same words
const ctrl = (...names) => {
  for (const name of names) {
    const found = screen.queryByLabelText(name) ?? screen.queryByPlaceholderText(name)
    if (found) return found
  }
  return null
}
const need = (...names) => {
  const found = ctrl(...names)
  if (!found) throw new Error(`no control named ${names.join(' / ')}`)
  return found
}
const phone = () => screen.getByPlaceholderText('Phone number')
const saveButton = () => screen.queryByRole('button', { name: /^(Update|Save changes)$/ })
const switchFor = (...names) => {
  for (const name of names) {
    const real = screen.queryByRole('switch', { name })
    if (real) return real
    const legacy = screen.queryByText(name)?.parentElement?.querySelector('input[type="checkbox"]')
    if (legacy) return legacy
  }
  throw new Error(`no switch named ${names.join(' / ')}`)
}
const fileInput = () => document.querySelector('input[type="file"]')
const png = () => new File(['pixels'], 'photo.png', { type: 'image/png' })
const text = () => new File(['words'], 'notes.txt', { type: 'text/plain' })
const heavy = () => {
  const file = new File(['pixels'], 'big.png', { type: 'image/png' })
  Object.defineProperty(file, 'size', { value: 3 * 1024 * 1024 })
  return file
}
const pick = file => fireEvent.change(fileInput(), { target: { files: [file] } })
const edit = (control, value) => fireEvent.change(control, { target: { value } })
const imageUploads = () => runtime.calls.update.filter(args => args[1] === true)
const position = (a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

// ------------------------------------------------------------------------------------------------------------------
describe('characterization · what main does and the migration keeps', () => {
  it('shows the five checkout fields, in their configured order, with the user\'s values', async () => {
    await mount()
    const order = ['Name', 'Middle name', 'Last name', 'Second last name', 'Email']
    order.forEach(name => expect(need(name)).toBeInTheDocument())
    order.slice(1).forEach((name, index) => expect(position(need(order[index]), need(name))).toBe(true))
    expect(need('Name')).toHaveValue('Olivia')
    expect(need('Last name')).toHaveValue('Bennett')
    expect(need('Email')).toHaveValue('olivia@example.com')
  })

  it('hides a field the controller\'s showField hides', async () => {
    runtime.hidden = ['middle_name']
    await mount()
    expect(ctrl('Middle name')).toBeNull()
    expect(need('Last name')).toBeInTheDocument()
  })

  it('typing a name hands the controller the name and the value', async () => {
    const user = userEvent.setup()
    await mount()
    await user.type(need('Name'), 'a')
    expect(runtime.calls.input.at(-1)).toEqual([{ name: 'name', value: 'Oliviaa' }, false])
    expect(runtime.latest.changes.name).toBe('Oliviaa')
  })

  it('lower-cases the email and strips what the API refuses', async () => {
    await mount()
    edit(need('Email'), 'Ana Bob(1)@Example.COM')
    expect(runtime.latest.changes.email).toBe('anabob1@example.com')
  })

  it('shows the phone only when the project enables the cellphone', async () => {
    await mount()
    expect(phone()).toHaveValue('+1 4155552671')
    cleanup()
    runtime.validationFields = { loading: false, fields: { checkout: checkout({ cellphone: { id: 6, code: 'cellphone', enabled: false, required: false } }) } }
    await mount()
    expect(screen.queryByPlaceholderText('Phone number')).toBeNull()
  })

  it('a valid phone becomes the two values the API takes; a leading zero reaches setCellphoneStartZero', async () => {
    await mount()
    fireEvent.change(phone(), { target: { value: '+14155559999' } })
    expect(runtime.calls.input.at(-1)).toEqual([{
      country_phone_code: { name: 'country_phone_code', value: '1' },
      cellphone: { name: 'cellphone', value: '4155559999' }
    }, true])
    expect(runtime.calls.startZero.at(-1)).toBeNull()
    fireEvent.change(phone(), { target: { value: '+44 07911 123456' } })
    expect(runtime.calls.startZero.at(-1)).toBe('07911123456')
  })

  it('drivers page: External ID, timezone, the two switches and the user type; the plate only in the listed projects', async () => {
    await mount()
    expect(need('External ID')).toHaveValue('12')
    expect(screen.getByText('Select a timezone')).toBeInTheDocument()
    expect(need('License plate')).toHaveAttribute('maxlength', '255')
    expect(switchFor('Driver Zone Restriccion', 'Driver zone restriction')).not.toBeChecked()
    expect(switchFor('Mono session')).not.toBeChecked()
    // the user type shows its level («Driver»), whatever else on the page says the word
    expect(screen.getAllByText('Driver').length).toBeGreaterThan(0)
  })

  it('drivers page: the driver fields keep their order', async () => {
    await mount()
    const ids = [need('External ID'), need('License plate'), screen.getByText('Select a timezone')]
    expect(position(ids[0], ids[1])).toBe(true)
    expect(position(ids[1], ids[2])).toBe(true)
    expect(position(ids[2], switchFor('Driver Zone Restriccion', 'Driver zone restriction'))).toBe(true)
    expect(position(switchFor('Driver Zone Restriccion', 'Driver zone restriction'), switchFor('Mono session'))).toBe(true)
  })

  it('outside the listed projects there is no plate and nothing asks the API for it', async () => {
    runtime.project = 'other'
    await mount()
    expect(ctrl('License plate')).toBeNull()
    await act(async () => {})
    expect(runtime.fetchCalls).toEqual([])
  })

  it('with no tenant configuration never requests a license plate', async () => {
    runtime.plateProjects = []
    await mount()
    expect(ctrl('License plate')).toBeNull()
    expect(runtime.fetchCalls).toEqual([])
  })

  it('without isDriversPage there are no driver fields, no timezone, no plate', async () => {
    await mount({ isDriversPage: false, isDriversManagersPage: true })
    expect(ctrl('External ID')).toBeNull()
    expect(ctrl('License plate')).toBeNull()
    expect(screen.queryByText('Select a timezone')).toBeNull()
    expect(screen.queryByText('Mono session')).toBeNull()
    expect(need('Name')).toBeInTheDocument()
    // the user type shows its level («Driver»), whatever else on the page says the word
    expect(screen.getAllByText('Driver').length).toBeGreaterThan(0)
  })

  it('External ID keeps only digits while typing', async () => {
    const user = userEvent.setup()
    await mount()
    const id = need('External ID')
    await user.clear(id)
    await user.type(id, 'a1b2')
    expect(runtime.latest.changes.external_id).toBe('12')
  })

  it('the switches send today\'s keys and booleans', async () => {
    const user = userEvent.setup()
    runtime.user = makeUser({ mono_session: true })
    await mount()
    await user.click(switchFor('Driver Zone Restriccion', 'Driver zone restriction'))
    await user.click(switchFor('Mono session'))
    expect(runtime.calls.swtich).toEqual([['driver_zone_restriction', true], ['mono_session', false]])
  })

  it('a missing driver_zone_restriction counts as off', async () => {
    const { driver_zone_restriction: _omit, ...rest } = makeUser()
    runtime.user = rest
    await mount()
    expect(switchFor('Driver Zone Restriccion', 'Driver zone restriction')).not.toBeChecked()
  })

  it('the user type is always there; the plate and the user are saved, the plate first', async () => {
    const user = userEvent.setup()
    await mount()
    await user.type(need('License plate'), 'ab 12')
    edit(need('Name'), 'Ana')
    await user.click(saveButton())
    await waitFor(() => expect(runtime.calls.update).toHaveLength(1))
    expect(runtime.log.filter(entry => entry !== 'plate:GET')).toEqual(['plate:POST', 'update'])
    expect(runtime.fetchCalls.find(call => call.method === 'POST')).toMatchObject({
      url: 'https://api.example.test/v1/users/5/metafields',
      body: { key: 'plate', value: 'AB 12', value_type: 'text' }
    })
    expect(runtime.calls.update[0]).toEqual([null])
  })

  it('a dirty plate alone is enough to save: only the plate is written', async () => {
    const user = userEvent.setup()
    await mount()
    await user.type(need('License plate'), 'xyz')
    await user.click(saveButton())
    await waitFor(() => expect(runtime.fetchCalls.some(call => call.method === 'POST')).toBe(true))
    await act(async () => {})
    expect(runtime.calls.update).toEqual([])
  })

  it('an existing plate is read on mount and saved with PUT, or removed with DELETE', async () => {
    const user = userEvent.setup()
    runtime.metafields = [{ id: 31, key: 'plate', value: 'OLD1' }]
    await mount()
    await waitFor(() => expect(need('License plate')).toHaveValue('OLD1'))
    await user.clear(need('License plate'))
    await user.type(need('License plate'), 'new2')
    await user.click(saveButton())
    await waitFor(() => expect(runtime.fetchCalls.some(call => call.method === 'PUT')).toBe(true))
    expect(runtime.fetchCalls.find(call => call.method === 'PUT')).toMatchObject({
      url: 'https://api.example.test/v1/users/5/metafields/31',
      body: { key: 'plate', value: 'NEW2', value_type: 'text' }
    })
  })

  it('a plate that fails to save stops the save and shows its message', async () => {
    const user = userEvent.setup()
    runtime.plateAnswer = method => method === 'GET'
      ? { body: { error: false, result: [] } }
      : { body: { error: true, result: ['Plate already used'] } }
    await mount()
    await user.type(need('License plate'), 'abc')
    edit(need('Name'), 'Ana')
    await user.click(saveButton())
    expect(await screen.findByText('Plate already used')).toBeInTheDocument()
    expect(runtime.calls.update).toEqual([])
  })

  it.each([
    ['a text', 'Email already exists', ['Email already exists']],
    ['a list', ['Email already exists', 'Phone is invalid'], ['Email already exists', 'Phone is invalid']]
  ])('shows an API error that is %s', async (_label, result, shown) => {
    await mount()
    edit(need('Name'), 'Ana')
    // main reads the answer when the controller stops loading
    act(() => runtime.setForm(state => ({ ...state, loading: true })))
    act(() => runtime.setForm(state => ({ ...state, loading: false, result: { error: true, result } })))
    for (const line of shown) expect(await screen.findByText(new RegExp(line))).toBeInTheDocument()
  })

  // main shows no message for an invalid email in this setup (jsdom, react-hook-form 6.15.8: the email is registered with a
  // custom `register('email')` and its value is set by hand; the cause was not investigated). The new form checks it
  // itself, see «new behavior».
  it('a password under eight characters blocks the save and says so', async () => {
    const user = userEvent.setup()
    await mount()
    await user.type(need('Password', 'New password'), 'abc')
    await user.click(saveButton())
    expect(await screen.findByText('The Password must be at least 8 characters.')).toBeInTheDocument()
    expect(runtime.calls.update).toEqual([])
    // main's «Profile» alert has to be accepted first; the new form has none
    const accept = screen.queryByRole('button', { name: 'Accept' })
    if (accept) await user.click(accept)
    await user.type(need('Password', 'New password'), 'defghij')
    await user.click(saveButton())
    await waitFor(() => expect(runtime.calls.update).toHaveLength(1))
    expect(runtime.latest.changes.password).toBe('abcdefghij')
  })

  it('a required phone left empty blocks the save', async () => {
    const user = userEvent.setup()
    runtime.user = makeUser({ cellphone: '', country_phone_code: '' })
    runtime.validationFields = { loading: false, fields: { checkout: checkout({ cellphone: { id: 6, code: 'cellphone', enabled: true, required: true } }) } }
    await mount()
    edit(need('Name'), 'Ana')
    await user.click(saveButton())
    expect(await screen.findByText('The field Phone Number is required.')).toBeInTheDocument()
    expect(runtime.calls.update).toEqual([])
  })

  it('an invalid phone blocks the save', async () => {
    const user = userEvent.setup()
    await mount()
    fireEvent.change(phone(), { target: { value: '+1415' } })
    await user.click(saveButton())
    expect((await screen.findAllByText('The Phone Number field is invalid')).length).toBeGreaterThan(0)
    expect(runtime.calls.update).toEqual([])
  })

  it('clearing a saved phone sends both values empty', async () => {
    const user = userEvent.setup()
    await mount()
    fireEvent.change(phone(), { target: { value: '' } })
    await user.click(saveButton())
    await waitFor(() => expect(runtime.calls.update).toHaveLength(1))
    expect(runtime.calls.update[0]).toEqual([{ country_phone_code: '', cellphone: '' }])
  })

  it('forgets the pending changes when the user changes', async () => {
    const view = await mount()
    const before = runtime.calls.clean.length
    view.rerender(
      <ThemeProvider theme={lightTheme}>
        <UserProfileForm user={makeUser({ id: 6 })} isDriversPage handleSuccessUpdate={() => {}} />
      </ThemeProvider>
    )
    await act(async () => {}) // the plate of the new driver is read
    expect(runtime.calls.clean.length).toBeGreaterThan(before)
    expect(runtime.calls.clean.at(-1)).toEqual({ changes: {} })
  })

  it('shows no field while the validation fields load', async () => {
    runtime.validationFields = { loading: true, fields: {} }
    await mount()
    expect(ctrl('Name')).toBeNull()
    expect(ctrl('External ID')).toBeNull()
  })

  it('photo: a file that is not an image is refused with today\'s message and nothing is read', async () => {
    await mount()
    pick(text())
    expect(await screen.findByText('Only images can be accepted')).toBeInTheDocument()
    expect(screen.queryByTestId('image-crop')).toBeNull()
  })

  it('photo: more than 2 MB is refused with today\'s message', async () => {
    await mount()
    pick(heavy())
    expect(await screen.findByText('The maximum image size is 2 megabytes')).toBeInTheDocument()
    expect(screen.queryByTestId('image-crop')).toBeNull()
  })

  it('photo: a dropped file goes through the same check', async () => {
    await mount()
    fireEvent.drop(screen.getByTestId('dnd'), { dataTransfer: { files: [text()] } })
    expect(await screen.findByText('Only images can be accepted')).toBeInTheDocument()
  })

  it('photo: a picked image opens the crop and the cropped one is what ends up saved', async () => {
    await mount()
    pick(png())
    expect(await screen.findByTestId('image-crop')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Crop' }))
    await waitFor(() => expect(runtime.calls.swtich).toContainEqual(['photo', CROPPED]))
    await waitFor(() => expect(imageUploads().length).toBeGreaterThan(0))
    expect(runtime.calls.update.filter(args => args[1] === true).at(-1)).toEqual([null, true])
  })
})

// ------------------------------------------------------------------------------------------------------------------
describe('new behavior · groups, labels, the save bar, inline errors', () => {
  it('groups the fields under headings: Details, Account and, on the drivers page, Driver', async () => {
    await mount()
    const headings = screen.getAllByRole('heading', { level: 3 }).map(node => node.textContent)
    expect(headings).toEqual(['Details', 'Account', 'Driver'])
    const form = document.querySelector('form')
    const details = within(form).getByRole('heading', { name: 'Details' }).closest('section')
    expect(within(details).getByLabelText('Name')).toBeInTheDocument()
    expect(within(details).getByLabelText('Email')).toBeInTheDocument()
    expect(within(details).getByLabelText('Phone number')).toBeInTheDocument()
    const account = within(form).getByRole('heading', { name: 'Account' }).closest('section')
    expect(within(account).getByLabelText('New password')).toBeInTheDocument()
    expect(within(account).getByRole('button', { name: /User type/ })).toBeInTheDocument()
    const driver = within(form).getByRole('heading', { name: 'Driver' }).closest('section')
    expect(within(driver).getByLabelText('External ID')).toBeInTheDocument()
    expect(within(driver).getByLabelText('License plate')).toBeInTheDocument()
    expect(within(driver).getByRole('button', { name: /Timezone/ })).toBeInTheDocument()
    expect(within(driver).getByRole('switch', { name: 'Driver zone restriction' })).toBeInTheDocument()
    expect(within(driver).getByRole('switch', { name: 'Mono session' })).toBeInTheDocument()
  })

  it('without isDriversPage there is no Driver group', async () => {
    await mount({ isDriversPage: false, isDriversManagersPage: true })
    expect(screen.queryByRole('heading', { name: 'Driver' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Timezone/ })).toBeNull()
  })

  it('has no Update button and no «Profile» alert dialog', async () => {
    await mount()
    edit(need('Email'), 'bad')
    expect(screen.queryByRole('button', { name: /^Update/ })).toBeNull()
    fireEvent.click(saveButton())
    await screen.findByText('Invalid email address')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('marks no field as required in Profile, as main; a required field would carry the marker', async () => {
    await mount()
    expect(document.querySelector('.odc-field-required')).toBeNull()
    cleanup()
    runtime.required = ['name']
    await mount()
    expect(within(screen.getByLabelText(/^Name/).closest('.odc-field')).getByText('Required')).toBeInTheDocument()
  })

  it('does not break when the validation-fields request failed (fields is {})', async () => {
    runtime.validationFields = { loading: false, fields: {} }
    await mount()
    expect(screen.queryByLabelText('Name')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument()
  })

  it('marks the form busy and draws skeleton lines while the validation fields load', async () => {
    runtime.validationFields = { loading: true, fields: {} }
    await mount()
    expect(document.querySelector('form')).toHaveAttribute('aria-busy', 'true')
    expect(document.querySelectorAll('form .odc-skeleton').length).toBeGreaterThan(0)
    expect(screen.queryByLabelText('Name')).toBeNull()
  })

  it('the bar is not there until something changes; then it counts and names the changes', async () => {
    const user = userEvent.setup()
    await mount()
    expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
    await user.type(need('Name'), 'a')
    const bar = screen.getByRole('group', { name: 'Save changes' })
    expect(document.querySelector('form')).toContainElement(bar)
    expect(within(bar).getByText('1 unsaved change')).toBeInTheDocument()
    expect(within(bar).getByText(/Name/)).toBeInTheDocument()
    edit(need('Last name'), 'Smith')
    fireEvent.change(phone(), { target: { value: '+14155559999' } })
    expect(within(bar).getByText('3 unsaved changes')).toBeInTheDocument()
    expect(bar).toHaveTextContent('Name, Last name, Phone number')
  })

  it('a phone counts once, the password is named, more than three names end in «+n»', async () => {
    await mount()
    edit(need('Name'), 'a')
    fireEvent.change(phone(), { target: { value: '+14155559999' } })
    edit(need('External ID'), '99')
    edit(need('New password'), 'secret-123')
    const bar = screen.getByRole('group', { name: 'Save changes' })
    expect(bar).toHaveTextContent('4 unsaved changes')
    expect(bar).toHaveTextContent('Name, Phone number, External ID +1')
  })

  it('a dirty plate counts as a change and enables the bar', async () => {
    const user = userEvent.setup()
    await mount()
    await user.type(need('License plate'), 'abc')
    const bar = screen.getByRole('group', { name: 'Save changes' })
    expect(bar).toHaveTextContent('1 unsaved change')
    expect(bar).toHaveTextContent('License plate')
  })

  it('the photo is not an unsaved change of the bar', async () => {
    runtime.onUpdate = () => {}
    await mount()
    pick(png())
    fireEvent.click(await screen.findByRole('button', { name: 'Crop' }))
    await waitFor(() => expect(imageUploads()).toHaveLength(1))
    expect(screen.queryByText(/unsaved change/)).toBeNull()
  })

  it('Enter in a field saves, through the same validation', async () => {
    const user = userEvent.setup()
    await mount()
    await user.type(need('Name'), 'a{Enter}')
    await waitFor(() => expect(runtime.calls.update).toHaveLength(1))
    expect(runtime.calls.update[0]).toEqual([null])
    await user.clear(need('Email'))
    await user.type(need('Email'), 'bad{Enter}')
    expect(await screen.findByText('Invalid email address')).toBeInTheDocument()
    expect(runtime.calls.update).toHaveLength(1)
  })

  it('each message sits under its field and the focus goes to the first invalid one', async () => {
    const user = userEvent.setup()
    await mount()
    edit(need('Email'), 'bad')
    await user.type(need('New password'), 'abc')
    await user.click(saveButton())
    const email = need('Email')
    await waitFor(() => expect(email).toHaveFocus())
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(within(email.closest('.odc-field')).getByRole('alert')).toHaveTextContent('Invalid email address')
    expect(within(need('New password').closest('.odc-field')).getByRole('alert')).toHaveTextContent('The Password must be at least 8 characters.')
    const bar = screen.getByRole('group', { name: 'Save changes' })
    expect(within(bar).getByRole('alert')).toHaveTextContent('Fix 2 fields to save.')
    expect(runtime.calls.update).toEqual([])
  })

  it('says «Fix 1 field to save.» with one error and takes the message away once it is fixed', async () => {
    const user = userEvent.setup()
    await mount()
    edit(need('Email'), 'bad')
    await user.click(saveButton())
    expect(within(screen.getByRole('group', { name: 'Save changes' })).getByRole('alert')).toHaveTextContent('Fix 1 field to save.')
    edit(need('Email'), 'good@example.com')
    await user.click(saveButton())
    await waitFor(() => expect(runtime.calls.update).toHaveLength(1))
    expect(screen.queryByText('Invalid email address')).toBeNull()
  })

  it('a required phone left empty says so under the phone', async () => {
    const user = userEvent.setup()
    runtime.user = makeUser({ cellphone: '', country_phone_code: '' })
    runtime.validationFields = { loading: false, fields: { checkout: checkout({ cellphone: { id: 6, code: 'cellphone', enabled: true, required: true } }) } }
    await mount()
    edit(need('Name'), 'Ana')
    await user.click(saveButton())
    await waitFor(() => expect(phone()).toHaveFocus())
    expect(within(phone().closest('.odc-phone-field')).getByRole('alert')).toHaveTextContent('The field Phone Number is required.')
  })

  it('the API error goes to the bar, translated and never empty, in each shape M-13 knows', async () => {
    class UserLike { constructor () { this.id = 7 } }
    const cases = [
      ['a text stays the text', 'Email already exists', 'Email already exists'],
      ['a list is joined', ['Email already exists', 'Phone is invalid'], 'Email already exists Phone is invalid'],
      ['an object falls back', { code: 500 }, fallbackText],
      ['a User instance falls back', new UserLike(), fallbackText],
      ['an Error falls back', new Error('boom'), fallbackText],
      ['an empty list falls back', [], fallbackText]
    ]
    for (const [, result, expected] of cases) {
      cleanup()
      await mount()
      edit(need('Name'), 'Ana')
      act(() => runtime.setForm(state => ({ ...state, loading: false, result: { error: true, result } })))
      const bar = screen.getByRole('group', { name: 'Save changes' })
      expect(within(bar).getByRole('alert')).toHaveTextContent(expected)
      expect(bar.textContent).not.toMatch(/\[object|undefined|null/)
    }
  })

  it('the bar is saving while the controller is, and the Save button is a plain button then', async () => {
    await mount()
    edit(need('Name'), 'Ana')
    act(() => runtime.setForm(state => ({ ...state, loading: true })))
    const bar = screen.getByRole('group', { name: 'Save changes' })
    expect(bar).toHaveAttribute('data-saving')
    expect(within(bar).getByRole('button', { name: 'Save changes' })).toHaveAttribute('type', 'button')
  })

  it('«Saved» shows for four seconds after a save that ended well, then goes', async () => {
    vi.useFakeTimers()
    runtime.onUpdate = (_args, setForm) => setForm(state => ({ ...state, loading: false, changes: {}, result: { error: false, result: null } }))
    await mount()
    edit(need('Name'), 'Ana')
    await act(async () => { fireEvent.click(saveButton()) })
    expect(screen.getByRole('status')).toHaveTextContent('Saved')
    act(() => { vi.advanceTimersByTime(3900) })
    expect(screen.queryByRole('status')).not.toBeNull()
    act(() => { vi.advanceTimersByTime(200) })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('it does not say «Saved» after a save that failed', async () => {
    runtime.onUpdate = (_args, setForm) => setForm(state => ({ ...state, loading: false, result: { error: true, result: 'Email already exists' } }))
    await mount()
    edit(need('Name'), 'Ana')
    await act(async () => { fireEvent.click(saveButton()) })
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('alert')).toHaveTextContent('Email already exists')
  })

  describe('Discard puts every kind of control back', () => {
    const discard = () => fireEvent.click(screen.getByRole('button', { name: 'Discard' }))

    it('empties the changes and the API error', async () => {
      await mount()
      edit(need('Name'), 'Ana')
      act(() => runtime.setForm(state => ({ ...state, loading: false, result: { error: true, result: 'Nope' } })))
      discard()
      expect(runtime.calls.clean.at(-1)).toEqual({ changes: {}, result: { error: false } })
      expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
    })

    it('text fields', async () => {
      await mount()
      edit(need('Name'), 'Ana')
      expect(need('Name')).toHaveValue('Ana')
      discard()
      expect(need('Name')).toHaveValue('Olivia')
    })

    it('External ID', async () => {
      await mount()
      edit(need('External ID'), '999')
      discard()
      expect(need('External ID')).toHaveValue('12')
    })

    it('the phone text and the start-zero value', async () => {
      await mount()
      fireEvent.change(phone(), { target: { value: '+44 07911 123456' } })
      expect(phone()).toHaveValue('+44 07911 123456')
      discard()
      expect(phone()).toHaveValue('+1 4155552671')
      expect(runtime.calls.startZero.at(-1)).toBeNull()
    })

    it('the switches', async () => {
      const user = userEvent.setup()
      await mount()
      await user.click(screen.getByRole('switch', { name: 'Mono session' }))
      expect(screen.getByRole('switch', { name: 'Mono session' })).toBeChecked()
      discard()
      expect(screen.getByRole('switch', { name: 'Mono session' })).not.toBeChecked()
    })

    it('the user type and the timezone', async () => {
      await mount()
      fireEvent.click(screen.getByRole('button', { name: /User type/ }))
      fireEvent.click(screen.getByRole('option', { name: 'Driver manager' }))
      expect(runtime.calls.userType).toEqual([5])
      expect(screen.getByRole('button', { name: /User type/ })).toHaveTextContent('Driver manager')
      fireEvent.click(screen.getByRole('button', { name: /Timezone/ }))
      fireEvent.click(await screen.findByRole('option', { name: 'America/New_York' }))
      expect(screen.getByRole('button', { name: /Timezone/ })).toHaveTextContent('America/New_York')
      discard()
      expect(screen.getByRole('button', { name: /User type/ })).toHaveTextContent('Driver')
      expect(screen.getByRole('button', { name: /User type/ })).not.toHaveTextContent('Driver manager')
      expect(screen.getByRole('button', { name: /Timezone/ })).not.toHaveTextContent('America/New_York')
    })

    it('the plate goes back to the saved one', async () => {
      runtime.metafields = [{ id: 31, key: 'plate', value: 'OLD1' }]
      const user = userEvent.setup()
      await mount()
      await waitFor(() => expect(need('License plate')).toHaveValue('OLD1'))
      await user.type(need('License plate'), 'x')
      expect(screen.getByRole('group', { name: 'Save changes' })).toHaveTextContent('1 unsaved change')
      discard()
      expect(need('License plate')).toHaveValue('OLD1')
      expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
    })

    it('the field errors', async () => {
      const user = userEvent.setup()
      await mount()
      edit(need('Email'), 'bad')
      await user.click(saveButton())
      await screen.findByText('Invalid email address')
      discard()
      expect(screen.queryByText('Invalid email address')).toBeNull()
      expect(need('Email')).toHaveValue('olivia@example.com')
    })
  })

  describe('controls', () => {
    it('the user type sends the level and is a labelled select', async () => {
      await mount()
      fireEvent.click(screen.getByRole('button', { name: /User type/ }))
      fireEvent.click(screen.getByRole('option', { name: 'Driver manager' }))
      expect(runtime.calls.userType).toEqual([5])
    })

    it('the timezone is searchable and sends the chosen one', async () => {
      const user = userEvent.setup()
      await mount()
      fireEvent.click(screen.getByRole('button', { name: /Timezone/ }))
      await user.type(await screen.findByRole('searchbox'), 'new_york')
      const options = within(await screen.findByRole('listbox')).getAllByRole('option')
      expect(options).toHaveLength(1)
      fireEvent.click(options[0])
      expect(runtime.calls.swtich).toContainEqual(['timezone', 'America/New_York'])
    })

    it('the password has a named show/hide button and says how to keep the current one', async () => {
      const user = userEvent.setup()
      await mount()
      const field = need('New password')
      expect(field).toHaveAttribute('type', 'password')
      expect(screen.getByText('Leave empty to keep the current password.')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Show password' }))
      expect(field).toHaveAttribute('type', 'text')
      expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument()
    })

    it('the phone is a labelled field with a named country select', async () => {
      await mount()
      expect(screen.getByLabelText('Phone number')).toBe(phone())
      expect(document.querySelector('select.PhoneInputCountrySelect')).toHaveAttribute('aria-label', 'Phone number country')
    })

    it('External ID is numeric', async () => {
      await mount()
      expect(need('External ID')).toHaveAttribute('inputmode', 'numeric')
    })
  })

  describe('External ID paste (M-UF12)', () => {
    const paste = async (initial, [start, end], text) => {
      const user = userEvent.setup()
      runtime.user = makeUser({ external_id: initial })
      await mount()
      const id = need('External ID')
      await act(async () => {
        id.focus()
        id.setSelectionRange(start, end)
      })
      await user.paste(text)
      return id
    }

    beforeEach(() => { document.execCommand = vi.fn() })
    afterEach(() => { delete document.execCommand })

    it('inserts the digits of the pasted text at the caret, and what is stored is what is shown', async () => {
      const id = await paste('4567', [2, 2], '1 2a3')
      expect(runtime.latest.changes.external_id).toBe('4512367')
      expect(id).toHaveValue('4512367')
      // the caret goes right after what was pasted
      expect(id.selectionStart).toBe(5)
      expect(document.execCommand).not.toHaveBeenCalled()
    })

    it('replaces the selection', async () => {
      const id = await paste('4567', [1, 3], '9')
      expect(runtime.latest.changes.external_id).toBe('497')
      expect(id).toHaveValue('497')
    })

    it('a paste without digits changes nothing', async () => {
      const id = await paste('4567', [2, 2], 'abc')
      expect(id).toHaveValue('4567')
    })

    it('typing still keeps only digits, letters pasted in the middle of typing included', async () => {
      await mount()
      edit(need('External ID'), '12ab34')
      expect(runtime.latest.changes.external_id).toBe('1234')
      expect(need('External ID')).toHaveValue('1234')
    })
  })

  describe('plate and user (M-UF18)', () => {
    it('counts the plate while it is saved: the bar is saving', async () => {
      let release
      runtime.plateAnswer = method => method === 'GET'
        ? { body: { error: false, result: [] } }
        : new Promise(resolve => { release = () => resolve({ body: { error: false, result: { id: 5 } } }) })
      const user = userEvent.setup()
      await mount()
      await user.type(need('License plate'), 'abc')
      await user.click(saveButton())
      await waitFor(() => expect(document.querySelector('[data-saving]')).not.toBeNull())
      expect(need('License plate')).toBeDisabled()
      await act(async () => { release() })
      await waitFor(() => expect(document.querySelector('[data-saving]')).toBeNull())
    })

    it('a plate error stops the save and shows its message in the bar', async () => {
      runtime.plateAnswer = method => method === 'GET'
        ? { body: { error: false, result: [] } }
        : { body: { error: true, result: ['Plate already used'] } }
      const user = userEvent.setup()
      await mount()
      await user.type(need('License plate'), 'abc')
      edit(need('Name'), 'Ana')
      await user.click(saveButton())
      const bar = screen.getByRole('group', { name: 'Save changes' })
      expect(await within(bar).findByRole('alert')).toHaveTextContent('Plate already used')
      expect(runtime.calls.update).toEqual([])
    })

    it.each([
      ['an object', { code: 500 }],
      ['an empty list', []],
      ['nothing', undefined]
    ])('a plate error that is %s is never empty', async (_label, result) => {
      runtime.plateAnswer = method => method === 'GET'
        ? { body: { error: false, result: [] } }
        : { body: { error: true, result } }
      const user = userEvent.setup()
      await mount()
      await user.type(need('License plate'), 'abc')
      await user.click(saveButton())
      const bar = screen.getByRole('group', { name: 'Save changes' })
      expect(await within(bar).findByRole('alert')).toHaveTextContent(fallbackText)
    })

    it('says the plate was saved when the user save fails after it', async () => {
      runtime.onUpdate = (_args, setForm) => setForm(state => ({ ...state, loading: false, result: { error: true, result: 'Email already exists' } }))
      const user = userEvent.setup()
      await mount()
      await user.type(need('License plate'), 'abc')
      edit(need('Name'), 'Ana')
      await user.click(saveButton())
      const bar = screen.getByRole('group', { name: 'Save changes' })
      expect(await within(bar).findByRole('alert')).toHaveTextContent('The license plate was saved, but the other changes were not. Email already exists')
      expect(runtime.log.filter(entry => entry !== 'plate:GET')).toEqual(['plate:POST', 'update'])
    })

    it('a failed user save without a plate change does not mention the plate', async () => {
      runtime.onUpdate = (_args, setForm) => setForm(state => ({ ...state, loading: false, result: { error: true, result: 'Email already exists' } }))
      const user = userEvent.setup()
      await mount()
      edit(need('Name'), 'Ana')
      await user.click(saveButton())
      expect(await screen.findByRole('alert')).toHaveTextContent(/^Email already exists$/)
    })
  })

  describe('photo (decision 3, M-UF3, M-UF16, M-UF17)', () => {
    it('draws an avatar with the initials and a named «Change photo» button, with its hint', async () => {
      await mount()
      expect(document.querySelector('.odc-avatar')).toHaveTextContent('OB')
      expect(screen.getByRole('button', { name: 'Change photo' })).toBeInTheDocument()
      expect(screen.getByText('JPG or PNG, up to 2 MB. Saved when you choose it.')).toBeInTheDocument()
    })

    it('shows the saved photo in the avatar', async () => {
      runtime.user = makeUser({ photo: 'https://cdn.example.test/olivia.png' })
      await mount()
      expect(document.querySelector('.odc-avatar img')).toHaveAttribute('src', 'https://cdn.example.test/olivia.png')
    })

    it('picking a file opens the crop in a dialog and uploads nothing', async () => {
      await mount()
      pick(png())
      const dialog = await screen.findByRole('dialog', { name: 'Image crop' })
      expect(within(dialog).getByTestId('image-crop')).toBeInTheDocument()
      expect(runtime.calls.image).toEqual([])
      expect(runtime.calls.update).toEqual([])
      expect(runtime.calls.swtich).toEqual([])
    })

    it('accepting the crop uploads exactly once: the cropped image', async () => {
      await mount()
      pick(png())
      fireEvent.click(await screen.findByRole('button', { name: 'Crop' }))
      await waitFor(() => expect(imageUploads()).toHaveLength(1))
      await act(async () => {})
      expect(imageUploads()).toEqual([[null, true]])
      expect(runtime.calls.swtich).toEqual([['photo', CROPPED]])
      expect(runtime.calls.image).toEqual([])
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    })

    it('closing the crop writes nothing', async () => {
      await mount()
      pick(png())
      const dialog = await screen.findByRole('dialog', { name: 'Image crop' })
      fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(runtime.calls.update).toEqual([])
      expect(runtime.calls.swtich).toEqual([])
      expect(runtime.calls.image).toEqual([])
    })

    it('a wrong type or more than 2 MB shows the message under the avatar, not in an alert, and opens no crop', async () => {
      await mount()
      pick(text())
      expect(await screen.findByText('Only images can be accepted')).toBeInTheDocument()
      expect(screen.queryByRole('alertdialog')).toBeNull()
      expect(screen.queryByRole('dialog')).toBeNull()
      pick(heavy())
      expect(await screen.findByText('The maximum image size is 2 megabytes')).toBeInTheDocument()
      expect(screen.queryByText('Only images can be accepted')).toBeNull()
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('a dropped image goes through the same crop', async () => {
      await mount()
      fireEvent.drop(screen.getByTestId('dnd'), { dataTransfer: { files: [png()] } })
      expect(await screen.findByRole('dialog', { name: 'Image crop' })).toBeInTheDocument()
      expect(runtime.calls.image).toEqual([])
    })

    it('the avatar and the button are the drop zone', async () => {
      await mount()
      const zone = screen.getByTestId('dnd')
      expect(zone).toContainElement(document.querySelector('.odc-avatar'))
      expect(zone).toContainElement(screen.getByRole('button', { name: 'Change photo' }))
    })

    it('while the photo uploads the avatar is a round skeleton and the picker is off', async () => {
      runtime.onUpdate = () => {} // the upload is in flight: the controller has not answered
      await mount()
      act(() => runtime.setForm(state => ({ ...state, loading: true, changes: { photo: CROPPED } })))
      expect(document.querySelector('.odc-skeleton[data-shape="round"]')).not.toBeNull()
      expect(screen.getByRole('button', { name: 'Change photo' })).toBeDisabled()
    })

    it('an upload error shows under the avatar, never empty, and not in the bar', async () => {
      runtime.onUpdate = () => {} // the upload is in flight: the controller has not answered
      await mount()
      act(() => runtime.setForm(state => ({ ...state, loading: false, changes: { photo: CROPPED }, result: { error: true, result: { code: 413 } } })))
      const photo = document.querySelector('.odc-uf-photo')
      expect(within(photo).getByRole('alert')).toHaveTextContent(fallbackText)
      expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
    })

    it('an upload error that is a text stays that text', async () => {
      runtime.onUpdate = () => {} // the upload is in flight: the controller has not answered
      await mount()
      act(() => runtime.setForm(state => ({ ...state, loading: false, changes: { photo: CROPPED }, result: { error: true, result: 'Image is too large' } })))
      expect(within(document.querySelector('.odc-uf-photo')).getByRole('alert')).toHaveTextContent('Image is too large')
    })
  })
})

// redesign UF-R1 (review r1 F1): at 390 the sticky bar (~96px) covered the field being edited and its error.
describe('the sticky bar does not cover the focused field (R1 F1)', () => {
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
    const user = userEvent.setup()
    await mount()
    edit(need('Email'), 'bad')
    scrolled.length = 0
    await user.click(saveButton())
    await waitFor(() => expect(need('Email')).toHaveFocus())
    expect(scrolled).toEqual([{ node: need('Email'), options: { block: 'nearest' } }])
  })

  it('when the bar appears the focused control is brought into view once, and not on later keystrokes', async () => {
    const user = userEvent.setup()
    await mount()
    await user.click(need('Email'))
    expect(scrolled).toEqual([])
    await user.keyboard('a')
    expect(screen.getByRole('group', { name: 'Save changes' })).toBeInTheDocument()
    expect(scrolled).toEqual([{ node: need('Email'), options: { block: 'nearest' } }])
    await user.keyboard('bc')
    expect(scrolled).toHaveLength(1)
  })

  it('does not scroll when the focus is not inside the form as the bar appears', async () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    await mount()
    outside.focus()
    edit(need('Name'), 'Ana')
    expect(screen.getByRole('group', { name: 'Save changes' })).toBeInTheDocument()
    expect(scrolled).toEqual([])
    outside.remove()
  })
})

// redesign DL-B5 (decision 1; as Users/UserFormDetails, UC-B6 auditor #16): opt-in `onDirtyChange`. The drivers page asks to hear
// whether the profile has unsaved changes, to guard the switch to another driver or the add sheet. It is the bar's own count: a
// changed field or a changed plate; the photo is saved the moment it is cropped, so it is never an unsaved change.
describe('onDirtyChange (opt-in, DL-B5)', () => {
  it('says false when the form opens and true with the first change, false again after Discard', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    await mount({ onDirtyChange })
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
    edit(need('Name'), 'Ana')
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  it('tells only when the state changes, not on every keystroke', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    await mount({ onDirtyChange })
    await user.type(need('Name'), 'abc')
    expect(onDirtyChange.mock.calls.map(([value]) => value)).toEqual([false, true])
  })

  it('a plate that changed alone is dirty, and going back to Discard cleans it', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    await mount({ onDirtyChange })
    await user.type(need('License plate'), 'abc')
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  it('a photo is not an unsaved change (it is uploaded when the crop is accepted)', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    await mount({ onDirtyChange })
    pick(png())
    await user.click(await screen.findByRole('button', { name: 'Crop' }))
    await waitFor(() => expect(imageUploads()).toHaveLength(1))
    expect(onDirtyChange).toHaveBeenCalled()
    expect(onDirtyChange.mock.calls.every(([value]) => value === false)).toBe(true)
  })

  it('works without the prop (nothing to call)', async () => {
    await mount()
    edit(need('Name'), 'Ana')
    expect(screen.getByRole('group', { name: 'Save changes' })).toBeInTheDocument()
  })
})

// redesign D-11 (owner, 2026-10-19): saving a change of user type asks first (C8), before anything is written: the
// plate is saved ahead of the user, so the question comes ahead of the plate. Cancel writes nothing and keeps the form as it is.
describe('saving a change of user type asks first (D-11)', () => {
  const chooseManager = () => {
    fireEvent.click(screen.getByRole('button', { name: /User type/ }))
    fireEvent.click(screen.getByRole('option', { name: 'Driver manager' }))
  }
  const cancel = () => fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))
  const posts = () => runtime.fetchCalls.filter(call => call.method === 'POST')

  it('asks with the name and the type, and the focus is on Cancel', async () => {
    const user = userEvent.setup()
    await mount()
    chooseManager()
    await user.click(saveButton())
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Change Olivia Bennett to Driver manager?')).toBeInTheDocument()
    expect(within(dialog).getByText('What they can see and do changes as soon as you save.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Change user type' })).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(runtime.calls.update).toEqual([])
  })

  it('Cancel saves neither the user nor the plate, and the form keeps both changes', async () => {
    const user = userEvent.setup()
    await mount()
    await user.type(need('License plate'), 'ab 12')
    chooseManager()
    await user.click(saveButton())
    await screen.findByRole('alertdialog')
    cancel()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await act(async () => {})
    expect(runtime.calls.update).toEqual([])
    expect(posts()).toEqual([])
    expect(runtime.log).not.toContain('update')
    expect(screen.getByRole('button', { name: /User type/ })).toHaveTextContent('Driver manager')
    expect(need('License plate')).toHaveValue('ab 12')
  })

  it('Confirm saves the plate and then the user, once each', async () => {
    const user = userEvent.setup()
    await mount()
    await user.type(need('License plate'), 'ab 12')
    chooseManager()
    await user.click(saveButton())
    const dialog = await screen.findByRole('alertdialog')
    expect(runtime.log.filter(entry => entry !== 'plate:GET')).toEqual([])
    await user.click(within(dialog).getByRole('button', { name: 'Change user type' }))
    await waitFor(() => expect(runtime.calls.update).toHaveLength(1))
    expect(runtime.log.filter(entry => entry !== 'plate:GET')).toEqual(['plate:POST', 'update'])
    await act(async () => {})
    expect(runtime.calls.update).toHaveLength(1)
    expect(posts()).toHaveLength(1)
  })

  it('saving after a Cancel asks again', async () => {
    const user = userEvent.setup()
    await mount()
    chooseManager()
    await user.click(saveButton())
    await screen.findByRole('alertdialog')
    cancel()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await user.click(saveButton())
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(runtime.calls.update).toEqual([])
  })

  it('a save without a change of user type does not ask', async () => {
    const user = userEvent.setup()
    await mount()
    edit(need('Name'), 'Ana')
    await user.click(saveButton())
    await waitFor(() => expect(runtime.calls.update).toHaveLength(1))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('a plate alone does not ask', async () => {
    const user = userEvent.setup()
    await mount()
    await user.type(need('License plate'), 'xyz')
    await user.click(saveButton())
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('a level put back to the saved one does not ask', async () => {
    const user = userEvent.setup()
    await mount()
    chooseManager()
    fireEvent.click(screen.getByRole('button', { name: /User type/ }))
    fireEvent.click(screen.getByRole('option', { name: 'Driver' }))
    await user.click(saveButton())
    await waitFor(() => expect(runtime.calls.update).toHaveLength(1))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('a field that fails validation does not ask', async () => {
    const user = userEvent.setup()
    await mount()
    chooseManager()
    edit(need('Email'), 'bad')
    await user.click(saveButton())
    await screen.findByText('Invalid email address')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(runtime.calls.update).toEqual([])
  })

  it('the photo upload never asks, even with a level change waiting', async () => {
    await mount()
    chooseManager()
    pick(png())
    fireEvent.click(await screen.findByRole('button', { name: 'Crop' }))
    await waitFor(() => expect(imageUploads()).toHaveLength(1))
    expect(imageUploads()).toEqual([[null, true]])
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

// Owner decision 24 B (2026-10-21, ): the driver's profile can make someone an administrator too, so it asks the password or a
// code (ConfirmAdmin, with the C8 words, never stacked on C8), as deactivating an admin does
describe('making a driver an administrator asks ConfirmAdmin (owner decision 24)', () => {
  const chooseAdministrator = () => {
    fireEvent.click(screen.getByRole('button', { name: /User type/ }))
    fireEvent.click(screen.getByRole('option', { name: 'Administrator' }))
  }

  it('asks ConfirmAdmin, not C8, and saves nothing until it passes', async () => {
    const user = userEvent.setup()
    await mount()
    chooseAdministrator()
    await user.click(saveButton())
    const dialog = await screen.findByRole('dialog', { name: 'Change Olivia Bennett to Administrator?' })
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(runtime.calls.update).toEqual([])
    await user.click(within(dialog).getByRole('button', { name: 'Cancel admin' }))
    await act(async () => {})
    expect(runtime.calls.update).toEqual([])
    expect(screen.getByRole('button', { name: /User type/ })).toHaveTextContent('Administrator')
  })

  it('a confirmed password saves once', async () => {
    const user = userEvent.setup()
    await mount()
    chooseAdministrator()
    await user.click(saveButton())
    await user.click(within(await screen.findByRole('dialog', { name: 'Change Olivia Bennett to Administrator?' })).getByRole('button', { name: 'Change user type' }))
    await waitFor(() => expect(runtime.calls.update).toHaveLength(1))
    await act(async () => {})
    expect(runtime.calls.update).toHaveLength(1)
  })
})

// (coordinator update): the API checks the confirmation both ways; taking level 0 away from an
// admin asks ConfirmAdmin too, not the C8 question — same as giving it (owner decision 24 B above).
describe('taking level 0 away from an admin driver also asks ConfirmAdmin', () => {
  const chooseDriver = () => {
    fireEvent.click(screen.getByRole('button', { name: /User type/ }))
    fireEvent.click(screen.getByRole('option', { name: 'Driver' }))
  }

  describe('with the server check (POST /users/confirm_action)', () => {
    it('asks ConfirmAdmin, not C8, and saves nothing until it passes', async () => {
      const user = userEvent.setup()
      await mount({ user: makeUser({ level: 0 }) })
      chooseDriver()
      await user.click(saveButton())
      const dialog = await screen.findByRole('dialog', { name: 'Change Olivia Bennett to Driver?' })
      expect(screen.queryByRole('alertdialog')).toBeNull()
      expect(runtime.calls.update).toEqual([])
      await user.click(within(dialog).getByRole('button', { name: 'Cancel admin' }))
      await act(async () => {})
      expect(runtime.calls.update).toEqual([])
    })

    it('a confirmed password saves once', async () => {
      const user = userEvent.setup()
      await mount({ user: makeUser({ level: 0 }) })
      chooseDriver()
      await user.click(saveButton())
      await user.click(within(await screen.findByRole('dialog', { name: 'Change Olivia Bennett to Driver?' })).getByRole('button', { name: 'Change user type' }))
      await waitFor(() => expect(runtime.calls.update).toHaveLength(1))
    })
  })
})

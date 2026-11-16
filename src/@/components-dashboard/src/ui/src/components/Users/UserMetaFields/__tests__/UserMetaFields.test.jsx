/* eslint-disable import/first */
// redesign UF-B5 (decision 5 A, decision 6 A, M-UF7, M-UF8, M-UF11): (1) the custom fields of a user in Product, (2) the
// controller no longer spins forever when a delete is refused, (3) the saved places of the other user panels use the
// embedded address list. One file on purpose: the batch has an 8-file ceiling (the controller and the two hosts have no
// file of their own in it).
//
// The controller of the UI tests is a fake that hands the real UI the props the real one hands it; the controller tests
// run the real controller against a mocked `fetch`.
import React, { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import brandTheme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const runtime = vi.hoisted(() => ({
  list: null,
  action: null,
  addError: null,
  add: null,
  del: null,
  // redesign D-10: null = the delete works; anything else is what the API answers when it refuses it
  delError: null,
  addressList: null,
  // redesign UF-R1 (F4): the catalog words that matter here; every other key says its English default
  catalog: {}
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (key, fallback) => runtime.catalog[key] ?? fallback ?? key],
  useSession: () => [{ user: { id: 1, level: 0 } }],
  useConfig: () => [{ configs: {} }],
  UserDetails: () => null,
  UserMetaFields: ({ UIComponent, ...props }) => {
    const [list, setList] = useState(runtime.list)
    const [action, setAction] = useState(runtime.action)
    const handeAddMetaField = async (values) => {
      runtime.add(values)
      setAction({ loading: true, result: { error: false } })
      await Promise.resolve()
      if (runtime.addError !== null) {
        setAction({ loading: false, result: { error: true, result: runtime.addError } })
      } else {
        setList(current => ({ ...current, metaFields: [...current.metaFields, { id: 99, ...values }] }))
        setAction({ loading: false, result: { error: false } })
      }
    }
    const handleDeleteMetaField = async (id) => {
      runtime.del(id)
      if (runtime.delError !== null) {
        // the real controller answers through `actionState`, not through the return value
        setAction({ loading: true, result: { error: false } })
        await Promise.resolve()
        setAction({ loading: false, result: { error: true, result: runtime.delError } })
        return
      }
      setList(current => ({ ...current, metaFields: current.metaFields.filter(item => item.id !== id) }))
    }
    return <UIComponent {...props} metaFieldsList={list} actionState={action} handleDeleteMetaField={handleDeleteMetaField} handeAddMetaField={handeAddMetaField} />
  }
}))
vi.mock('../../../../../../contexts/ApiContext', async (importOriginal) => ({
  ...(await importOriginal()),
  useApi: () => [{ root: 'https://api.test/v4' }]
}))
vi.mock('../../../../../../contexts/SessionContext', async (importOriginal) => ({
  ...(await importOriginal()),
  useSession: () => [{ token: 'tkn' }]
}))
vi.mock('jsoneditor-react', () => ({
  JsonEditor: ({ onChange }) => <button type='button' data-testid='json-editor' onClick={() => onChange({ a: 1 })}>editor</button>
}))

// The hosts of the saved places: everything around the address list is a stub; the list records the props it gets.
vi.mock('../../../Shared', () => ({ Confirm: () => null, PushTokens: () => null, Modal: () => null, Personalization: () => null, Schedule: () => null }))
vi.mock('../../../Shared/Personalization', () => ({ Personalization: () => null }))
vi.mock('../../../Orders/OrdersManager', () => ({ OrdersManager: () => null }))
vi.mock('../../../Delivery', () => ({
  AddressList: (props) => {
    runtime.addressList = props
    return <div data-testid='address-list' />
  }
}))
vi.mock('../../../Delivery/AddressList', () => ({
  AddressList: (props) => {
    runtime.addressList = props
    return <div data-testid='address-list' />
  }
}))
vi.mock('../../../Delivery/UserProfileForm', () => ({ UserProfileForm: () => null }))
vi.mock('../../../Delivery/DriversLogs', () => ({ DriversLogs: () => null }))
vi.mock('../../../Delivery/DriversGroupLogs', () => ({ DriversGroupLogsUI: () => null }))
vi.mock('../../../Delivery/DriverGroupSetting', () => ({ DriverGroupSetting: () => null }))
vi.mock('../../../Delivery/DriversAdvancedLogs', () => ({ DriversAdvancedLogs: () => null }))
vi.mock('../../../Users', () => ({ UserMetaFields: () => null }))
vi.mock('../../UserDetailsMenu', () => ({ UserDetailsMenu: () => null }))
vi.mock('../../UserProfileForm', () => ({ UserProfileForm: () => null }))
vi.mock('../../BusinessManagerBusinesses', () => ({ BusinessManagerBusinesses: () => null }))
vi.mock('../../../Schools/SchoolUserStudents', () => ({ SchoolUserStudents: () => null }))

import { UserMetaFields } from '..'
import { UserMetaFields as UserMetaFieldsController } from '../../../../../../components/UserMetaFields'
import { UserDetailsUI as UsersUserDetailsUI } from '../../UserDetails'

const fields = [
  { id: 1, key: 'vip', value: 'yes', value_type: 'text' },
  { id: 2, key: 'visits', value: '12', value_type: 'integer' },
  { id: 3, key: 'newsletter', value: '1', value_type: 'boolean' },
  { id: 4, key: 'muted', value: '0', value_type: 'boolean' }
]

const fallback = 'We couldn\'t save the changes. Try again.'
class User { constructor () { this.id = 7; this.email = 'ana@example.com' } }

beforeEach(() => {
  runtime.list = { loading: false, error: null, metaFields: fields }
  runtime.action = { loading: false, result: { error: false } }
  runtime.addError = null
  runtime.delError = null
  // the real catalog says «Value is required» for VALIDATION_ERROR_REQUIRED (dashboard-translations.json)
  runtime.catalog = { VALIDATION_ERROR_REQUIRED: 'Value is required' }
  runtime.add = vi.fn()
  runtime.del = vi.fn()
  runtime.addressList = null
})

const mount = () => renderWithProviders(<UserMetaFields userId={7} />)
const typeTrigger = () => screen.getByRole('button', { name: /^Type/ })
const addButton = () => screen.getByRole('button', { name: 'Add field' })
const keyInput = () => screen.getByLabelText(/^Key/)
const valueInput = () => screen.getByLabelText(/^Value/)
const pickType = async (user, name) => {
  await user.click(typeTrigger())
  await user.click(await screen.findByRole('option', { name }))
}

describe('UserMetaFields · the list', () => {
  it('has one row per field with its type, key and value', () => {
    mount()
    const rows = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(rows).toHaveLength(4)
    expect(within(rows[0]).getByText('text')).toBeInTheDocument()
    expect(within(rows[0]).getByText('vip')).toBeInTheDocument()
    expect(within(rows[0]).getByText('yes')).toBeInTheDocument()
    expect(within(rows[1]).getByText('integer')).toBeInTheDocument()
    expect(within(rows[1]).getByText('12')).toBeInTheDocument()
  })

  it('paints the key in the mono family, as an identifier', () => {
    mount()
    expect(screen.getByText('vip')).toHaveClass('odc-uf-meta-key')
  })

  it('says true and false for a boolean (the default text of false was «fase»)', () => {
    mount()
    const rows = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(within(rows[2]).getByText('true')).toBeInTheDocument()
    expect(within(rows[3]).getByText('false')).toBeInTheDocument()
    expect(screen.queryByText('fase')).not.toBeInTheDocument()
  })

  it('says «No custom fields yet» when there are none', () => {
    runtime.list = { loading: false, error: null, metaFields: [] }
    mount()
    expect(screen.getByText('No custom fields yet')).toBeInTheDocument()
    expect(screen.queryByText('No MetaField')).not.toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('draws skeleton rows, not the form, while the fields load', () => {
    runtime.list = { loading: true, error: null, metaFields: [] }
    const { container } = mount()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(container.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    expect(screen.queryByText('No custom fields yet')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add field' })).not.toBeInTheDocument()
  })

  // redesign D-10 (owner, 2026-10-19): deleting a custom field asks first (C8), as the order version does
  const deleteButton = (key) => screen.getByRole('button', { name: `Delete ${key}` })
  const confirmButton = () => within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete field' })
  const keepButton = () => within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Keep field' })

  it('names the delete button after its field and asks first: opening the confirmation deletes nothing', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(deleteButton('visits'))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Delete custom field “visits”?')).toBeInTheDocument()
    expect(within(dialog).getByText('It will be removed from this user. This can\'t be undone.')).toBeInTheDocument()
    expect(runtime.del).not.toHaveBeenCalled()
    expect(screen.getByText('visits')).toBeInTheDocument()
    // the initial focus is on the safe answer
    await waitFor(() => expect(keepButton()).toHaveFocus())
  })

  it('deletes the field, once, only on «Delete field»', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(deleteButton('visits'))
    await screen.findByRole('alertdialog')
    await user.click(confirmButton())
    expect(runtime.del).toHaveBeenCalledTimes(1)
    expect(runtime.del).toHaveBeenCalledWith(2)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.queryByText('visits')).not.toBeInTheDocument()
  })

  it.each([
    ['«Keep field»', async (user) => user.click(keepButton())],
    ['the close button', async (user) => user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Close' }))],
    ['Escape', async (user) => user.keyboard('{Escape}')]
  ])('%s deletes nothing and gives the focus back to the delete button', async (_label, leave) => {
    const user = userEvent.setup()
    mount()
    await user.click(deleteButton('visits'))
    await screen.findByRole('alertdialog')
    await leave(user)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(runtime.del).not.toHaveBeenCalled()
    expect(screen.getByText('visits')).toBeInTheDocument()
    await waitFor(() => expect(deleteButton('visits')).toHaveFocus())
  })

  it('a refused delete says why in the dialog, keeps the field and sends nothing twice', async () => {
    const user = userEvent.setup()
    runtime.delError = 'Not allowed'
    mount()
    await user.click(deleteButton('visits'))
    await screen.findByRole('alertdialog')
    await user.click(confirmButton())
    expect(await within(screen.getByRole('alertdialog')).findByRole('alert')).toHaveTextContent('Not allowed')
    expect(runtime.del).toHaveBeenCalledTimes(1)
    expect(screen.getByText('visits')).toBeInTheDocument()
    // the refusal is not repeated in the add form behind the dialog
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    await user.click(keepButton())
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    await waitFor(() => expect(deleteButton('visits')).toHaveFocus())
  })

  it('a refusal with no usable message says the field could not be deleted', async () => {
    const user = userEvent.setup()
    runtime.delError = undefined
    mount()
    await user.click(deleteButton('visits'))
    await screen.findByRole('alertdialog')
    await user.click(confirmButton())
    expect(await within(screen.getByRole('alertdialog')).findByRole('alert')).toHaveTextContent('The field couldn\'t be deleted. Try again.')
  })

  // redesign UF-R1 (F3): the button goes with its row; the focus must not fall to <body>
  it('deleting with the keyboard moves the focus to the delete button of the row that takes its place', async () => {
    const user = userEvent.setup()
    mount()
    deleteButton('visits').focus()
    await user.keyboard('{Enter}')
    await screen.findByRole('alertdialog')
    await user.click(confirmButton())
    expect(runtime.del).toHaveBeenCalledWith(2)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Delete visits' })).not.toBeInTheDocument()
    await waitFor(() => expect(deleteButton('newsletter')).toHaveFocus())
  })

  it('deleting the last row moves the focus to the delete button of the previous one', async () => {
    const user = userEvent.setup()
    mount()
    deleteButton('muted').focus()
    await user.keyboard('{Enter}')
    await screen.findByRole('alertdialog')
    await user.click(confirmButton())
    await waitFor(() => expect(deleteButton('newsletter')).toHaveFocus())
  })

  it('deleting the only row moves the focus to the Key input of the add form', async () => {
    runtime.list = { loading: false, error: null, metaFields: [fields[0]] }
    const user = userEvent.setup()
    mount()
    deleteButton('vip').focus()
    await user.keyboard('{Enter}')
    await screen.findByRole('alertdialog')
    await user.click(confirmButton())
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.getByText('No custom fields yet')).toBeInTheDocument()
    await waitFor(() => expect(keyInput()).toHaveFocus())
  })

  it('a row that appears or goes away without a delete here leaves the focus alone', async () => {
    const user = userEvent.setup()
    mount()
    await user.type(keyInput(), 'tier')
    await user.type(valueInput(), 'gold')
    await user.click(addButton())
    await screen.findByText('gold', { selector: '.odc-uf-meta-value' })
    expect(addButton()).toHaveFocus()
  })

  it('marks the list busy and the add button busy while an action runs', () => {
    runtime.action = { loading: true, result: { error: false } }
    mount()
    expect(screen.getByRole('list')).toHaveAttribute('aria-busy', 'true')
    expect(addButton()).toHaveAttribute('aria-busy', 'true')
  })
})

describe('UserMetaFields · the add form', () => {
  it('has labelled Type, Key and Value, with text as the starting type and the five types of today', async () => {
    const user = userEvent.setup()
    mount()
    expect(typeTrigger()).toHaveTextContent('text')
    expect(keyInput()).toBeRequired()
    expect(valueInput()).toBeRequired()
    await user.click(typeTrigger())
    expect(within(await screen.findByRole('listbox')).getAllByRole('option').map(option => option.textContent.trim()))
      .toEqual(['integer', 'decimal', 'boolean', 'text', 'json'])
  })

  it('adds a text field with {key, user_id, value, value_type} and empties the key and the value', async () => {
    const user = userEvent.setup()
    mount()
    await user.type(keyInput(), 'tier')
    await user.type(valueInput(), 'gold')
    await user.click(addButton())
    await waitFor(() => expect(runtime.add).toHaveBeenCalledWith({ key: 'tier', user_id: 7, value: 'gold', value_type: 'text' }))
    await waitFor(() => expect(keyInput()).toHaveValue(''))
    expect(valueInput()).toHaveValue('')
    expect(screen.getByText('tier')).toBeInTheDocument()
  })

  it('empties an integer value too (M-UF8: only the text input was emptied)', async () => {
    const user = userEvent.setup()
    mount()
    await pickType(user, 'integer')
    await user.type(keyInput(), 'age')
    await user.type(valueInput(), '41')
    await user.click(addButton())
    await waitFor(() => expect(runtime.add).toHaveBeenCalledWith({ key: 'age', user_id: 7, value: '41', value_type: 'integer' }))
    await waitFor(() => expect(valueInput()).toHaveValue(''))
    expect(keyInput()).toHaveValue('')
  })

  it('decimal accepts a signed number with exponent and empties after the add', async () => {
    const user = userEvent.setup()
    mount()
    await pickType(user, 'decimal')
    await user.type(keyInput(), 'rate')
    await user.type(valueInput(), '-1.5e3')
    await user.click(addButton())
    await waitFor(() => expect(runtime.add).toHaveBeenCalledWith({ key: 'rate', user_id: 7, value: '-1.5e3', value_type: 'decimal' }))
    await waitFor(() => expect(valueInput()).toHaveValue(''))
  })

  it('boolean sends 1 by default and 0 when false is chosen', async () => {
    const user = userEvent.setup()
    mount()
    await pickType(user, 'boolean')
    expect(screen.getByRole('button', { name: /^Value/ })).toHaveTextContent('true')
    await user.type(keyInput(), 'flag')
    await user.click(addButton())
    await waitFor(() => expect(runtime.add).toHaveBeenLastCalledWith({ key: 'flag', user_id: 7, value: '1', value_type: 'boolean' }))
    await waitFor(() => expect(keyInput()).toHaveValue(''))
    await user.click(screen.getByRole('button', { name: /^Value/ }))
    await user.click(await screen.findByRole('option', { name: 'false' }))
    await user.type(keyInput(), 'other')
    await user.click(addButton())
    await waitFor(() => expect(runtime.add).toHaveBeenLastCalledWith({ key: 'other', user_id: 7, value: '0', value_type: 'boolean' }))
  })

  it('json sends JSON.stringify of what the editor holds', async () => {
    const user = userEvent.setup()
    mount()
    await pickType(user, 'json')
    expect(screen.getByRole('group', { name: /^Value/ })).toBeInTheDocument()
    await user.type(keyInput(), 'cfg')
    await user.click(screen.getByTestId('json-editor'))
    await user.click(addButton())
    await waitFor(() => expect(runtime.add).toHaveBeenCalledWith({ key: 'cfg', user_id: 7, value: '{"a":1}', value_type: 'json' }))
  })

  it('json sends {} when the editor was never touched', async () => {
    const user = userEvent.setup()
    mount()
    await pickType(user, 'json')
    await user.type(keyInput(), 'cfg')
    await user.click(addButton())
    await waitFor(() => expect(runtime.add).toHaveBeenCalledWith({ key: 'cfg', user_id: 7, value: '{}', value_type: 'json' }))
  })

  it('asks for the key and the value inline, next to their fields, before it adds', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(addButton())
    expect(await screen.findByText('Key is required')).toBeInTheDocument()
    expect(screen.getByText('Value is required')).toBeInTheDocument()
    expect(keyInput()).toBeInvalid()
    expect(valueInput()).toBeInvalid()
    expect(runtime.add).not.toHaveBeenCalled()
    await user.type(keyInput(), 'k')
    await waitFor(() => expect(screen.queryByText('Key is required')).not.toBeInTheDocument())
  })

  // redesign UF-R1 (F4): the catalog says «Value is required» for VALIDATION_ERROR_REQUIRED; under Key it needs its own words
  it('says «Key is required» under Key and «Value is required» under Value, each in its own field', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(addButton())
    const keyFrame = keyInput().closest('.odc-field')
    const valueFrame = valueInput().closest('.odc-field')
    expect(within(keyFrame).getByText('Key is required')).toBeInTheDocument()
    expect(within(keyFrame).queryByText('Value is required')).not.toBeInTheDocument()
    expect(within(valueFrame).getByText('Value is required')).toBeInTheDocument()
  })

  it('translates the Key message with its own key and leaves the Value message on the old one', async () => {
    const user = userEvent.setup()
    runtime.catalog = { USER_FORM_KEY_REQUIRED: 'Falta la clave', VALIDATION_ERROR_REQUIRED: 'Falta el valor' }
    mount()
    await user.click(addButton())
    expect(within(keyInput().closest('.odc-field')).getByText('Falta la clave')).toBeInTheDocument()
    expect(within(valueInput().closest('.odc-field')).getByText('Falta el valor')).toBeInTheDocument()
  })

  it('after a failed add the focus goes to Key, else to Value', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(addButton())
    expect(keyInput()).toHaveFocus()
    await user.type(keyInput(), 'k')
    await user.click(addButton())
    expect(valueInput()).toHaveFocus()
    expect(runtime.add).not.toHaveBeenCalled()
  })

  it('a failed add of a type with no Value field puts the focus on Key', async () => {
    const user = userEvent.setup()
    mount()
    await pickType(user, 'boolean')
    await user.click(addButton())
    expect(keyInput()).toHaveFocus()
    expect(runtime.add).not.toHaveBeenCalled()
  })

  it('integer takes digits only; decimal takes a number', async () => {
    const user = userEvent.setup()
    mount()
    await pickType(user, 'integer')
    await user.type(keyInput(), 'n')
    await user.type(valueInput(), '1.5')
    await user.click(addButton())
    expect(await screen.findByText('Invalid integer')).toBeInTheDocument()
    expect(runtime.add).not.toHaveBeenCalled()
    await pickType(user, 'decimal')
    await user.type(valueInput(), 'abc')
    await user.click(addButton())
    expect(await screen.findByText('Invalid decimal')).toBeInTheDocument()
    expect(runtime.add).not.toHaveBeenCalled()
  })

  it('keeps what was typed when the API refuses the add', async () => {
    const user = userEvent.setup()
    runtime.addError = 'Key already exists'
    mount()
    await user.type(keyInput(), 'tier')
    await user.type(valueInput(), 'gold')
    await user.click(addButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('Key already exists')
    expect(keyInput()).toHaveValue('tier')
    expect(valueInput()).toHaveValue('gold')
  })
})

// M-13 · the error of the API reaches the user as text (moved here from the CustomersExport tests, where the legacy alert was titled «ERROR»).
describe('UserMetaFields · the error of the API (M-13)', () => {
  const alertOf = async () => screen.findByRole('alert')

  it('a string error renders as it is', async () => {
    runtime.action = { loading: false, result: { error: true, result: 'Email already exists' } }
    mount()
    expect(await alertOf()).toHaveTextContent('Email already exists')
  })

  it('a list of strings renders each one', async () => {
    runtime.action = { loading: false, result: { error: true, result: ['Email already exists', 'Phone is invalid'] } }
    mount()
    await screen.findAllByRole('alert')
    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(2)
    expect(alerts[0]).toHaveTextContent('Email already exists')
    expect(alerts[1]).toHaveTextContent('Phone is invalid')
  })

  it.each([
    ['an object', { code: 500 }],
    ['a User instance (the SDK cast)', new User()],
    ['an Error', new Error('boom')],
    ['an empty list', []],
    ['nothing', undefined]
  ])('%s renders the generic message, never an empty alert', async (_label, value) => {
    runtime.action = { loading: false, result: { error: true, result: value } }
    mount()
    const alert = await alertOf()
    expect(alert).toHaveTextContent(fallback)
    expect(alert.textContent).not.toMatch(/\[object|undefined|null/)
  })

  it('says the fields could not be loaded instead of passing for an empty list', () => {
    runtime.list = { loading: false, error: 'Unauthorized', metaFields: [] }
    mount()
    expect(screen.getByRole('alert')).toHaveTextContent('Unauthorized')
  })
})

// M-UF11 · the controller with a mocked `fetch`.
describe('K/UserMetaFields · the controller (M-UF11)', () => {
  const replies = (...answers) => {
    const queue = [...answers]
    global.fetch = vi.fn(async () => {
      const next = queue.shift()
      if (next instanceof Error) throw next
      return next
    })
  }
  const answer = (body, { ok = true, status = ok ? 200 : 500, statusText = '' } = {}) => ({
    ok,
    status,
    statusText,
    json: async () => {
      if (body === undefined) throw new SyntaxError('Unexpected end of JSON input')
      return body
    }
  })
  const Probe = ({ metaFieldsList, actionState, handleDeleteMetaField, handeAddMetaField }) => (
    <div>
      <output data-testid='state'>{JSON.stringify({ list: metaFieldsList, action: actionState })}</output>
      <button type='button' onClick={() => handleDeleteMetaField(2)}>delete</button>
      <button type='button' onClick={() => handeAddMetaField({ key: 'k', user_id: 7, value: 'v', value_type: 'text' })}>add</button>
    </div>
  )
  const state = () => JSON.parse(screen.getByTestId('state').textContent)
  const mountController = async () => {
    render(<UserMetaFieldsController userId={7} UIComponent={Probe} />)
    await waitFor(() => expect(state().list.loading).toBe(false))
  }
  const stored = [{ id: 1, key: 'a' }, { id: 2, key: 'b' }]

  afterEach(() => { delete global.fetch })

  it('loads the fields of the user with its token', async () => {
    replies(answer({ result: stored }))
    await mountController()
    expect(global.fetch).toHaveBeenCalledWith('https://api.test/v4/users/7/metafields', expect.objectContaining({ method: 'GET', headers: expect.objectContaining({ Authorization: 'Bearer tkn' }) }))
    expect(state().list.metaFields).toEqual(stored)
  })

  it('keeps the fields an array and records the error when the API answers an error', async () => {
    replies(answer({ error: true, result: 'Unauthorized' }, { ok: false, status: 401 }))
    await mountController()
    expect(Array.isArray(state().list.metaFields)).toBe(true)
    expect(state().list.metaFields).toEqual([])
    expect(state().list.error).toBe('Unauthorized')
  })

  it('keeps the fields an array when the API answers an error with a 200', async () => {
    replies(answer({ error: true, result: ['Not allowed'] }))
    await mountController()
    expect(state().list.metaFields).toEqual([])
    expect(state().list.error).toEqual(['Not allowed'])
  })

  it('records the message of a request that fails', async () => {
    replies(new TypeError('Failed to fetch'))
    await mountController()
    expect(state().list.metaFields).toEqual([])
    expect(state().list.error).toBe('Failed to fetch')
  })

  it('deletes and filters the list', async () => {
    replies(answer({ result: stored }), answer({ result: 'ok' }))
    const user = userEvent.setup()
    await mountController()
    await user.click(screen.getByRole('button', { name: 'delete' }))
    await waitFor(() => expect(state().list.metaFields).toEqual([{ id: 1, key: 'a' }]))
    expect(global.fetch).toHaveBeenLastCalledWith('https://api.test/v4/users/7/metafields/2', expect.objectContaining({ method: 'DELETE' }))
    expect(state().action).toEqual({ loading: false, result: { error: false } })
  })

  it('ends the loading and records the error when the delete is refused', async () => {
    replies(answer({ result: stored }), answer({ error: true, result: ['Not allowed'] }, { ok: false, status: 403 }))
    const user = userEvent.setup()
    await mountController()
    await user.click(screen.getByRole('button', { name: 'delete' }))
    await waitFor(() => expect(state().action.loading).toBe(false))
    expect(state().action.result).toEqual({ error: true, result: ['Not allowed'] })
    expect(state().list.metaFields).toEqual(stored)
  })

  it('uses the status text when the refusal has no body', async () => {
    replies(answer({ result: stored }), answer(undefined, { ok: false, status: 502, statusText: 'Bad Gateway' }))
    const user = userEvent.setup()
    await mountController()
    await user.click(screen.getByRole('button', { name: 'delete' }))
    await waitFor(() => expect(state().action.loading).toBe(false))
    expect(state().action.result).toEqual({ error: true, result: 'Bad Gateway' })
  })

  it('ends the loading and records the message when the delete request throws', async () => {
    replies(answer({ result: stored }), new TypeError('Failed to fetch'))
    const user = userEvent.setup()
    await mountController()
    await user.click(screen.getByRole('button', { name: 'delete' }))
    await waitFor(() => expect(state().action.loading).toBe(false))
    expect(state().action.result).toEqual({ error: true, result: 'Failed to fetch' })
  })

  it('adds with the body it is given and appends what the API returns', async () => {
    replies(answer({ result: stored }), answer({ result: { id: 3, key: 'k' } }))
    const user = userEvent.setup()
    await mountController()
    await user.click(screen.getByRole('button', { name: 'add' }))
    await waitFor(() => expect(state().list.metaFields).toHaveLength(3))
    const [url, options] = global.fetch.mock.calls[1]
    expect(url).toBe('https://api.test/v4/users/7/metafields')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ key: 'k', user_id: 7, value: 'v', value_type: 'text' })
  })

  it('records the error of an add the API refuses', async () => {
    replies(answer({ result: stored }), answer({ error: true, result: 'Key already exists' }))
    const user = userEvent.setup()
    await mountController()
    await user.click(screen.getByRole('button', { name: 'add' }))
    await waitFor(() => expect(state().action.result).toEqual({ error: true, result: 'Key already exists' }))
    expect(state().list.metaFields).toEqual(stored)
  })
})

// Decision 6 A · the saved places of the other user panels.
describe('the saved places of the other user panels (decision 6 A)', () => {
  const hostTheme = createDashboardTheme(brandTheme)
  const userState = { loading: false, user: { id: 5, name: 'Ana', lastname: 'Díaz', addresses: [{ id: 1, address: 'Home street 1' }] } }
  const hosts = [
    ['Users/UserDetails', (extra) => <UsersUserDetailsUI userState={userState} setExtraOpen={vi.fn()} handleSuccessUserUpdate={vi.fn()} {...extra} />]
  ]

  describe.each(hosts)('%s', (_name, host) => {
    it('lists the addresses with the embedded list, which owns its own form', async () => {
      renderWithProviders(host(), { theme: hostTheme, initialEntries: ['/?tab=saved_places'] })
      expect(await screen.findByTestId('address-list')).toBeInTheDocument()
      expect(runtime.addressList.isEmbedded).toBe(true)
      expect(runtime.addressList.isSeletectedUserAddresses).toBe(true)
      expect(runtime.addressList.userId).toBe(5)
      expect(runtime.addressList.addresses).toEqual(userState.user.addresses)
    })

    it('does not hand the list the setter that widens the side bar to a second, empty column', async () => {
      const setExtraOpen = vi.fn()
      renderWithProviders(host({ setExtraOpen }), { theme: hostTheme, initialEntries: ['/?tab=saved_places'] })
      await screen.findByTestId('address-list')
      expect(runtime.addressList).not.toHaveProperty('setExtraOpen')
      // the host itself still tells the bar it is not extended when the tab changes
      expect(setExtraOpen).not.toHaveBeenCalledWith(true)
    })

    it('does not draw the list on another tab', () => {
      renderWithProviders(host(), { theme: hostTheme, initialEntries: ['/?tab=profile'] })
      expect(screen.queryByTestId('address-list')).not.toBeInTheDocument()
    })
  })
})

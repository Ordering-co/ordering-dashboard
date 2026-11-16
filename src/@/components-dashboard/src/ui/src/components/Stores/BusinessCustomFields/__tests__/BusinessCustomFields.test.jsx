/* eslint-disable import/first */
// redesign stores 5.16 (; G2-31, G2-32): the custom fields of a store are S/MetaFieldsEditor under an h1, wired to the REAL
// BusinessMetaFields controller (only the network and the session are stand-ins), so the whole path is covered: the requests of
// before (GET only without the `metafields` prop; POST `{ business_id, key, value, value_type }`; DELETE by id), the delete that asks
// first and only runs on Confirm, a refused delete that keeps the row and says why (no spinner left on), a refused add, a failed load
// with Retry instead of the empty state, and the two callbacks the host passes (the store editor's section).
// Connect mounted it inside a P/Dialog until ; the nested-dialog contract stays covered below.
import React, { useState } from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  ordering: { root: 'https://api.test' },
  fetch: vi.fn()
}))

const mockModule = vi.hoisted(() => async () => {
  const { BusinessMetaFields } = await import('../../../../../../components/BusinessMetaFields')
  return {
    useLanguage: () => [{}, (_key, text) => text],
    BusinessMetaFields
  }
})
// `~components` and the relative index are the same module: both mocks must say the same
vi.mock('../../../../../../index', mockModule)
vi.mock('~components', mockModule)
vi.mock('../../../../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token' }]
}))
vi.mock('../../../../../../contexts/ApiContext', () => ({
  useApi: () => [mocks.ordering]
}))
// the editor of today, reduced to a button that types `{ "a": 1 }` into it
vi.mock('jsoneditor-react', () => ({
  JsonEditor: ({ onChange }) => <button type='button' data-testid='json-editor' onClick={() => onChange({ a: 1 })}>edit json</button>
}))

import { Dialog } from '../../../Shared/Product'
import { BusinessCustomFields } from '../index'

const BUSINESS_ID = 7
const BASE = `https://api.test/business/${BUSINESS_ID}/metafields`
const FIELDS = [
  { id: 1, key: 'color', value: 'red', value_type: 'text' },
  { id: 2, key: 'gift', value: '0', value_type: 'boolean' }
]
const NEW_FIELD = { id: 9, key: 'size', value: 'large', value_type: 'text' }

const reply = (content, ok = true) => () => Promise.resolve({ ok, json: async () => content })
const never = () => new Promise(() => {})

let routes
const callsOf = (method) => mocks.fetch.mock.calls.filter(([, options]) => options.method === method)

const keyInput = () => screen.getByRole('textbox', { name: /^Key/ })
const valueInput = () => screen.getByRole('textbox', { name: /^Value/ })
const addButton = () => screen.getByRole('button', { name: 'Add field' })
const deleteButton = (key) => screen.getByRole('button', { name: `Delete field ${key}` })
// `hidden`: while a confirmation is open the page behind it is inert, and the rows are still there to be counted
const rowsText = () => within(screen.getByRole('list', { hidden: true })).getAllByRole('listitem', { hidden: true }).map(row => row.textContent)

beforeEach(() => {
  mocks.fetch.mockReset()
  routes = {
    get: reply({ error: false, result: FIELDS }),
    post: reply({ error: false, result: NEW_FIELD }),
    delete: reply({ error: false, result: true })
  }
  mocks.fetch.mockImplementation((url, options) => {
    if (options.method === 'GET') return routes.get()
    if (options.method === 'POST') return routes.post()
    if (options.method === 'DELETE') return routes.delete()
    throw new Error(`unexpected request ${options.method} ${url}`)
  })
  vi.stubGlobal('fetch', mocks.fetch)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// the section of the store editor, as StoreSectionBody mounts it
const hostProps = (overrides = {}) => ({
  businessId: BUSINESS_ID,
  metafields: FIELDS,
  handleSuccessAddMetaFields: vi.fn(),
  handleSuccessDeleteBusinessMetaFields: vi.fn(),
  ...overrides
})
const renderSection = (overrides = {}) => {
  const props = hostProps(overrides)
  const utils = render(<BusinessCustomFields {...props} />)
  return { ...utils, props }
}

describe('BusinessCustomFields · the section', () => {
  it('titles the section with an h1 and draws the fields in the editor, with no fetch when the store brings them', () => {
    renderSection()
    expect(screen.getByRole('heading', { level: 1, name: 'Custom fields' })).toBeTruthy()
    const rows = rowsText()
    expect(rows).toHaveLength(2)
    expect(rows[0]).toContain('color')
    expect(rows[1]).toContain('False') // a boolean reads as True / False
    expect(screen.getByRole('form', { name: 'Add field' })).toBeTruthy()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('without the metafields prop it asks the API once and shows a skeleton, not the empty text, while it waits', async () => {
    routes.get = never
    const { container } = renderSection({ metafields: undefined })
    expect(container.querySelector('.odc-mfe-skeleton')).not.toBeNull()
    expect(screen.queryByText('No custom fields yet.')).toBeNull()
    await waitFor(() => expect(callsOf('GET')).toHaveLength(1))
    expect(callsOf('GET')[0][0]).toBe(BASE)
  })

  it('shows what the API answers', async () => {
    renderSection({ metafields: undefined })
    await waitFor(() => expect(rowsText()).toHaveLength(2))
    expect(callsOf('GET')).toHaveLength(1)
  })

  it('says it is empty only when it is', () => {
    renderSection({ metafields: [] })
    expect(screen.getByText('No custom fields yet.')).toBeTruthy()
  })

  it('says why it could not load, with Retry, instead of saying there are none; Retry asks again and recovers', async () => {
    const user = userEvent.setup()
    routes.get = reply({ error: true, result: ['Not authorized'] })
    renderSection({ metafields: undefined })
    const notice = await screen.findByRole('alert')
    expect(notice.textContent).toContain('Not authorized')
    expect(screen.queryByText('No custom fields yet.')).toBeNull()
    routes.get = reply({ error: false, result: FIELDS })
    await user.click(within(notice).getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(rowsText()).toHaveLength(2))
    expect(callsOf('GET')).toHaveLength(2)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('says why it could not load when the call itself fails', async () => {
    routes.get = () => Promise.reject(new Error('Network down'))
    renderSection({ metafields: undefined })
    expect((await screen.findByRole('alert')).textContent).toContain('Network down')
    expect(screen.queryByText('No custom fields yet.')).toBeNull()
  })
})

describe('BusinessCustomFields · add', () => {
  it('sends { business_id, key, value, value_type } to the store, shows the new row, empties the form and tells the host', async () => {
    const user = userEvent.setup()
    const { props } = renderSection()
    await user.type(keyInput(), 'size')
    await user.type(valueInput(), 'large')
    await user.click(addButton())
    await waitFor(() => expect(callsOf('POST')).toHaveLength(1))
    const [url, options] = callsOf('POST')[0]
    expect(url).toBe(BASE)
    expect(options.headers.Authorization).toBe('Bearer test-token')
    // the body of before: toEqual does not care about the order of the keys, the list of keys is exact
    const body = JSON.parse(options.body)
    expect(body).toEqual({ business_id: BUSINESS_ID, key: 'size', value: 'large', value_type: 'text' })
    expect(Object.keys(body).sort()).toEqual(['business_id', 'key', 'value', 'value_type'])
    await waitFor(() => expect(rowsText()).toHaveLength(3))
    expect(rowsText()[2]).toContain('size')
    expect(rowsText()[2]).toContain('large')
    await waitFor(() => expect(keyInput()).toHaveValue(''))
    expect(valueInput()).toHaveValue('')
    expect(props.handleSuccessAddMetaFields).toHaveBeenCalledTimes(1)
    expect(props.handleSuccessAddMetaFields).toHaveBeenCalledWith(NEW_FIELD)
  })

  it('adds a boolean and a json value with the types the API knows', async () => {
    const user = userEvent.setup()
    renderSection()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'json')
    await user.type(keyInput(), 'meta')
    await user.click(screen.getByTestId('json-editor'))
    await user.click(addButton())
    await waitFor(() => expect(callsOf('POST')).toHaveLength(1))
    expect(JSON.parse(callsOf('POST')[0][1].body)).toEqual({ business_id: BUSINESS_ID, key: 'meta', value: '{"a":1}', value_type: 'json' })
  })

  it('keeps what was typed, says why and tells nobody when the API refuses the add', async () => {
    const user = userEvent.setup()
    routes.post = reply({ error: true, result: ['Key already exists'] })
    const { props } = renderSection()
    await user.type(keyInput(), 'color')
    await user.type(valueInput(), 'blue')
    await user.click(addButton())
    const notice = await screen.findByRole('alert')
    expect(notice.textContent).toContain('Key already exists')
    expect(keyInput()).toHaveValue('color')
    expect(valueInput()).toHaveValue('blue')
    expect(rowsText()).toHaveLength(2)
    expect(props.handleSuccessAddMetaFields).not.toHaveBeenCalled()
    expect(document.querySelector('[aria-busy="true"]')).toBeNull()
  })

  it('says it could not add when the network fails', async () => {
    const user = userEvent.setup()
    routes.post = () => Promise.reject(new Error('Network down'))
    renderSection()
    await user.type(keyInput(), 'color')
    await user.type(valueInput(), 'blue')
    await user.click(addButton())
    expect((await screen.findByRole('alert')).textContent).toContain('Network down')
    expect(rowsText()).toHaveLength(2)
  })

  it('asks for the key and the value before it calls the API', async () => {
    const user = userEvent.setup()
    renderSection()
    await user.click(addButton())
    expect(screen.getByText('Enter a key.')).toBeTruthy()
    expect(screen.getByText('Enter a value.')).toBeTruthy()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('shows each field once when the store editor hands the new list back after the success', async () => {
    const user = userEvent.setup()
    // the store editor keeps the metafields of the business and passes them back down: the list follows the prop
    const Host = () => {
      const [metafields, setMetafields] = useState(FIELDS)
      return (
        <BusinessCustomFields
          businessId={BUSINESS_ID}
          metafields={metafields}
          handleSuccessAddMetaFields={result => setMetafields(current => [...current, result])}
          handleSuccessDeleteBusinessMetaFields={id => setMetafields(current => current.filter(item => item.id !== id))}
        />
      )
    }
    render(<Host />)
    await user.type(keyInput(), 'size')
    await user.type(valueInput(), 'large')
    await user.click(addButton())
    await waitFor(() => expect(rowsText()).toHaveLength(3))
    await user.click(deleteButton('color'))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete field' }))
    await waitFor(() => expect(rowsText()).toHaveLength(2))
    expect(rowsText().map(text => text.includes('color'))).toEqual([false, false])
    expect(callsOf('GET')).toHaveLength(0)
  })
})

describe('BusinessCustomFields · delete', () => {
  it('asks first and does not call the API until Confirm; Cancel leaves everything as it was', async () => {
    const user = userEvent.setup()
    const { props } = renderSection()
    await user.click(deleteButton('color'))
    const confirm = await screen.findByRole('alertdialog')
    expect(within(confirm).getByText('Delete field "color"?')).toBeTruthy()
    expect(within(confirm).getByText("This can't be undone.")).toBeTruthy()
    expect(callsOf('DELETE')).toHaveLength(0)
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(callsOf('DELETE')).toHaveLength(0)
    expect(rowsText()).toHaveLength(2)
    expect(props.handleSuccessDeleteBusinessMetaFields).not.toHaveBeenCalled()
  })

  it('on Confirm it deletes that field, removes the row and tells the host', async () => {
    const user = userEvent.setup()
    const { props } = renderSection()
    await user.click(deleteButton('gift'))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete field' }))
    await waitFor(() => expect(callsOf('DELETE')).toHaveLength(1))
    const [url, options] = callsOf('DELETE')[0]
    expect(url).toBe(`${BASE}/2`)
    expect(options.headers.Authorization).toBe('Bearer test-token')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(rowsText()).toHaveLength(1))
    expect(rowsText()[0]).toContain('color')
    expect(props.handleSuccessDeleteBusinessMetaFields).toHaveBeenCalledTimes(1)
    expect(props.handleSuccessDeleteBusinessMetaFields).toHaveBeenCalledWith(2)
  })

  it('G2-31: a refused delete keeps the row, says why, tells nobody and leaves nothing spinning', async () => {
    const user = userEvent.setup()
    routes.delete = reply({ result: ['Field is in use'] }, false)
    const { props } = renderSection()
    await user.click(deleteButton('color'))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete field' }))
    const dialog = screen.getByRole('alertdialog')
    const notice = await within(dialog).findByRole('alert')
    expect(notice.textContent).toContain('Field is in use')
    expect(callsOf('DELETE')).toHaveLength(1)
    expect(rowsText()).toHaveLength(2)
    expect(props.handleSuccessDeleteBusinessMetaFields).not.toHaveBeenCalled()
    expect(within(dialog).getByRole('button', { name: 'Delete field' }).getAttribute('aria-busy')).toBeNull()
    expect(within(dialog).getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(false)
    expect(document.querySelector('[aria-busy="true"]')).toBeNull()
    // it can be given up
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(rowsText()).toHaveLength(2)
  })

  it('G2-31: a delete that fails with an answer that is not JSON also ends, with the status as the reason', async () => {
    const user = userEvent.setup()
    routes.delete = () => Promise.resolve({ ok: false, status: 500, statusText: '', json: async () => { throw new SyntaxError('Unexpected token <') } })
    renderSection()
    await user.click(deleteButton('color'))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete field' }))
    const notice = await within(screen.getByRole('alertdialog')).findByRole('alert')
    expect(notice.textContent).toContain('HTTP 500')
    expect(rowsText()).toHaveLength(2)
    expect(document.querySelector('[aria-busy="true"]')).toBeNull()
  })

  it('a delete that fails on the network says why and keeps the row', async () => {
    const user = userEvent.setup()
    routes.delete = () => Promise.reject(new Error('Network down'))
    renderSection()
    await user.click(deleteButton('color'))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete field' }))
    expect((await within(screen.getByRole('alertdialog')).findByRole('alert')).textContent).toContain('Network down')
    expect(rowsText()).toHaveLength(2)
  })
})

describe('BusinessCustomFields · inside a P/Dialog', () => {
  // How Connect (PosStorePanel) mounted it until the very same component inside a P/Dialog, with the same four props.
  const renderInDialog = (overrides = {}) => {
    const props = hostProps(overrides)
    const utils = render(
      <Dialog open onOpenChange={() => {}} size='md' title='Custom fields' closeLabel='Close'>
        <BusinessCustomFields {...props} />
      </Dialog>
    )
    return { ...utils, props }
  }

  it('lists the fields of the store inside the dialog', () => {
    renderInDialog()
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('list')).toBeTruthy()
    expect(within(dialog).getByRole('form', { name: 'Add field' })).toBeTruthy()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('still asks before deleting; only Confirm calls the API and tells the host', async () => {
    const user = userEvent.setup()
    const { props } = renderInDialog()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete field color' }))
    const confirm = await screen.findByRole('alertdialog')
    expect(within(confirm).getByText('Delete field "color"?')).toBeTruthy()
    expect(callsOf('DELETE')).toHaveLength(0)
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(callsOf('DELETE')).toHaveLength(0)
    // the Dialog of Connect is still there after the question closes
    expect(screen.getByRole('dialog')).toBeTruthy()

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete field color' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete field' }))
    await waitFor(() => expect(callsOf('DELETE')).toHaveLength(1))
    expect(callsOf('DELETE')[0][0]).toBe(`${BASE}/1`)
    await waitFor(() => expect(props.handleSuccessDeleteBusinessMetaFields).toHaveBeenCalledWith(1))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('keeps the row and says why when the delete is refused inside the dialog too', async () => {
    const user = userEvent.setup()
    routes.delete = reply({ result: ['Field is in use'] }, false)
    const { props } = renderInDialog()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete field color' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete field' }))
    expect((await within(screen.getByRole('alertdialog')).findByRole('alert')).textContent).toContain('Field is in use')
    expect(props.handleSuccessDeleteBusinessMetaFields).not.toHaveBeenCalled()
    expect(document.querySelector('[aria-busy="true"]')).toBeNull()
  })

  it('adds a field and tells the host', async () => {
    const user = userEvent.setup()
    const { props } = renderInDialog()
    await user.type(keyInput(), 'size')
    await user.type(valueInput(), 'large')
    await user.click(addButton())
    await waitFor(() => expect(props.handleSuccessAddMetaFields).toHaveBeenCalledWith(NEW_FIELD))
    expect(JSON.parse(callsOf('POST')[0][1].body)).toEqual({ business_id: BUSINESS_ID, key: 'size', value: 'large', value_type: 'text' })
  })
})

describe('BusinessCustomFields · source', () => {
  const source = readFileSync(path.resolve(__dirname, '../index.js'), 'utf8')

  it('is the editor under an h1: none of the legacy form, spinner, alert or DOM lookups are left', () => {
    expect(source).toMatch(/MetaFieldsEditor/)
    expect(source).not.toMatch(/react-hook-form|useForm/)
    expect(source).not.toMatch(/react-loading-skeleton|@meronex/)
    expect(source).not.toMatch(/SpinnerLoader|\bAlert\b|IconButton/)
    expect(source).not.toMatch(/getElementById/)
    expect(source).not.toMatch(/jsoneditor-react/)
    expect(source).not.toMatch(/from '\.\/styles'|styled-components/)
  })
})

/* eslint-disable import/first */
import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// Redesign 5.3-C: the fields tab runs the REAL MetaFields controller (same GET, POST and DELETE as today).
const t = (key, fallback) => fallback ?? key

vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'token' }] }))
vi.mock('../../../../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'https://api.test' }] }))
vi.mock('../../../../../../index', async () => {
  const { MetaFields } = await vi.importActual('../../../../../../components/MetaFields')
  return { MetaFields, useLanguage: () => [{}, t] }
})
vi.mock('jsoneditor-react', () => ({ JsonEditor: () => <div data-testid='json-editor' /> }))

import { FieldsTab } from '../FieldsTab'

const FIELDS = [
  { id: 7, key: 'dispatch_note', value: 'Gate 4', value_type: 'text' },
  { id: 8, key: 'gift', value: '0', value_type: 'boolean' },
  { id: 9, key: 'weight', value: '12', value_type: 'integer' }
]

const mockApi = ({ fields = FIELDS, postError } = {}) => {
  global.fetch = vi.fn(async (url, options) => {
    if (options?.method === 'POST') {
      return postError
        ? { ok: true, json: async () => ({ error: true, result: postError }) }
        : { ok: true, json: async () => ({ error: false, result: { id: 50, ...JSON.parse(options.body) } }) }
    }
    if (options?.method === 'DELETE') return { ok: true, json: async () => ({}) }
    return { ok: true, json: async () => ({ error: false, result: fields }) }
  })
}

const renderFields = () => renderWithProviders(<FieldsTab order={{ order: { id: 42 }, loading: false }} onSelectTab={vi.fn()} />)
const callsWith = (method) => global.fetch.mock.calls.filter(([, options]) => options?.method === method)

describe('FieldsTab: custom fields', () => {
  beforeEach(() => mockApi())

  it('reads the fields of the order from the same endpoint', async () => {
    renderFields()
    await screen.findByText('dispatch_note')
    expect(global.fetch.mock.calls[0][0]).toBe('https://api.test/orders/42/metafields')
  })

  it('is a table with visible Key, Value and Type labels', async () => {
    renderFields()
    const table = await screen.findByRole('table', { name: 'Custom fields' })
    expect(within(table).getAllByRole('columnheader').map(cell => cell.textContent.trim())).toEqual(['Key', 'Value', 'Type', 'Actions'])
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(3)
    expect(within(rows[0]).getByText('dispatch_note')).toBeInTheDocument()
    expect(within(rows[0]).getByText('Gate 4')).toBeInTheDocument()
    expect(within(rows[0]).getByText('text')).toBeInTheDocument()
  })

  it('writes booleans as true or false, like today', async () => {
    renderFields()
    const row = (await screen.findByText('gift')).closest('tr')
    expect(within(row).getByText('false')).toBeInTheDocument()
  })

  it('keeps long keys and values readable: the key is mono and left-to-right', async () => {
    renderFields()
    const key = await screen.findByText('dispatch_note')
    expect(key).toHaveClass('odc-mono')
    expect(key.closest('[dir]')).toHaveAttribute('dir', 'ltr')
  })

  it('shows an empty state with the way to add the first one', async () => {
    mockApi({ fields: [] })
    renderFields()
    expect(await screen.findByText('No custom fields yet')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Key' })).toBeInTheDocument()
  })

  it('shows a skeleton while the fields load', () => {
    global.fetch = vi.fn(() => new Promise(() => {}))
    const { container } = renderFields()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })
})

describe('FieldsTab: add', () => {
  beforeEach(() => mockApi())

  it('posts the payload of today: key, order_id, value and value_type', async () => {
    renderFields()
    await screen.findByText('dispatch_note')
    await userEvent.type(screen.getByRole('textbox', { name: 'Key' }), 'priority')
    await userEvent.type(screen.getByRole('textbox', { name: 'Value' }), 'high')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(callsWith('POST')).toHaveLength(1))
    const [url, options] = callsWith('POST')[0]
    expect(url).toBe('https://api.test/orders/42/metafields')
    expect(options.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer token' })
    expect(JSON.parse(options.body)).toEqual({ key: 'priority', order_id: 42, value: 'high', value_type: 'text' })
    expect(await screen.findByText('priority')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Key' })).toHaveValue(''))
  })

  it('sends booleans as 1 or 0 and numbers as typed, with their type', async () => {
    renderFields()
    await screen.findByText('dispatch_note')
    // redesign 5.3 audit-1: the type and the boolean value are dropdowns (a group named by its label),
    // no longer native selects; the payload asserted below is the same.
    await userEvent.click(within(screen.getByRole('group', { name: 'Type' })).getByRole('button'))
    await userEvent.click(await screen.findByRole('option', { name: 'boolean' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Key' }), 'vip')
    await userEvent.click(within(screen.getByRole('group', { name: 'Value' })).getByRole('button'))
    await userEvent.click(await screen.findByRole('option', { name: 'false' }))
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(callsWith('POST')).toHaveLength(1))
    expect(JSON.parse(callsWith('POST')[0][1].body)).toEqual({ key: 'vip', order_id: 42, value: '0', value_type: 'boolean' })
  })

  it('asks for a key and a value before sending anything', async () => {
    renderFields()
    await screen.findByText('dispatch_note')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Key is required')
    expect(alert).toHaveTextContent('Value is required')
    expect(callsWith('POST')).toHaveLength(0)
  })

  it('validates an integer like today', async () => {
    renderFields()
    await screen.findByText('dispatch_note')
    // redesign 5.3 audit-1: the type is a Select of Shared/UI, no longer a native select
    await userEvent.click(within(screen.getByRole('group', { name: 'Type' })).getByRole('button'))
    await userEvent.click(await screen.findByRole('option', { name: 'integer' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Key' }), 'qty')
    await userEvent.type(screen.getByRole('textbox', { name: 'Value' }), 'abc')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid integer')
    expect(callsWith('POST')).toHaveLength(0)
  })

  it('shows what the server refused', async () => {
    mockApi({ postError: ['Key already exists'] })
    renderFields()
    await screen.findByText('dispatch_note')
    await userEvent.type(screen.getByRole('textbox', { name: 'Key' }), 'dispatch_note')
    await userEvent.type(screen.getByRole('textbox', { name: 'Value' }), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Key already exists')
  })
})

describe('FieldsTab: delete', () => {
  beforeEach(() => mockApi())

  // redesign W0-12 (T0-47, M-05): the DELETE of today, but only after the confirmation (C8). Fetch is counted.
  it('asks first: the click sends no DELETE, confirm sends exactly one, named after the key', async () => {
    renderFields()
    await screen.findByText('dispatch_note')
    await userEvent.click(screen.getByRole('button', { name: 'Delete dispatch_note' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveAccessibleName('Delete custom field “dispatch_note”?')
    expect(callsWith('DELETE')).toHaveLength(0)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Keep field' })).toHaveFocus())
    await userEvent.click(screen.getByRole('button', { name: 'Delete field' }))
    await waitFor(() => expect(callsWith('DELETE')).toHaveLength(1))
    expect(callsWith('DELETE')[0][0]).toBe('https://api.test/orders/42/metafields/7')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.queryByText('dispatch_note')).not.toBeInTheDocument())
    expect(callsWith('DELETE')).toHaveLength(1)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete gift' })).toHaveFocus())
  })

  it('Cancel sends no DELETE and keeps the field', async () => {
    renderFields()
    await screen.findByText('dispatch_note')
    const remove = screen.getByRole('button', { name: 'Delete dispatch_note' })
    await userEvent.click(remove)
    await userEvent.click(await screen.findByRole('button', { name: 'Keep field' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(callsWith('DELETE')).toHaveLength(0)
    expect(screen.getByText('dispatch_note')).toBeInTheDocument()
    await waitFor(() => expect(remove).toHaveFocus())
  })

  it('a refusal of the API shows in the dialog and the field stays', async () => {
    global.fetch = vi.fn(async (url, options) => {
      if (options?.method === 'DELETE') return { ok: false, json: async () => ({ error: true, result: ['Not allowed'] }) }
      return { ok: true, json: async () => ({ error: false, result: FIELDS }) }
    })
    renderFields()
    await screen.findByText('dispatch_note')
    await userEvent.click(screen.getByRole('button', { name: 'Delete dispatch_note' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Delete field' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed')
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText('dispatch_note')).toBeInTheDocument()
    expect(callsWith('DELETE')).toHaveLength(1)
  })
})

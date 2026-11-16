/* eslint-disable import/first */
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

// redesign 5.3 audit-1 (FD-5): the type (and the boolean value) use the Select of Shared/UI instead of the native
// select, and the key of a field is never split in the middle of a word when there is room for it.
const readCss = () => readFileSync(resolve(__dirname, '..', 'activity-tab.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rulesFor = (css, selector) => [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
  .filter(([, selectors]) => selectors.split(',').map(item => item.trim()).includes(selector))
  .map(([, , declarations]) => declarations)

const pick = async (trigger, optionName) => {
  await userEvent.click(trigger)
  await userEvent.click(await screen.findByRole('option', { name: optionName }))
}

describe('FieldsTab — the type is a Select (FD-5)', () => {
  beforeEach(() => mockApi())

  // redesign F6a (D-15): the select is the C18 dropdown (FirstSelect) now, not the Base UI Select of Shared/UI;
  // FieldsTab.d15.test.jsx pins the anatomy, this keeps «not native, inside a group named Type».
  it('is not a native select: it is the dropdown of the orders surfaces inside a group named Type', async () => {
    const { container } = renderFields()
    await screen.findByText('dispatch_note')
    expect(container.querySelector('select')).toBeNull()
    const group = screen.getByRole('group', { name: 'Type' })
    const root = group.querySelector('.od-first-select-root')
    expect(root).not.toBeNull()
    expect(within(root).getByRole('button')).toHaveTextContent('text')
  })

  it('offers the five types and keeps the type chosen', async () => {
    renderFields()
    await screen.findByText('dispatch_note')
    const group = screen.getByRole('group', { name: 'Type' })
    await userEvent.click(within(group).getByRole('button'))
    expect((await screen.findAllByRole('option')).map(option => option.textContent)).toEqual(['integer', 'decimal', 'boolean', 'text', 'json'])
    await userEvent.click(screen.getByRole('option', { name: 'integer' }))
    expect(within(screen.getByRole('group', { name: 'Type' })).getByRole('button')).toHaveTextContent('integer')
  })

  it('posts the same payload with the type chosen in the Select (integer)', async () => {
    renderFields()
    await screen.findByText('dispatch_note')
    await pick(within(screen.getByRole('group', { name: 'Type' })).getByRole('button'), 'integer')
    await userEvent.type(screen.getByRole('textbox', { name: 'Key' }), 'qty')
    await userEvent.type(screen.getByRole('textbox', { name: 'Value' }), '12')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(callsWith('POST')).toHaveLength(1))
    expect(JSON.parse(callsWith('POST')[0][1].body)).toEqual({ key: 'qty', order_id: 42, value: '12', value_type: 'integer' })
  })

  it('a boolean value is a Select too, sent as 1 or 0', async () => {
    const { container } = renderFields()
    await screen.findByText('dispatch_note')
    await pick(within(screen.getByRole('group', { name: 'Type' })).getByRole('button'), 'boolean')
    expect(container.querySelector('select')).toBeNull()
    const value = within(screen.getByRole('group', { name: 'Value' })).getByRole('button')
    expect(value).toHaveTextContent('true')
    await pick(value, 'false')
    await userEvent.type(screen.getByRole('textbox', { name: 'Key' }), 'vip')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(callsWith('POST')).toHaveLength(1))
    expect(JSON.parse(callsWith('POST')[0][1].body)).toEqual({ key: 'vip', order_id: 42, value: '0', value_type: 'boolean' })
  })
})

describe('FieldsTab — the key keeps its words (FD-5)', () => {
  beforeEach(() => mockApi({ fields: [{ id: 7, key: 'hash_key', value: 'abc', value_type: 'text' }] }))

  it('marks the key cell so the column can keep it whole', async () => {
    renderFields()
    const key = await screen.findByText('hash_key')
    expect(key.closest('td')).toHaveClass('odt-fld-key')
    expect(key).toHaveClass('odc-mono')
  })

  it('only breaks the key when it does not fit (break-word), while the value may shrink first (anywhere)', () => {
    const css = readCss()
    const key = rulesFor(css, '.odt-fld-key').join(' ')
    expect(key).toMatch(/overflow-wrap:\s*break-word/)
    expect(key).not.toMatch(/overflow-wrap:\s*anywhere/)
    const others = rulesFor(css, '.odt-fld-table td:not(.odt-fld-key)').join(' ')
    expect(others).toMatch(/overflow-wrap:\s*anywhere/)
    // no rule gives anywhere to the key cell too
    expect(rulesFor(css, '.odt-fld-table td').join(' ')).not.toMatch(/overflow-wrap:\s*anywhere/)
  })
})

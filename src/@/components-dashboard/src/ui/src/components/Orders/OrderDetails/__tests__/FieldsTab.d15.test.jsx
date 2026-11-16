/* eslint-disable import/first */
// redesign F6a (D-15): the Type select of the custom fields (and the boolean value) is the C18 dropdown: a brand
// field trigger with a chevron, a listbox of 32px rows with a check on the chosen one. Same options, same payload.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const t = (key, fallback) => fallback ?? key

vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'token' }] }))
vi.mock('../../../../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'https://api.test' }] }))
vi.mock('../../../../../../index', async () => {
  const { MetaFields } = await vi.importActual('../../../../../../components/MetaFields')
  return { MetaFields, useLanguage: () => [{}, t] }
})
vi.mock('jsoneditor-react', () => ({ JsonEditor: () => <div data-testid='json-editor' /> }))

import { FieldsTab } from '../FieldsTab'

beforeEach(() => {
  global.fetch = vi.fn(async (url, options) => {
    if (options?.method === 'POST') return { ok: true, json: async () => ({ error: false, result: { id: 50, ...JSON.parse(options.body) } }) }
    return { ok: true, json: async () => ({ error: false, result: [] }) }
  })
})

const renderFields = () => renderWithProviders(<FieldsTab order={{ order: { id: 42 }, loading: false }} onSelectTab={vi.fn()} />)
const typeTrigger = () => within(screen.getByRole('group', { name: 'Type' })).getByRole('button')

describe('FieldsTab Type select · C18 anatomy', () => {
  it('is the brand dropdown (FirstSelect with the trigger-fit list), not the legacy Base UI select', async () => {
    const { container } = renderFields()
    await screen.findByText('No custom fields yet')
    const root = screen.getByRole('group', { name: 'Type' }).querySelector('.od-first-select-root')
    expect(root).not.toBeNull()
    expect(root).toHaveAttribute('data-fit', 'trigger')
    expect(container.querySelector('[data-slot="select-root"]')).toBeNull()
    expect(typeTrigger()).toHaveTextContent('text')
    expect(typeTrigger()).toHaveAccessibleName(/Type/)
  })

  it('lists the five types as 32px C18 rows, marks the chosen one with a check and keeps the choice', async () => {
    const user = userEvent.setup()
    renderFields()
    await screen.findByText('No custom fields yet')
    await user.click(typeTrigger())
    const list = screen.getByRole('listbox')
    expect(within(list).getAllByRole('option').map(option => option.textContent)).toEqual(['integer', 'decimal', 'boolean', 'text', 'json'])
    expect(within(list).getByRole('option', { name: 'text' })).toHaveAttribute('aria-selected', 'true')
    expect(within(list).getByRole('option', { name: 'text' }).querySelector('.od-first-select-check svg')).not.toBeNull()
    await user.click(within(list).getByRole('option', { name: 'integer' }))
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(typeTrigger()).toHaveTextContent('integer')
    expect(typeTrigger()).toHaveFocus()
  })

  it('sends the same payload: boolean value 1/0 chosen in the same kind of dropdown', async () => {
    const user = userEvent.setup()
    renderFields()
    await screen.findByText('No custom fields yet')
    await user.click(typeTrigger())
    await user.click(await screen.findByRole('option', { name: 'boolean' }))
    const value = within(screen.getByRole('group', { name: 'Value' })).getByRole('button')
    expect(value.closest('.od-first-select-root')).toHaveAttribute('data-fit', 'trigger')
    await user.click(value)
    await user.click(await screen.findByRole('option', { name: 'false' }))
    await user.type(screen.getByRole('textbox', { name: 'Key' }), 'vip')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(global.fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1))
    const [, options] = global.fetch.mock.calls.find(([, options]) => options?.method === 'POST')
    expect(JSON.parse(options.body)).toEqual({ key: 'vip', order_id: 42, value: '0', value_type: 'boolean' })
  })

  it('the select takes the width of the form field', () => {
    const css = readFileSync(path.resolve(__dirname, '../../OrderDetails/activity-tab.css'), 'utf8')
    expect(css).toMatch(/\.odt-fld \.odt-fld-select[^{]*\{[^}]*inline-size:\s*100%/)
  })
})

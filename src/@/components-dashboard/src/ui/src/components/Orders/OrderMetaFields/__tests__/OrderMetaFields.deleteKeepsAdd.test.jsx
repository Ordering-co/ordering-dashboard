/* eslint-disable import/first */
// redesign tramo A r2 (W0-PA1-05): a refused DELETE must not empty what the user typed in «Add». Real controller and
// real UI together (the UI-only tests pass the actionState by hand and could not see it).
import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'https://api.test/v1/en/p' }] }))
vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'tok' }] }))
vi.mock('../../../../../../index', async () => {
  const { MetaFields } = await import('../../../../../../components/MetaFields')
  return { MetaFields, useLanguage: () => [null, (_key, fallback) => fallback] }
})
vi.mock('jsoneditor-react', () => ({ JsonEditor: () => <div /> }))

import { OrderMetaFields } from '..'

describe('OrderMetaFields · a refused delete keeps the Add form', () => {
  afterEach(() => vi.unstubAllGlobals())

  const stubFetch = (deleteResponse) => vi.stubGlobal('fetch', vi.fn(async (url, options) => {
    if (options.method === 'GET') return { ok: true, json: async () => ({ result: [{ id: 7, key: 'dispatch_note', value: 'Gate 4', value_type: 'text' }] }) }
    if (options.method === 'DELETE') return deleteResponse
    return { ok: true, json: async () => ({ error: false, result: { id: 9, key: 'priority', value: 'high', value_type: 'text' } }) }
  }))

  const typeInAdd = async () => {
    await screen.findByText('dispatch_note')
    fireEvent.change(screen.getByRole('textbox', { name: 'Key' }), { target: { value: 'priority' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Value' }), { target: { value: 'high' } })
  }

  it('keeps the text when the DELETE is refused', async () => {
    stubFetch({ ok: false, json: async () => ({ error: true, result: ['Not allowed'] }) })
    renderWithProviders(<OrderMetaFields orderId={42} />)
    await typeInAdd()
    fireEvent.click(screen.getByRole('button', { name: 'Delete dispatch_note' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete field' }))
    await screen.findByText('Not allowed')
    // the open dialog hides the form from the accessibility tree: read the inputs by id
    expect(document.getElementById('meta_key')).toHaveValue('priority')
    expect(document.getElementById('meta_value')).toHaveValue('high')
  })

  // redesign tramo A r4 (W0-PA2-04): as on main, a delete that goes well empties «Add» again
  it('empties the form when the DELETE goes well, as on main', async () => {
    stubFetch({ ok: true })
    renderWithProviders(<OrderMetaFields orderId={42} />)
    await typeInAdd()
    fireEvent.click(screen.getByRole('button', { name: 'Delete dispatch_note' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete field' }))
    await waitFor(() => expect(screen.queryByText('dispatch_note')).toBeNull())
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Key' })).toHaveValue(''))
    expect(screen.getByRole('textbox', { name: 'Value' })).toHaveValue('')
  })

  it('still empties the form when an ADD succeeds', async () => {
    stubFetch({ ok: true })
    renderWithProviders(<OrderMetaFields orderId={42} />)
    await typeInAdd()
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Key' })).toHaveValue(''))
    expect(screen.getByRole('textbox', { name: 'Value' })).toHaveValue('')
  })
})

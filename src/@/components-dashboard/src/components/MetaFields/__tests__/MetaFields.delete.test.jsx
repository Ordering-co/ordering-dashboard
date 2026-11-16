import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MetaFields } from '..'

vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'https://api.test/v1/en/p' }] }))
vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'tok' }] }))

// redesign W0-12 (T0-47, M-05): the controller answers the delete to the caller, and a refusal no longer leaves
// `loading` on with no message. Fetch is counted: the GET of the list, then the DELETE.
describe('MetaFields controller · delete', () => {
  afterEach(() => vi.unstubAllGlobals())

  const mount = async (deleteResponse) => {
    const calls = []
    vi.stubGlobal('fetch', vi.fn(async (url, options) => {
      calls.push([options.method, url])
      if (options.method === 'GET') {
        return { ok: true, json: async () => ({ result: [{ id: 7, key: 'a' }, { id: 8, key: 'b' }] }) }
      }
      return deleteResponse
    }))
    const seen = { props: null }
    const UI = (props) => { seen.props = props; return null }
    render(<MetaFields orderId={42} UIComponent={UI} />)
    await waitFor(() => expect(seen.props.metaFieldsList.loading).toBe(false))
    return { seen, calls }
  }

  it('removes the field and answers no error when the API accepts', async () => {
    const { seen, calls } = await mount({ ok: true })
    let outcome
    await React.act(async () => { outcome = await seen.props.handleDeleteMetaField(7) })
    expect(outcome).toEqual({ error: false })
    expect(calls.filter(([method]) => method === 'DELETE')).toEqual([['DELETE', 'https://api.test/v1/en/p/orders/42/metafields/7']])
    expect(seen.props.metaFieldsList.metaFields.map(field => field.id)).toEqual([8])
  })

  it('keeps the field, stops loading and answers the message when the API refuses', async () => {
    const { seen } = await mount({ ok: false, json: async () => ({ error: true, result: ['Not allowed'] }) })
    let outcome
    await React.act(async () => { outcome = await seen.props.handleDeleteMetaField(7) })
    expect(outcome).toEqual({ error: true, result: 'Not allowed' })
    expect(seen.props.metaFieldsList.metaFields.map(field => field.id)).toEqual([7, 8])
    expect(seen.props.actionState.loading).toBe(false)
  })

  it('answers the error of a network failure and keeps the field', async () => {
    const { seen } = await mount({ ok: false, json: async () => { throw new Error('bad body') } })
    let outcome
    await React.act(async () => { outcome = await seen.props.handleDeleteMetaField(8) })
    expect(outcome).toEqual({ error: true, result: '' })
    expect(seen.props.metaFieldsList.metaFields).toHaveLength(2)
  })
})

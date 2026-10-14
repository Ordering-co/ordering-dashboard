/* eslint-disable import/first */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', loading: false, user: { level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test/v400/en/demo' }]
}))

import { PayoutRules } from '../index'

const platformRule = { fixed: 1, percentage: 10, percentage_base: 'subtotal' }

let lastResult
const UI = ({ ruleState, handleSaveRule, handleInheritRule }) => (
  <>
    <output data-testid='state'>{JSON.stringify(ruleState)}</output>
    <button onClick={async () => { lastResult = await handleSaveRule({ fixed: '2.50', percentage: '5', percentage_base: 'total' }) }}>
      save
    </button>
    {handleInheritRule && (
      <button onClick={async () => { lastResult = await handleInheritRule() }}>inherit</button>
    )}
  </>
)

const answer = (result, error = false) => ({ ok: !error, json: async () => ({ error, result }) })
const readState = () => JSON.parse(screen.getByTestId('state').textContent)

describe('PayoutRules controller', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    lastResult = undefined
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads the global rule of the scope', async () => {
    fetchMock.mockResolvedValue(answer({ scope: 'platform', rule: platformRule }))

    render(<PayoutRules UIComponent={UI} scope='platform' />)

    await waitFor(() => expect(readState().loading).toBe(false))
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.test/v400/en/demo/payout_rules/platform')
    expect(options.method).toBeUndefined()
    expect(options.headers.Authorization).toBe('Bearer test-token')
    expect(readState()).toEqual({ loading: false, error: null, rule: platformRule, override: null })
    expect(screen.queryByText('inherit')).not.toBeInTheDocument()
  })

  it('keeps a scope without a rule as null', async () => {
    fetchMock.mockResolvedValue(answer({ scope: 'driver', rule: null }))

    render(<PayoutRules UIComponent={UI} scope='driver' />)

    await waitFor(() => expect(readState().loading).toBe(false))
    expect(readState().rule).toBeNull()
  })

  it('saves the rule whole and keeps what the API answers', async () => {
    const saved = { fixed: 2.5, percentage: 5, percentage_base: 'total' }
    fetchMock
      .mockResolvedValueOnce(answer({ scope: 'platform', rule: platformRule }))
      .mockResolvedValueOnce(answer({ scope: 'platform', rule: saved }))

    render(<PayoutRules UIComponent={UI} scope='platform' />)
    await waitFor(() => expect(readState().loading).toBe(false))

    await act(async () => { screen.getByText('save').click() })

    const [url, options] = fetchMock.mock.calls[1]
    expect(url).toBe('https://api.test/v400/en/demo/payout_rules/platform')
    expect(options.method).toBe('PUT')
    expect(JSON.parse(options.body)).toEqual(saved)
    expect(lastResult.error).toBe(false)
    expect(readState().rule).toEqual(saved)
  })

  it('answers the error of a save and leaves the rule as it was', async () => {
    fetchMock
      .mockResolvedValueOnce(answer({ scope: 'platform', rule: platformRule }))
      .mockResolvedValueOnce(answer(['Somebody else saved this rule'], true))

    render(<PayoutRules UIComponent={UI} scope='platform' />)
    await waitFor(() => expect(readState().loading).toBe(false))

    await act(async () => { screen.getByText('save').click() })

    expect(lastResult).toEqual({ error: true, result: ['Somebody else saved this rule'] })
    expect(readState().rule).toEqual(platformRule)
  })

  it('reads, saves and removes the rule of an owner', async () => {
    const own = { fixed: 2.5, percentage: 5, percentage_base: 'total' }
    fetchMock
      .mockResolvedValueOnce(answer({ scope: 'platform', owner_id: 41, override: null, effective: platformRule }))
      .mockResolvedValueOnce(answer({ scope: 'platform', owner_id: 41, override: own, effective: own }))
      .mockResolvedValueOnce(answer({ scope: 'platform', owner_id: 41, override: null, effective: platformRule }))

    render(<PayoutRules UIComponent={UI} scope='platform' ownerId={41} />)
    await waitFor(() => expect(readState().loading).toBe(false))
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/v400/en/demo/payout_rules/platform/41')
    expect(readState()).toMatchObject({ rule: platformRule, override: null })

    await act(async () => { screen.getByText('save').click() })
    expect(fetchMock.mock.calls[1][1].method).toBe('PUT')
    expect(readState()).toMatchObject({ rule: own, override: own })

    await act(async () => { screen.getByText('inherit').click() })
    expect(fetchMock.mock.calls[2][0]).toBe('https://api.test/v400/en/demo/payout_rules/platform/41')
    expect(fetchMock.mock.calls[2][1].method).toBe('DELETE')
    expect(readState()).toMatchObject({ rule: platformRule, override: null })
  })
})

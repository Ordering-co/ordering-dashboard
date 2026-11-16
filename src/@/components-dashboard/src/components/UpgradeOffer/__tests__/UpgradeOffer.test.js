/* eslint-disable import/first */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { mockFetch, mockFetchError } from '../../../../../../__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({
  token: 'a-token',
  root: 'https://api.example.com'
}))

vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: mocks.root }]
}))
vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: mocks.token }]
}))

import { UpgradeOffer } from '..'

const Probe = ({ offer }) => <pre data-testid='offer'>{JSON.stringify(offer)}</pre>

describe('UpgradeOffer controller', () => {
  afterEach(() => {
    mocks.token = 'a-token'
    vi.restoreAllMocks()
  })

  it('passes the offer through to UIComponent', async () => {
    mockFetch({ error: false, result: { id: 812, language: 'en' } })
    render(<UpgradeOffer UIComponent={Probe} />)
    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('offer').textContent)).toEqual({ id: 812, language: 'en' })
    })
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/billing/subscriptions/upgrade-offer',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer a-token' }) })
    )
  })

  it('offer is null when the API says there is no offer', async () => {
    mockFetch({ error: false, result: null })
    render(<UpgradeOffer UIComponent={Probe} />)
    await waitFor(() => {
      expect(screen.getByTestId('offer').textContent).toBe('null')
    })
  })

  it('offer is null on error:true', async () => {
    mockFetch({ error: true, result: 'not allowed' })
    render(<UpgradeOffer UIComponent={Probe} />)
    await waitFor(() => {
      expect(screen.getByTestId('offer').textContent).toBe('null')
    })
  })

  it('offer is null on a non-ok response', async () => {
    mockFetch({ error: false, result: { id: 1 } }, { ok: false, status: 500 })
    render(<UpgradeOffer UIComponent={Probe} />)
    await waitFor(() => {
      expect(screen.getByTestId('offer').textContent).toBe('null')
    })
  })

  it('offer is null on a network error', async () => {
    mockFetchError('network down')
    render(<UpgradeOffer UIComponent={Probe} />)
    await waitFor(() => {
      expect(screen.getByTestId('offer').textContent).toBe('null')
    })
  })

  it('does not fetch without a token', () => {
    mocks.token = null
    global.fetch = vi.fn()
    render(<UpgradeOffer UIComponent={Probe} />)
    expect(global.fetch).not.toHaveBeenCalled()
    expect(screen.getByTestId('offer').textContent).toBe('null')
  })
})

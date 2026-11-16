/* eslint-disable import/first */
// redesign bugs F row 41 (M-05): confirming «create site» asked GET /business/{id}/sites/current twice, once from
// handleConfirmCreate and once from the effect that runs when handleUpdateBusinessState gives the business its new site_id.
import React, { useState } from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token' }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test/v400/en/demo' }]
}))

import { BusinessWhiteLabel } from '../index'

const json = (body) => ({ json: async () => body })
const fetchMock = vi.fn()
const sitesCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('/sites/current')).map(([url]) => url)

let ui
const UI = (props) => {
  ui = props
  return null
}

// handleUpdateBusinessState works like the parent: it stores the business it is given and rerenders the controller with it
let setBusinessFromOutside
const Host = ({ initial }) => {
  const [business, setBusiness] = useState(initial)
  setBusinessFromOutside = setBusiness
  return <BusinessWhiteLabel UIComponent={UI} business={business} handleUpdateBusinessState={setBusiness} />
}

beforeEach(() => {
  ui = null
  fetchMock.mockReset()
  fetchMock.mockImplementation(async () => json({ error: false, result: { site: { id: 5 }, theme: { id: 8 } } }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BusinessWhiteLabel controller · site loading', () => {
  it('confirming the creation of a business without site_id asks GET sites/current once', async () => {
    render(<Host initial={{ id: 1 }} />)
    expect(ui.confirmCreate).toBe(true)
    expect(sitesCalls()).toHaveLength(0)
    await act(async () => { await ui.handleConfirmCreate() })
    await waitFor(() => expect(ui.siteCurrentState.site).toEqual({ id: 5 }))
    expect(ui.confirmCreate).toBe(false)
    expect(sitesCalls()).toEqual(['https://api.test/v400/en/demo/business/1/sites/current'])
  })

  it('a business that already has a site_id loads it once on mount', async () => {
    render(<Host initial={{ id: 1, site_id: 5 }} />)
    await waitFor(() => expect(ui.siteCurrentState.site).toEqual({ id: 5 }))
    expect(sitesCalls()).toHaveLength(1)
  })

  it('a different business loads again, also after one that was just created', async () => {
    render(<Host initial={{ id: 1 }} />)
    await act(async () => { await ui.handleConfirmCreate() })
    await waitFor(() => expect(ui.siteCurrentState.site).toEqual({ id: 5 }))
    expect(sitesCalls()).toHaveLength(1)
    await act(async () => { setBusinessFromOutside({ id: 2, site_id: 5 }) })
    await waitFor(() => expect(sitesCalls()).toHaveLength(2))
    expect(sitesCalls()[1]).toBe('https://api.test/v400/en/demo/business/2/sites/current')
  })

  it('the same business with another site_id loads again', async () => {
    render(<Host initial={{ id: 1 }} />)
    await act(async () => { await ui.handleConfirmCreate() })
    await waitFor(() => expect(ui.siteCurrentState.site).toEqual({ id: 5 }))
    await act(async () => { setBusinessFromOutside({ id: 1, site_id: 6 }) })
    await waitFor(() => expect(sitesCalls()).toHaveLength(2))
  })

  it('handleRetry still asks again', async () => {
    render(<Host initial={{ id: 1, site_id: 5 }} />)
    await waitFor(() => expect(ui.siteCurrentState.site).toEqual({ id: 5 }))
    await act(async () => { await ui.handleRetry() })
    expect(sitesCalls()).toHaveLength(2)
  })
})

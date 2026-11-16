/* eslint-disable import/first */
// redesign bugs F row 41 (M-05): confirming «create site» asked GET /franchises/{id}/sites/current twice, once from
// handleConfirmCreate and once from the effect that runs when handleUpdateBrand gives the brand its new site_id.
import React, { useState } from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token' }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test/v400/en/demo' }]
}))

import { BrandWhiteLabel } from '../index'

const json = (body) => ({ json: async () => body })
const fetchMock = vi.fn()
const sitesCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('/sites/current')).map(([url]) => url)

let ui
const UI = (props) => {
  ui = props
  return null
}

// handleUpdateBrand works like the parent: it stores the brand it is given and rerenders the controller with it
let setBrandFromOutside
const Host = ({ initial }) => {
  const [brand, setBrand] = useState(initial)
  setBrandFromOutside = setBrand
  return <BrandWhiteLabel UIComponent={UI} brand={brand} handleUpdateBrand={setBrand} />
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

describe('BrandWhiteLabel controller · site loading', () => {
  it('confirming the creation of a brand without site_id asks GET sites/current once', async () => {
    render(<Host initial={{ id: 1 }} />)
    expect(ui.confirmCreate).toBe(true)
    expect(sitesCalls()).toHaveLength(0)
    await act(async () => { await ui.handleConfirmCreate() })
    await waitFor(() => expect(ui.siteCurrentState.site).toEqual({ id: 5 }))
    expect(ui.confirmCreate).toBe(false)
    expect(sitesCalls()).toEqual(['https://api.test/v400/en/demo/franchises/1/sites/current'])
  })

  it('a brand that already has a site_id loads it once on mount', async () => {
    render(<Host initial={{ id: 1, site_id: 5 }} />)
    await waitFor(() => expect(ui.siteCurrentState.site).toEqual({ id: 5 }))
    expect(sitesCalls()).toHaveLength(1)
  })

  it('a different brand loads again, also after one that was just created', async () => {
    render(<Host initial={{ id: 1 }} />)
    await act(async () => { await ui.handleConfirmCreate() })
    await waitFor(() => expect(ui.siteCurrentState.site).toEqual({ id: 5 }))
    expect(sitesCalls()).toHaveLength(1)
    await act(async () => { setBrandFromOutside({ id: 2, site_id: 5 }) })
    await waitFor(() => expect(sitesCalls()).toHaveLength(2))
    expect(sitesCalls()[1]).toBe('https://api.test/v400/en/demo/franchises/2/sites/current')
  })

  it('the same brand with another site_id loads again', async () => {
    render(<Host initial={{ id: 1 }} />)
    await act(async () => { await ui.handleConfirmCreate() })
    await waitFor(() => expect(ui.siteCurrentState.site).toEqual({ id: 5 }))
    await act(async () => { setBrandFromOutside({ id: 1, site_id: 6 }) })
    await waitFor(() => expect(sitesCalls()).toHaveLength(2))
  })

  it('handleRetry still asks again', async () => {
    render(<Host initial={{ id: 1, site_id: 5 }} />)
    await waitFor(() => expect(ui.siteCurrentState.site).toEqual({ id: 5 }))
    await act(async () => { await ui.handleRetry() })
    expect(sitesCalls()).toHaveLength(2)
  })
})

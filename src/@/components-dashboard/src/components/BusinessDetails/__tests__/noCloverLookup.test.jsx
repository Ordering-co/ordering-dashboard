/* eslint-disable import/first */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  level: 0
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { id: 7, level: mocks.level } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test/v400/en/demo', project: 'demo' }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [null, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback]
}))
vi.mock('../../../contexts/EventContext', () => ({
  useEvent: () => [{ on: vi.fn(), off: vi.fn(), emit: vi.fn() }]
}))
vi.mock('../../../contexts/AssistantContext', () => ({
  useAssistantRecordChanges: () => {}
}))

import { BusinessDetails } from '../index'

// main 4b7ff4f9 + owner decision 1A: the store no longer installs or connects Clover; Clover is connected from
// Connect › POS. So the store's controller asks for no integration list and hands the store no Clover state or handlers.
const business = { id: 42, name: 'Demo' }

let controller
const UI = (props) => {
  controller = props
  return null
}

describe('BusinessDetails without Clover in the store', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('asks for no integration list, even for an admin, and hands no Clover state or handlers', async () => {
    mocks.level = 0
    const fetchMock = vi.fn(() => Promise.resolve({ json: async () => ({ error: false, result: [] }) }))
    vi.stubGlobal('fetch', fetchMock)
    render(<BusinessDetails UIComponent={UI} businessId={42} business={business} notGetSites notGetTaxes notGetStreamConnection />)
    await waitFor(() => expect(controller).not.toBeNull())
    await act(async () => { await Promise.resolve() })
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/third_party_integrations'))).toBe(false)
    expect(controller).not.toHaveProperty('cloverState')
    expect(controller).not.toHaveProperty('handleSyncClover')
    expect(controller).not.toHaveProperty('handleInstallClover')
  })
})

/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { id: 7, level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => {
  const chain = () => new Proxy(function () {}, {
    get: (target, prop) => {
      if (prop === 'then') return undefined
      if (prop === 'get') return mocks.get
      return () => chain()
    },
    apply: () => chain()
  })
  const ordering = new Proxy({}, {
    get: (target, prop) => {
      if (prop === 'root') return 'https://api.test/v400/en/demo'
      if (prop === 'then') return undefined
      return () => chain()
    }
  })
  return { useApi: () => [ordering] }
})
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [null, { showToast: vi.fn() }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback]
}))

import { PosMenuBusinessDetails } from '../index'

let latest
const UI = (props) => {
  latest = props
  return null
}

/**
 * The list's Refresh also reads the open store panel again (refreshSignal).
 * Before, the panel kept the store it was opened with until it was closed.
 */
describe('PosMenuBusinessDetails refreshSignal', () => {
  it('reads the store again on each new signal, and not before', async () => {
    mocks.get.mockResolvedValue({ content: { error: false, result: { id: 42, name: 'Store', third_party_integrations: [{ id: 1, setup_status: 'success' }] } } })
    const business = { id: 42, name: 'Store', third_party_integrations: [] }
    const { rerender } = render(<PosMenuBusinessDetails UIComponent={UI} businessId={42} business={business} asDashboard refreshSignal={0} />)

    expect(mocks.get).not.toHaveBeenCalled()

    rerender(<PosMenuBusinessDetails UIComponent={UI} businessId={42} business={business} asDashboard refreshSignal={1} />)

    await waitFor(() => expect(latest.businessState.business.third_party_integrations).toHaveLength(1))
    expect(mocks.get).toHaveBeenCalledTimes(1)
  })
})

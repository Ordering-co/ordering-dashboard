/* eslint-disable import/first */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const { captureDashboardOperation } = vi.hoisted(() => ({
  captureDashboardOperation: vi.fn()
}))

vi.mock('../posthog', () => ({ captureDashboardOperation }))

import { useTrackedLoadState } from '../useTrackedLoadState'

describe('useTrackedLoadState', () => {
  beforeEach(() => captureDashboardOperation.mockClear())

  it('can report only the first load lifecycle per mount', () => {
    const { rerender } = renderHook(
      ({ loading }) => useTrackedLoadState({
        loading,
        error: null,
        module: 'orders',
        action: 'load_orders',
        once: true
      }),
      { initialProps: { loading: false } }
    )

    rerender({ loading: true })
    rerender({ loading: false })
    rerender({ loading: true })
    rerender({ loading: false })

    expect(captureDashboardOperation).toHaveBeenCalledTimes(2)
    expect(captureDashboardOperation).toHaveBeenNthCalledWith(1, {
      status: 'started', module: 'orders', action: 'load_orders'
    })
    expect(captureDashboardOperation).toHaveBeenNthCalledWith(2, {
      status: 'succeeded', module: 'orders', action: 'load_orders'
    })
  })
})

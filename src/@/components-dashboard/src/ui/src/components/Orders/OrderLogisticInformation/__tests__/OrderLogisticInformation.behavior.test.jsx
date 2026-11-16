/* eslint-disable import/first */
import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  LogisticInformation: ({ UIComponent, ...props }) => <UIComponent {...props} />,
  useConfig: () => [{ configs: {} }],
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{
    parseDate: value => value,
    parseNumber: value => String(value)
  }]
}))

vi.mock('../../../../styles', () => ({
  Button: ({ children, ...props }) => {
    const domProps = { ...props }
    delete domProps.color
    delete domProps.rectangle
    return <button {...domProps}>{children}</button>
  }
}))

import { OrderLogisticInformation } from '..'

describe('OrderLogisticInformation behavior', () => {
  it('keeps the existing reload callback and exposes a 44px control', () => {
    const getLogistics = vi.fn()
    renderWithProviders(
      <OrderLogisticInformation
        orderId={42}
        getLogistics={getLogistics}
        logisticInformation={{
          loading: false,
          error: null,
          data: {
            distance_customer_from_business: 1000,
            queues: [],
            logistic_attempts: []
          }
        }}
      />
    )

    const reload = screen.getByRole('button', { name: 'Reload' })
    expect(reload).toHaveAttribute('type', 'button')
    expect(getComputedStyle(reload).minHeight).toBe('44px')
    fireEvent.click(reload)
    expect(getLogistics).toHaveBeenCalledTimes(1)
  })

  it('announces the existing logistics error without changing its content', () => {
    renderWithProviders(
      <OrderLogisticInformation
        orderId={42}
        getLogistics={vi.fn()}
        logisticInformation={{ loading: false, error: 'Unable to load logistics' }}
      />
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load logistics')
  })
})

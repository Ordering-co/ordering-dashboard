/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'

import { renderWithProviders, defaultTheme } from '~/__tests__/helpers/testUtils'

const mockConfigs = { current: {} }

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: {} }],
  useConfig: () => [{ configs: mockConfigs.current }],
  useUtils: () => [{
    parsePrice: (value) => `$${value}`,
    parseDistance: (value) => `${value}km`,
    optimizeImage: (value) => value
  }]
}))

vi.mock('../../../../hooks/useWindowSize', () => ({
  useWindowSize: () => ({ width: 1200 })
}))

vi.mock('../../../Shared', () => ({
  SearchBar: () => null,
  DragScroll: ({ children }) => <div>{children}</div>
}))

import { BusinessPreview } from '..'

const business = {
  id: 1,
  name: 'Test store',
  open: true,
  delivery_price: 5,
  delivery_time: '00:30',
  pickup_time: '00:15',
  categories: [
    {
      id: 10,
      name: 'Food',
      products: [{ id: 100, name: 'Burger', price: 8, inventoried: true, quantity: 3 }]
    }
  ]
}

const theme = {
  ...defaultTheme,
  images: { general: {}, logos: {}, dummies: {} }
}

const renderPreview = () => renderWithProviders(<BusinessPreview business={business} />, { theme })

describe('BusinessPreview', () => {
  beforeEach(() => {
    mockConfigs.current = {}
  })

  it('previews delivery when delivery is allowed and is the default order type', () => {
    mockConfigs.current = {
      order_types_allowed: { value: '1|2' },
      default_order_type: { value: 'delivery' }
    }

    renderPreview()

    expect(screen.getByText('Delivery')).toBeInTheDocument()
    expect(screen.getByText('Delivery fee')).toBeInTheDocument()
    expect(screen.getByText('30min')).toBeInTheDocument()
  })

  it('previews pickup when the default order type is not delivery', () => {
    mockConfigs.current = {
      order_types_allowed: { value: '1|2' },
      default_order_type: { value: 'pickup' }
    }

    renderPreview()

    expect(screen.getByText('Pickup')).toBeInTheDocument()
    expect(screen.queryByText('Delivery fee')).not.toBeInTheDocument()
    expect(screen.getByText('15min')).toBeInTheDocument()
  })

  it('previews pickup when delivery is not an allowed order type', () => {
    mockConfigs.current = {
      order_types_allowed: { value: '2|3' },
      default_order_type: { value: 'delivery' }
    }

    renderPreview()

    expect(screen.getByText('Pickup')).toBeInTheDocument()
    expect(screen.queryByText('Delivery fee')).not.toBeInTheDocument()
  })

  it('does not mark in-stock products as sold out', () => {
    mockConfigs.current = { order_types_allowed: { value: '1' } }

    renderPreview()

    expect(screen.getByText('Burger')).toBeInTheDocument()
    expect(screen.queryByText('SOLD OUT')).not.toBeInTheDocument()
  })
})

/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mockConfigs = { current: {} }
const mockController = { current: {} }
const mockSearch = { current: null }

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useEvent: () => [{ emit: vi.fn() }],
  useConfig: () => [{ configs: mockConfigs.current }],
  GoogleMapsMap: () => null,
  BusinessAdd: ({ UIComponent, ...props }) => (
    <UIComponent {...props} formState={{ changes: {} }} paymethodIds={[]} gallery={[]} {...mockController.current} />
  )
}))

vi.mock('../../GoogleBusinessSearch', () => ({
  GoogleBusinessSearch: (props) => { mockSearch.current = props; return null }
}))

vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: vi.fn() }]
}))

vi.mock('../BusinessDetails', () => ({ BusinessDetails: () => null }))
vi.mock('../Images', () => ({ Images: () => null }))
vi.mock('../Schedule', () => ({ Schedule: () => null }))
vi.mock('../Photos', () => ({ Photos: () => null }))
vi.mock('../OrderTypePriceLevel', () => ({ OrderTypePriceLevel: () => null }))
vi.mock('../PaymentMethods', () => ({ PaymentMethods: () => null }))
vi.mock('../ReceiveOrders', () => ({ ReceiveOrders: () => null }))
vi.mock('../DeliveryZone', () => ({
  DeliveryZone: ({ disabled }) => <div data-testid='delivery-zone' data-disabled={String(!!disabled)} />
}))
vi.mock('../../../Shared', () => ({ Alert: () => null, Modal: () => null }))

import { BusinessAdd } from '..'

describe('BusinessAdd', () => {
  beforeEach(() => {
    mockConfigs.current = {}
    mockController.current = {}
    mockSearch.current = null
  })

  it('applies the business confirmed in the add-store modal without fetching it again', () => {
    const googleBusiness = { placeId: 'place-1', name: 'Joe’s' }

    renderWithProviders(<BusinessAdd placeId='place-1' googleBusiness={googleBusiness} />)

    expect(mockSearch.current.initialBusiness).toBe(googleBusiness)
    expect(mockSearch.current.initialPlaceId).toBeUndefined()
    expect(mockSearch.current.photoRoles).toEqual(['gallery', 'header', 'logo'])
  })

  it('loads the place from the URL when there is no confirmed business in the navigation state', () => {
    renderWithProviders(<BusinessAdd placeId='place-2' />)

    expect(mockSearch.current.initialPlaceId).toBe('place-2')
  })

  it('maps Google data to the business form fields', () => {
    renderWithProviders(<BusinessAdd />)

    const fields = mockSearch.current.getFields({
      name: 'Joe’s Pizza',
      phone: '+1 212',
      address: '7 Carmine St',
      location: { lat: 1, lng: 2 },
      zipcode: '10014',
      timezone: 'America/New_York',
      schedule: [{ enabled: false }],
      priceLevel: 0
    })

    expect(fields).toEqual({
      name: { name: 'Joe’s Pizza', slug: 'joes_pizza' },
      phone: { cellphone: '+1 212' },
      address: { address: '7 Carmine St', location: { lat: 1, lng: 2, zipcode: '10014', zoom: 15 }, timezone: 'America/New_York' },
      schedule: { schedule: [{ enabled: false }] },
      priceLevel: { price_level: null }
    })
  })

  it('sends Google schedule changes to the schedule state used on submit', () => {
    const handleChangeSchedule = vi.fn()
    const changeFormState = vi.fn()
    mockController.current = { handleChangeSchedule, changeFormState }
    renderWithProviders(<BusinessAdd />)

    mockSearch.current.onChange({ schedule: [{ enabled: true }], name: 'Joe’s' })

    expect(handleChangeSchedule).toHaveBeenCalledWith([{ enabled: true }])
    expect(changeFormState).toHaveBeenCalledWith({ schedule: [{ enabled: true }], name: 'Joe’s' })
  })

  it('adds chosen Google photos to the gallery, logo and header', () => {
    const handleChangeGallery = vi.fn()
    const changeFormState = vi.fn()
    mockController.current = { handleChangeGallery, changeFormState, gallery: [{ temp_id: 'old', file: 'data:old' }] }
    renderWithProviders(<BusinessAdd />)

    mockSearch.current.onPhotos([
      { role: 'gallery', file: 'data:gallery' },
      { role: 'logo', file: 'data:logo' },
      { role: 'header', file: 'data:header' }
    ])

    expect(handleChangeGallery).toHaveBeenCalledWith([
      { temp_id: 'old', file: 'data:old' },
      expect.objectContaining({ file: 'data:gallery', type: 1, temp_id: expect.any(String) })
    ])
    expect(changeFormState).toHaveBeenCalledWith({ logo: 'data:logo', header: 'data:header' })
  })

  it('enables the delivery zone when delivery is an allowed order type', () => {
    mockConfigs.current = { order_types_allowed: { value: '1|2|3' } }

    renderWithProviders(<BusinessAdd />)

    expect(screen.getByTestId('delivery-zone')).toHaveAttribute('data-disabled', 'false')
  })

  it('disables the delivery zone when delivery is not an allowed order type', () => {
    mockConfigs.current = { order_types_allowed: { value: '2|3' } }

    renderWithProviders(<BusinessAdd />)

    expect(screen.getByTestId('delivery-zone')).toHaveAttribute('data-disabled', 'true')
  })

  it('disables the delivery zone when the order types config is missing', () => {
    renderWithProviders(<BusinessAdd />)

    expect(screen.getByTestId('delivery-zone')).toHaveAttribute('data-disabled', 'true')
  })
})

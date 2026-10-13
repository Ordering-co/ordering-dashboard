/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{ parseNumber: (value) => value }],
  useConfig: () => [{ configs: {} }],
  BusinessZoneGoogleMaps: () => null
}))

vi.mock('../../../../../styles/Select/FirstSelect', () => ({ Select: () => null }))
vi.mock('../../../../../styles', () => ({ Input: (props) => <input {...props} /> }))
vi.mock('../../../../Shared', () => ({ Alert: () => null }))

import { DeliveryZone } from '..'

const disabledText = 'The delivery order type is disabled for your project. Enable it in Settings to create delivery zones.'

const renderZone = (props = {}) => renderWithProviders(
  <DeliveryZone
    formState={{ changes: {} }}
    zoneState={{}}
    handleChangeZoneState={vi.fn()}
    {...props}
  />
)

describe('DeliveryZone', () => {
  it('opens the zone form when the header is clicked', () => {
    renderZone()

    fireEvent.click(screen.getByText('Let’s create your first Delivery Zone'))

    expect(screen.getByText('Minimum purchase')).toBeInTheDocument()
    expect(screen.queryByText(disabledText)).not.toBeInTheDocument()
  })

  it('shows the disabled message and keeps the form closed when disabled', () => {
    renderZone({ disabled: true })

    fireEvent.click(screen.getByText('Let’s create your first Delivery Zone'))

    expect(screen.getByText(disabledText)).toBeInTheDocument()
    expect(screen.queryByText('Minimum purchase')).not.toBeInTheDocument()
  })
})

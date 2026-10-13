import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useConfig: () => [{
    configs: {
      addon_catering: { value: '1' },
      format_time: { id: 91, key: 'format_time', value: '24' },
      dates_moment_format: { id: 92, key: 'dates_moment_format', value: 'MM-DD HH:mm' }
    }
  }]
}))

vi.mock('../../SettingsSelectUI', () => ({
  SettingsSelectUI: ({ config, handleSelectChange }) => (
    <button type='button' onClick={() => handleSelectChange('v3')}>
      {config?.name || config?.key}
    </button>
  )
}))

import { SettingsCustomBlocks } from '../index'

describe('SettingsCustomBlocks', () => {
  it('renders a date preview and keeps leftover keys out', () => {
    renderWithProviders(
      <SettingsCustomBlocks
        configs={[
          { id: 1, key: 'dates_general_format', value: 'YYYY-MM-DD HH:mm:ss' },
          { id: 2, key: 'reject_orders_enabled', value: '1' }
        ]}
        handleInputChange={() => {}}
      />
    )

    expect(screen.getByText('Date and time')).toBeInTheDocument()
    expect(screen.getByText('Scheduled order date')).toBeInTheDocument()
    expect(screen.getByText('09-14')).toBeInTheDocument()
    expect(screen.queryByText('Allow businesses to reject orders')).not.toBeInTheDocument()
    expect(screen.getByText('When set, dashboard, invoices and scheduled orders use this format. Scheduled orders still hide the year.')).toBeInTheDocument()
    expect(document.getElementById('settings-focus-dates_general_format')).toBeTruthy()
  })

  it('swaps reCAPTCHA keys when the version changes', () => {
    const handleInputChange = vi.fn()
    const { rerender } = renderWithProviders(
      <SettingsCustomBlocks
        configs={[
          { id: 10, key: 'security_recaptcha_type', value: 'v2', name: 'Version' },
          { id: 11, key: 'security_recaptcha_site_key', value: 'v2-site', name: 'Site key' },
          { id: 12, key: 'security_recaptcha_site_key_v3', value: 'v3-site', name: 'Site key v3' }
        ]}
        handleInputChange={handleInputChange}
      />
    )

    expect(screen.getByDisplayValue('v2-site')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('v3-site')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Version'), { target: { value: 'v3' } })
    expect(handleInputChange).toHaveBeenCalledWith('v3_only', 10)

    rerender(
      <SettingsCustomBlocks
        configs={[
          { id: 10, key: 'security_recaptcha_type', value: 'v3_only', name: 'Version' },
          { id: 11, key: 'security_recaptcha_site_key', value: 'v2-site', name: 'Site key' },
          { id: 12, key: 'security_recaptcha_site_key_v3', value: 'v3-site', name: 'Site key v3' }
        ]}
        handleInputChange={handleInputChange}
      />
    )

    expect(screen.getByDisplayValue('v3-site')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('v2-site')).not.toBeInTheDocument()
  })

  it('shows both key sets and blocks enabling until they are valid', () => {
    const handleInputChange = vi.fn()
    renderWithProviders(
      <SettingsCustomBlocks
        configs={[
          { id: 10, key: 'security_recaptcha_type', value: 'both', name: 'Version' },
          { id: 11, key: 'security_recaptcha_site_key', value: 'v2-site', name: 'Site key' },
          { id: 12, key: 'security_recaptcha_site_key_v3', value: 'v3-site', name: 'Site key v3' },
          { id: 13, key: 'security_recaptcha_auth', value: '0', name: 'Login', options: [{ text: 'YES', value: '1' }, { text: 'NO', value: '0' }] }
        ]}
        handleInputChange={handleInputChange}
      />
    )

    expect(screen.getByDisplayValue('v2-site')).toBeInTheDocument()
    expect(screen.getByDisplayValue('v3-site')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Login' }))
    expect(handleInputChange).not.toHaveBeenCalled()
    expect(screen.getByText('Fill the required keys for the selected version before enabling reCAPTCHA.')).toBeInTheDocument()
    expect(screen.queryByText('Choose v2, v3, or both. Only the keys for that choice are shown.')).not.toBeInTheDocument()
    expect(screen.getByText('v2')).toBeInTheDocument()
    expect(screen.getByText('v3')).toBeInTheDocument()
  })

  it('also writes format_time and dates_moment_format when the date format changes', () => {
    const handleInputChange = vi.fn()
    renderWithProviders(
      <SettingsCustomBlocks
        configs={[
          { id: 1, key: 'dates_general_format', value: 'YYYY-MM-DD HH:mm:ss' }
        ]}
        handleInputChange={handleInputChange}
      />
    )

    fireEvent.change(screen.getByLabelText('Date and time format'), {
      target: { value: 'MM/DD/YYYY hh:mm A' }
    })

    expect(handleInputChange).toHaveBeenCalledWith('MM/DD/YYYY hh:mm A', 1)
    expect(handleInputChange).toHaveBeenCalledWith('12', 91)
    expect(handleInputChange).toHaveBeenCalledWith('MM/DD hh:mm A', 92)
  })

  it('hides the in-app alert position when the in-app master is off', () => {
    renderWithProviders(
      <SettingsCustomBlocks
        configs={[
          { id: 21, key: 'notification_in_app_enabled', value: '0', name: 'Show an in-app order alert' },
          { id: 22, key: 'notification_in_app_position', value: 'right', name: 'In-app alert position' },
          { id: 23, key: 'notification_toast', value: '1', name: 'Show a toast when a new order arrives' }
        ]}
        handleInputChange={() => {}}
      />
    )

    expect(screen.getByText('Dashboard order alerts')).toBeInTheDocument()
    expect(screen.getByText('Show an in-app order alert')).toBeInTheDocument()
    expect(screen.getByText('Show a toast when a new order arrives')).toBeInTheDocument()
    expect(screen.queryByText('In-app alert position')).not.toBeInTheDocument()
  })

  it('shows the in-app alert position when the in-app master is on', () => {
    renderWithProviders(
      <SettingsCustomBlocks
        configs={[
          { id: 21, key: 'notification_in_app_enabled', value: '1', name: 'Show an in-app order alert' },
          { id: 22, key: 'notification_in_app_position', value: 'right', name: 'In-app alert position' },
          { id: 23, key: 'notification_toast', value: '1', name: 'Show a toast when a new order arrives' }
        ]}
        handleInputChange={() => {}}
      />
    )

    expect(screen.getByText('In-app alert position')).toBeInTheDocument()
  })

  it('hides the preorder window when scheduled orders are off', () => {
    renderWithProviders(
      <SettingsCustomBlocks
        configs={[
          { id: 30, key: 'preorder_status_enabled', value: '0' },
          { id: 31, key: 'max_days_preorder', value: '7', name: 'Default preorder window (days)' },
          { id: 32, key: 'preorder_maximum_days', value: '{"delivery":7}' }
        ]}
        handleInputChange={() => {}}
      />
    )

    expect(screen.queryByText('Preorder window')).not.toBeInTheDocument()
    expect(screen.queryByText('Default preorder window (days)')).not.toBeInTheDocument()
  })

  it('hides the multi-checkout discount table when the master is off', () => {
    renderWithProviders(
      <SettingsCustomBlocks
        configs={[
          { id: 40, key: 'checkout_multi_business_enabled', value: '0' },
          {
            id: 41,
            key: 'multi_business_checkout_delivery_fee_discount_percentage_cart_1',
            value: '10'
          }
        ]}
        handleInputChange={() => {}}
      />
    )

    expect(screen.queryByText('Delivery fee discount by cart')).not.toBeInTheDocument()
    expect(screen.queryByText('Cart 1')).not.toBeInTheDocument()
  })

  it('renders reservation setting as a compact table, not raw JSON', () => {
    const raw = '{"min_guests_reservation":1,"max_guests_reservation":4,"allow_preorder_reservation":true}'
    const handleInputChange = vi.fn()
    renderWithProviders(
      <SettingsCustomBlocks
        configs={[
          { id: 80, key: 'reservation_setting', name: 'Reservation Setting', value: raw }
        ]}
        handleInputChange={handleInputChange}
      />
    )

    expect(screen.getByRole('columnheader', { name: 'Setting' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Value' })).toBeInTheDocument()
    expect(screen.getByText('Minimum guests')).toBeInTheDocument()
    expect(screen.getByText('Max reservation sites')).toBeInTheDocument()
    expect(screen.getByText('Allow food preorder when booking')).toBeInTheDocument()
    expect(screen.queryByDisplayValue(raw)).not.toBeInTheDocument()
    expect(screen.queryByText(/min_guests_reservation/)).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Minimum guests'), { target: { value: '3' } })
    expect(handleInputChange).toHaveBeenCalledWith(
      expect.stringContaining('"min_guests_reservation":3'),
      80
    )
  })

  it('still renders date/time and reCAPTCHA when other masters are off', () => {
    renderWithProviders(
      <SettingsCustomBlocks
        configs={[
          { id: 1, key: 'dates_general_format', value: 'YYYY-MM-DD HH:mm:ss' },
          { id: 10, key: 'security_recaptcha_type', value: 'v2', name: 'Version' },
          { id: 11, key: 'security_recaptcha_site_key', value: 'v2-site', name: 'Site key' },
          { id: 30, key: 'preorder_status_enabled', value: '0' },
          { id: 31, key: 'max_days_preorder', value: '7' }
        ]}
        handleInputChange={() => {}}
      />
    )

    expect(screen.getByText('Date and time')).toBeInTheDocument()
    expect(screen.getByDisplayValue('v2-site')).toBeInTheDocument()
    expect(screen.queryByText('Preorder window')).not.toBeInTheDocument()
  })
})

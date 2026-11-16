/* eslint-disable import/first */
// one row of SettingsList inside the Settings hub (ProductSettingsRow).
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))

import { ProductSettingsRow } from '../ProductSettingsRow'

const dashboardTheme = createDashboardTheme(theme)
const yesNo = [{ text: 'Yes', value: '1' }, { text: 'No', value: '0' }]

const renderRow = (config, props = {}) => {
  const handleInputChange = vi.fn()
  const view = renderWithProviders(
    <ProductSettingsRow config={config} handleInputChange={handleInputChange} {...props} />,
    { theme: dashboardTheme }
  )
  return { ...view, handleInputChange }
}

describe('ProductSettingsRow · type 3 lists that only hold Yes and No', () => {
  const reservation = (value) => ({ id: 81, key: 'reservation_enabled', name: 'Reservation Enabled', description: 'Turn reservations on.', type: 3, value, options: yesNo })

  it('is one exclusive Yes/No switch with an accessible name, not two checkboxes', () => {
    renderRow(reservation('1'))
    const toggle = screen.getByRole('switch', { name: 'Reservation Enabled' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('writes one value at a time, never «1|0»', async () => {
    const { handleInputChange } = renderRow(reservation('1'))
    await userEvent.click(screen.getByRole('switch', { name: 'Reservation Enabled' }))
    expect(handleInputChange).toHaveBeenCalledTimes(1)
    expect(handleInputChange).toHaveBeenCalledWith('0', 81)
  })

  it('turns on with the value of the Yes option', async () => {
    const { handleInputChange } = renderRow(reservation('0'))
    await userEvent.click(screen.getByRole('switch', { name: 'Reservation Enabled' }))
    expect(handleInputChange).toHaveBeenCalledWith('1', 81)
  })

  it('shows the broken «1|0» state as off and writes nothing until the user chooses', () => {
    const { handleInputChange } = renderRow(reservation('1|0'))
    expect(screen.getByRole('switch', { name: 'Reservation Enabled' })).toHaveAttribute('aria-checked', 'false')
    expect(handleInputChange).not.toHaveBeenCalled()
  })

  it('an order-type list keeps its checkboxes even with a Yes/No look', () => {
    renderRow({ id: 5, key: 'default_order_type', name: 'Default type', type: 3, value: '1', options: yesNo }, { orderTypeValues: ['1', '0'] })
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
  })

  it('a real multi-selection list keeps its checkboxes', async () => {
    const { handleInputChange } = renderRow({
      id: 4,
      key: 'payment_methods_shown',
      name: 'Methods shown',
      type: 3,
      value: 'cash',
      options: [{ text: 'cash', value: 'cash' }, { text: 'card', value: 'card' }]
    })
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    await userEvent.click(screen.getByRole('checkbox', { name: 'card' }))
    expect(handleInputChange).toHaveBeenCalledWith('cash|card', 4)
  })
})

describe('ProductSettingsRow · «Add your …» defaults', () => {
  it('a plain text config shows the instruction as a hint on an empty field, writing nothing', () => {
    const { handleInputChange } = renderRow({ id: 9, key: 'google_analytics_id', name: 'Google Analytics ID', type: 1, value: 'Add your Google Analytics ID' })
    const input = screen.getByRole('textbox', { name: 'Google Analytics ID' })
    expect(input).toHaveValue('')
    expect(input).toHaveAttribute('placeholder', 'Add your Google Analytics ID')
    expect(handleInputChange).not.toHaveBeenCalled()
  })

  it('a secret shows it as a hint too', () => {
    renderRow({ id: 10, key: 'security_recaptcha_secret_key', name: 'Recaptcha Secret Key', type: 1, value: 'Add your Recaptcha Secret Key' })
    const input = screen.getByLabelText('Recaptcha Secret Key', { selector: 'input' })
    expect(input).toHaveValue('')
    expect(input).toHaveAttribute('placeholder', 'Add your Recaptcha Secret Key')
  })

  it('a real value is shown as it is', () => {
    renderRow({ id: 9, key: 'google_analytics_id', name: 'Google Analytics ID', type: 1, value: 'G-ABC123' })
    expect(screen.getByRole('textbox', { name: 'Google Analytics ID' })).toHaveValue('G-ABC123')
  })

  // review of batch S: outside the dependents, a real value equal to the field's name is a value, not a hint
  it('a value equal to the name of a field that is not a dependent stays a value', () => {
    renderRow({ id: 11, key: 'site_title', name: 'Pizza', type: 1, value: 'Pizza' })
    expect(screen.getByRole('textbox', { name: 'Pizza' })).toHaveValue('Pizza')
  })
})

// ST9: «Set expiry for shared order details» (guest_uuid_max_days, type 1) holds days as text. It asks for the numeric
// keyboard and says in line, under the field, that «5x» is not a number; the save bar's rule is the same and does not change.
describe('ProductSettingsRow · a type 1 config that holds a number (ST9)', () => {
  const expiry = (value) => ({ id: 41, key: 'guest_uuid_max_days', name: 'Set expiry for shared order details', type: 1, value })

  it('asks for the numeric keyboard and still writes text', async () => {
    const { handleInputChange } = renderRow(expiry(''))
    const input = screen.getByRole('textbox', { name: 'Set expiry for shared order details' })
    expect(input).toHaveAttribute('inputmode', 'numeric')
    await userEvent.type(input, '7')
    expect(handleInputChange).toHaveBeenCalledWith('7', 41)
  })

  it('says in line that «5x» is not a number, tied to the field', () => {
    renderRow(expiry('5x'))
    const input = screen.getByRole('textbox', { name: 'Set expiry for shared order details' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    const message = screen.getByText('The Set expiry for shared order details must be a number.')
    expect(input.getAttribute('aria-describedby')).toContain(message.id)
  })

  it.each(['24', '0', ' 12 ', ''])('says nothing for %j (the bar accepts it, and an empty field is not an error)', (value) => {
    renderRow(expiry(value))
    expect(screen.getByRole('textbox', { name: 'Set expiry for shared order details' })).not.toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByText(/must be a number/)).toBeNull()
  })

  it('keeps the message the save bar passes in `error` over its own', () => {
    renderRow(expiry('5x'), { error: 'Something else.' })
    expect(screen.getByText('Something else.')).toBeInTheDocument()
    expect(screen.queryByText(/must be a number/)).toBeNull()
  })

  it('leaves the other type 1 fields as they were: plain text, no rule', () => {
    renderRow({ id: 5, key: 'invoice_footer', name: 'Invoice footer', type: 1, value: 'abc' })
    const input = screen.getByRole('textbox', { name: 'Invoice footer' })
    expect(input).not.toHaveAttribute('inputmode')
    expect(input).not.toHaveAttribute('aria-invalid', 'true')
  })
})

describe('ProductSettingsRow · the default country of phone numbers', () => {
  const country = (value) => ({ id: 52, key: 'default_country_code', name: 'Set default country code', type: 1, value })
  const invalid = 'Use a two-letter country code in capital letters, like US, CA or MX. A dialing prefix like +1 does not work.'

  it.each(['+1', '1', 'ca', ' CA', 'Canada', 'XX'])('says in line that %j is not a country code, tied to the field', (value) => {
    renderRow(country(value))
    const input = screen.getByRole('textbox', { name: 'Set default country code' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    const message = screen.getByText(invalid)
    expect(input.getAttribute('aria-describedby')).toContain(message.id)
  })

  it.each(['US', 'CA', 'MX', 'PK', ''])('says nothing for %j', (value) => {
    renderRow(country(value))
    expect(screen.getByRole('textbox', { name: 'Set default country code' })).not.toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByText(invalid)).toBeNull()
  })

  it('does not apply the rule to other text fields', () => {
    renderRow({ id: 5, key: 'invoice_footer', name: 'Invoice footer', type: 1, value: '+1' })
    expect(screen.getByRole('textbox', { name: 'Invoice footer' })).not.toHaveAttribute('aria-invalid', 'true')
  })
})

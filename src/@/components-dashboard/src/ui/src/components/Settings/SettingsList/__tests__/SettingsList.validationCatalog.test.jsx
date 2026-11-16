/* eslint-disable import/first */
// the validation messages of Settings read the catalog text, not the code fallback. The catalog stored
// VALIDATION_MUST_SMALLER_HUNDRED with a literal «${item?.name}», so the user saw the template unfilled.
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import catalog from '../../../../../../../../../../i18n/translations.json'

const lang = vi.hoisted(() => ({ code: 'en', overrides: {} }))
const translate = (key, fallback) => lang.overrides[key] ?? lang.catalog?.[key]?.[lang.code] ?? fallback

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, translate],
  useConfig: () => [{ configs: {} }],
  SettingsList: () => null
}))

vi.mock('../../../Shared', () => ({
  Alert: ({ content, open }) => open
    ? <div role='alert'>{(Array.isArray(content) ? content : [content]).filter(Boolean).join(' ')}</div>
    : null,
  ColorPicker: () => null,
  NotFoundSource: () => null
}))

import { SettingsListUI } from '../index'

const fee = { id: 20, key: 'platform_fee_percentage', name: 'Platform fee percentage', type: 1, value: '120' }

const renderAndSave = async () => {
  const handleClickUpdate = vi.fn()
  renderWithProviders(
    <SettingsListUI
      category={{ key: 'platform_fees' }}
      settingsState={{ loading: false, error: null, API: false, changes: [fee] }}
      configs={[fee]}
      formState={{ changes: [fee] }}
      configOptionsToHide={[]}
      handleClickUpdate={handleClickUpdate}
      focus=''
    />
  )
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  return handleClickUpdate
}

const preorderDays = (value) => ({ id: 31, key: 'max_days_preorder', name: 'Maximum preorder days', type: 1, value })
const expiry = (value) => ({ id: 41, key: 'guest_uuid_max_days', name: 'Set Expiry for Shared Order Details', type: 1, value })

const renderAndSaveChange = async (change) => {
  const handleClickUpdate = vi.fn()
  renderWithProviders(
    <SettingsListUI
      category={{ key: 'x' }}
      settingsState={{ loading: false, error: null, API: false, changes: [change] }}
      configs={[change]}
      formState={{ changes: [change] }}
      configOptionsToHide={[]}
      handleClickUpdate={handleClickUpdate}
      focus=''
    />
  )
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  return handleClickUpdate
}

describe('SettingsListUI validation texts from the catalog', () => {
  lang.catalog = catalog

  afterEach(() => {
    lang.code = 'en'
    lang.overrides = {}
  })

  it('names the field when a percentage is over 100', async () => {
    const handleClickUpdate = await renderAndSave()
    expect(await screen.findByText(/Percentage platform fee must not be greater than 100/)).toBeTruthy()
    expect(screen.queryByText(/_attribute_|\$\{/)).toBeNull()
    expect(handleClickUpdate).not.toHaveBeenCalled()
  })

  it.each(Object.keys(catalog.VALIDATION_MUST_SMALLER_HUNDRED))('the %s text uses the _attribute_ placeholder', (code) => {
    const text = catalog.VALIDATION_MUST_SMALLER_HUNDRED[code]
    expect(text).toContain('_attribute_')
    expect(text).not.toContain('${')
  })

  // the old key keeps the bad English («must be not bigger than») in the live catalog, so the code asks a new key.
  it('does not read the old catalog text of the percentage rule', async () => {
    lang.overrides = { VALIDATION_MUST_SMALLER_HUNDRED: '${item?.name} must be not bigger than 100' } // eslint-disable-line no-template-curly-in-string
    await renderAndSave()
    expect(await screen.findByText(/Percentage platform fee must not be greater than 100/)).toBeTruthy()
    expect(screen.queryByText(/not bigger than/)).toBeNull()
  })
})

describe('SettingsListUI numeric rules', () => {
  lang.catalog = catalog

  it.each(['0', '-1', '1', '30'])('accepts %s as the default preorder window (the help says 0 or -1 turns scheduling off)', async (value) => {
    const handleClickUpdate = await renderAndSaveChange(preorderDays(value))
    expect(handleClickUpdate).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it.each(['-2', 'abc', '', '1.5'])('refuses %j as the default preorder window, naming the field as the screen does', async (value) => {
    const handleClickUpdate = await renderAndSaveChange(preorderDays(value))
    expect(handleClickUpdate).not.toHaveBeenCalled()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Default preorder window (days) must be a whole number, -1 or greater.')
    expect(alert).not.toHaveTextContent('bigger than zero')
    expect(alert).not.toHaveTextContent('Maximum preorder days')
  })

  // ST9: the row now says it in line too (ProductSettingsRow.test.jsx); the bar's rule is the same one and is unchanged
  it.each(['abc', '5x'])('refuses %j in a numeric expiry field', async (value) => {
    const refused = await renderAndSaveChange(expiry(value))
    expect(refused).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveTextContent('The Set expiry for shared order details must be a number.') // (decision 32 A)
  })

  it('saves a number in a numeric expiry field', async () => {
    const handleClickUpdate = await renderAndSaveChange(expiry('24'))
    expect(handleClickUpdate).toHaveBeenCalledTimes(1)
  })

  it('does not apply the numeric rule to other text fields', async () => {
    const handleClickUpdate = await renderAndSaveChange({ id: 5, key: 'invoice_footer', name: 'Invoice footer', type: 1, value: 'abc' })
    expect(handleClickUpdate).toHaveBeenCalledTimes(1)
  })
})

describe('SettingsListUI default country of phone numbers', () => {
  lang.catalog = catalog
  const country = (value) => ({ id: 52, key: 'default_country_code', name: 'Set default country code', type: 1, value })

  it.each(['+1', '1', 'ca', 'Canada'])('refuses %j, saying what goes in the field', async (value) => {
    const handleClickUpdate = await renderAndSaveChange(country(value))
    expect(handleClickUpdate).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveTextContent('Use a two-letter country code in capital letters, like US, CA or MX. A dialing prefix like +1 does not work.')
  })

  it.each(['US', 'CA', ''])('saves %j', async (value) => {
    const handleClickUpdate = await renderAndSaveChange(country(value))
    expect(handleClickUpdate).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

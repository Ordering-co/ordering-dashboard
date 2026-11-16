/* eslint-disable import/first */
// redesign F3 (D-03): the Address field of Edit customer had no box. The real GoogleAutocompleteInput renders a bare
// <input class="od-ui od-field od-field-input">; the governed `.od-field` rules paint their border, background and
// colour from `--od-field-*` custom properties that only the styled `Input` defines inline, so on the bare input
// `border: 1px solid var(--od-field-border)` was invalid at computed-value time and the box vanished (measured live:
// `border: 0px none`, background transparent). The form now defines those properties for every field inside it, and the
// field is a real label + input + hint, disabled with its value visible (and a reason) when Google is not available.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const config = vi.hoisted(() => ({ configs: {} }))

// Stand-in for the controller of components/GoogleAutocompleteInput: the same bare <input>, with the className, id and
// defaultValue passed through and `disabled` while Google is not there (the controller's `disabled={!googleReady}`).
vi.mock('../../../../../../index', () => ({
  GoogleAutocompleteInput: ({ apiKey, childRef, onChangeAddress, countryCode, ...props }) => (
    <input
      {...props}
      data-testid='autocomplete'
      disabled={!apiKey || !window.google?.maps?.Map}
      ref={childRef}
    />
  ),
  GoogleMapsMap: () => <div data-testid='map' />,
  useConfig: () => [config],
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: 0 } }],
  useUtils: () => [{ optimizeImage: value => value }]
}))

vi.mock('../../../../utils', () => ({ getUserType: () => false }))
vi.mock('../../DriverSelector', () => ({ DriverSelector: () => null }))
vi.mock('../../CompanySelector', () => ({ CompanySelector: () => null }))
vi.mock('../../ReviewCustomer', () => ({ ReviewCustomer: () => null }))

import { OrderContactInformation } from '..'

const makeProps = () => ({
  addressState: {},
  commentInfoState: {},
  customerInfoState: { customer: {}, loading: false },
  handleChangeCustomerInfoState: vi.fn(),
  handleOpenMessages: vi.fn(),
  handleUpdateCustomerInfo: vi.fn(),
  isServiceOrder: true,
  setAddressState: vi.fn(),
  setCommentInfostate: vi.fn(),
  order: {
    id: 42,
    status: 1,
    delivery_type: 1,
    business: { name: 'Restaurant' },
    customer: { id: 7, name: 'Ada', cellphone: '5552000', email: 'ada@example.test', address: '200 Customer Street' }
  }
})

const openEdit = () => {
  renderWithProviders(<OrderContactInformation {...makeProps()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Edit Customer' }))
}

const tab = name => readFileSync(path.join(__dirname, '..', '..', 'OrderDetails', name), 'utf8')
const withoutComments = css => css.replace(/\/\*[\s\S]*?\*\//g, '')
const rules = (css, selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return [...css.matchAll(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'gm'))].map(match => match[1]).join('\n')
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  config.configs = { google_maps_api_key: { value: 'key' } }
  window.google = { maps: { Map: function Map () {} } }
})

afterEach(() => {
  vi.useRealTimers()
  delete window.google
})

describe('Address field of Edit customer (F3)', () => {
  it('is a labelled governed field, like Phone and Email, with its value', () => {
    openEdit()
    const address = screen.getByLabelText('Address')
    expect(address).toBe(screen.getByTestId('autocomplete'))
    expect(address).toHaveClass('od-ui', 'od-field', 'od-field-input')
    expect(address).toHaveValue('200 Customer Street')
    expect(address).toBeEnabled()
    expect(screen.queryByText('Address search unavailable')).toBeNull()
  })

  it('without a Google key it is disabled, keeps its value and says why', () => {
    config.configs = {}
    openEdit()
    const address = screen.getByLabelText('Address')
    expect(address).toBeDisabled()
    expect(address).toHaveValue('200 Customer Street')
    const hint = screen.getByText('Address search unavailable')
    expect(address).toHaveAccessibleDescription('Address search unavailable')
    expect(hint.id).toBeTruthy()
    expect(hint.closest('label')).toBeNull()
    expect(screen.queryByTestId('map')).toBeNull()
  })

  it('with a key but Google blocked it says so after a moment, not while it is still loading', () => {
    delete window.google
    openEdit()
    expect(screen.getByLabelText('Address')).toBeDisabled()
    expect(screen.queryByText('Address search unavailable')).toBeNull()
    act(() => { vi.advanceTimersByTime(6000) })
    expect(screen.getByText('Address search unavailable')).toBeInTheDocument()
    expect(screen.getByLabelText('Address')).toHaveAccessibleDescription('Address search unavailable')
  })

  it('takes the hint back when Google arrives late', () => {
    delete window.google
    openEdit()
    act(() => { vi.advanceTimersByTime(6000) })
    expect(screen.getByText('Address search unavailable')).toBeInTheDocument()
    window.google = { maps: { Map: function Map () {} } }
    act(() => { vi.advanceTimersByTime(500) })
    expect(screen.queryByText('Address search unavailable')).toBeNull()
    expect(screen.getByLabelText('Address')).toBeEnabled()
  })
})

describe('field box of Edit customer (F3, CSS)', () => {
  const css = withoutComments(tab('details-tab.css'))
  const field = rules(css, '.odt-edit .od-field')

  it('gives every field of the form the properties the governed rules paint the box from, from brand tokens', () => {
    expect(field).toMatch(/--od-field-border:\s*var\(--od-x-field-border\)/)
    expect(field).toMatch(/--od-field-surface:\s*var\(--od-bg\)/)
    expect(field).toMatch(/--od-field-surface-subtle:\s*var\(--od-surface-subtle\)/)
    expect(field).toMatch(/--od-field-text:\s*var\(--od-text\)/)
    expect(field).toMatch(/--od-field-text-muted:\s*var\(--od-text-muted\)/)
    expect(field).toMatch(/--od-field-text-subtle:\s*var\(--od-x-text-subtle\)/)
    expect(field).toMatch(/--od-field-radius:\s*var\(--od-radius-component\)/)
    expect(field).toMatch(/--od-field-focus:\s*var\(--od-focus-ring-color\)/)
    expect(field).toMatch(/--od-field-focus-width:\s*var\(--od-focus-ring-width\)/)
    expect(field).toMatch(/--od-field-focus-offset:\s*var\(--od-focus-ring-offset\)/)
  })

  it('keeps no hard-coded colour or size in the form rules', () => {
    // the 767px of the phone media query is a breakpoint, not a size of the field
    const form = css.slice(css.indexOf('.odt-edit .od-field {')).replace(/@media[^{]*/g, '')
    expect(form).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|\b\d+px\b/i)
  })

  it('reaches 44px on a phone, not only on a coarse pointer (C3)', () => {
    expect(css).toMatch(/@media \(pointer: coarse\), \(max-width: 767px\)\s*\{[^@]*\.odt-edit \.od-field-input[^@]*--od-x-target-coarse/)
  })

  it('a disabled field keeps its value legible: no extra fading', () => {
    expect(rules(css, '.odt-edit .od-field:disabled')).toMatch(/opacity:\s*1/)
  })
})

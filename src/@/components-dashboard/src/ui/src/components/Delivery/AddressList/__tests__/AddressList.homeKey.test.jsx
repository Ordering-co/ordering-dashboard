/* eslint-disable import/first */
import React from 'react'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders, defaultTheme } from '~/__tests__/helpers/testUtils'

// redesign W0-4c (T0-15, decisión 19): the saved address of type home is named with HOME_ADDRESS; HOME stays for the menu.
const mocks = vi.hoisted(() => ({ calls: [], controller: {} }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (key, fallback) => { mocks.calls.push(key); return fallback }],
  AddressList: ({ UIComponent, ...props }) => <UIComponent {...props} {...mocks.controller} />
}))
vi.mock('../../../../utils', () => ({ scrollTo: vi.fn() }))
vi.mock('../../AddressForm', () => ({ AddressForm: () => <div data-testid='address-form' /> }))

import { AddressList } from '..'

const theme = { ...defaultTheme, images: { general: {} } }

beforeEach(() => { mocks.calls.length = 0 })

describe('AddressList · address type key (W0-4c)', () => {
  it('names a home address with HOME_ADDRESS, never HOME, and the English text does not change', () => {
    mocks.controller = {
      addressList: { loading: false, error: null, addresses: [{ id: 1, address: 'Home street 1', default: true, tag: 'home', zipcode: '10001' }] },
      actionStatus: { loading: false, error: null },
      setAddressList: vi.fn(),
      handleSetDefault: vi.fn(),
      handleDelete: vi.fn()
    }
    renderWithProviders(<AddressList isEmbedded isSeletectedUserAddresses userId={7} />, { theme })
    expect(screen.getByText(/^Home/, { selector: '.odc-steps-row-meta' })).toHaveTextContent('Home · 10001')
    expect(mocks.calls).toContain('HOME_ADDRESS')
    expect(mocks.calls).not.toContain('HOME')
  })
})

/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import { renderWithProviders, defaultTheme } from '~/__tests__/helpers/testUtils'

const mockController = { current: {} }

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  AddressList: ({ UIComponent, ...props }) => <UIComponent {...props} {...mockController.current} />
}))

vi.mock('../../../../utils', () => ({ scrollTo: vi.fn() }))
vi.mock('../../../../styles/Buttons', () => ({
  Button: ({ children, borderRadius, outline, ...props }) => <button {...props}>{children}</button>
}))
vi.mock('../../AddressForm', () => ({ AddressForm: () => <div data-testid='address-form' /> }))
vi.mock('../../../Shared', () => ({
  Confirm: () => null,
  NotFoundSource: ({ content }) => <div>{content}</div>
}))

import { AddressList } from '..'

const homeAddress = { id: 1, address: 'Home street 1', default: true }
const officeAddress = { id: 2, address: 'Office street 2', default: false }

const theme = { ...defaultTheme, images: { general: {} } }

const renderList = (controller = {}) => {
  mockController.current = {
    addressList: { loading: false, error: null, addresses: [homeAddress, officeAddress] },
    actionStatus: { loading: false, error: null },
    setAddressList: vi.fn(),
    handleSetDefault: vi.fn(),
    handleDelete: vi.fn(),
    ...controller
  }
  return renderWithProviders(<AddressList isSeletectedUserAddresses userId={7} />, { theme })
}

describe('AddressList', () => {
  beforeEach(() => {
    mockController.current = {}
  })

  it('lists the addresses without depending on order options', () => {
    renderList()

    expect(screen.getByText('Home street 1')).toBeInTheDocument()
    expect(screen.getByText('Office street 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add new address' })).toBeEnabled()
    expect(screen.queryByText('Network error, please reload the page')).not.toBeInTheDocument()
  })

  it('sets a non-default address as the default one', () => {
    renderList()

    fireEvent.click(screen.getByText('Office street 2'))

    expect(mockController.current.handleSetDefault).toHaveBeenCalledWith(officeAddress, undefined)
  })

  it('does nothing when the clicked address is already the default one', () => {
    renderList()

    fireEvent.click(screen.getByText('Home street 1'))

    expect(mockController.current.handleSetDefault).not.toHaveBeenCalled()
  })

  it('shows the empty state when the user has no addresses', () => {
    renderList({ addressList: { loading: false, error: null, addresses: [] } })

    expect(screen.getByText('Sorry, You don\'t seem to have any addresses.')).toBeInTheDocument()
  })

  it('shows the address loading error', () => {
    renderList({ addressList: { loading: false, error: ['Could not load addresses'], addresses: [] } })

    expect(screen.getByText('Could not load addresses')).toBeInTheDocument()
  })

  it('disables adding an address while an address action is running', () => {
    renderList({ actionStatus: { loading: true, error: null } })

    expect(screen.getByRole('button', { name: 'Loading' })).toBeDisabled()
    expect(screen.queryByText('Home street 1')).not.toBeInTheDocument()
  })
})

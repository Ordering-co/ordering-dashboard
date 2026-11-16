/* eslint-disable import/first */
import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  GoogleAutocompleteInput: props => <input aria-label={props.placeholder} />,
  GoogleMapsMap: () => <div data-testid='map' />,
  useConfig: () => [{ configs: {} }],
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: 0 } }],
  useUtils: () => [{ optimizeImage: value => value }]
}))

vi.mock('../../../../utils', () => ({ getUserType: () => false }))

vi.mock('../../DriverSelector', () => ({ DriverSelector: () => null }))
vi.mock('../../CompanySelector', () => ({ CompanySelector: () => null }))
vi.mock('../../ReviewCustomer', () => ({ ReviewCustomer: () => null }))
vi.mock('../../../Shared', () => ({ Modal: ({ children, open }) => open ? <div role='dialog'>{children}</div> : null }))

vi.mock('../../../../styles', () => ({
  Button: ({ children, ...props }) => {
    const domProps = { ...props }
    delete domProps.color
    return <button {...domProps}>{children}</button>
  },
  IconButton: ({ children, ...props }) => <button {...props}>{children}</button>,
  Input: props => <input {...props} />
}))

import { OrderContactInformation } from '..'

const longEmail = 'operations-contact-with-a-very-long-name@example-marketplace.test'

const props = {
  addressState: {},
  commentInfoState: {},
  customerInfoState: { customer: {}, loading: false },
  handleChangeCustomerInfoState: vi.fn(),
  handleOpenMessages: vi.fn(),
  handleUpdateCustomerInfo: vi.fn(),
  isServiceOrder: true,
  order: {
    id: 42,
    status: 1,
    delivery_type: 1,
    business: {
      name: 'Restaurant',
      phone: '5551000',
      email: longEmail,
      address: '100 Very Long Operations Avenue, Suite 12345'
    },
    customer: {
      id: 7,
      name: 'Ada',
      lastname: 'Lovelace',
      cellphone: '5552000',
      email: longEmail,
      address: '200 Another Very Long Customer Address, Apartment 98765'
    }
  },
  setAddressState: vi.fn(),
  setCommentInfostate: vi.fn()
}

describe('OrderContactInformation accessibility', () => {
  // redesign 5.3: the business and customer accordions are gone (the address and the
  // contact lines are always visible), so there are no disclosure buttons to assert on.
  // The rest of the contract stays: phone, review and edit are valid sibling buttons, the
  // edit trigger keeps its name and aria-pressed, and the long values are not lost.
  it('keeps phone, review, and edit actions as valid sibling buttons with every value visible', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const { container } = renderWithProviders(<OrderContactInformation {...props} />)

    const edit = screen.getByRole('button', { name: 'Edit Customer' })

    expect(container.querySelector('button button')).toBeNull()
    expect(container.querySelector('[aria-expanded]')).toBeNull()
    expect(screen.getAllByText(longEmail).length).toBeGreaterThan(0)
    expect(screen.getByText('200 Another Very Long Customer Address, Apartment 98765')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Call Restaurant' }))
    expect(open).toHaveBeenCalledWith('tel:5551000')

    expect(edit).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(edit)
    expect(edit).toHaveAttribute('aria-pressed', 'true')
    // redesign fix-qa E6: the phone field used to carry a sample number as its placeholder, which read as
    // data; it is found by its label now (the form itself is covered in OrderContactInformation.parity.test.jsx)
    expect(screen.getByLabelText('Phone / Mobile')).toBeInTheDocument()

    fireEvent.click(edit)
    expect(edit).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByLabelText('Phone / Mobile')).toBeNull()
    expect(screen.getAllByText(longEmail).length).toBeGreaterThan(0)

    open.mockRestore()
  })

  it('offers Review for a past order that has no review yet', () => {
    renderWithProviders(<OrderContactInformation {...props} />)
    expect(screen.getByRole('button', { name: 'Review' })).toBeInTheDocument()
  })

  it('does not offer Review while the order is open', () => {
    renderWithProviders(<OrderContactInformation {...props} order={{ ...props.order, status: 7 }} />)
    expect(screen.queryByRole('button', { name: 'Review' })).toBeNull()
  })
})

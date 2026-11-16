/* eslint-disable import/first */
import React from 'react'
import { act, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({
  setUserCustomer: vi.fn(),
  deleteUserCustomer: vi.fn(),
  addForm: { current: null },
  addressList: { current: null },
  harness: null
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: url => url }],
  useCustomer: () => [{}, { setUserCustomer: mocks.setUserCustomer, deleteUserCustomer: mocks.deleteUserCustomer }],
  useConfig: () => [{ configs: { default_country_code: { value: 'us' } } }]
}))

vi.mock('../../../../utils', () => ({ findExitingCountryPhoneCode: () => '1' }))

vi.mock('../../../Users', () => ({
  UserAddForm: props => {
    mocks.addForm.current = props
    return (
      <div data-testid='user-add-form'>
        <h1>New user</h1>
        <button type='button' onClick={() => props.onClose?.()}>Cancel form</button>
      </div>
    )
  }
}))

vi.mock('../../../Delivery', () => ({
  AddressList: props => {
    mocks.addressList.current = props
    return (
      <>
        <div id='address_control'><button type='button'>Add new address</button></div>
        <div data-testid='address-form-panel'>Address form</div>
      </>
    )
  }
}))

import { SelectCustomer } from '../SelectCustomer'

const customer = { id: 4, name: 'Ana', lastname: 'Perez', cellphone: '5550001111' }

const renderStep = (overrides = {}) => {
  const props = {
    phone: '',
    customersPhones: { users: [], loading: false, error: null },
    selectedUser: null,
    setSelectedUser: vi.fn(),
    onChangeNumber: vi.fn(),
    customerAddress: null,
    ...overrides
  }
  const view = renderWithProviders(<SelectCustomer {...props} />)
  return { props, ...view, update: next => view.rerender(<SelectCustomer {...props} {...next} />) }
}

beforeEach(() => {
  mocks.setUserCustomer.mockClear()
  mocks.deleteUserCustomer.mockClear()
  mocks.addForm.current = null
  mocks.addressList.current = null
})

describe('SelectCustomer · step content (5.5-B)', () => {
  it('keeps its own "Customer" heading by default and drops it when the wizard owns the title', () => {
    const { unmount } = renderStep()
    expect(screen.getByRole('heading', { name: 'Customer', level: 3 })).toBeInTheDocument()
    unmount()
    renderStep({ hideTitle: true })
    expect(screen.queryByRole('heading', { name: 'Customer' })).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Phone number' })).toBeInTheDocument()
    expect(screen.getByText('Search for the customer by phone number.')).toBeInTheDocument()
  })

  // redesign F6c (Q2-28): the field is a combobox and the suggestions its listbox, so the role queries of the
  // field and of the rows changed; what they check did not.
  it('lists the suggestions as options with the name and the phone, and picks the customer', async () => {
    const user = userEvent.setup()
    const { props } = renderStep({ phone: '5550001111', customersPhones: { users: [customer], loading: false, error: null } })
    await user.click(screen.getByRole('combobox', { name: 'Phone number' }))
    const option = await screen.findByRole('option', { name: /Ana Perez/ })
    expect(option).toHaveTextContent('5550001111')
    await user.click(option)
    expect(mocks.setUserCustomer).toHaveBeenCalledWith(customer, true)
    expect(props.setSelectedUser).toHaveBeenCalledWith(customer)
    expect(props.onChangeNumber).toHaveBeenCalledWith('')
  })

  it('shows the picked customer with two separate actions: change and remove', async () => {
    const user = userEvent.setup()
    const { props } = renderStep({ phone: '5550001111', customersPhones: { users: [customer], loading: false, error: null }, selectedUser: customer, customerAddress: { id: 1, address: '1 Main St', location: { lat: 1, lng: 2 } } })
    await user.click(screen.getByRole('combobox', { name: 'Phone number' }))
    await user.click(await screen.findByRole('option', { name: /Ana Perez/ }))
    const change = screen.getByRole('button', { name: /Change customer/ })
    const remove = screen.getByRole('button', { name: 'Remove customer' })
    expect(change.querySelector('button')).toBeNull()
    expect(screen.getByText('1 Main St')).toBeInTheDocument()
    await user.click(remove)
    expect(mocks.deleteUserCustomer).toHaveBeenCalledWith(true)
    expect(props.setSelectedUser).toHaveBeenLastCalledWith(null)
    expect(screen.getByRole('combobox', { name: 'Phone number' })).toBeInTheDocument()
  })

  it('only allows digits in the phone field and searches with what was typed', async () => {
    const user = userEvent.setup()
    renderStep()
    const field = screen.getByRole('combobox', { name: 'Phone number' })
    await user.type(field, 'a1b2')
    expect(field).toHaveValue('12')
  })
})

describe('SelectCustomer · one panel level (C8)', () => {
  it('opens "New user" in place, inside the step, with Back, and not as a stacked dialog', async () => {
    const user = userEvent.setup()
    const { container } = renderStep({ phone: '5550001111' })
    await user.click(screen.getByRole('button', { name: 'New user' }))
    const panel = container.querySelector('#user_add_form')
    expect(panel).not.toBeNull()
    expect(within(panel).getByTestId('user-add-form')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // The search is replaced by the sub view, so there is one task on screen.
    expect(screen.queryByRole('combobox', { name: 'Phone number' })).not.toBeInTheDocument()
    expect(mocks.addForm.current.isFromCustomOrder).toBe(true)
    expect(mocks.addForm.current.hideUserTypeSelector).toBe(true)
    expect(mocks.addForm.current.defaultPhoneNumber).toBe('+1 5550001111')

    await user.click(within(panel).getByRole('button', { name: 'Back' }))
    expect(container.querySelector('#user_add_form')).toBeNull()
    expect(screen.getByRole('combobox', { name: 'Phone number' })).toBeInTheDocument()
  })

  it('the form closes the sub view through its own onClose, and a created user is picked like before', async () => {
    const user = userEvent.setup()
    const { container, props } = renderStep()
    await user.click(screen.getByRole('button', { name: 'New user' }))
    mocks.addForm.current.handleSuccessAdd(customer)
    expect(props.setSelectedUser).toHaveBeenCalledWith(customer)
    expect(mocks.setUserCustomer).toHaveBeenCalledWith(customer, true)
    await user.click(screen.getByRole('button', { name: 'Cancel form' }))
    expect(container.querySelector('#user_add_form')).toBeNull()
  })

  it('opens the address list in place with the customer name, keeps #address_list and the same controller props', async () => {
    const user = userEvent.setup()
    const withAddress = { ...customer, addresses: [{ id: 1 }] }
    const { container, props } = renderStep({
      selectedUser: withAddress,
      customerAddress: { id: 1, address: '1 Main St', location: { lat: 1, lng: 2 } }
    })
    await user.click(screen.getByRole('button', { name: 'Change' }))
    const panel = container.querySelector('#address_list')
    expect(panel).not.toBeNull()
    expect(within(panel).getByRole('heading', { name: 'Ana Perez' })).toBeInTheDocument()
    expect(within(panel).getByText('Select customer address')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const list = mocks.addressList.current
    expect(list.isAutoOpenAddNewAddress).toBe(true)
    expect(list.isSeletectedUserAddresses).toBe(true)
    expect(list.userId).toBe(4)
    expect(list.addresses).toEqual([{ id: 1 }])
    expect(list.userState).toEqual({ user: withAddress })
    expect(list.handleSuccessUpdate).toBe(props.setSelectedUser)

    await user.click(within(panel).getByRole('button', { name: 'Back' }))
    expect(container.querySelector('#address_list')).toBeNull()
  })

  it('a customer without an address lands on the address list by itself, and the list stands in for the add form when it opens', async () => {
    const user = userEvent.setup()
    const { container } = renderStep({ selectedUser: customer, customerAddress: null })
    const panel = await waitFor(() => {
      const found = container.querySelector('#address_list')
      expect(found).not.toBeNull()
      return found
    })
    expect(panel).not.toHaveAttribute('data-form-open', 'true')
    act(() => mocks.addressList.current.setExtraOpen(true))
    await waitFor(() => expect(panel).toHaveAttribute('data-form-open', 'true'))
    await user.click(within(panel).getByRole('button', { name: 'Back' }))
    expect(container.querySelector('#address_list')).toBeNull()
  })

  it('leaves the sub view when the customer gets a located address', async () => {
    const { container, update } = renderStep({ selectedUser: customer, customerAddress: null })
    await waitFor(() => expect(container.querySelector('#address_list')).not.toBeNull())
    update({ customerAddress: { id: 2, address: '2 Oak Ave', location: { lat: 3, lng: 4 } } })
    await waitFor(() => expect(container.querySelector('#address_list')).toBeNull())
    expect(screen.getByText('2 Oak Ave')).toBeInTheDocument()
  })
})

describe('SelectCustomer · Back from the address view of a customer without address', () => {
  // The controller keeps the customer and derives the default address from it, as CustomOrderDetails does.
  const Harness = ({ phone = '5550001111', initial = null }) => {
    const [selectedUser, setSelectedUser] = React.useState(initial)
    const customerAddress = selectedUser?.addresses?.find(address => address?.default) || null
    mocks.harness = { setSelectedUser }
    return (
      <SelectCustomer
        phone={phone}
        customersPhones={{ users: [customer], loading: false, error: null }}
        selectedUser={selectedUser}
        setSelectedUser={setSelectedUser}
        onChangeNumber={() => {}}
        customerAddress={customerAddress}
      />
    )
  }

  const pickCustomer = async (user) => {
    await user.click(screen.getByRole('combobox', { name: 'Phone number' }))
    await user.click(await screen.findByRole('option', { name: /Ana Perez/ }))
  }

  it('lands on the address view in the same commit as the pick, with no flash of the customer card', async () => {
    const user = userEvent.setup()
    const { container } = renderWithProviders(<Harness />)
    // The card's own DOM is patched in place, so what shows that the card step was rendered is its address row.
    const flashed = []
    const collect = records => records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType === 1 && (node.matches?.('.odc-steps-address-row') || node.querySelector?.('.odc-steps-address-row'))) flashed.push(node)
    }))
    const observer = new MutationObserver(collect)
    observer.observe(container, { childList: true, subtree: true })
    await pickCustomer(user)
    collect(observer.takeRecords())
    observer.disconnect()
    expect(container.querySelector('#address_list')).not.toBeNull()
    expect(flashed, 'the customer card must not render before the address view').toHaveLength(0)
  })

  it('Back shows the picked customer with its actions, and the view does not reopen by itself', async () => {
    const user = userEvent.setup()
    const { container } = renderWithProviders(<Harness />)
    await pickCustomer(user)
    await user.click(within(container.querySelector('#address_list')).getByRole('button', { name: 'Back' }))
    expect(container.querySelector('#address_list')).toBeNull()
    expect(screen.getByRole('button', { name: /Change customer/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove customer' })).toBeInTheDocument()
    // Still without an address: the way back to the list stays on the card.
    expect(screen.getByRole('button', { name: 'Add new address' })).toBeInTheDocument()

    // The controller hands back a refreshed copy of the same customer (e.g. after a save): not a new episode.
    act(() => mocks.harness.setSelectedUser({ ...customer, addresses: [{ id: 9, address: '9 Elm St' }] }))
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(container.querySelector('#address_list')).toBeNull()
    expect(screen.getByRole('button', { name: /Change customer/ })).toBeInTheDocument()

    // And «Add new address» reopens it on demand.
    await user.click(screen.getByRole('button', { name: 'Add new address' }))
    expect(container.querySelector('#address_list')).not.toBeNull()
  })

  it('opens the view again when the customer loses its address, or when another customer is picked', async () => {
    const { container, update } = renderStep({ selectedUser: { ...customer, addresses: [{ id: 1, default: true }] }, customerAddress: { id: 1, address: '1 Main St', location: { lat: 1, lng: 2 } } })
    expect(container.querySelector('#address_list')).toBeNull()
    update({ customerAddress: null })
    await waitFor(() => expect(container.querySelector('#address_list')).not.toBeNull())
  })
})

// redesign F6c (Q2-28): the suggestions answer the arrows and Enter (combobox + listbox), not only Tab and the pointer.
describe('SelectCustomer · suggestions with the keyboard (Q2-28)', () => {
  const second = { id: 5, name: 'Bea', lastname: 'Lopez', cellphone: '5550002222' }
  const withUsers = (extra = {}) => renderStep({ phone: '555000', customersPhones: { users: [customer, second], loading: false, error: null }, ...extra })
  const field = () => screen.getByRole('combobox', { name: 'Phone number' })
  const activeOption = () => {
    const id = field().getAttribute('aria-activedescendant')
    return id ? document.getElementById(id) : null
  }

  it('is a combobox that owns the listbox of suggestions while they show', async () => {
    const user = userEvent.setup()
    withUsers()
    expect(field()).toHaveAttribute('aria-expanded', 'false')
    await user.click(field())
    const list = await screen.findByRole('listbox')
    expect(field()).toHaveAttribute('aria-expanded', 'true')
    expect(field()).toHaveAttribute('aria-controls', list.id)
    expect(field()).toHaveAttribute('aria-autocomplete', 'list')
    expect(within(list).getAllByRole('option').map(option => option.textContent)).toEqual([
      expect.stringContaining('Ana Perez'),
      expect.stringContaining('Bea Lopez')
    ])
    expect(field()).not.toHaveAttribute('aria-activedescendant')
  })

  it('moves through the suggestions with ↓ and ↑ and keeps the focus in the field', async () => {
    const user = userEvent.setup()
    withUsers()
    await user.click(field())
    await screen.findByRole('listbox')
    await user.keyboard('{ArrowDown}')
    expect(activeOption()).toHaveTextContent('Ana Perez')
    expect(activeOption()).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{ArrowDown}')
    expect(activeOption()).toHaveTextContent('Bea Lopez')
    expect(screen.getAllByRole('option').filter(option => option.getAttribute('aria-selected') === 'true')).toHaveLength(1)
    await user.keyboard('{ArrowDown}')
    expect(activeOption()).toHaveTextContent('Ana Perez')
    await user.keyboard('{ArrowUp}')
    expect(activeOption()).toHaveTextContent('Bea Lopez')
    await user.keyboard('{ArrowUp}')
    expect(activeOption()).toHaveTextContent('Ana Perez')
    expect(field()).toHaveFocus()
  })

  it('goes to the last suggestion with ↑ when none is active', async () => {
    const user = userEvent.setup()
    withUsers()
    await user.click(field())
    await screen.findByRole('listbox')
    await user.keyboard('{ArrowUp}')
    expect(activeOption()).toHaveTextContent('Bea Lopez')
  })

  it('picks the active suggestion with Enter, like a click on it', async () => {
    const user = userEvent.setup()
    const { props } = withUsers()
    await user.click(field())
    await screen.findByRole('listbox')
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(mocks.setUserCustomer).toHaveBeenCalledWith(second, true)
    expect(props.setSelectedUser).toHaveBeenCalledWith(second)
    expect(props.onChangeNumber).toHaveBeenCalledWith('')
  })

  it('does nothing on Enter while no suggestion is active', async () => {
    const user = userEvent.setup()
    const { props } = withUsers()
    await user.click(field())
    await screen.findByRole('listbox')
    await user.keyboard('{Enter}')
    expect(props.setSelectedUser).not.toHaveBeenCalled()
  })

  it('still picks with the pointer', async () => {
    const user = userEvent.setup()
    const { props } = withUsers()
    await user.click(field())
    await user.click(await screen.findByRole('option', { name: /Bea Lopez/ }))
    expect(props.setSelectedUser).toHaveBeenCalledWith(second)
  })

  it('closes the list with Escape without leaving the form, and ↓ opens it again', async () => {
    const user = userEvent.setup()
    const heard = []
    const outside = event => heard.push(event.key)
    renderWithProviders(
      <div onKeyDown={outside}>
        <SelectCustomer
          phone='555000'
          customersPhones={{ users: [customer, second], loading: false, error: null }}
          selectedUser={null}
          setSelectedUser={vi.fn()}
          onChangeNumber={vi.fn()}
          customerAddress={null}
        />
      </div>
    )
    await user.click(field())
    await screen.findByRole('listbox')
    await user.keyboard('{ArrowDown}{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(field()).toHaveAttribute('aria-expanded', 'false')
    expect(field()).not.toHaveAttribute('aria-activedescendant')
    // The Sheet around the step reads Escape as «discard»: it must not get this one.
    expect(heard).not.toContain('Escape')
    await user.keyboard('{ArrowDown}')
    expect(await screen.findByRole('listbox')).toBeInTheDocument()
    expect(activeOption()).toHaveTextContent('Ana Perez')
  })

  it('lets Escape through when there is no list to close', async () => {
    const user = userEvent.setup()
    const heard = []
    const outside = event => heard.push(event.key)
    renderWithProviders(
      <div onKeyDown={outside}>
        <SelectCustomer
          phone=''
          customersPhones={{ users: [], loading: false, error: null }}
          selectedUser={null}
          setSelectedUser={vi.fn()}
          onChangeNumber={vi.fn()}
          customerAddress={null}
        />
      </div>
    )
    await user.click(field())
    await user.keyboard('{Escape}')
    expect(heard).toContain('Escape')
  })

  it('reaches «New user» with the arrows when nothing was found, and Enter opens the form', async () => {
    const user = userEvent.setup()
    renderStep({ phone: '5559998', customersPhones: { users: [], loading: false, error: null } })
    await user.click(field())
    const row = await screen.findByRole('option', { name: 'New user' })
    await user.keyboard('{ArrowDown}')
    expect(activeOption()).toBe(row)
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('user-add-form')).toBeInTheDocument()
  })

  it('starts again from no active suggestion when the results change', async () => {
    const user = userEvent.setup()
    const { update } = withUsers()
    await user.click(field())
    await screen.findByRole('listbox')
    await user.keyboard('{ArrowDown}{ArrowDown}')
    update({ customersPhones: { users: [customer], loading: false, error: null } })
    expect(field()).not.toHaveAttribute('aria-activedescendant')
    await user.keyboard('{ArrowDown}')
    expect(activeOption()).toHaveTextContent('Ana Perez')
  })

  it('has no listbox while there is only a note (loading, or too few digits)', async () => {
    const user = userEvent.setup()
    renderStep({ phone: '55', customersPhones: { users: [], loading: false, error: null } })
    await user.click(field())
    expect(await screen.findByText('Type at least 7 digits to see suggestions')).toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(field()).toHaveAttribute('aria-expanded', 'false')
    await user.keyboard('{ArrowDown}{Enter}')
    expect(mocks.setUserCustomer).not.toHaveBeenCalled()
  })
})

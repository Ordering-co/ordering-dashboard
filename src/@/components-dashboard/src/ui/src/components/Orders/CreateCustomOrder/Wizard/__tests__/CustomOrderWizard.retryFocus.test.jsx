/* eslint-disable import/first */
import React from 'react'
import { screen, waitFor, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// redesign F6f (Q5-03): «Try again» in the wizard notices (the address options and the delivery type) used to unmount
// the notice while it retried, so the focus fell to <body>, outside the modal dialog. The notice now stays mounted and
// busy while it retries; on success the focus goes to the control the error was about (or the step title); on a new
// failure it stays on «Try again».
const mocks = vi.hoisted(() => ({ changeAddress: null, onFailure: null, retryType: null }))

vi.mock('../../../../../../../index', () => ({
  useLanguage: () => [null, (key, fallback) => fallback],
  useUtils: () => [{ parsePrice: value => `$${Number(value ?? 0).toFixed(2)}` }],
  useOrder: () => [{ loading: false, options: { type: 1 } }, { changeAddress: (...args) => mocks.changeAddress(...args) }],
  useValidationFields: () => [{ fields: { checkout: {} } }],
  CustomOrderDetails: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))

// The address control of the customer step is the opener of its address list.
vi.mock('../../SelectCustomer', () => ({
  SelectCustomer: () => (
    <div>
      <input aria-label='Phone number' />
      <button type='button' data-subview-opener='address_list'>Change</button>
    </div>
  )
}))
vi.mock('../../OrderTypeSelector', () => ({
  OrderTypeSelector: ({ onFailure }) => {
    mocks.onFailure = onFailure
    return (
      <div data-order-type=''>
        <button type='button' aria-pressed='true'>Delivery</button>
        <button type='button' aria-pressed='false'>Pickup</button>
      </div>
    )
  }
}))
vi.mock('../../SelectBusinesses', () => ({ SelectBusinesses: () => <div data-testid='select-businesses' /> }))
vi.mock('../../Map', () => ({ Map: () => <div data-testid='map' /> }))
vi.mock('../../SelectProducts', () => ({ SelectProducts: () => <input aria-label='Search products' /> }))
vi.mock('../../Checkout', () => ({ Checkout: () => <div data-testid='checkout' /> }))

import { CustomOrderDetails } from '../../CustomOrderDetails'

const selectedBusiness = { id: 5, slug: 'store', name: 'Corner Store' }
const baseProps = () => ({
  phone: '',
  onChangeNumber: vi.fn(),
  customersPhones: { users: [], loading: false, error: null },
  setCustomersPhones: vi.fn(),
  businessList: { loading: false, businesses: [selectedBusiness] },
  selectedUser: { id: 1, name: 'Ana', lastname: 'Perez', cellphone: '5550001111' },
  selectedBusiness,
  setSelectedUser: vi.fn(),
  setSelectedBusiness: vi.fn(),
  productList: { loading: false, products: [] },
  getProducts: vi.fn(),
  handeUpdateProductCart: vi.fn(),
  cart: { products: [{ id: 1, name: 'Burger', quantity: 1 }], total: 10 },
  onClose: vi.fn(),
  handleOpenCustomOrderDetail: vi.fn(),
  handlePlaceOrderByTotal: vi.fn(),
  extraFields: {},
  setExtraFields: vi.fn(),
  actionState: { loading: false, error: null },
  customerAddress: { id: 7, address: '1 Main St', location: { lat: 1, lng: 2 } }
})

const renderWizard = () => renderWithProviders(
  <div role='dialog' aria-label='Create custom order'><CustomOrderDetails {...baseProps()} /></div>
)
const continueButton = () => screen.getByRole('button', { name: /^Continue$/ })
const deferred = () => {
  let settle
  const promise = new Promise(resolve => { settle = resolve })
  return { promise, resolve: settle }
}
const insideDialog = () => screen.getByRole('dialog').contains(document.activeElement) && document.activeElement !== document.body

beforeEach(() => {
  mocks.changeAddress = vi.fn().mockResolvedValue({ ok: true })
  mocks.onFailure = null
  mocks.retryType = null
})

describe('wizard notices · focus while «Try again» retries (Q5-03)', () => {
  describe('address options notice', () => {
    const failOnce = (second) => {
      const retry = deferred()
      mocks.changeAddress = vi.fn()
        .mockResolvedValueOnce({ ok: false, error: 'Address out of coverage' })
        .mockImplementationOnce(() => retry.promise)
      return { retry, settle: (result) => act(async () => { retry.resolve(result) }), second }
    }

    it('keeps the notice mounted and busy while it retries, with the focus on its button, and ignores a second press', async () => {
      const { retry } = failOnce()
      const user = userEvent.setup()
      renderWizard()
      const alert = await screen.findByRole('alert')
      const button = within(alert).getByRole('button', { name: 'Try again' })
      await user.click(button)
      expect(screen.getByRole('alert')).toBe(alert)
      expect(within(alert).getByRole('button', { name: 'Try again' })).toBe(button)
      expect(button).toHaveAttribute('aria-busy', 'true')
      expect(button).toHaveFocus()
      await user.click(button)
      expect(mocks.changeAddress).toHaveBeenCalledTimes(2)
      await act(async () => { retry.resolve({ ok: true }) })
    })

    it('moves the focus to the address control of the step when the retry works', async () => {
      const { settle } = failOnce()
      const user = userEvent.setup()
      renderWizard()
      await user.click(within(await screen.findByRole('alert')).getByRole('button', { name: 'Try again' }))
      await settle({ ok: true })
      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
      expect(screen.getByRole('button', { name: 'Change' })).toHaveFocus()
    })

    it('moves the focus to the step title when the address control is not in the step', async () => {
      const { settle } = failOnce()
      const user = userEvent.setup()
      renderWizard()
      await screen.findByRole('alert')
      await user.click(continueButton())
      await user.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Try again' }))
      await settle({ ok: true })
      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
      expect(screen.getByRole('heading', { name: 'Business' })).toHaveFocus()
      expect(insideDialog()).toBe(true)
    })

    it('keeps the focus on «Try again» when the retry fails again, and shows the new message', async () => {
      const { settle } = failOnce()
      const user = userEvent.setup()
      renderWizard()
      const alert = await screen.findByRole('alert')
      const button = within(alert).getByRole('button', { name: 'Try again' })
      await user.click(button)
      await settle({ ok: false, error: 'Still out of coverage' })
      await waitFor(() => expect(button).not.toHaveAttribute('aria-busy'))
      expect(screen.getByRole('alert')).toBe(alert)
      expect(alert).toHaveTextContent('Still out of coverage')
      expect(button).toHaveFocus()
    })

    it('does not take the focus away from where the operator went while it retried', async () => {
      const { settle } = failOnce()
      const user = userEvent.setup()
      renderWizard()
      await user.click(within(await screen.findByRole('alert')).getByRole('button', { name: 'Try again' }))
      await user.click(screen.getByRole('textbox', { name: 'Phone number' }))
      await settle({ ok: true })
      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
      expect(screen.getByRole('textbox', { name: 'Phone number' })).toHaveFocus()
    })
  })

  describe('delivery type notice', () => {
    const goToBusinessAndRefuse = async (user) => {
      await waitFor(() => expect(mocks.changeAddress).toHaveBeenCalled())
      await user.click(continueButton())
      await screen.findByRole('button', { name: 'Pickup' })
      const retry = deferred()
      mocks.retryType = vi.fn(() => retry.promise)
      act(() => { mocks.onFailure('Pickup is not available for this address', () => mocks.retryType()) })
      return { retry, notice: (await screen.findByText('Pickup is not available for this address')).closest('[role="alert"]') }
    }

    it('keeps the notice mounted and busy while it retries, with the focus on its button', async () => {
      const user = userEvent.setup()
      renderWizard()
      const { retry, notice } = await goToBusinessAndRefuse(user)
      const button = within(notice).getByRole('button', { name: 'Try again' })
      await user.click(button)
      expect(screen.getByText('Pickup is not available for this address').closest('[role="alert"]')).toBe(notice)
      expect(button).toHaveAttribute('aria-busy', 'true')
      expect(button).toHaveFocus()
      await user.click(button)
      expect(mocks.retryType).toHaveBeenCalledTimes(1)
      await act(async () => { retry.resolve() })
    })

    it('moves the focus to the delivery type control when the retry works', async () => {
      const user = userEvent.setup()
      renderWizard()
      const { retry, notice } = await goToBusinessAndRefuse(user)
      await user.click(within(notice).getByRole('button', { name: 'Try again' }))
      await act(async () => {
        mocks.onFailure(null)
        retry.resolve()
      })
      await waitFor(() => expect(screen.queryByText('Pickup is not available for this address')).not.toBeInTheDocument())
      expect(screen.getByRole('button', { name: 'Delivery' })).toHaveFocus()
    })

    it('moves the focus to the step title when the type control is not showing (Items step)', async () => {
      const user = userEvent.setup()
      renderWizard()
      const { retry } = await goToBusinessAndRefuse(user)
      await user.click(continueButton())
      expect(await screen.findByRole('heading', { name: 'Items' })).toBeInTheDocument()
      const notice = screen.getByText('Pickup is not available for this address').closest('[role="alert"]')
      await user.click(within(notice).getByRole('button', { name: 'Try again' }))
      await act(async () => {
        mocks.onFailure(null)
        retry.resolve()
      })
      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
      expect(screen.getByRole('heading', { name: 'Items' })).toHaveFocus()
      expect(insideDialog()).toBe(true)
    })

    it('keeps the focus on «Try again» when the retry fails again', async () => {
      const user = userEvent.setup()
      renderWizard()
      const { retry, notice } = await goToBusinessAndRefuse(user)
      const button = within(notice).getByRole('button', { name: 'Try again' })
      await user.click(button)
      await act(async () => {
        mocks.onFailure('Pickup is still refused', () => mocks.retryType())
        retry.resolve()
      })
      await waitFor(() => expect(button).not.toHaveAttribute('aria-busy'))
      expect(screen.getByText('Pickup is still refused').closest('[role="alert"]')).toBe(notice)
      expect(button).toHaveFocus()
    })
  })
})

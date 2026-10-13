/* eslint-disable import/first */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const sessionState = vi.hoisted(() => ({ project: 'demo', level: 0 }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useApi: () => [{ project: sessionState.project }],
  useSession: () => [{ user: { level: sessionState.level } }]
}))

vi.mock('../../../../styles/Select', () => ({ Select: () => null }))
vi.mock('../../../../styles/Select/FirstSelect', () => ({
  Select: ({ defaultValue, onChange, options, isDisabled }) => (
    <select
      data-testid='status-select'
      value={defaultValue}
      disabled={isDisabled}
      onChange={e => onChange(isNaN(e.target.value) ? e.target.value : Number(e.target.value))}
    >
      {options.map(option => (
        <option key={option.value} value={option.value}>{option.name}</option>
      ))}
    </select>
  )
}))
vi.mock('../../../../styles/MultiSelect', () => ({ MultiSelect: () => null }))

vi.mock('../../../Shared', () => ({
  Alert: ({ open, content }) => open ? <div data-testid='alert'>{content.join(',')}</div> : null
}))

vi.mock('../../OrderStatusRegressionModal', () => ({
  OrderStatusRegressionModal: ({ open, currentStatus, newStatus, onSubmit, onClose }) => open
    ? (
      <div data-testid='regression-modal'>
        <span>{`${currentStatus}->${newStatus}`}</span>
        <button onClick={() => onSubmit('customer asked')}>submit</button>
        <button onClick={onClose}>cancel</button>
      </div>
      )
    : null
}))

import { OrderStatusTypeSelector } from '..'

const renderSelector = (handleUpdateOrderStatus, defaultValue = 11) => {
  renderWithProviders(
    <OrderStatusTypeSelector
      isFirstSelect
      orderId={55}
      deliveryType={1}
      defaultValue={defaultValue}
      handleUpdateOrderStatus={handleUpdateOrderStatus}
    />
  )
}

describe('OrderStatusTypeSelector final status lock', () => {
  afterEach(() => {
    sessionState.project = 'demo'
    sessionState.level = 0
  })

  it('disables the selector and ignores changes for a business owner on a finalized order in a locked project', async () => {
    sessionState.project = 'quickiedelivery'
    sessionState.level = 2
    const handleUpdateOrderStatus = vi.fn().mockResolvedValue({ error: false })

    renderSelector(handleUpdateOrderStatus, 11)

    expect(screen.getByTestId('status-select')).toBeDisabled()
    fireEvent.change(screen.getByTestId('status-select'), { target: { value: '7' } })
    await waitFor(() => expect(handleUpdateOrderStatus).not.toHaveBeenCalled())
  })

  it('keeps the selector enabled for a business owner on an in-progress order in a locked project', async () => {
    sessionState.project = 'quickiedelivery'
    sessionState.level = 2
    const handleUpdateOrderStatus = vi.fn().mockResolvedValue({ error: false })

    renderSelector(handleUpdateOrderStatus, 7)

    expect(screen.getByTestId('status-select')).not.toBeDisabled()
    fireEvent.change(screen.getByTestId('status-select'), { target: { value: '4' } })
    await waitFor(() => expect(handleUpdateOrderStatus).toHaveBeenCalledWith({ id: 55, newStatus: 4 }))
  })

  it('keeps the selector enabled for an admin on a finalized order in a locked project', () => {
    sessionState.project = 'quickiedelivery'
    sessionState.level = 0

    renderSelector(vi.fn(), 11)

    expect(screen.getByTestId('status-select')).not.toBeDisabled()
  })

  it('keeps the selector enabled for a business owner outside locked projects', () => {
    sessionState.level = 2

    renderSelector(vi.fn(), 11)

    expect(screen.getByTestId('status-select')).not.toBeDisabled()
  })
})

describe('OrderStatusTypeSelector regression reason flow', () => {
  it('opens the reason modal and retries with reasons when the controller flags a regression', async () => {
    const handleUpdateOrderStatus = vi.fn()
      .mockResolvedValueOnce({ error: true, regressionRequired: true, result: ['blocked'] })
      .mockResolvedValueOnce({ error: false })

    renderSelector(handleUpdateOrderStatus)
    fireEvent.change(screen.getByTestId('status-select'), { target: { value: '7' } })

    expect(await screen.findByTestId('regression-modal')).toBeInTheDocument()
    expect(screen.getByText('11->7')).toBeInTheDocument()
    expect(screen.queryByTestId('alert')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('submit'))

    await waitFor(() => expect(handleUpdateOrderStatus).toHaveBeenCalledTimes(2))
    expect(handleUpdateOrderStatus).toHaveBeenLastCalledWith({ id: 55, newStatus: 7, reasons: 'customer asked' })
    await waitFor(() => expect(screen.queryByTestId('regression-modal')).not.toBeInTheDocument())
  })

  it('reverts the selection and closes the modal on cancel without a second request', async () => {
    const handleUpdateOrderStatus = vi.fn()
      .mockResolvedValueOnce({ error: true, regressionRequired: true, result: ['blocked'] })

    renderSelector(handleUpdateOrderStatus)
    fireEvent.change(screen.getByTestId('status-select'), { target: { value: '7' } })
    await screen.findByTestId('regression-modal')

    fireEvent.click(screen.getByText('cancel'))

    await waitFor(() => expect(screen.queryByTestId('regression-modal')).not.toBeInTheDocument())
    expect(handleUpdateOrderStatus).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('status-select')).toHaveValue('11')
  })

  it('shows the error and reverts when the retry with reasons is rejected', async () => {
    const handleUpdateOrderStatus = vi.fn()
      .mockResolvedValueOnce({ error: true, regressionRequired: true, result: ['blocked'] })
      .mockResolvedValueOnce({ error: true, result: ['still blocked'] })

    renderSelector(handleUpdateOrderStatus)
    fireEvent.change(screen.getByTestId('status-select'), { target: { value: '7' } })
    await screen.findByTestId('regression-modal')
    fireEvent.click(screen.getByText('submit'))

    expect(await screen.findByTestId('alert')).toHaveTextContent('still blocked')
    expect(screen.queryByTestId('regression-modal')).not.toBeInTheDocument()
    expect(screen.getByTestId('status-select')).toHaveValue('11')
  })

  it('keeps the plain error alert when the controller does not flag a regression', async () => {
    const handleUpdateOrderStatus = vi.fn()
      .mockResolvedValueOnce({ error: true, result: ['not allowed'] })

    renderSelector(handleUpdateOrderStatus)
    fireEvent.change(screen.getByTestId('status-select'), { target: { value: '7' } })

    expect(await screen.findByTestId('alert')).toHaveTextContent('not allowed')
    expect(screen.queryByTestId('regression-modal')).not.toBeInTheDocument()
  })
})

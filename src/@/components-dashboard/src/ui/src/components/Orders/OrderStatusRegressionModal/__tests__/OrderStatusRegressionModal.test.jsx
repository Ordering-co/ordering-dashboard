/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

vi.mock('../../../../styles', () => ({
  Button: ({ children, borderRadius, ...props }) => <button {...props}>{children}</button>,
  TextArea: (props) => <textarea {...props} />
}))

vi.mock('../../../Shared', () => ({
  Modal: ({ open, children }) => open ? <div data-testid='modal'>{children}</div> : null
}))

import { OrderStatusRegressionModal } from '..'

const renderModal = (props = {}) => {
  const onSubmit = vi.fn()
  const onClose = vi.fn()
  renderWithProviders(
    <OrderStatusRegressionModal
      open
      orderId={123}
      currentStatus={11}
      newStatus={7}
      onSubmit={onSubmit}
      onClose={onClose}
      {...props}
    />
  )
  return { onSubmit, onClose }
}

describe('OrderStatusRegressionModal', () => {
  it('shows the transition for a single order', () => {
    renderModal()
    expect(screen.getByText('Delivery completed by driver')).toBeInTheDocument()
    expect(screen.getByText('Accepted by business')).toBeInTheDocument()
    expect(screen.getByText(/#123/)).toBeInTheDocument()
  })

  it('shows the orders count when it is a multi order change', () => {
    renderModal({ ordersCount: 3 })
    expect(screen.getByText(/^3/)).toBeInTheDocument()
    expect(screen.getByText('Accepted by business')).toBeInTheDocument()
  })

  it('keeps confirm disabled while the reason is empty or whitespace', () => {
    const { onSubmit } = renderModal()
    const confirm = screen.getByRole('button', { name: 'Confirm' })
    expect(confirm).toBeDisabled()

    fireEvent.change(screen.getByPlaceholderText('Write the reason'), { target: { value: '   ' } })
    expect(confirm).toBeDisabled()

    fireEvent.click(confirm)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits the trimmed reason', () => {
    const { onSubmit } = renderModal()
    fireEvent.change(screen.getByPlaceholderText('Write the reason'), { target: { value: '  customer asked  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onSubmit).toHaveBeenCalledWith('customer asked')
  })

  it('disables both buttons while loading', () => {
    renderModal({ loading: true })
    fireEvent.change(screen.getByPlaceholderText('Write the reason'), { target: { value: 'reason' } })
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('cancel closes without submitting', () => {
    const { onSubmit, onClose } = renderModal()
    fireEvent.change(screen.getByPlaceholderText('Write the reason'), { target: { value: 'reason' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('renders nothing when closed', () => {
    renderModal({ open: false })
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
  })
})

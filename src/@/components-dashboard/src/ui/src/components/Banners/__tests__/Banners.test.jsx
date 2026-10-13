/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../styles', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>
}))

vi.mock('../../../../../index.js', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: { name: 'Ada' } }]
}))

import { Banners } from '..'

describe('Banners', () => {
  it('renders the past-due message and opens the billing payment flow', () => {
    const setShowBillingPayment = vi.fn()

    renderWithProviders(<Banners setShowBillingPayment={setShowBillingPayment} />, {
      theme: { colors: { warning: '#ffcc00' }, images: {} }
    })

    fireEvent.click(screen.getByRole('button', { name: 'Pay now' }))

    expect(screen.getByText('Hey Ada, we have a problem, your account is past due.')).toBeInTheDocument()
    expect(setShowBillingPayment).toHaveBeenCalledWith(expect.any(Function))
    expect(setShowBillingPayment.mock.calls[0][0]({ open: false })).toEqual({
      open: true,
      from: 'past_due'
    })
  })
})

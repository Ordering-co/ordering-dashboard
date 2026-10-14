import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

let user

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useSession: () => [{ user }]
}))

vi.mock('../../../Shared', () => ({
  DragScroll: ({ children }) => <div>{children}</div>
}))

import { UserDetailsMenu } from '../index'

describe('UserDetailsMenu', () => {
  beforeEach(() => {
    user = { level: 0 }
  })

  it('offers the Stripe Connect tab of a driver only where it is enabled', () => {
    const handleChangeMenu = vi.fn()
    const { rerender } = renderWithProviders(
      <UserDetailsMenu isDriverMenu currentMenuSelected='profile' handleChangeMenu={handleChangeMenu} />
    )
    expect(screen.queryByText('Stripe Connect')).not.toBeInTheDocument()

    rerender(
      <UserDetailsMenu isDriverMenu isStripeConnectEnabled currentMenuSelected='profile' handleChangeMenu={handleChangeMenu} />
    )
    fireEvent.click(screen.getByText('Stripe Connect'))
    expect(handleChangeMenu).toHaveBeenCalledWith('stripe_connect')
  })

  it('has no Stripe Connect tab for a drivers manager', () => {
    renderWithProviders(
      <UserDetailsMenu isStripeConnectEnabled currentMenuSelected='profile' handleChangeMenu={vi.fn()} />
    )

    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.queryByText('Stripe Connect')).not.toBeInTheDocument()
  })
})

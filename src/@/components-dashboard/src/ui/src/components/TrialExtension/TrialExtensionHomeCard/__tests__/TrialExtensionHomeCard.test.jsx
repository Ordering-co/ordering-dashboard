/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({
  trialExtension: {
    available: true,
    daysRemaining: 5,
    openBooking: vi.fn()
  }
}))

vi.mock('../../../../../../index.js', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))
vi.mock('../../../../contexts/TrialExtensionContext', () => ({
  useTrialExtension: () => mocks.trialExtension
}))
vi.mock('../../../../styles', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>
}))

import { TrialExtensionHomeCard } from '..'

describe('TrialExtensionHomeCard', () => {
  it('renders the offer with days remaining and opens booking from Home', () => {
    renderWithProviders(<TrialExtensionHomeCard />)
    expect(screen.getByText('Extend your free trial to 14 days')).toBeInTheDocument()
    expect(screen.getByText(/Your trial ends in 5 days\./)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Book a call' }))
    expect(mocks.trialExtension.openBooking).toHaveBeenCalledWith('home')
  })

  it('renders nothing when not available', () => {
    mocks.trialExtension.available = false
    const { container } = renderWithProviders(<TrialExtensionHomeCard />)
    expect(container).toBeEmptyDOMElement()
    mocks.trialExtension.available = true
  })
})

/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({
  trialExtension: {
    isModalOpen: true,
    closeBooking: vi.fn(),
    bookingUrl: 'https://calendly.com/orderingteam/ordering-demo?embed_domain=x',
    fallbackUrl: 'https://calendly.com/orderingteam/ordering-demo',
    booked: false,
    justBooked: false,
    markBooked: vi.fn()
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
vi.mock('../../../../components/Shared', () => ({
  Modal: ({ open, title, children, onClose }) => open
    ? (
      <div role='dialog' aria-label={title}>
        <button aria-label='close-modal' onClick={onClose} />
        {children}
      </div>
      )
    : null
}))
vi.mock('../../CalendlyInlineEmbed', () => ({
  CalendlyInlineEmbed: ({ onScheduled }) => (
    <button onClick={() => onScheduled({ event: { uri: 'x' } })}>simulate-scheduled</button>
  )
}))

import { TrialExtensionModal } from '..'

describe('TrialExtensionModal', () => {
  it('shows the offer + Calendly embed when not booked', () => {
    renderWithProviders(<TrialExtensionModal />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Book a short call with our team before your trial ends/)).toBeInTheDocument()
    expect(screen.getByText('simulate-scheduled')).toBeInTheDocument()
  })

  it('calls markBooked when the embed reports a scheduled event', () => {
    renderWithProviders(<TrialExtensionModal />)
    fireEvent.click(screen.getByText('simulate-scheduled'))
    expect(mocks.trialExtension.markBooked).toHaveBeenCalledWith({ event: { uri: 'x' } })
  })

  it('shows the success state and a close button once booked', () => {
    mocks.trialExtension.booked = true
    renderWithProviders(<TrialExtensionModal />)
    expect(screen.getByText('Your meeting is booked')).toBeInTheDocument()
    expect(screen.getByText(/Our team will extend your free trial to 14 days/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(mocks.trialExtension.closeBooking).toHaveBeenCalled()
    mocks.trialExtension.booked = false
  })

  it('renders nothing (via Modal) when not open', () => {
    mocks.trialExtension.isModalOpen = false
    renderWithProviders(<TrialExtensionModal />)
    expect(screen.queryByRole('dialog')).toBeNull()
    mocks.trialExtension.isModalOpen = true
  })
})

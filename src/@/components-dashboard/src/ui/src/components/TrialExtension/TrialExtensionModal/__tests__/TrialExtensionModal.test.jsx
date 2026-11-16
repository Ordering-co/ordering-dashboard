/* eslint-disable import/first */
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

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
vi.mock('../../CalendlyInlineEmbed', () => ({
  CalendlyInlineEmbed: ({ onScheduled }) => (
    <button onClick={() => onScheduled({ event: { uri: 'x' } })}>simulate-scheduled</button>
  )
}))

import { TrialExtensionModal } from '..'

// redesign (R2): the booking modal is a Product Dialog; its own look lives in a plain CSS file.
const HERE = path.resolve(__dirname, '..')
const CSS = readFileSync(path.join(HERE, 'trial-extension-modal.css'), 'utf8')
const DIALOG_CSS = readFileSync(path.resolve(HERE, '../../Shared/Product/dialog.css'), 'utf8')
const collapse = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, '')

afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

describe('TrialExtensionModal', () => {
  it('is a Product Dialog titled with the offer, with the description and the Calendly embed when not booked', async () => {
    render(<TrialExtensionModal />)
    const dialog = await screen.findByRole('dialog', { name: 'Extend your free trial to 14 days' })
    expect(dialog).toHaveClass('odc-dialog')
    expect(screen.getByRole('heading', { level: 2, name: 'Extend your free trial to 14 days' })).toBeInTheDocument()
    expect(screen.getByText(/Book a short call with our team before your trial ends/)).toBeInTheDocument()
    expect(screen.getByText('simulate-scheduled')).toBeInTheDocument()
    expect(dialog.querySelector('.odc-overlay-body')).toContainElement(screen.getByText('simulate-scheduled'))
  })

  it('is the large Dialog size (720px) and its body scrolls when Calendly grows', async () => {
    render(<TrialExtensionModal />)
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('data-size', 'lg')
    expect(DIALOG_CSS).toMatch(/\.odc-dialog\[data-size='lg'\]\s*\{\s*inline-size: var\(--od-x-dialog-lg\)/)
    expect(DIALOG_CSS).toMatch(/\.odc-overlay-body\s*\{[^}]*overflow: auto/)
    const css = collapse(CSS)
    expect(css).not.toMatch(/overflow:(hidden|clip)/)
    // no cap on the body's height (only the success icon sizes itself): the Dialog's viewport cap is the one that applies
    expect(css).not.toMatch(/(^|[};])(height|max-block-size|max-height|min-block-size):/)
    expect(css.match(/block-size:/g)).toHaveLength(1)
  })

  it('calls markBooked when the embed reports a scheduled event', async () => {
    render(<TrialExtensionModal />)
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByText('simulate-scheduled'))
    expect(mocks.trialExtension.markBooked).toHaveBeenCalledWith({ event: { uri: 'x' } })
  })

  it('closes through the header close button', async () => {
    mocks.trialExtension.closeBooking.mockClear()
    render(<TrialExtensionModal />)
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(mocks.trialExtension.closeBooking).toHaveBeenCalledTimes(1)
  })

  it('shows the success state with a primary Close button once booked', async () => {
    mocks.trialExtension.booked = true
    mocks.trialExtension.closeBooking.mockClear()
    render(<TrialExtensionModal />)
    const dialog = await screen.findByRole('dialog')
    expect(screen.getByRole('heading', { level: 3, name: 'Your meeting is booked' })).toBeInTheDocument()
    expect(screen.getByText(/Our team will extend your free trial to 14 days/)).toBeInTheDocument()
    expect(screen.queryByText('simulate-scheduled')).toBeNull()
    expect(dialog.querySelector('.odc-trial-modal-success svg.odc-icon')).not.toBeNull()

    const body = dialog.querySelector('.odc-overlay-body')
    const close = [...body.querySelectorAll('button')].find(button => button.textContent === 'Close')
    expect(close).toHaveAttribute('data-variant', 'primary')
    fireEvent.click(close)
    expect(mocks.trialExtension.closeBooking).toHaveBeenCalledTimes(1)
    mocks.trialExtension.booked = false
  })

  it('shows the success state right after booking (justBooked)', async () => {
    mocks.trialExtension.justBooked = true
    render(<TrialExtensionModal />)
    await screen.findByRole('dialog')
    expect(screen.getByText('Your meeting is booked', { selector: 'h3' })).toBeInTheDocument()
    mocks.trialExtension.justBooked = false
  })

  it('renders nothing when not open', () => {
    mocks.trialExtension.isModalOpen = false
    render(<TrialExtensionModal />)
    expect(screen.queryByRole('dialog')).toBeNull()
    mocks.trialExtension.isModalOpen = true
  })

  it('brings no styled-components, legacy Modal, hex colors or pixel sizes of its own', () => {
    expect(CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(CSS.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/\d(px|rem)\b/)
    const source = readFileSync(path.join(HERE, 'index.js'), 'utf8')
    expect(source).not.toMatch(/styled-components|react-bootstrap-icons|from '\.\/styles'|Shared'/)
  })
})

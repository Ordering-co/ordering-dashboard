/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))
// the modal is a Product Dialog in the redesigned shell (main used the legacy Modal); same contract
vi.mock('../../Shared/Product', () => ({
  Dialog: ({ open, title, children, onOpenChange }) => open
    ? (
      <div role='dialog' aria-label={title}>
        <button aria-label='close-modal' onClick={() => onOpenChange(false)} />
        {children}
      </div>
      )
    : null
}))

import { AiAgentsUpgradeModal } from '..'

const formUrl = 'https://forms.example.test/upgrade'

describe('AiAgentsUpgradeModal', () => {
  it('embeds the upgrade form and offers it in a safe new tab', () => {
    renderWithProviders(<AiAgentsUpgradeModal open onClose={vi.fn()} formUrl={formUrl} />)

    expect(screen.getByRole('dialog', { name: 'Upgrade to use AI Agents' })).toBeInTheDocument()
    expect(screen.getByTitle('Upgrade request form')).toHaveAttribute('src', formUrl)
    const link = screen.getByRole('link', { name: 'Open in a new tab' })
    expect(link).toHaveAttribute('href', formUrl)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('uses general upgrade copy when opened from a legacy Dashboard feature', () => {
    renderWithProviders(<AiAgentsUpgradeModal open variant='legacy-plan' onClose={vi.fn()} formUrl={formUrl} />)

    expect(screen.getByRole('dialog', { name: 'Request an upgrade' })).toBeInTheDocument()
    expect(screen.queryByText(/AI Agents is available/)).not.toBeInTheDocument()
    expect(screen.getByTitle('Upgrade request form')).toHaveAttribute('src', formUrl)
    expect(screen.getByRole('link', { name: 'Open in a new tab' })).toHaveAttribute('href', formUrl)
  })

  it('shows a loading status until the form loads', () => {
    renderWithProviders(<AiAgentsUpgradeModal open onClose={vi.fn()} formUrl={formUrl} />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading the form…')
    fireEvent.load(screen.getByTitle('Upgrade request form'))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('offers public sales without loading a form when the deployment has no destination', () => {
    renderWithProviders(<AiAgentsUpgradeModal open variant='legacy-plan' onClose={vi.fn()} formUrl={null} />)

    expect(screen.queryByTitle('Upgrade request form')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Contact Sales' })).toHaveAttribute('href', expect.stringMatching(/\/platform-demo-and-pricing$/))
  })

  it('closes from the modal', () => {
    const onClose = vi.fn()
    renderWithProviders(<AiAgentsUpgradeModal open onClose={onClose} formUrl={formUrl} />)

    fireEvent.click(screen.getByLabelText('close-modal'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders nothing while closed', () => {
    renderWithProviders(<AiAgentsUpgradeModal open={false} onClose={vi.fn()} formUrl={formUrl} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

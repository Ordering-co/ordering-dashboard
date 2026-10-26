/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))
vi.mock('../../Shared', () => ({
  Modal: ({ open, title, children, onClose }) => open
    ? (
      <div role='dialog' aria-label={title}>
        <button aria-label='close-modal' onClick={onClose} />
        {children}
      </div>
      )
    : null
}))

import { AiAgentsUpgradeModal } from '..'

const formUrl = 'https://forms.ordering.co/r/A7GDBo?utm_source=ordering_dashboard&ref=orderingplus'

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

  it('shows a loading status until the form loads', () => {
    renderWithProviders(<AiAgentsUpgradeModal open onClose={vi.fn()} formUrl={formUrl} />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading the form…')
    fireEvent.load(screen.getByTitle('Upgrade request form'))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
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

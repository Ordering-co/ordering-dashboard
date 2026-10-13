/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

import { defaultTheme, renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { ProjectStatusBadge } from '..'

// Production trial: billing-api sends naive UTC dates, 3-day trial.
const productionTrial = { status: 'trialing', start_date: '2026-10-01T12:35:54', trial_end: '2026-10-04T12:35:54' }
const NOW = new Date('2026-10-01T15:00:00.000Z').getTime()
const HOUR_MS = 60 * 60 * 1000
const theme = { ...defaultTheme, colors: { ...defaultTheme.colors, warning: '#FFC700', success: '#00D27A' } }
const renderBadge = (ui) => renderWithProviders(ui, { theme })

describe('ProjectStatusBadge', () => {
  it('updates days remaining when the API returns the extended Stripe trial end', () => {
    const { rerender } = renderBadge(
      <ProjectStatusBadge currentStatus='active' trialSubscription={productionTrial} statusLabel='Project Active' now={NOW} />
    )
    expect(screen.getByText('Free trial — 3 days left')).toBeInTheDocument()
    rerender(
      <ProjectStatusBadge currentStatus='active' trialSubscription={{ ...productionTrial, trial_end: '2026-10-16T12:35:54' }} statusLabel='Project Active' now={NOW} />
    )
    expect(screen.getByText('Free trial — 15 days left')).toBeInTheDocument()
    expect(screen.queryByText('Free trial — 3 days left')).not.toBeInTheDocument()
  })

  it('shows the free trial and days left for an active project on a running trial', () => {
    renderBadge(
      <ProjectStatusBadge currentStatus='active' trialSubscription={productionTrial} statusLabel='Project Active' now={NOW} />
    )
    const pill = screen.getByText('Free trial — 3 days left')
    expect(pill).toHaveAttribute('data-status', 'trialing')
    // Warning pill, not the green "active" one.
    expect(pill).toHaveStyle('color: #FFC700')
    expect(screen.queryByText('Project Active')).not.toBeInTheDocument()
  })

  it('uses the singular on the last day', () => {
    const now = Date.UTC(2026, 9, 4, 12, 35, 54) - 2 * HOUR_MS
    renderBadge(
      <ProjectStatusBadge currentStatus='active' trialSubscription={productionTrial} statusLabel='Project Active' now={now} />
    )
    expect(screen.getByText('Free trial — 1 day left')).toBeInTheDocument()
  })

  it('reads the trial end as UTC (api-core space-separated format)', () => {
    const trial = { status: 'trialing', trial_end: '2026-10-04 12:35:54' }
    // 1 hour before the UTC trial end: still 1 day left whatever the browser time zone.
    const now = Date.UTC(2026, 9, 4, 11, 35, 54)
    renderBadge(
      <ProjectStatusBadge currentStatus='active' trialSubscription={trial} statusLabel='Project Active' now={now} />
    )
    expect(screen.getByText('Free trial — 1 day left')).toBeInTheDocument()
  })

  it('keeps "Project Active" without a trial, after the trial ends, or when no longer trialing', () => {
    const { rerender } = renderBadge(
      <ProjectStatusBadge currentStatus='active' trialSubscription={null} statusLabel='Project Active' now={NOW} />
    )
    expect(screen.getByText('Project Active')).toHaveStyle('color: #00D27A')

    rerender(
      <ProjectStatusBadge currentStatus='active' trialSubscription={productionTrial} statusLabel='Project Active' now={Date.UTC(2026, 9, 4, 13)} />
    )
    expect(screen.getByText('Project Active')).toBeInTheDocument()

    rerender(
      <ProjectStatusBadge currentStatus='active' trialSubscription={{ ...productionTrial, status: 'active' }} statusLabel='Project Active' now={NOW} />
    )
    expect(screen.getByText('Project Active')).toBeInTheDocument()
  })

  it('keeps the past-due status even with a trialing subscription', () => {
    renderBadge(
      <ProjectStatusBadge currentStatus='past_due' trialSubscription={productionTrial} statusLabel='Project Past Due Payment' now={NOW} />
    )
    expect(screen.getByText('Project Past Due Payment')).toBeInTheDocument()
    expect(screen.queryByText(/Free trial/)).not.toBeInTheDocument()
  })
})

/* eslint-disable import/first */
import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{
    optimizeImage: value => value,
    parseDate: value => value
  }]
}))

import { InterActOrderMarker } from '..'
import { DriverMapMarkerAndInfo } from '../../DriverMapMarkerAndInfo'

describe('map marker details', () => {
  it.each([
    ['order marker', <InterActOrderMarker key='order' customer={{ name: 'Grace', lastname: 'Hopper' }} />],
    ['driver marker', <DriverMapMarkerAndInfo key='driver' driver={{ name: 'Ada', lastname: 'Lovelace', enabled: true, available: true, busy: false }} />]
  ])('opens the %s tooltip through focus and closes it with Escape', (_label, marker) => {
    renderWithProviders(marker)

    const trigger = screen.getByRole('button', { name: /Show details for/ })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.focus(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id)

    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('keeps a touch-style click disclosure open and announces driver status without relying on marker color', () => {
    renderWithProviders(<DriverMapMarkerAndInfo driver={{ name: 'Ada', lastname: 'Lovelace', enabled: true, available: true, busy: true }} />)

    const trigger = screen.getByRole('button', { name: 'Show details for Ada Lovelace, Busy' })
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
  })

  it.each([
    ['order marker', <InterActOrderMarker key='order-toggle' customer={{ name: 'Grace', lastname: 'Hopper' }} />],
    ['driver marker', <DriverMapMarkerAndInfo key='driver-toggle' driver={{ name: 'Ada', lastname: 'Lovelace', enabled: true, available: true, busy: false }} />]
  ])('keeps the first focus-before-click activation open and collapses the %s on the second click', (_label, marker) => {
    renderWithProviders(marker)

    const trigger = screen.getByRole('button', { name: /Show details for/ })
    fireEvent.focus(trigger)
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('tooltip')).toBeInTheDocument()

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('announces delayed before availability so the accessible name matches the red status marker', () => {
    renderWithProviders(<DriverMapMarkerAndInfo timeStatus='delayed' driver={{ name: 'Ada', lastname: 'Lovelace', enabled: true, available: true, busy: false }} />)

    expect(screen.getByRole('button', { name: 'Show details for Ada Lovelace, Delayed' })).toBeInTheDocument()
  })

  // redesign W1-2 (T1-2-4): the state colour comes from the product status tokens, one source for both markers.
  const stateCss = () => Array.from(document.querySelectorAll('style')).map(node => node.textContent).join('\n')

  it.each([
    ['delayed', { timeStatus: 'delayed', driver: { enabled: true, available: true, busy: false } }, '--od-danger-signal'],
    ['offline', { driver: { enabled: true, available: false, busy: false } }, '--od-border-strong'],
    ['busy', { driver: { enabled: true, available: true, busy: true } }, '--od-x-info-signal,var(--od-text)'], // redesign W1-2c: the in-progress colour, with --od-text as its fallback where candidates.css is not loaded
    ['available', { driver: { enabled: true, available: true, busy: false } }, '--od-x-marker-available'] // --od-success-signal was ~2:1 on white and ~1.6:1 on map land, under the 3:1 of WCAG 1.4.11
  ])('marks the %s marker of both components with its status and maps that status to a product token', (state, extra, token) => {
    const { unmount } = renderWithProviders(<InterActOrderMarker customer={{ name: 'Grace' }} {...extra} />)
    expect(screen.getByRole('button')).toHaveAttribute('data-status', state)
    unmount()
    renderWithProviders(<DriverMapMarkerAndInfo {...extra} driver={{ name: 'Ada', ...extra.driver }} />)
    expect(screen.getByRole('button')).toHaveAttribute('data-status', state)

    expect(stateCss()).toContain(`[data-status='${state}']{--od-marker-status:var(${token});}`)
    expect(stateCss()).toContain('border:3px solid var(--od-marker-status)')
    expect(stateCss()).not.toMatch(/#E63757|#6c757d|#007bff|#28a745|#9D9B9B/i)
  })

  it('keeps the neutral colour for a customer marker without driver and draws the customer with a Lucide icon', () => {
    const { container } = renderWithProviders(<InterActOrderMarker customer={{ name: 'Grace' }} />)
    expect(screen.getByRole('button')).not.toHaveAttribute('data-status')
    expect(stateCss()).toContain('--od-marker-status:var(--od-border-strong);')
    expect(container.querySelector('svg.lucide, svg[class*="lucide"]')).not.toBeNull()
  })
})

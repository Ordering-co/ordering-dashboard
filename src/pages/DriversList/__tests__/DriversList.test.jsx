import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../__tests__/helpers/testUtils'

vi.mock('../../../components/HelmetTags', () => ({
  HelmetTags: ({ page }) => <div data-testid='helmet-tags' data-page={page} />
}))

// redesign W1-4 (T1-4-4a, W1-D-5): the page's mocks keep what the controller gets and what the page emits
const probe = vi.hoisted(() => ({ props: null, emit: null }))

vi.mock('~ui', async () => {
  const { createUiPageMocks } = await import('../../../__tests__/helpers/pageMocks')
  const mocks = createUiPageMocks()
  return { ...mocks, DriversManager: (props) => { probe.props = props; return <div data-testid='page-ui' /> } }
})

vi.mock('~components', async () => {
  const { createComponentsPageMocks } = await import('../../../__tests__/helpers/pageMocks')
  return { ...createComponentsPageMocks(), useEvent: () => [{ emit: probe.emit }] }
})

vi.mock('../../../config', () => ({ default: {} }))

import { DriversList } from '../index'

describe('DriversList page', () => {
  // opening replaces the entry too (like /orders), so each opening does not add a history entry
  it('W1-D-5: opening the panel writes ?id= and closing it removes it, with the page key ListenPageChanges knows', () => {
    probe.emit = vi.fn()
    renderWithProviders(<DriversList />)
    probe.props.onDriverRedirect(7)
    expect(probe.emit).toHaveBeenLastCalledWith('go_to_page', { page: 'drivers_dashboard', search: '?id=7', replace: true })
    probe.props.onDriverRedirect()
    expect(probe.emit).toHaveBeenLastCalledWith('go_to_page', { page: 'drivers_dashboard', replace: true })
    // the key must exist in the route table, or handleGoToPage ignores the event (it was 'drivers')
    const routes = fs.readFileSync(path.resolve(__dirname, '../../../components/ListenPageChanges/index.js'), 'utf8')
    expect(routes).toMatch(/drivers_dashboard:\s*'\/drivers-dashboard'/)
  })

  // redesign drivers-dashboard B4 (DD-07): the panel shows the phone and the list can tell when a driver was last given an order
  it('DD-07: asks the API for the phone and the last assignment, besides what it asked for before', () => {
    renderWithProviders(<DriversList />)
    expect(probe.props.propsToFetch).toEqual(expect.arrayContaining(['id', 'name', 'lastname', 'last_location_at', 'cellphone', 'last_order_assigned_at']))
  })

  it('renders its helmet tags and main controller', () => {
    renderWithProviders(<DriversList />)

    expect(screen.getByTestId('helmet-tags')).toHaveAttribute('data-page', 'drivers_dashboard')
    expect(screen.getByTestId('page-ui')).toBeInTheDocument()
  })
})

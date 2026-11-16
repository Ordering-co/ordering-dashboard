/* eslint-disable import/first */
// redesign drivers-dashboard B2 (DD-07, DD-11): the balloon of the driver marker lists the groups of the driver (the page asks for
// `driver_groups`, the old lists send `drivergroups`) separated by «, » with no trailing comma, and names the driver without double spaces.
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

import { DriverMapMarkerAndInfo } from '..'

const base = { name: 'Marco', lastname: 'Test', enabled: true, available: true, busy: false }

const openBalloon = (driver) => {
  renderWithProviders(<DriverMapMarkerAndInfo driver={{ ...base, ...driver }} />)
  fireEvent.focus(screen.getByRole('button', { name: /Show details for/ }))
  return screen.getByRole('tooltip')
}

describe('DriverMapMarkerAndInfo balloon', () => {
  it('lists driver_groups separated by a comma and a space, with no trailing comma', () => {
    const balloon = openBalloon({ driver_groups: [{ id: 1, name: 'North' }, { id: 2, name: 'Night shift' }] })
    expect(balloon).toHaveTextContent('Driver group:North, Night shift')
    expect(balloon.textContent).not.toMatch(/Night shift,/)
  })

  it('still reads drivergroups, and prefers it over driver_groups', () => {
    const only = openBalloon({ drivergroups: [{ id: 1, name: 'North' }, { id: 2, name: 'Night shift' }] })
    expect(only).toHaveTextContent('North, Night shift')
  })

  it('prefers drivergroups when both arrive', () => {
    const balloon = openBalloon({ drivergroups: [{ id: 1, name: 'Old' }], driver_groups: [{ id: 2, name: 'New' }] })
    expect(balloon).toHaveTextContent('Driver group:Old')
    expect(balloon.textContent).not.toContain('New')
  })

  it('skips the groups without a name and hides the row when none has one', () => {
    const some = openBalloon({ driver_groups: [{ id: 1 }, { id: 2, name: 'North' }] })
    expect(some).toHaveTextContent('Driver group:North')
    expect(some.textContent).not.toContain(',')
  })

  it('has no group row without named groups', () => {
    const balloon = openBalloon({ driver_groups: [{ id: 1 }] })
    expect(balloon).not.toHaveTextContent('Driver group')
  })

  it('names the driver without a double space in the accessible name and in the balloon', () => {
    const balloon = openBalloon({ name: 'Marco ', lastname: ' Test' })
    expect(screen.getByRole('button', { name: 'Show details for Marco Test, Available' })).toBeInTheDocument()
    expect(balloon).toHaveTextContent('Name:Marco Test')
    expect(balloon.textContent).not.toMatch(/Marco\s{2,}Test/)
  })

  it('names a driver with a single name part without stray spaces', () => {
    const balloon = openBalloon({ name: 'Marco', lastname: undefined })
    expect(screen.getByRole('button', { name: 'Show details for Marco, Available' })).toBeInTheDocument()
    expect(balloon.textContent).toBe('Name:Marco')
  })
})

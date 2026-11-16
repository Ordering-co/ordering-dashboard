/* eslint-disable import/first */
// redesign D-12 (owner, 2026-10-19): the stores of a drivers group say how many are selected (all pages, not only
// the ones on screen) in a polite status line next to "Select all" / "Select none"; the buttons call the controller as before.
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from 'styled-components'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { DriversGroupBusinesses } from '..'

const BUSINESSES = [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }]
const draw = (props = {}) => {
  const handlers = { handleSelectAllBusiness: vi.fn(), handleSelectBusiness: vi.fn() }
  render(
    <ThemeProvider theme={createDashboardTheme(theme)}>
      <DriversGroupBusinesses
        driversGroupState={{ driversGroup: { id: 3 } }}
        businesses={BUSINESSES}
        actionState={{ loading: false }}
        changesState={{}}
        selectedBusinessIds={[]}
        {...handlers}
        {...props}
      />
    </ThemeProvider>
  )
  return handlers
}

afterEach(cleanup)

describe('DriversGroupBusinesses · selection count (D-12)', () => {
  it('says how many stores are selected, singular and plural, in a polite status', () => {
    draw({ selectedBusinessIds: [] })
    expect(screen.getByRole('status')).toHaveTextContent('0 stores selected')
    cleanup()
    draw({ selectedBusinessIds: [2] })
    expect(screen.getByRole('status')).toHaveTextContent(/^1 store selected$/)
  })

  it('counts the whole selection, including stores that are not on the page on screen', () => {
    draw({ selectedBusinessIds: [1, 40, 41, 42] })
    expect(screen.getByRole('status')).toHaveTextContent('4 stores selected')
  })

  it('keeps the status while the page loads', () => {
    draw({ selectedBusinessIds: [1, 40], businessesLoading: true })
    // redesign (AD-6): the list's own skeleton is also a status (named «Loading»); the count is found by its text
    const count = screen.getByText('2 stores selected')
    expect(count).toHaveAttribute('role', 'status')
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  it('"Select all" and "Select none" call the controller as before', async () => {
    const { handleSelectAllBusiness } = draw({ selectedBusinessIds: [1] })
    await userEvent.click(screen.getByRole('button', { name: 'Select all' }))
    expect(handleSelectAllBusiness).toHaveBeenLastCalledWith(true)
    await userEvent.click(screen.getByRole('button', { name: 'Select none' }))
    expect(handleSelectAllBusiness).toHaveBeenLastCalledWith(false)
    expect(handleSelectAllBusiness).toHaveBeenCalledTimes(2)
  })
})

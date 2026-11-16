/* eslint-disable import/first */
// redesign (AD-4, AD-6): the driver companies of a delivery group on the Product pieces; the list is derived from the
// `companies` the controller hands over, so it fills when they arrive after the first paint (main left it empty until a search).
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
import { DriversGroupCompanies } from '..'

const COMPANIES = [{ id: 1, name: 'Fast Co' }, { id: 2, name: 'Slow Co' }]

const tree = (props = {}, handlers = {}) => (
  <ThemeProvider theme={createDashboardTheme(theme)}>
    <DriversGroupCompanies
      companies={COMPANIES}
      actionState={{ loading: false }}
      selectedDriversCompanyIds={[]}
      {...handlers}
      {...props}
    />
  </ThemeProvider>
)

const draw = (props = {}) => {
  const handlers = { handleSelectDriversCompany: vi.fn(), handleSelectAllDriversCompany: vi.fn() }
  const view = render(tree(props, handlers))
  return { ...view, handlers, again: next => view.rerender(tree({ ...props, ...next }, handlers)) }
}

afterEach(cleanup)

describe('DriversGroupCompanies', () => {
  it('fills the list when the companies arrive after the first paint (root cause)', () => {
    const { again } = draw({ companies: [] })
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    again({ companies: COMPANIES })
    expect(screen.getByRole('checkbox', { name: 'Fast Co' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Slow Co' })).toBeInTheDocument()
  })

  it('is a group named «Driver companies» whose Select all and Select none call the controller', async () => {
    const { handlers } = draw()
    expect(screen.getByRole('group', { name: 'Driver companies' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Select all' }))
    expect(handlers.handleSelectAllDriversCompany).toHaveBeenLastCalledWith(true)
    await userEvent.click(screen.getByRole('button', { name: 'Select none' }))
    expect(handlers.handleSelectAllDriversCompany).toHaveBeenLastCalledWith(false)
  })

  it('reflects the selection and calls handleSelectDriversCompany with the id and the next value', async () => {
    const { handlers } = draw({ selectedDriversCompanyIds: [1] })
    expect(screen.getByRole('checkbox', { name: 'Fast Co' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Slow Co' }))
    expect(handlers.handleSelectDriversCompany).toHaveBeenCalledWith(2, true)
  })

  it('filters by name and says when nothing matches', async () => {
    draw()
    const search = screen.getByRole('searchbox', { name: 'Search driver companies' })
    await userEvent.type(search, 'fast')
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    await userEvent.type(search, 'zzz')
    expect(screen.getByText('Nothing matches your search')).toBeInTheDocument()
  })

  it('says it is loading, when it could not load and when there are none', () => {
    draw({ companies: [], pickLists: { companies: { loading: true, error: null } } })
    expect(screen.getByRole('status', { name: 'Loading' })).toHaveAttribute('aria-busy', 'true')
    cleanup()
    draw({ companies: [], pickLists: { companies: { loading: false, error: ['boom'] } } })
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the driver companies.")
    cleanup()
    draw({ companies: [] })
    expect(screen.getByText('No driver companies yet')).toBeInTheDocument()
  })

  it('keeps the add form contract: the selection error is shown and describes the rows', () => {
    draw({ selectionError: { id: 'companies-error', message: 'Choose a company' } })
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a company')
    const rows = screen.getAllByRole('group', { name: 'Driver companies' }).find(node => node.getAttribute('aria-describedby') === 'companies-error')
    expect(rows).toBeTruthy()
    expect(rows).toHaveAttribute('tabindex', '-1')
  })
})

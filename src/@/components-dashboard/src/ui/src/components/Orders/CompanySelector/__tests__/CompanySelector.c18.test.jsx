/* eslint-disable import/first */
// redesign F2 (C18): the driver company list inside the orders surfaces.
import React from 'react'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const state = vi.hoisted(() => ({ first: vi.fn(), legacy: vi.fn() }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  DriversList: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))

const List = ({ name, spy, ...props }) => {
  spy(props)
  return <ul data-testid={name}>{props.options.map((option, index) => <li key={index} data-value={String(option.value)}>{option.content}</li>)}</ul>
}
vi.mock('../../../../styles/Select', () => ({ Select: props => <List name='legacy-select' spy={state.legacy} {...props} /> }))
vi.mock('../../../../styles/Select/FirstSelect', () => ({ Select: props => <List name='first-select' spy={state.first} {...props} /> }))
vi.mock('../../../../styles/MultiSelect', () => ({ MultiSelect: () => null }))

import { CompanySelector } from '..'
import { SelectSurfaceContext } from '../../../Shared/UI/selectPlacement'

const companysList = { loading: false, error: null, companys: [{ id: 1, name: 'Fast Riders', logo: null }, { id: 2, name: 'City Couriers', logo: null }] }

const renderSelector = surface => render(
  <ThemeProvider theme={{ ...createDashboardTheme(theme), images: {} }}>
    <SelectSurfaceContext.Provider value={surface}>
      <CompanySelector small order={{ id: 7 }} defaultValue='default' companysList={companysList} handleAssignDriverCompany={() => {}} />
    </SelectSurfaceContext.Provider>
  </ThemeProvider>
)

describe('CompanySelector inside the orders surfaces (C18)', () => {
  it('is a FirstSelect with the company as a square logo and its name; the removal is the dangerous action', () => {
    const { container } = renderSelector({ fitTrigger: true })
    expect(screen.getByTestId('first-select')).toBeInTheDocument()
    expect(screen.queryByTestId('legacy-select')).toBeNull()
    const row = container.querySelector('[data-value="1"]')
    expect(row.querySelector('.odc-avatar')).toHaveAttribute('data-kind', 'business')
    expect(row.querySelector('.odc-so-label')).toHaveTextContent('Fast Riders')
    const options = state.first.mock.calls.at(-1)[0].options
    expect(options.find(option => option.value === 'remove')).toMatchObject({ danger: true })
  })

  // redesign F6c (P3-02, P3-03): as in `main`, the removal is the first row and the search is always there.
  it('lists «Remove assigned company» before every company and asks for the search field', () => {
    renderSelector({ fitTrigger: true })
    const props = state.first.mock.calls.at(-1)[0]
    expect(props.options.filter(option => !option.showDisable).map(option => option.value)).toEqual(['remove', 1, 2])
    expect(props.isShowSearchBar).toBe(true)
  })

  it('keeps the legacy select and rows outside them', () => {
    const { container } = renderSelector({})
    expect(screen.getByTestId('legacy-select')).toBeInTheDocument()
    expect(container.querySelector('[data-value="1"] .odc-so')).toBeNull()
  })
})

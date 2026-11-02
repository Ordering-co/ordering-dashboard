import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from 'styled-components'
import theme from '~/theme.json'
import { BusinessFilterGroup } from './index'

const h = vi.hoisted(() => ({
  session: { user: { id: 7, level: 0 } },
  handleChangeValue: vi.fn(),
  handleChangeFilterValues: vi.fn(),
  handleResetFilterValues: vi.fn()
}))

vi.mock('../../../../../index', async () => {
  const React = await import('react')
  return {
    useLanguage: () => [{}, (key, fallback) => fallback],
    useSession: () => [h.session],
    BusinessFilter: ({ UIComponent, ...props }) => React.createElement(UIComponent, {
      ...props,
      filterValues: { name: '', cityIds: [], featured: null },
      handleChangeValue: h.handleChangeValue,
      handleChangeCity: vi.fn(),
      handleChangeFilterValues: h.handleChangeFilterValues,
      handleResetFilterValues: h.handleResetFilterValues
    })
  }
})

vi.mock('../../../styles', async () => {
  const React = await import('react')
  return {
    Input: (props) => React.createElement('input', props),
    DefaultSelect: ({ defaultValue, options, onChange }) => React.createElement(
      'select',
      {
        'aria-label': 'Featured',
        defaultValue: defaultValue === true ? 'true' : defaultValue === false ? 'false' : '',
        onChange: (event) => {
          const option = options.find(({ value }) => String(value) === event.target.value)
          onChange(option?.value)
        }
      },
      <option value=''>Select an option</option>,
      ...options.map(({ value }) => (
        <option key={String(value)} value={String(value)}>{value ? 'Yes' : 'No'}</option>
      ))
    ),
    Button: ({ children, onClick }) => React.createElement('button', { type: 'button', onClick }, children)
  }
})

vi.mock('../../Shared', async () => {
  const React = await import('react')
  return {
    CitySelector: () => React.createElement('div', { 'data-testid': 'city-selector' }),
    Modal: ({ open, children }) => open
      ? React.createElement('div', { role: 'dialog' }, children)
      : null
  }
})

const renderFilters = (user) => {
  h.session.user = user ? { id: 7, ...user } : null
  return render(
    <ThemeProvider theme={theme}>
      <BusinessFilterGroup
        isFilterModal
        onClose={vi.fn()}
      />
    </ThemeProvider>
  )
}

describe('BusinessFilterGroup Featured filter', () => {
  beforeEach(() => {
    h.session.user = { id: 7, level: 0 }
    vi.clearAllMocks()
  })

  it('shows Featured to admins and forwards its change to the filter callback', () => {
    renderFilters({ level: 0 })

    const featured = screen.getByLabelText('Featured')
    fireEvent.change(featured, { target: { value: 'true' } })

    expect(h.handleChangeValue).toHaveBeenCalledWith({ featured: true })
  })

  it.each([
    ['level 2 users', { level: 2 }],
    ['users without a session', null]
  ])('hides Featured but preserves Name and City for %s', (_role, user) => {
    renderFilters(user)

    expect(screen.queryByLabelText('Featured')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('Name')).toBeInTheDocument()
    expect(screen.getByText('City')).toBeInTheDocument()
    expect(screen.getByTestId('city-selector')).toBeInTheDocument()
  })
})

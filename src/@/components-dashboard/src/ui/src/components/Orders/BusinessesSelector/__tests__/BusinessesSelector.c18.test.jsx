/* eslint-disable import/first */
// redesign F2 (C18): the business list inside the orders surfaces (the filters sheet): rounded-square
// logos at 20px, the category as a muted second column, no pager. Elsewhere the legacy list stays.
import React from 'react'
import { render } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const spy = vi.hoisted(() => vi.fn())

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))
vi.mock('../../../../styles', () => ({
  MultiSelect: props => {
    spy(props)
    return <ul>{props.options.map((option, index) => <li key={index} data-value={String(option.value)}>{option.content}</li>)}</ul>
  }
}))

import { BusinessesSelector } from '..'
import { SelectSurfaceContext } from '../../../Shared/UI/selectPlacement'

const businessesList = {
  loading: false,
  businesses: [
    { id: 1, name: 'Fast Bite', logo: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', food: true },
    { id: 2, name: 'KCF', logo: null }
  ]
}

const renderSelector = surface => render(
  <ThemeProvider theme={createDashboardTheme(theme)}>
    <SelectSurfaceContext.Provider value={surface}>
      <BusinessesSelector filterValues={{ businessIds: [] }} businessesList={businessesList} handleChangeBusinesses={vi.fn()} />
    </SelectSurfaceContext.Provider>
  </ThemeProvider>
)

describe('BusinessesSelector inside the orders surfaces (C18)', () => {
  it('draws the business as a square logo, its name and the category in a muted second column', () => {
    const { container } = renderSelector({ fitTrigger: true })
    const row = container.querySelector('[data-value="1"]')
    expect(row.querySelector('.odc-avatar')).toHaveAttribute('data-kind', 'business')
    expect(row.querySelector('.odc-avatar img')).not.toBeNull()
    expect(row.querySelector('.odc-so-label')).toHaveTextContent('Fast Bite')
    expect(row.querySelector('.odc-so-meta')).toHaveTextContent('Food')
    const noLogo = container.querySelector('[data-value="2"]')
    expect(noLogo.querySelector('.odc-avatar-initials')).toHaveTextContent('K')
    expect(noLogo.querySelector('.odc-so-meta')).toBeNull()
  })

  it('does not pass a pager: the list scrolls', () => {
    renderSelector({ fitTrigger: true })
    const props = spy.mock.calls.at(-1)[0]
    expect(props.pagination).toBeUndefined()
    expect(props.handleChangePage).toBeUndefined()
  })

  it('keeps the legacy rows and the pager outside them', () => {
    const { container } = renderSelector({})
    expect(container.querySelector('[data-value="1"] .odc-so')).toBeNull()
    expect(spy.mock.calls.at(-1)[0].pagination).toBeDefined()
  })
})

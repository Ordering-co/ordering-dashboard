/* eslint-disable import/first */
// redesign F2 (C18): the administrator list inside the orders surfaces. Elsewhere the legacy rows and pager stay.
import React from 'react'
import { render } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

const spy = vi.hoisted(() => vi.fn())

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))
vi.mock('../../../../styles/MultiSelect', () => ({
  MultiSelect: props => {
    spy(props)
    return <ul>{props.options.map((option, index) => <li key={index} data-value={String(option.value)}>{option.content}</li>)}</ul>
  }
}))

import { AdminsSelector } from '..'
import { SelectSurfaceContext } from '../../../Shared/UI/selectPlacement'

const adminsList = { loading: false, admins: [{ id: 1, name: 'Ordering', lastname: 'Admin', photo: null }] }

const renderSelector = surface => render(
  <ThemeProvider theme={{ colors: {}, images: {} }}>
    <SelectSurfaceContext.Provider value={surface}>
      <AdminsSelector adminsList={adminsList} filterValues={{ administratorIds: [] }} handleChangeAdmin={vi.fn()} />
    </SelectSurfaceContext.Provider>
  </ThemeProvider>
)

describe('AdminsSelector inside the orders surfaces (C18)', () => {
  it('draws the administrator as a round picture and the name, with no pager', () => {
    const { container } = renderSelector({ fitTrigger: true })
    const row = container.querySelector('[data-value="1"]')
    expect(row.querySelector('.odc-avatar')).toHaveAttribute('data-kind', 'person')
    expect(row.querySelector('.odc-so-label')).toHaveTextContent('Ordering Admin')
    expect(spy.mock.calls.at(-1)[0].pagination).toBeUndefined()
  })

  it('keeps the legacy rows and the pager outside them', () => {
    const { container } = renderSelector({})
    expect(container.querySelector('[data-value="1"] .odc-so')).toBeNull()
    expect(spy.mock.calls.at(-1)[0].pagination).toBeDefined()
  })
})

/* eslint-disable import/first */
// redesign F2 (C18): the status list inside the orders surfaces: groups as headings, plain rows (no
// vertical rule, no padding of their own). Outside them the legacy rows stay.
import React from 'react'
import { render } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const spy = vi.hoisted(() => vi.fn())

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useApi: () => [{ project: 'demo' }],
  useSession: () => [{ user: { level: 0 } }]
}))

vi.mock('../../../../styles/Select', () => ({ Select: () => null }))
vi.mock('../../../../styles/Select/FirstSelect', () => ({
  Select: props => {
    spy(props)
    return (
      <ul>{props.options.map((option, index) => <li key={index} data-value={String(option.value)}>{option.content}</li>)}</ul>
    )
  }
}))
vi.mock('../../../../styles/MultiSelect', () => ({ MultiSelect: () => null }))
vi.mock('../../../Shared', () => ({ Alert: () => null }))
vi.mock('../../OrderStatusRegressionModal', () => ({ OrderStatusRegressionModal: () => null }))

import { OrderStatusTypeSelector } from '..'
import { SelectSurfaceContext } from '../../../Shared/UI/selectPlacement'

const renderList = (surface, props = {}) => render(
  <ThemeProvider theme={createDashboardTheme(theme)}>
    <SelectSurfaceContext.Provider value={surface}>
      <OrderStatusTypeSelector isFirstSelect noPadding orderId={1} deliveryType={1} defaultValue={0} handleUpdateOrderStatus={vi.fn()} {...props} />
    </SelectSurfaceContext.Provider>
  </ThemeProvider>
)

describe('OrderStatusTypeSelector inside the orders surfaces (C18)', () => {
  it('flags the group headings and leaves the statuses as options', () => {
    renderList({ fitTrigger: true }, { placement: 'auto' })
    const options = spy.mock.calls.at(-1)[0].options
    const groups = options.filter(option => option.group).map(option => option.content.props.children)
    expect(groups).toEqual(expect.arrayContaining(['In Progress', 'Completed', 'Cancelled']))
    expect(options.filter(option => option.group).every(option => option.disabled)).toBe(true)
    expect(options.find(option => option.value === 0)).not.toHaveProperty('group')
    expect(options.find(option => option.value === 7)).not.toHaveProperty('group')
  })

  it('draws every row as plain text: no legacy block with a rule and a padding', () => {
    const { container } = renderList({ fitTrigger: true }, { placement: 'auto' })
    expect(container.querySelector('li p')).toBeNull()
    expect(container.querySelector('[data-value="7"]')).toHaveTextContent('Accepted by business')
    expect(container.querySelector('[data-value="inProgress"]')).toHaveTextContent('In Progress')
  })

  it('keeps every value, so what is sent does not change', () => {
    renderList({ fitTrigger: true }, { placement: 'auto' })
    const withSurface = spy.mock.calls.at(-1)[0].options.map(option => option.value)
    spy.mockClear()
    renderList({}, { placement: 'auto' })
    expect(spy.mock.calls.at(-1)[0].options.map(option => option.value)).toEqual(withSurface)
  })
})

describe('the bulk status of the selection bar (C18)', () => {
  it('opens upward, from the bar at the foot of the list', () => {
    renderList({ fitTrigger: true }, { mutiOrdersChange: true, orderControl: true, noSelected: true, defaultValue: 'default' })
    expect(spy.mock.calls.at(-1)[0].placement).toBe('top')
  })

  it('has a single Pending: the group title of the same word is not drawn', () => {
    renderList({ fitTrigger: true }, { mutiOrdersChange: true, orderControl: true, noSelected: true, defaultValue: 'default' })
    const options = spy.mock.calls.at(-1)[0].options
    expect(options.some(option => option.value === 'pending')).toBe(false)
    expect(options.some(option => option.value === 0)).toBe(true)
  })

  it('does not ask for a placement for the same selector outside the orders surfaces', () => {
    renderList({}, { mutiOrdersChange: true, orderControl: true, noSelected: true, defaultValue: 'default' })
    expect(spy.mock.calls.at(-1)[0].placement).toBeUndefined()
  })
})

describe('OrderStatusTypeSelector outside the orders surfaces', () => {
  it('keeps the legacy rows', () => {
    const { container } = renderList({})
    expect(container.querySelector('[data-value="7"] p')).toHaveTextContent('Accepted by business')
    expect(spy.mock.calls.at(-1)[0].options.some(option => option.group)).toBe(false)
  })
})

/* eslint-disable import/first */
// redesign F6i-2 (A3-02): the status select of the panel footer is named «Order status <current status>», not only with
// the status it draws.
import React from 'react'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, fallback) => fallback],
  useApi: () => [{ project: 'demo' }],
  useSession: () => [{ user: { level: 0 } }]
}))

import { SelectSurfaceContext } from '../../../Shared/UI/selectPlacement'
import { DetailsFooter } from '../DetailsFooter'

const renderFooter = (status, surface = { fitTrigger: true }) => render(
  <ThemeProvider theme={createDashboardTheme(theme)}>
    <SelectSurfaceContext.Provider value={surface}>
      <DetailsFooter
        order={{ loading: false, order: { id: 42, delivery_type: 1, status, customer: { name: 'Ada', lastname: 'Lovelace' } } }}
        handleUpdateOrderStatus={vi.fn()}
      />
    </SelectSurfaceContext.Provider>
  </ThemeProvider>
)

describe('DetailsFooter · status trigger name (A3-02)', () => {
  it('is «Order status» followed by the current status', () => {
    renderFooter(11)
    const trigger = document.querySelector('.od-first-select-trigger')
    expect(trigger).toHaveAccessibleName('Order status Delivery Completed by Driver')
    expect(screen.getByRole('button', { name: 'Order status Delivery Completed by Driver' })).toBe(trigger)
  })

  it('legacy surface: the trigger keeps its own text only', () => {
    renderFooter(11, {})
    const trigger = document.querySelector('.od-first-select-trigger')
    expect(trigger).not.toHaveAttribute('aria-labelledby')
    expect(trigger).not.toHaveAttribute('aria-label')
  })
})

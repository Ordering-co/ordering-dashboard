/* eslint-disable import/first */
import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  Logistics: ({ UIComponent, ...props }) => <UIComponent {...props} />,
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{ getTimeAgo: () => 'now', parseDate: value => value }]
}))
vi.mock('react-bootstrap', () => ({
  OverlayTrigger: ({ children }) => children,
  Tooltip: ({ children }) => <span>{children}</span>
}))

import { Logistics } from '..'

describe('Logistics log', () => {
  it('announces refreshed entries and keeps reload as a non-submit action', () => {
    const getLogistics = vi.fn()
    renderWithProviders(
      <Logistics
        logisticList={{ loading: false, logs: [{ id: 1, event: 'created', updated_at: '2026-09-15' }] }}
        parseLog={() => '<span>Created</span>'}
        getLogistics={getLogistics}
      />
    )

    const log = screen.getByRole('log')
    expect(log).toHaveAttribute('aria-live', 'polite')
    const reload = screen.getByRole('button', { name: 'Reload' })
    expect(reload).toHaveAttribute('type', 'button')
    fireEvent.click(reload)
    expect(getLogistics).toHaveBeenCalledTimes(1)
  })
})

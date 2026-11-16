/* eslint-disable import/first */
// redesign F6b (D-18): the Export trigger can collapse to its icon in a narrow head without losing its name:
// the label is a span the stylesheet clips (not removes), an icon waits beside it, and the title says Export.
import React from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  ExportCSV: ({ UIComponent, ...props }) => <UIComponent {...props} actionStatus={{ loading: false, error: null, result: null }} getCSV={vi.fn()} />
}))

import { OrdersExportCSV } from '..'

describe('OrdersExportCSV · trigger that can collapse (D-18)', () => {
  const mount = () => renderWithProviders(<OrdersExportCSV filterValues={{ statuses: [] }} ordersStatusGroup='pending' selectedSubOrderStatus={{}} />)

  it('is still the Export menu button, named Export, with the label in a clippable span and an icon beside it', () => {
    mount()
    const trigger = screen.getByRole('button', { name: 'Export' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('title', 'Export')
    expect(trigger.querySelector('.odc-export-label')).toHaveTextContent('Export')
    expect(trigger.querySelector('.odc-export-icon')).toBeInTheDocument()
    // the chevron of the menu stays
    expect(trigger.querySelectorAll('svg.odc-icon').length).toBe(2)
  })
})

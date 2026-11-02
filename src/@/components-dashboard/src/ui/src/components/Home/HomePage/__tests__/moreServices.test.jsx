import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import dashboardTheme from '~/theme.json'

vi.mock('../../../../../../index', () => ({
  Home: ({ UIComponent, ...props }) => <UIComponent {...props} ordersList={{ loading: false, total: 0 }} todaySalelsList={{ loading: false, sales: 0 }} monthSalesList={{ loading: false, sales: [] }} getCurrentDateRange={() => ({})} disableSupportModule />,
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useUtils: () => [{ parsePrice: value => String(value) }],
  useEvent: () => [{ emit: vi.fn() }],
  useSession: () => [{ user: { level: 0 } }],
  useApi: () => [{}, { configurations: { subdomain: 'orderingplus' } }],
  useSite: () => [{ sites: [] }],
  useConfig: () => [{ configs: {}, loading: true }]
}))
vi.mock('../../../../contexts/InfoShareContext', () => ({ useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: vi.fn() }] }))
vi.mock('../../../../contexts/ProjectContext', () => ({ useProjectState: () => [{ loading: true }] }))
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1280 }) }))
vi.mock('../../../Shared', () => ({ Modal: () => null }))
vi.mock('../../../TrialExtension', () => ({ TrialExtensionHomeCard: () => null }))
vi.mock('react-chartjs-2', () => ({ Line: () => <div /> }))
import { HomePage } from '../index'

const renderHome = () => renderWithProviders(<HomePage />, { theme: { ...dashboardTheme, images: { project: { active: '', pastDuePayment: '' } } } })

describe('Home More Services', () => {
  it('no longer offers the source code and custom work cards to admins', () => {
    renderHome()
    expect(screen.queryByText('More Services')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'View source code' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Contact us about custom work/ })).not.toBeInTheDocument()
  })
})

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import dashboardTheme from '~/theme.json'
import labels from '../../../../../../components/SourceCodeDownloads/sourceCodeTranslations.generated.json'

const state = vi.hoisted(() => ({ language: { code: 'en' }, apiLabels: {} }))

vi.mock('../../../../../../index', () => ({
  Home: ({ UIComponent, ...props }) => <UIComponent {...props} ordersList={{ loading: false, total: 0 }} todaySalelsList={{ loading: false, sales: 0 }} monthSalesList={{ loading: false, sales: [] }} getCurrentDateRange={() => ({})} disableSupportModule />,
  useLanguage: () => [{ language: state.language }, (key, fallback) => state.apiLabels[`DASHBOARD_${key}`] ?? state.apiLabels[key] ?? fallback],
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
beforeEach(() => { state.language = { code: 'en' }; state.apiLabels = {} })

const renderHome = () => renderWithProviders(<HomePage />, { theme: { ...dashboardTheme, images: { project: { active: '', pastDuePayment: '' } } } })

describe('Website Marketplace source CTA', () => {
  it('replaces only the Marketplace purchase claim and keeps the separate custom-work offer', () => {
    renderHome()
    expect(screen.getByText('Website Marketplace source code')).toBeInTheDocument()
    expect(screen.getByText('Find the available Website Marketplace version, installation instructions, and license.')).toBeInTheDocument()
    expect(screen.queryByText(/Purchase the original source code/)).not.toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'View source code' })
    expect(link).toHaveAttribute('href', '/open-source-code')
    expect(link).not.toHaveAttribute('target')
    const customWork = screen.getByRole('link', { name: /Contact us about custom work/ })
    expect(customWork).toHaveAttribute('href', 'https://www.ordering.co/platform-demo-and-pricing')
    expect(customWork).toHaveAttribute('target', '_blank')
  })

  it.each(['es', 'ar'])('localizes the Marketplace source card in %s without changing other offer labels', locale => {
    state.language = { code: locale }
    renderHome()
    expect(screen.getByText(labels.SOURCE_CODE_HOME_TITLE[locale])).toBeInTheDocument()
    expect(screen.getByRole('link', { name: labels.SOURCE_CODE_HOME_CTA[locale] })).toHaveAttribute('href', '/open-source-code')
    expect(screen.getByRole('link', { name: /Contact us about custom work/ })).toHaveAttribute('target', '_blank')
  })

  it('preserves a nonempty API source CTA label', () => {
    state.language = { code: 'es' }
    state.apiLabels = { DASHBOARD_SOURCE_CODE_HOME_CTA: 'Controlled API source CTA' }
    renderHome()
    expect(screen.getByRole('link', { name: 'Controlled API source CTA' })).toHaveAttribute('href', '/open-source-code')
  })
})

import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import dashboardTheme from '~/theme.json'

const state = vi.hoisted(() => ({ isCollapse: false, collapse: vi.fn() }))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useApi: () => [{}, { configurations: {} }]
}))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: state.isCollapse }, { handleMenuCollapse: state.collapse }]
}))
import { FreeProductsList } from '../index'

const theme = { ...dashboardTheme, images: { apps: { driverApp: '/driver.png', storeApp: '/business.png', callCenterApp: '/callcenter.png' }, icons: { delivery: '/delivery.svg', posTerminal: '/pos.svg', poster: '/kiosk.svg' }, general: { appStore: '/app-store.svg', googlePlay: '/google-play.svg' } } }
const renderCatalog = (overrides = {}) => renderWithProviders(<FreeProductsList />, { theme: { ...theme, ...overrides } })
const expectedLinks = [
  ['App Store · Driver App', 'https://apps.apple.com/mx/app/driver-app-v26/id6526462318'],
  ['Google Play · Driver App', 'https://play.google.com/store/apps/details?id=com.orderingplus.driverapp'],
  ['App Store · Business App', 'https://apps.apple.com/mx/app/business-app-v26/id6526502488'],
  ['Google Play · Business App', 'https://play.google.com/store/apps/details?id=com.orderingplus.storeapp'],
  ['Open Call Center', 'https://callcenter.orderingplus.com/signin']
]

describe('Free downloads catalog', () => {
  beforeEach(() => { state.isCollapse = false; state.collapse.mockClear() })
  it('shows only the three Ordering products in the agreed order', () => {
    renderCatalog()
    expect(screen.getByRole('heading', { level: 1, name: 'Free downloads' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 }).map(node => node.textContent)).toEqual(['Driver App', 'Business App', 'Call Center'])
    expect(screen.getAllByText('By Ordering')).toHaveLength(3)
    expect(screen.queryByText(/Kiosk|POS|2\.0/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(5)
  })
  it.each(expectedLinks)('provides the exact safe destination for %s', (name, href) => {
    renderCatalog()
    const link = screen.getByRole('link', { name })
    expect(link).toHaveAttribute('href', href)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
  it('keeps the catalog static without opening product sidebars', async () => {
    renderCatalog()
    await userEvent.click(screen.getByRole('heading', { name: 'Business App' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(3)
  })
  it('opens the collapsed sidebar through a named keyboard accessible control', async () => {
    state.isCollapse = true
    renderCatalog()
    const user = userEvent.setup()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(state.collapse).toHaveBeenCalledExactlyOnceWith(false)
  })
  it('supports optional product imagery and RTL tenant themes', () => {
    renderCatalog({ images: {}, rtl: true, colors: { ...theme.colors, primary: '#5b247a' } })
    expect(screen.getByRole('heading', { name: 'Call Center' })).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(5)
  })
})

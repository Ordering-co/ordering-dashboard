/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const showToast = vi.fn()

vi.mock('../../../../../../index.js', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useConfig: () => [{ configs: {} }],
  useUtils: () => [{ optimizeImage: (url) => url, parseDate: (date) => `parsed ${date}` }],
  useApi: () => [{ project: 'demo' }],
  useSession: () => [{ token: 'token', user: { level: 0 } }],
  useToast: () => [null, { showToast }],
  ToastType: { Error: 'error' },
  PosMenuBusinessDetails: ({ UIComponent, business, ...props }) => (
    <UIComponent
      {...props}
      businessState={{ loading: false, business }}
    />
  )
}))

vi.mock('../../../../styles', () => ({
  Button: ({ children, ...props }) => <button type='button' {...props}>{children}</button>
}))

vi.mock('../../../Shared', () => ({
  Modal: ({ open, title, children }) => open ? <div role='dialog' aria-label={title}>{children}</div> : null
}))

import { SingleBusiness } from '../index'

const clover = {
  id: 9,
  name: 'Clover',
  type: 'pos',
  logo: '/clover.png',
  plugin: { name: 'Clover', root: 'https://clover.plugin', setup_url: '/setup?project=@{project_code}' }
}

const integrationsList = { thirdPartyIntegrations: [clover] }

const posRow = (fields) => ({
  id: 1,
  business_id: 42,
  third_party_integration_id: clover.id,
  third_party_integration: { id: clover.id, name: 'Clover', type: 'pos', logo: '/clover.png' },
  ...fields
})

const businessWith = (integrations) => ({
  id: 42,
  name: 'Pizza Pro',
  logo: '/logo.png',
  third_party_integrations: integrations
})

const listProps = {
  viewMethod: 'list',
  allowColumns: {
    business: true,
    status: true,
    pos: true,
    sales_channels: false
  },
  business: businessWith([]),
  integrationsList,
  handleOpenBusinessDetails: vi.fn(),
  detailsBusinessId: null,
  citiesList: []
}

const getRowCellCount = () => within(screen.getByRole('row')).getAllByRole('cell').length

const renderRow = (ui) => renderWithProviders(<table>{ui}</table>)

describe('Connect SingleBusiness — fromImporters', () => {
  it('hides the status, POS and action columns when fromImporters is true', () => {
    renderRow(
      <SingleBusiness
        {...listProps}
        fromImporters
        allowColumns={{ ...listProps.allowColumns, status: false, pos: false }}
      />
    )

    expect(screen.getByText('Pizza Pro')).toBeInTheDocument()
    expect(screen.queryByText('Not connected')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders skeleton rows without status or action placeholders when fromImporters', () => {
    renderRow(
      <SingleBusiness
        isSkeleton
        viewMethod='list'
        fromImporters
        allowColumns={{ business: true, status: false, pos: false, sales_channels: false }}
      />
    )

    expect(getRowCellCount()).toBe(2)
  })

  it('renders one skeleton cell per visible column of the POS list', () => {
    renderRow(
      <SingleBusiness
        isSkeleton
        viewMethod='list'
        allowColumns={{ business: true, status: true, pos: true, sales_channels: false }}
      />
    )

    expect(getRowCellCount()).toBe(5)
  })
})

describe('Connect SingleBusiness — Sales Channels column', () => {
  const salesChannelsProps = {
    ...listProps,
    fromSalesChannels: true,
    allowColumns: { business: true, status: false, pos: true, sales_channels: true }
  }

  const channel = (id, name) => ({
    id,
    business_id: 42,
    third_party_integration_id: 100 + id,
    third_party_integration: { id: 100 + id, name, type: 'sales_channel', logo: `/${name}.png` }
  })

  it('shows "—" when the business has no sales channel', () => {
    renderRow(<SingleBusiness {...salesChannelsProps} business={businessWith([])} />)

    expect(screen.getAllByText('—')).toHaveLength(2)
  })

  it('shows up to three channel logos and counts the rest', () => {
    const channels = ['Rappi', 'Uber Eats', 'DoorDash', 'Didi', 'Glovo'].map((name, i) => channel(i + 1, name))
    renderRow(<SingleBusiness {...salesChannelsProps} business={businessWith(channels)} />)

    expect(screen.getByTitle('Rappi')).toBeInTheDocument()
    expect(screen.getByTitle('Uber Eats')).toBeInTheDocument()
    expect(screen.getByTitle('DoorDash')).toBeInTheDocument()
    expect(screen.queryByTitle('Didi')).not.toBeInTheDocument()
    expect(screen.getByText('+2')).toHaveAttribute('title', 'Didi, Glovo')
  })

  it('shows no counter with three channels or fewer', () => {
    const channels = ['Rappi', 'Uber Eats', 'DoorDash'].map((name, i) => channel(i + 1, name))
    renderRow(<SingleBusiness {...salesChannelsProps} business={businessWith(channels)} />)

    expect(screen.getByTitle('DoorDash')).toBeInTheDocument()
    expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument()
  })
})

describe('Connect SingleBusiness — POS status and action', () => {
  beforeEach(() => {
    listProps.handleOpenBusinessDetails.mockClear()
    showToast.mockClear()
  })

  it('shows a business without a POS as not connected, with no action', () => {
    renderRow(<SingleBusiness {...listProps} />)

    expect(screen.getByText('Not connected')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows the POS name, and no action when it is connected', () => {
    renderRow(<SingleBusiness {...listProps} business={businessWith([posRow({ setup_status: 'success' })])} />)

    expect(screen.getByText('Clover')).toBeInTheDocument()
    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('warns next to Connected when the POS plugin is disabled', () => {
    renderRow(
      <SingleBusiness
        {...listProps}
        integrationsList={{ thirdPartyIntegrations: [{ ...clover, plugin: { ...clover.plugin, enabled: false } }] }}
        business={businessWith([posRow({ setup_status: 'success' })])}
      />
    )

    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'The plugin of this integration is disabled.' })).toBeInTheDocument()
  })

  it('shows why a failed POS needs attention and when it changed, and offers Reconnect', () => {
    renderRow(
      <SingleBusiness
        {...listProps}
        business={businessWith([posRow({
          setup_status: 'failed',
          setup_message: 'Clover token revoked',
          setup_status_updated_at: '2026-10-21 19:19:10'
        })])}
      />
    )

    expect(screen.getByText('Needs attention')).toBeInTheDocument()
    expect(screen.getByText('Clover token revoked')).toBeInTheDocument()
    expect(screen.getByText('parsed 2026-10-21 19:19:10')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reconnect' })).toBeInTheDocument()
  })

  it('offers Continue setup for a connection the plugin has not reported on yet', () => {
    renderRow(<SingleBusiness {...listProps} business={businessWith([posRow({ setup_status: null })])} />)

    expect(screen.getByText('Setup pending')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue setup' })).toBeInTheDocument()
  })

  it('opens the plugin setup page from the action without opening the panel', async () => {
    renderRow(<SingleBusiness {...listProps} business={businessWith([posRow({ setup_status: 'failed' })])} />)

    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }))

    expect(await screen.findByRole('dialog', { name: 'Clover' })).toBeInTheDocument()
    expect(document.querySelector('iframe').getAttribute('src')).toBe('https://clover.plugin/setup?project=demo')
    expect(listProps.handleOpenBusinessDetails).not.toHaveBeenCalled()
  })

  it('opens the panel when the row is clicked anywhere else', () => {
    renderRow(<SingleBusiness {...listProps} business={businessWith([posRow({ setup_status: 'failed' })])} />)

    fireEvent.click(screen.getByText('Pizza Pro'))

    expect(listProps.handleOpenBusinessDetails).toHaveBeenCalledTimes(1)
  })

  it('offers no action when the plugin has no setup page', () => {
    const noSetup = { thirdPartyIntegrations: [{ ...clover, plugin: { name: 'Clover', root: 'https://clover.plugin' } }] }
    renderRow(
      <SingleBusiness
        {...listProps}
        integrationsList={noSetup}
        business={businessWith([posRow({ setup_status: 'failed' })])}
      />
    )

    expect(screen.getByText('Needs attention')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('offers no action when the plugin is disabled', () => {
    const disabled = { thirdPartyIntegrations: [{ ...clover, plugin: { ...clover.plugin, enabled: false } }] }
    renderRow(
      <SingleBusiness
        {...listProps}
        integrationsList={disabled}
        business={businessWith([posRow({ setup_status: 'failed' })])}
      />
    )

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route } from 'react-router-dom'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const session = vi.hoisted(() => ({ user: { id: 7, level: 0 }, token: 'jwt' }))
const history = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useHistory: () => history
}))

vi.mock('../../../../../../contexts/SessionContext', () => ({
  useSession: () => [session]
}))

vi.mock('../../../../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test/v400/en/demo' }]
}))

vi.mock('../../../../../../index', async () => {
  const { WebsiteMigration } = await vi.importActual('../../../../../../components/WebsiteMigration')
  return {
    WebsiteMigration,
    useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
    useToast: () => [{}, { showToast: vi.fn() }],
    ToastType: {},
    Popup: ({ UIComponent, open, ...props }) => (open ? <UIComponent {...props} open={open} /> : null)
  }
})

import { WebsiteMigration } from '../index'
import { WebsiteInBuilder, formatMigrationDate, getMigrationErrorText } from '..'

const PATH = '/sites/12/migration'

/** Answers GET and POST of the migration; each handler returns `[status, body]`. */
const mockApi = ({ get, post }) => {
  global.fetch = vi.fn((url, options = {}) => {
    const method = options.method || 'GET'
    expect(url).toBe(`https://api.test/v400/en/demo${PATH}`)
    expect(options.headers.Authorization).toBe('Bearer jwt')
    const [status, body] = method === 'POST' ? post() : get()
    return Promise.resolve({ ok: status < 400, status, json: async () => body })
  })
}

const DAY = 24 * 60 * 60 * 1000
const daysAgo = (days) => new Date(Date.now() - days * DAY).toISOString()

const result = (overrides = {}) => ({ status: 'eligible', migrated_at: null, url: null, product_id: null, domain: null, cname_target: null, ...overrides })

const renderMigration = (props = {}) => renderWithProviders(<WebsiteMigration siteId={12} {...props} />)

describe('WebsiteMigration', () => {
  beforeEach(() => {
    history.push.mockClear()
  })

  it('offers the migration, asks first, and shows the migrated site', async () => {
    const onMigrated = vi.fn()
    const onChange = vi.fn()
    const migratedAt = daysAgo(2)
    const migrated = result({ status: 'migrated', migrated_at: migratedAt, url: 'https://shop.example.com', product_id: 31 })
    mockApi({ get: () => [200, { error: false, result: result() }], post: () => [200, { error: false, result: migrated }] })
    renderMigration({ onMigrated, onChange })

    fireEvent.click(await screen.findByRole('button', { name: 'Migrate website' }))
    // Nothing is sent before the confirmation, which says it goes live at once
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/goes live right away/)).toBeInTheDocument()
    expect(screen.getByText(/review your website after the migration/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Migrate now' }))

    expect(await screen.findByRole('heading', { name: 'This website was migrated to the new editor' })).toBeInTheDocument()
    expect(global.fetch.mock.calls[1][1].method).toBe('POST')
    expect(onMigrated).toHaveBeenCalledWith(migrated)
    expect(onChange).toHaveBeenLastCalledWith({ loading: false, migration: migrated })
    expect(screen.getByText(`Migrated on ${formatMigrationDate(migratedAt, 'en')}. It’s now edited in Builder.`)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /View website/ })).toHaveAttribute('href', 'https://shop.example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Open in Builder' }))
    expect(history.push).toHaveBeenCalledWith('/builder/31')
  })

  it('opens the Builder product straight away a week after the migration', async () => {
    mockApi({ get: () => [200, { error: false, result: result({ status: 'migrated', migrated_at: daysAgo(8), product_id: 31 }) }] })
    renderWithProviders(
      <>
        <WebsiteMigration siteId={12} />
        <Route path='/builder/:productId'>{({ match }) => match && <p>Builder product {match.params.productId}</p>}</Route>
      </>,
      { initialEntries: ['/my-products/ordering-website'] }
    )
    expect(await screen.findByText('Builder product 31')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'This website was migrated to the new editor' })).toBeNull()
  })

  it('does nothing when the confirmation is cancelled', async () => {
    mockApi({ get: () => [200, { error: false, result: result() }], post: () => [200, { error: false, result: result({ status: 'migrated' }) }] })
    renderMigration()
    fireEvent.click(await screen.findByRole('button', { name: 'Migrate website' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText(/goes live right away/)).toBeNull()
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('says why a migration was refused, and reads the status again when it changed', async () => {
    let status = 'eligible'
    mockApi({
      get: () => [200, { error: false, result: result({ status }) }],
      post: () => {
        status = 'migrated'
        return [409, { error: true, result: ['already'], error_codes: ['site_migration.already_migrated'] }]
      }
    })
    renderMigration()
    fireEvent.click(await screen.findByRole('button', { name: 'Migrate website' }))
    fireEvent.click(screen.getByRole('button', { name: 'Migrate now' }))
    expect(await screen.findByRole('heading', { name: 'This website was migrated to the new editor' })).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledTimes(3)
  })

  it('shows the refusal it can’t recover from under the button', async () => {
    mockApi({ get: () => [200, { error: false, result: result() }], post: () => [503, { error: true, error_codes: ['site_migration.unavailable'] }] })
    renderMigration()
    fireEvent.click(await screen.findByRole('button', { name: 'Migrate website' }))
    fireEvent.click(screen.getByRole('button', { name: 'Migrate now' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Migration isn’t available right now. Try again later.')
    expect(screen.getByRole('button', { name: 'Migrate website' })).not.toBeDisabled()
  })

  it('asks for the DNS change first, with the record to create', async () => {
    mockApi({ get: () => [200, { error: false, result: result({ status: 'dns_required', domain: 'order.example.com', cname_target: 'cname.my-sites.app' }) }] })
    renderMigration()
    expect(await screen.findByRole('heading', { name: 'To migrate, first change your domain’s DNS' })).toBeInTheDocument()
    expect(screen.getByText(/Your domain order.example.com isn’t on our network yet/)).toBeInTheDocument()
    const row = screen.getAllByRole('row')[1]
    expect(within(row).getByText('CNAME')).toBeInTheDocument()
    expect(within(row).getByText('order')).toBeInTheDocument()
    expect(within(row).getByText('cname.my-sites.app')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Migrate website' })).toBeNull()
  })

  it('shows nothing for a site that can’t be migrated, or when the API has no migrations', async () => {
    const onChange = vi.fn()
    mockApi({ get: () => [200, { error: false, result: result({ status: 'not_eligible' }) }] })
    const { container, unmount } = renderMigration({ onChange })
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith({ loading: false, migration: result({ status: 'not_eligible' }) }))
    expect(container).toBeEmptyDOMElement()
    unmount()

    mockApi({ get: () => [404, { error: true, result: ['Not found'] }] })
    const view = renderMigration({ onChange })
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith({ loading: false, migration: null }))
    expect(view.container).toBeEmptyDOMElement()
  })

  it('names refusals and formats the day it was migrated', () => {
    const t = (_key, fallback) => fallback
    expect(getMigrationErrorText(['site_migration.dns_required'], t, 'cname.my-sites.app')).toBe('Point your domain to cname.my-sites.app first.')
    expect(getMigrationErrorText(['other'], t)).toBe('The website couldn’t be migrated. Try again.')
    expect(formatMigrationDate('2026-10-19 23:30:00', 'en')).toMatch(/Oct (19|20), 2026/)
    expect(formatMigrationDate('2026-10-19T10:00:00Z', 'en')).toBe('Oct 19, 2026')
    expect(formatMigrationDate('nope', 'en')).toBe('')
  })

  it('sends a page with no website to Builder', () => {
    renderWithProviders(<WebsiteInBuilder />)
    expect(screen.getByRole('heading', { name: 'Websites are now made in Builder' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Go to Builder' }))
    expect(history.push).toHaveBeenCalledWith('/builder')
  })
})

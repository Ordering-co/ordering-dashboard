import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

import SCHEMA from './themeNodesFixture.json'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))
vi.mock('../../../styles', async () => {
  const ReactActual = await vi.importActual('react')
  return {
    Button: ReactActual.forwardRef(({ color, borderRadius, outline, ...props }, ref) => <button ref={ref} {...props} />)
  }
})

import { SiteSettingsEditor } from '../ThemeSchemaEditor'

const list = (extra = {}) => ({ items: [], search: '', page: 0, totalPages: 0, total: 0, loading: false, loaded: false, error: false, ...extra })
const STORES = [{ id: 7, name: 'Burger Town Centro', slug: 'centro', logo: 'https://cdn/centro.png' }, { id: 8, name: 'Burger Town Norte' }]

const renderPicker = (extra = {}) => {
  const site = {
    current: { site: {} },
    edits: {},
    fieldErrors: {},
    errorCodes: [],
    scope: { mode: 'single_store', businessId: null, franchiseId: null },
    scopeOptions: { stores: list(), franchises: list() },
    scopeSelection: null,
    scopeIncomplete: false,
    hasEdits: false,
    setValue: vi.fn(),
    setScope: vi.fn(),
    setScopeMode: vi.fn(),
    loadScopeOptions: vi.fn(),
    reloadScopeSelection: vi.fn(),
    save: vi.fn(),
    discard: vi.fn(),
    ...extra
  }
  const view = renderWithProviders(<SiteSettingsEditor schema={SCHEMA} site={site} />)
  const rerender = (next) => view.rerender(<SiteSettingsEditor schema={SCHEMA} site={{ ...site, ...next }} />)
  return { site, rerender }
}

describe('Website type pickers', () => {
  afterEach(() => { vi.useRealTimers() })

  it('names the type, the picker, its search and its list', () => {
    renderPicker({ scopeOptions: { stores: list({ items: STORES, loaded: true, page: 1, totalPages: 1, total: 2 }), franchises: list() }, scope: { mode: 'single_store', businessId: 7, franchiseId: null }, scopeSelection: { item: STORES[0] } })
    const types = screen.getByRole('radiogroup', { name: 'Website type' })
    expect(within(types).getByRole('radio', { name: 'One store' })).toBeChecked()
    const picker = screen.getByRole('group', { name: 'Store' })
    expect(within(picker).getByRole('searchbox', { name: 'Search stores by name, slug or ID' })).toBeInTheDocument()
    const options = within(picker).getByRole('listbox', { name: 'Stores' })
    expect(options).toHaveAttribute('aria-busy', 'false')
    expect(within(options).getByRole('option', { name: 'Burger Town Centro' })).toHaveAttribute('aria-selected', 'true')
    expect(within(options).getByRole('option', { name: 'Burger Town Norte' })).toHaveAttribute('aria-selected', 'false')
  })

  it('asks for the first page of the type’s list, and nothing for the marketplace', () => {
    const { site, rerender } = renderPicker({ scope: { mode: 'marketplace', businessId: null, franchiseId: null } })
    expect(site.loadScopeOptions).not.toHaveBeenCalled()
    expect(screen.queryByRole('listbox')).toBeNull()
    rerender({ scope: { mode: 'franchise', businessId: null, franchiseId: null } })
    expect(site.loadScopeOptions).toHaveBeenCalledWith('franchises', { search: '' })
    expect(screen.getByRole('searchbox', { name: 'Search franchises by name, slug or ID' })).toBeInTheDocument()
  })

  it('searches on the server once the typing stops', () => {
    vi.useFakeTimers()
    const { site } = renderPicker({ scopeOptions: { stores: list({ items: STORES, loaded: true, page: 1, totalPages: 1, total: 2 }), franchises: list() } })
    expect(site.loadScopeOptions).not.toHaveBeenCalled()
    const search = screen.getByRole('searchbox', { name: 'Search stores by name, slug or ID' })
    fireEvent.change(search, { target: { value: 'ce' } })
    act(() => { vi.advanceTimersByTime(100) })
    fireEvent.change(search, { target: { value: 'centro ' } })
    act(() => { vi.advanceTimersByTime(299) })
    expect(site.loadScopeOptions).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(site.loadScopeOptions).toHaveBeenCalledTimes(1)
    expect(site.loadScopeOptions).toHaveBeenCalledWith('stores', { search: 'centro' })
  })

  it('loads the next page with its button or at the end of the list', () => {
    const { site, rerender } = renderPicker({ scopeOptions: { stores: list({ items: STORES, loaded: true, page: 1, totalPages: 3, total: 41 }), franchises: list() } })
    expect(screen.getByText('Showing 2 of 41')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(site.loadScopeOptions).toHaveBeenLastCalledWith('stores', { more: true })
    const options = screen.getByRole('listbox', { name: 'Stores' })
    Object.defineProperties(options, { scrollHeight: { value: 600, configurable: true }, clientHeight: { value: 240, configurable: true } })
    options.scrollTop = 100
    fireEvent.scroll(options)
    expect(site.loadScopeOptions).toHaveBeenCalledTimes(1)
    options.scrollTop = 330
    fireEvent.scroll(options)
    expect(site.loadScopeOptions).toHaveBeenCalledTimes(2)
    // While a page loads, and after the last one, nothing more is asked
    rerender({ scopeOptions: { stores: list({ items: STORES, loaded: true, loading: true, page: 1, totalPages: 3, total: 41 }), franchises: list() } })
    expect(screen.getByRole('listbox', { name: 'Stores' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
    rerender({ scopeOptions: { stores: list({ items: STORES, loaded: true, page: 3, totalPages: 3, total: 41 }), franchises: list() } })
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
    fireEvent.scroll(screen.getByRole('listbox', { name: 'Stores' }))
    expect(site.loadScopeOptions).toHaveBeenCalledTimes(2)
  })

  it('picks a row with the row, for the controller to keep it', () => {
    const { site } = renderPicker({ scope: { mode: 'franchise', businessId: null, franchiseId: null }, scopeOptions: { stores: list(), franchises: list({ items: [{ id: 3, name: 'Burger Group' }], loaded: true, page: 1, totalPages: 1, total: 1 }) } })
    fireEvent.click(screen.getByRole('option', { name: 'Burger Group' }))
    expect(site.setScope).toHaveBeenCalledWith({ mode: 'franchise', franchiseId: 3, item: { id: 3, name: 'Burger Group' } })
  })

  it('shows the picked one when no loaded page has it, while it is read, and when it is gone', () => {
    const { site, rerender } = renderPicker({ scope: { mode: 'single_store', businessId: 70, franchiseId: null }, scopeSelection: { item: null, loading: true } })
    expect(screen.getByText('#70 · Loading')).toBeInTheDocument()
    rerender({ scope: { mode: 'single_store', businessId: 70, franchiseId: null }, scopeSelection: { item: { id: 70, name: 'Burger Town Airport', enabled: false } } })
    const picker = screen.getByRole('group', { name: 'Store' })
    expect(within(picker).getByText('Burger Town Airport')).toBeInTheDocument()
    expect(within(picker).getByText('(disabled)')).toBeInTheDocument()
    rerender({ scope: { mode: 'single_store', businessId: 70, franchiseId: null }, scopeSelection: { item: null, missing: true } })
    expect(screen.getByRole('alert')).toHaveTextContent('Store #70 isn’t available anymore. Choose another one.')
    rerender({ scope: { mode: 'single_store', businessId: 70, franchiseId: null }, scopeSelection: { item: null, error: true } })
    fireEvent.click(within(screen.getByRole('group', { name: 'Store' })).getByRole('button', { name: 'Try again' }))
    expect(site.reloadScopeSelection).toHaveBeenCalled()
  })

  it('asks for a pick when the type has none, and says why it can’t be saved', () => {
    renderPicker({ scope: { mode: 'franchise', businessId: null, franchiseId: null }, scopeIncomplete: true, hasEdits: true, errorCodes: ['scope.incomplete'] })
    expect(screen.getByText('Choose the franchise')).toBeInTheDocument()
    expect(screen.getByText('Choose a franchise to save this website type.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Choose the store or the franchise this website shows, or make it a marketplace.')
  })

  it('tells an empty project from a search without matches, and loads a failed list again', () => {
    const { site, rerender } = renderPicker({ scopeOptions: { stores: list({ loaded: true }), franchises: list() } })
    expect(screen.getByRole('status')).toHaveTextContent('There are no enabled stores yet.')
    rerender({ scopeOptions: { stores: list({ loaded: true, search: 'zzz' }), franchises: list() } })
    expect(screen.getByRole('status')).toHaveTextContent('Nothing matches “zzz”.')
    rerender({ scopeOptions: { stores: list({ error: true }), franchises: list() } })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('We couldn’t load the list. Try again in a moment.')
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(site.loadScopeOptions).toHaveBeenLastCalledWith('stores', { search: '', force: true })
  })
})

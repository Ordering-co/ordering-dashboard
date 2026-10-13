import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const state = vi.hoisted(() => ({ props: {}, emit: vi.fn(), showToast: vi.fn() }))

vi.mock('../../../../../index', () => ({
  BuilderProductDetail: ({ UIComponent, ...props }) => <UIComponent {...props} {...state.props} />,
  BuilderProductDomain: ({ UIComponent, ...props }) => <UIComponent {...props} domainState={{ loading: false, error: false, domain: null }} />,
  ToastType: { Success: 'SUCCESS', Error: 'ERROR' },
  useEvent: () => [{ emit: state.emit }],
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useToast: () => [{}, { showToast: state.showToast }],
  useUtils: () => [{ parseDate: (value) => `date:${value}` }]
}))
vi.mock('../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: vi.fn() }]
}))
vi.mock('../../../styles', () => ({
  Button: ({ color, borderRadius, outline, ...props }) => <button {...props} />,
  IconButton: ({ color, ...props }) => <button {...props} />,
  Input: (props) => <input {...props} />,
  TextArea: (props) => <textarea {...props} />
}))
vi.mock('../BuilderAppSettings', () => ({
  BuilderAppColors: () => <div>colors tab</div>,
  BuilderAppFiles: ({ focusGroup }) => <div>files tab {focusGroup}</div>
}))
vi.mock('../BuilderAppConstants', () => ({ BuilderAppConstantsList: () => <div>constants tab</div> }))
vi.mock('../BuilderAppCredentials', () => ({ BuilderAppCredentialsForm: () => <div>credentials tab</div> }))
vi.mock('../../Shared', () => ({
  Modal: ({ open, children }) => open ? <div>{children}</div> : null,
  Confirm: ({ open, title, acceptText, onAccept, onCancel, children }) => open
    ? (
      <div role='dialog' aria-label={title}>
        {children}
        <button onClick={onCancel}>Cancel</button>
        <button onClick={onAccept}>{acceptText}</button>
      </div>
      )
    : null
}))

import { BuilderProduct } from '../BuilderProductDetail'

const product = {
  id: 41,
  code: 'a8k2m',
  name: 'Repartidores',
  product_type: 'driver_app',
  product_status: 'draft',
  created_at: '2026-10-07 17:02:11',
  updated_at: '2026-10-07 17:02:11',
  apps: [{
    id: 310,
    name: 'Repartidores',
    version: '0.0.1',
    package: 'com.miproyecto.k3x9a',
    base: { id: 14, name: 'Driver 26', platforms: ['ios', 'android'] },
    platforms: [{ platform: 'android', name: 'Repartidores Android', version: '0.0.2', package: 'com.miproyecto.android' }],
    builds: [{ platform: 'android', mode: 'release', status: 'failed', error_code: 'build_timed_out', app_version: '0.0.2', updated_at: '2026-10-07 17:40:00' }]
  }]
}

const renderDetail = (productState, extra = {}) => {
  state.props = { productState, reloadProduct: vi.fn(), statusState: { loading: false }, changeStatus: vi.fn(), checksState: { loading: false, checks: null, error: false }, ...extra }
  return renderWithProviders(<BuilderProduct productId='41' />)
}

const withStatus = (productStatus) => ({ loading: false, product: { ...product, product_status: productStatus }, errorKind: null })

describe('BuilderProduct detail', () => {
  beforeEach(() => {
    state.emit.mockReset()
    state.showToast.mockReset()
  })

  it('shows the app without a My products hand-off', () => {
    renderDetail({ loading: false, product, errorKind: null })
    expect(screen.getByRole('heading', { level: 1, name: 'Repartidores' })).toBeTruthy()
    expect(screen.getByText('Driver app · Code a8k2m · Created date:2026-10-07 17:02:11')).toBeTruthy()
    expect(screen.queryByText(/My products/)).toBeNull()
  })

  it('fills platforms the customer has not edited with the app values', () => {
    renderDetail({ loading: false, product, errorKind: null })
    const [, iosRow, androidRow] = screen.getAllByRole('row')
    expect(within(iosRow).getByText('Uses app values')).toBeTruthy()
    expect(within(iosRow).getByText('com.miproyecto.k3x9a')).toBeTruthy()
    expect(within(androidRow).getByText('com.miproyecto.android')).toBeTruthy()
    // The last build moved to the Builds card
    expect(screen.queryByRole('columnheader', { name: 'Last build' })).toBeNull()
  })

  it('shows a not found state with a way back', () => {
    renderDetail({ loading: false, product: null, errorKind: 'not_found' })
    expect(screen.getByText('This app doesn’t exist')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to Builder' }))
    expect(state.emit).toHaveBeenCalledWith('go_to_page', { page: 'builder' })
  })

  it.each([
    ['draft', ['More actions', 'Activate']],
    ['active', ['More actions', 'Move to draft']],
    ['archived', ['Move to draft', 'Activate']]
  ])('offers the status actions that fit a %s app', (status, labels) => {
    renderDetail(withStatus(status))
    for (const label of labels) expect(screen.getAllByRole('button', { name: label }).length).toBeGreaterThan(0)
    const all = ['More actions', 'Activate', 'Move to draft']
    for (const label of all.filter(l => !labels.includes(l))) expect(screen.queryByRole('button', { name: label })).toBeNull()
  })

  it('activates and confirms with a toast, showing no checks', async () => {
    const changeStatus = vi.fn(async () => ({ product: { ...product, product_status: 'active' }, errorKind: null }))
    renderDetail(withStatus('draft'), { changeStatus })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Activate' })) })
    expect(changeStatus).toHaveBeenCalledWith('active')
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Repartidores is active')
  })

  it('asks before archiving', async () => {
    const changeStatus = vi.fn(async () => ({ product: { ...product, product_status: 'archived' }, errorKind: null }))
    renderDetail(withStatus('active'), { changeStatus })
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Archive' }))
    const dialog = screen.getByRole('dialog', { name: 'Archive Repartidores?' })
    expect(within(dialog).getByText(/Archived apps can’t build from here. Installed apps keep working/)).toBeTruthy()
    expect(changeStatus).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' })) })
    expect(changeStatus).toHaveBeenCalledWith('archived')
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Repartidores was archived')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('says when the change failed', async () => {
    const changeStatus = vi.fn(async () => ({ product: null, errorKind: 'error' }))
    renderDetail(withStatus('archived'), { changeStatus })
    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Move to draft' })[0]) })
    expect(state.showToast).toHaveBeenCalledWith('ERROR', 'Couldn’t change the status. Try again.')
  })

  it('locks the actions while a change is running', () => {
    renderDetail(withStatus('draft'), { statusState: { loading: true, nextStatus: 'active' } })
    expect(screen.getByRole('button', { name: 'Activate' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'More actions' }).disabled).toBe(true)
  })

  it('switches tabs, keeps the tab in the URL and opens the one a check points to', () => {
    window.history.replaceState(null, '', '/builder/41')
    renderDetail(withStatus('draft'), {
      checksEnabled: true,
      checksState: {
        loading: false,
        error: false,
        checks: { platforms: { ios: { problems: [{ code: 'missing_file', level: 'warning', subject: { name: 'Icon iOS', group: 'resources_icons' } }] } } }
      }
    })
    expect(screen.getByRole('tab', { name: 'General' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByRole('tab', { name: 'Constants' }))
    expect(screen.getByText('constants tab')).toBeTruthy()
    expect(window.location.search).toBe('?tab=constants')
    fireEvent.click(screen.getByRole('button', { name: 'Fix' }))
    expect(screen.getByText('files tab resources_icons')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'General' }))
    expect(window.location.search).toBe('')
  })

  it('renames the product in place', async () => {
    const renameProduct = vi.fn(async () => ({ ok: true, errorCodes: [] }))
    renderDetail(withStatus('draft'), { renameProduct })
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    fireEvent.change(screen.getByLabelText('Name in Ordering'), { target: { value: ' Drivers ' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
    expect(renameProduct).toHaveBeenCalledWith('Drivers')
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Renamed to Drivers')
  })

  it('keeps an app name to 30 characters', async () => {
    const renameProduct = vi.fn(async () => ({ ok: true, errorCodes: [] }))
    renderDetail(withStatus('draft'), { renameProduct })
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    const input = screen.getByLabelText('Name in Ordering')
    expect(input.getAttribute('maxLength')).toBe('30')
    fireEvent.change(input, { target: { value: 'x'.repeat(31) } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
    expect(screen.getByText('Use 30 characters or fewer.')).toBeTruthy()
    expect(renameProduct).not.toHaveBeenCalled()
  })

  it('hides the checks of an archived app', () => {
    renderDetail(withStatus('archived'), { checksEnabled: false, checksState: { loading: false, checks: null, error: false } })
    expect(screen.queryByText('Before the next build')).toBeNull()
  })

  describe('a website', () => {
    const web = {
      id: 43,
      code: 'fleet-mountain-7zoeit',
      name: 'Prueba web',
      kind: 'web',
      product_type: 'marketplace_website',
      product_status: 'draft',
      domain: null,
      temporal_domain: 'fleet-mountain-7zoeit-stores.my-sites.app',
      created_at: '2026-10-08 17:40:00',
      apps: []
    }

    it('shows where it is online and its general data, without app tabs', () => {
      renderDetail({ loading: false, product: web, errorKind: null })
      expect(screen.getByText('Marketplace website · Code fleet-mountain-7zoeit · Created date:2026-10-08 17:40:00')).toBeTruthy()
      expect(screen.getByRole('heading', { name: 'Your website is online' })).toBeTruthy()
      expect(screen.getByRole('link', { name: /Open website/ }).getAttribute('href')).toBe('https://fleet-mountain-7zoeit-stores.my-sites.app')
      expect(screen.getByText('Domains')).toBeTruthy()
      expect(screen.queryByRole('tablist')).toBeNull()
      expect(screen.queryByText('This product has no app')).toBeNull()
      expect(screen.queryByRole('heading', { name: 'Builds' })).toBeNull()
    })

    it('keeps a website name to 100 characters', () => {
      renderDetail({ loading: false, product: web, errorKind: null })
      fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
      expect(screen.getByLabelText('Name in Ordering').getAttribute('maxLength')).toBe('100')
    })

    it('stands in for a name left empty', () => {
      renderDetail({ loading: false, product: { ...web, name: '  ' }, errorKind: null })
      expect(screen.getByRole('heading', { level: 1, name: 'Untitled website' })).toBeTruthy()
      expect(screen.getByText('Untitled website', { selector: '[aria-current="page"]' })).toBeTruthy()
    })

    it('asks for a name when activating is refused for it', async () => {
      const changeStatus = vi.fn(async () => ({ product: null, errorKind: 'incomplete', checks: [], missing: ['name'] }))
      const renameProduct = vi.fn(async () => ({ ok: true, errorCodes: [] }))
      renderDetail({ loading: false, product: { ...web, name: '' }, errorKind: null }, { changeStatus, renameProduct })
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Activate' })) })
      const dialog = screen.getByRole('alertdialog', { name: 'Add a name to activate this website' })
      expect(screen.queryByText(/can’t be activated yet/)).toBeNull()
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add a name' }))

      expect(screen.queryByRole('alertdialog')).toBeNull()
      const input = screen.getByLabelText('Name in Ordering')
      expect(document.activeElement).toBe(input)
      expect(screen.getByText('Then activate the website again.')).toBeTruthy()
      fireEvent.change(input, { target: { value: 'Burger Town' } })
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
      expect(renameProduct).toHaveBeenCalledWith('Burger Town')
    })

    it('falls back to a message for anything else a website misses', async () => {
      const changeStatus = vi.fn(async () => ({ product: null, errorKind: 'incomplete', checks: [], missing: ['logo'] }))
      renderDetail({ loading: false, product: web, errorKind: null }, { changeStatus })
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Activate' })) })
      expect(state.showToast).toHaveBeenCalledWith('ERROR', 'Complete the product before activating it.')
      expect(screen.queryByRole('alertdialog')).toBeNull()
    })

    it('says an archived website stays online', async () => {
      renderDetail({ loading: false, product: { ...web, product_status: 'active' }, errorKind: null })
      fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Archive' }))
      const dialog = screen.getByRole('dialog', { name: 'Archive Prueba web?' })
      expect(within(dialog).getByText('For now this only labels the website as archived. It stays online at fleet-mountain-7zoeit-stores.my-sites.app; you can bring it back at any time.')).toBeTruthy()
    })
  })
})

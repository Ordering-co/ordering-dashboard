import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const state = vi.hoisted(() => ({ props: {}, emit: vi.fn(), showToast: vi.fn(), isCollapse: false, handleMenuCollapse: vi.fn() }))

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
  useInfoShare: () => [{ isCollapse: state.isCollapse }, { handleMenuCollapse: state.handleMenuCollapse }]
}))
// redesign B2: the detail shell no longer imports `../../../styles` nor `../../Shared`; the children of other slices it
// mounts (builds card, app general, build dialogs) render their real pieces here.
vi.mock('../BuilderAppSettings', () => ({
  BuilderAppColors: () => <div>colors tab</div>,
  BuilderAppFiles: ({ focusGroup }) => <div>files tab {focusGroup}</div>
}))
vi.mock('../BuilderAppConstants', () => ({ BuilderAppConstantsList: () => <div>constants tab</div> }))
vi.mock('../BuilderWebTheme', () => ({
  BuilderWebThemes: ({ onEditTheme }) => <button onClick={() => onEditTheme(10)}>themes list</button>,
  BuilderThemeEditorView: ({ themeId, onBack, onUnsavedChange }) => (
    <>
      <button onClick={onBack}>editor of {themeId}</button>
      <button onClick={() => onUnsavedChange(true)}>change the theme</button>
    </>
  )
}))
vi.mock('../BuilderWebSite', () => ({ BuilderWebSiteSettings: () => <div>website settings tab</div> }))
vi.mock('../BuilderAppCredentials', () => ({ BuilderAppCredentialsForm: () => <div>credentials tab</div> }))

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

// redesign B2: «More actions» is a P/Menu: its items are menuitems in a popup that opens on a real press
const openMore = async () => {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'More actions' }))
  return screen.findByRole('menu')
}

describe('BuilderProduct detail', () => {
  beforeEach(() => {
    state.emit.mockReset()
    state.showToast.mockReset()
    state.handleMenuCollapse.mockReset()
    state.isCollapse = false
  })

  it('shows the app without a My products hand-off', () => {
    renderDetail({ loading: false, product, errorKind: null })
    expect(screen.getByRole('heading', { level: 1, name: 'Repartidores' })).toBeTruthy()
    expect(screen.getByText('Driver app · Code a8k2m · Created date:2026-10-07 17:02:11')).toBeTruthy()
    expect(screen.queryByText(/My products/)).toBeNull()
  })

  // redesign B2: the header on Product pieces
  it('draws the header with Product pieces: rename button, status badge and status actions', () => {
    renderDetail(withStatus('draft'))
    const rename = screen.getByRole('button', { name: 'Rename' })
    expect(rename.classList.contains('odc-btn')).toBe(true)
    expect(rename.getAttribute('title')).toBe('Rename')
    const badge = screen.getByText('Draft').closest('.odc-badge')
    expect(badge?.getAttribute('data-family')).toBe('pending')
    const activate = screen.getByRole('button', { name: 'Activate' })
    expect(activate.classList.contains('odc-btn')).toBe(true)
    expect(activate.getAttribute('data-variant')).toBe('primary')
    expect(screen.getByRole('button', { name: 'More actions' }).getAttribute('aria-haspopup')).toBe('menu')
  })

  it('opens the menu from the header when it is collapsed', () => {
    state.isCollapse = true
    renderDetail(withStatus('draft'))
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(state.handleMenuCollapse).toHaveBeenCalledWith(false)
  })

  it('goes back to the list from the breadcrumb', () => {
    renderDetail(withStatus('draft'))
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' })
    const link = within(breadcrumb).getByRole('link', { name: 'Builder' })
    expect(link.getAttribute('href')).toBe('/builder')
    fireEvent.click(link)
    expect(state.emit).toHaveBeenCalledWith('go_to_page', { page: 'builder' })
    expect(within(breadcrumb).getByText('Repartidores', { selector: '[aria-current="page"]' })).toBeTruthy()
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

  // redesign B2: P/Skeleton in a busy region
  it('shows a skeleton while it loads', () => {
    const { container } = renderDetail({ loading: true, product: null, errorKind: null })
    const busy = container.querySelector('[aria-busy="true"]')
    expect(busy).toBeTruthy()
    expect(busy.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    expect(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByText('App', { selector: '[aria-current="page"]' })).toBeTruthy()
  })

  it('shows a not found state with a way back', () => {
    renderDetail({ loading: false, product: null, errorKind: 'not_found' })
    // redesign B2: P/EmptyState with the title as a heading, as BuilderMessage drew it
    expect(screen.getByRole('heading', { name: 'This app doesn’t exist' })).toBeTruthy()
    expect(screen.getByText('It may have been deleted, or it belongs to another project.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to Builder' }))
    expect(state.emit).toHaveBeenCalledWith('go_to_page', { page: 'builder' })
  })

  it.each([
    ['disabled', 'Builder isn’t available here', 'Builder is turned off for this installation.'],
    ['no_access', 'You don’t have access to Builder', 'Only admins with edit permissions can create and manage apps. Ask a project owner for access.']
  ])('says when Builder is %s, with nothing to do', (errorKind, title, text) => {
    renderDetail({ loading: false, product: null, errorKind })
    expect(screen.getByRole('heading', { name: title })).toBeTruthy()
    expect(screen.getByText(text)).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('announces a failed load and tries again', () => {
    renderDetail({ loading: false, product: null, errorKind: 'error' })
    const alert = screen.getByRole('alert')
    expect(within(alert).getByText('We couldn’t load this app')).toBeTruthy()
    expect(within(alert).getByText('Check your connection and try again.')).toBeTruthy()
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(state.props.reloadProduct).toHaveBeenCalled()
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
    const menu = await openMore()
    // redesign B2: Archive is a menuitem of P/Menu and the confirmation a P/ConfirmDialog (alertdialog)
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Archive' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Archive Repartidores?' })
    expect(within(dialog).getByText(/Archived apps can’t build from here. Installed apps keep working/)).toBeTruthy()
    expect(changeStatus).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' })) })
    expect(changeStatus).toHaveBeenCalledWith('archived')
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Repartidores was archived')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('keeps the app when the archive is cancelled', async () => {
    const changeStatus = vi.fn()
    renderDetail(withStatus('draft'), { changeStatus })
    const menu = await openMore()
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Archive' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Archive Repartidores?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(changeStatus).not.toHaveBeenCalled()
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

  it('lists what an app misses when activating is refused, with the way to fix it', async () => {
    const checks = [{
      app_id: 310,
      platforms: { ios: { problems: [{ code: 'missing_file', level: 'warning', subject: { name: 'Icon iOS', group: 'resources_icons' } }] } }
    }]
    const changeStatus = vi.fn(async () => ({ product: null, errorKind: 'incomplete', checks }))
    renderDetail(withStatus('draft'), { changeStatus })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Activate' })) })
    // redesign B2: a P/Dialog that keeps the alertdialog role
    const dialog = await screen.findByRole('alertdialog', { name: 'Repartidores can’t be activated yet' })
    expect(dialog.classList.contains('odc-dialog')).toBe(true)
    expect(within(dialog).getByText('Complete these and try again. Issues marked Ordering don’t stop it.')).toBeTruthy()
    expect(within(dialog).getByText('Repartidores · iOS')).toBeTruthy()
    expect(within(dialog).getByText('Upload Icon iOS')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fix' }))
    expect(screen.getByText('files tab resources_icons')).toBeTruthy()
    expect(window.location.search).toBe('?tab=files')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    window.history.replaceState(null, '', '/')
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
    // redesign B2: P/Tabs, named, with its hint as a P/InlineNotice
    expect(screen.getByRole('tablist', { name: 'App sections' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'General' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('Changes to the app apply on the next build. The name in Ordering changes right away.').closest('.odc-notice')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Constants' }))
    expect(screen.getByText('constants tab')).toBeTruthy()
    expect(screen.getByText('Constants apply on the next build.')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Constants' }).getAttribute('aria-selected')).toBe('true')
    expect(window.location.search).toBe('?tab=constants')
    fireEvent.click(screen.getByRole('button', { name: 'Fix' }))
    expect(screen.getByText('files tab resources_icons')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'General' }))
    expect(window.location.search).toBe('')
  })

  it('opens the tab of the URL', () => {
    window.history.replaceState(null, '', '/builder/41?tab=credentials')
    renderDetail(withStatus('draft'))
    expect(screen.getByRole('tab', { name: 'Credentials' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tabpanel').textContent).toContain('credentials tab')
    window.history.replaceState(null, '', '/')
  })

  it('says when a product has no app', () => {
    renderDetail({ loading: false, product: { ...product, apps: [] }, errorKind: null })
    expect(screen.getByRole('heading', { name: 'This product has no app' })).toBeTruthy()
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('renames the product in place', async () => {
    const renameProduct = vi.fn(async () => ({ ok: true, errorCodes: [] }))
    renderDetail(withStatus('draft'), { renameProduct })
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    const input = screen.getByLabelText('Name in Ordering')
    // redesign B2: a P/TextField
    expect(input.classList.contains('odc-field-input')).toBe(true)
    expect(input.value).toBe('Repartidores')
    expect(document.activeElement).toBe(input)
    fireEvent.change(input, { target: { value: ' Drivers ' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
    expect(renameProduct).toHaveBeenCalledWith('Drivers')
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Renamed to Drivers')
    expect(screen.queryByLabelText('Name in Ordering')).toBeNull()
  })

  it('leaves the rename with Escape or Cancel, saving nothing', () => {
    const renameProduct = vi.fn()
    renderDetail(withStatus('draft'), { renameProduct })
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    fireEvent.keyDown(screen.getByLabelText('Name in Ordering'), { key: 'Escape' })
    expect(screen.queryByLabelText('Name in Ordering')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('Name in Ordering')).toBeNull()
    expect(renameProduct).not.toHaveBeenCalled()
  })

  it('asks for a name and says why the API refused one', async () => {
    const renameProduct = vi.fn(async () => ({ ok: false, errorCodes: ['name.max'] }))
    renderDetail(withStatus('draft'), { renameProduct })
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    const input = screen.getByLabelText('Name in Ordering')
    fireEvent.change(input, { target: { value: '   ' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
    expect(renameProduct).not.toHaveBeenCalled()
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByRole('alert').textContent).not.toBe('')
    fireEvent.change(input, { target: { value: 'Drivers' } })
    expect(screen.queryByRole('alert')).toBeNull()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
    expect(screen.getByRole('alert').textContent).toBe('Use 30 characters or fewer.')
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

  describe('an app with themes (has_themes)', () => {
    const marketplaceApp = { ...product, kind: 'app', product_type: 'marketplace_app', has_themes: true }
    const appTabs = () => within(screen.getByRole('tablist', { name: 'App sections' })).getAllByRole('tab').map(tab => tab.textContent)

    it('has the Theme tab after General, with the same themes list and editor as a website', async () => {
      window.history.replaceState(null, '', '/builder/41')
      renderDetail({ loading: false, product: marketplaceApp, errorKind: null })
      expect(appTabs()).toEqual(['General', 'Theme', 'Images and files', 'Constants', 'Credentials', 'Push notifications', 'Builds'])
      await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Theme' })) })
      expect(window.location.search).toBe('?tab=theme')
      expect(screen.getByText(/the next time they open the app/)).toBeTruthy()
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'themes list' })) })
      expect(window.location.search).toBe('?tab=theme&theme=10')
      expect(screen.getByText('Theme', { selector: '[aria-current="page"]' })).toBeTruthy()
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'editor of 10' })) })
      expect(screen.getByRole('button', { name: 'themes list' })).toBeTruthy()
    })

    it('has no Appearance tab: the theme sets its colors, and a link to it opens General', () => {
      window.history.replaceState(null, '', '/builder/41?tab=appearance')
      renderDetail({ loading: false, product: marketplaceApp, errorKind: null })
      expect(screen.queryByRole('tab', { name: 'Appearance' })).toBeNull()
      expect(screen.queryByText('colors tab')).toBeNull()
      expect(screen.getByRole('tab', { name: 'General' }).getAttribute('aria-selected')).toBe('true')
    })

    it('keeps the Appearance tab in an app without themes', () => {
      window.history.replaceState(null, '', '/builder/41?tab=appearance')
      renderDetail({ loading: false, product: { ...product, kind: 'app', has_themes: false }, errorKind: null })
      expect(screen.getByRole('tab', { name: 'Appearance' }).getAttribute('aria-selected')).toBe('true')
      expect(screen.getByText('colors tab')).toBeTruthy()
    })

    it('opens a theme’s editor from its link', () => {
      window.history.replaceState(null, '', '/builder/41?tab=theme&theme=10')
      renderDetail({ loading: false, product: marketplaceApp, errorKind: null })
      expect(screen.getByRole('button', { name: 'editor of 10' })).toBeTruthy()
    })

    it('has no Theme tab without themes, nor its editor from a link', () => {
      window.history.replaceState(null, '', '/builder/41?tab=theme&theme=10')
      renderDetail({ loading: false, product: { ...product, kind: 'app', has_themes: false }, errorKind: null })
      expect(screen.queryByRole('tab', { name: 'Theme' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'editor of 10' })).toBeNull()
      expect(screen.getByRole('tab', { name: 'General' }).getAttribute('aria-selected')).toBe('true')
    })

    it('reads `has_themes` for a website too, and the kind only when the API doesn’t send it', () => {
      window.history.replaceState(null, '', '/builder/43')
      const web = { ...product, id: 43, kind: 'web', product_type: 'marketplace_website', apps: [] }
      const webTabs = () => within(screen.getByRole('tablist', { name: 'Website sections' })).getAllByRole('tab').map(tab => tab.textContent)
      const { unmount } = renderDetail({ loading: false, product: { ...web, has_themes: false }, errorKind: null })
      expect(webTabs()).toEqual(['General', 'Website settings'])
      unmount()
      renderDetail({ loading: false, product: web, errorKind: null })
      expect(webTabs()).toEqual(['General', 'Website settings', 'Theme'])
    })
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

    it('shows where it is online and its general data, with only the website tabs', () => {
      renderDetail({ loading: false, product: web, errorKind: null })
      expect(screen.getByText('Marketplace website · Code fleet-mountain-7zoeit · Created date:2026-10-08 17:40:00')).toBeTruthy()
      expect(screen.getByRole('heading', { name: 'Your website is online' })).toBeTruthy()
      const open = screen.getByRole('link', { name: /Open website/ })
      expect(open.getAttribute('href')).toBe('https://fleet-mountain-7zoeit-stores.my-sites.app')
      // redesign B2: a link drawn as a Product button, still in a new tab
      expect(open.getAttribute('target')).toBe('_blank')
      expect(open.getAttribute('rel')).toBe('noopener noreferrer')
      expect(open.classList.contains('odc-btn')).toBe(true)
      expect(open.textContent).toContain('(opens in a new tab)')
      expect(screen.getByText('Domains')).toBeTruthy()
      expect(within(screen.getByRole('tablist', { name: 'Website sections' })).getAllByRole('tab').map(tab => tab.textContent)).toEqual(['General', 'Website settings', 'Theme'])
      expect(screen.queryByText('This product has no app')).toBeNull()
      expect(screen.queryByRole('heading', { name: 'Builds' })).toBeNull()
    })

    it('lists its general data', () => {
      renderDetail({ loading: false, product: web, errorKind: null })
      const general = screen.getByRole('region', { name: 'General' })
      expect(Array.from(general.querySelectorAll('dt')).map(node => node.textContent)).toEqual(['Name in Ordering', 'Type', 'Status'])
      expect(Array.from(general.querySelectorAll('dd')).map(node => node.textContent)).toEqual(['Prueba web', 'Marketplace website', 'Draft'])
    })

    it('goes back to the website from the theme’s breadcrumb, asking first with changes not saved', async () => {
      renderDetail({ loading: false, product: web, errorKind: null })
      await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Theme' })) })
      expect(screen.getByText('How your website looks. Your customers see the active theme; changes reach them after you publish.')).toBeTruthy()
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'themes list' })) })
      const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' })
      expect(within(breadcrumb).getByRole('link', { name: 'Prueba web' }).getAttribute('href')).toBe('/builder/43')
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'change the theme' })) })
      await act(async () => { fireEvent.click(within(breadcrumb).getByRole('link', { name: 'Prueba web' })) })
      // redesign B2: P/ConfirmDialog (alertdialog); its cancel is «Stay», as main's Confirm said
      const dialog = await screen.findByRole('alertdialog', { name: 'Leave without saving?' })
      expect(within(dialog).getByText('You have changes you haven’t saved. They’ll be lost.')).toBeTruthy()
      await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Stay' })) })
      expect(screen.getByRole('button', { name: 'editor of 10' })).toBeTruthy()
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
      await act(async () => { fireEvent.click(within(breadcrumb).getByRole('link', { name: 'Prueba web' })) })
      await act(async () => { fireEvent.click(within(await screen.findByRole('alertdialog', { name: 'Leave without saving?' })).getByRole('button', { name: 'Leave' })) })
      expect(screen.getByRole('heading', { name: 'Your website is online' })).toBeTruthy()
      expect(window.location.search).not.toContain('theme=')
    })

    it('opens the themes and a theme to edit, and goes back to them', async () => {
      renderDetail({ loading: false, product: web, errorKind: null })
      await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Theme' })) })
      expect(window.location.search).toContain('tab=theme')
      expect(screen.queryByRole('heading', { name: 'Your website is online' })).toBeNull()
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'themes list' })) })
      expect(window.location.search).toContain('theme=10')
      expect(screen.getByText('Theme', { selector: '[aria-current="page"]' })).toBeTruthy()
      expect(screen.queryByRole('tablist')).toBeNull()
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'editor of 10' })) })
      expect(window.location.search).not.toContain('theme=10')
      expect(screen.getByRole('button', { name: 'themes list' })).toBeTruthy()
      await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'General' })) })
      expect(window.location.search).not.toContain('tab=')
    })

    it('opens a theme’s editor from its link, and leaving it takes its section and item out of the URL', async () => {
      window.history.replaceState(null, '', '/builder/43?tab=theme&theme=10&section=components&item=components.button')
      renderDetail({ loading: false, product: web, errorKind: null })
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'editor of 10' })) })
      expect(window.location.search).toBe('?tab=theme')
      expect(screen.getByRole('button', { name: 'themes list' })).toBeTruthy()

      // A section left in the URL doesn't reach the next theme opened, nor another tab
      window.history.replaceState(null, '', '/builder/43?tab=theme&section=pages&item=pages.home')
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'themes list' })) })
      expect(window.location.search).toBe('?tab=theme&theme=10')
      window.history.replaceState(null, '', '/builder/43?tab=theme&theme=10&section=pages')
      await act(async () => { fireEvent.click(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('link', { name: 'Prueba web' })) })
      expect(window.location.search).toBe('')
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
      const dialog = await screen.findByRole('alertdialog', { name: 'Add a name to activate this website' })
      // redesign B2: a P/Dialog, described by its text
      expect(dialog.classList.contains('odc-dialog')).toBe(true)
      expect(dialog).toHaveAccessibleDescription(/A website needs a name before it goes active/)
      expect(within(dialog).getByText('After you save it, activate the website again.')).toBeTruthy()
      expect(screen.queryByText(/can’t be activated yet/)).toBeNull()
      await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Add a name' })) })

      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
      const input = screen.getByLabelText('Name in Ordering')
      await waitFor(() => expect(document.activeElement).toBe(input))
      expect(screen.getByText('Then activate the website again.')).toBeTruthy()
      expect(input).toHaveAccessibleDescription('Then activate the website again.')
      fireEvent.change(input, { target: { value: 'Burger Town' } })
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
      expect(renameProduct).toHaveBeenCalledWith('Burger Town')
    })

    it('closes the name dialog without renaming', async () => {
      const changeStatus = vi.fn(async () => ({ product: null, errorKind: 'incomplete', checks: [], missing: ['name'] }))
      renderDetail({ loading: false, product: { ...web, name: '' }, errorKind: null }, { changeStatus })
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Activate' })) })
      const dialog = await screen.findByRole('alertdialog', { name: 'Add a name to activate this website' })
      const closes = within(dialog).getAllByRole('button', { name: 'Close' })
      fireEvent.click(closes[closes.length - 1])
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
      expect(screen.queryByLabelText('Name in Ordering')).toBeNull()
    })

    it('falls back to a message for anything else a website misses', async () => {
      const changeStatus = vi.fn(async () => ({ product: null, errorKind: 'incomplete', checks: [], missing: ['logo'] }))
      renderDetail({ loading: false, product: web, errorKind: null }, { changeStatus })
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Activate' })) })
      expect(state.showToast).toHaveBeenCalledWith('ERROR', 'Complete the product before activating it.')
      expect(screen.queryByRole('alertdialog')).toBeNull()
    })

    describe('with its own domain', () => {
      const lock = 'A website with its own domain can’t be moved to draft or archived. Remove the domain first.'

      it.each(['active', 'archived'])('keeps an %s website from moving to draft, saying why', (status) => {
        renderDetail({ loading: false, product: { ...web, product_status: status, domain: 'shop.burgertown.com' }, errorKind: null })
        const draft = screen.getByRole('button', { name: 'Move to draft' })
        expect(draft.disabled).toBe(true)
        const hint = document.getElementById(draft.getAttribute('aria-describedby'))
        expect(hint.textContent).toContain(lock)
        expect(within(hint).getByRole('button', { name: 'Go to Domains' })).toBeTruthy()
        // redesign B2: the hint is a P/InlineNotice
        expect(hint.classList.contains('odc-notice')).toBe(true)
      })

      it('keeps it from being archived, and activating stays open', async () => {
        renderDetail({ loading: false, product: { ...web, domain: 'shop.burgertown.com' }, errorKind: null })
        expect(screen.getByRole('button', { name: 'Activate' }).disabled).toBe(false)
        const menu = await openMore()
        // redesign B2: a disabled menuitem whose reason is its accessible description
        const archive = within(menu).getByRole('menuitem', { name: 'Archive' })
        expect(archive.getAttribute('aria-disabled')).toBe('true')
        expect(document.getElementById(archive.getAttribute('aria-describedby')).textContent).toContain(lock)
        expect(archive).toHaveAccessibleDescription(lock)
        fireEvent.click(archive)
        expect(screen.queryByRole('alertdialog')).toBeNull()
      })

      it('takes the user to the Domains card of the General tab', async () => {
        window.history.replaceState(null, '', '/builder/43?tab=site')
        renderDetail({ loading: false, product: { ...web, product_status: 'active', domain: 'shop.burgertown.com' }, errorKind: null })
        expect(screen.getByText('website settings tab')).toBeTruthy()
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Go to Domains' })) })
        expect(window.location.search).not.toContain('tab=')
        expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Domains' }))
      })

      it('offers every status action without a domain', async () => {
        renderDetail({ loading: false, product: { ...web, product_status: 'active' }, errorKind: null })
        expect(screen.getByRole('button', { name: 'Move to draft' }).disabled).toBe(false)
        expect(screen.getByRole('button', { name: 'Move to draft' }).getAttribute('aria-describedby')).toBeNull()
        expect(screen.queryByText(lock)).toBeNull()
        const menu = await openMore()
        expect(within(menu).getByRole('menuitem', { name: 'Archive' }).getAttribute('aria-disabled')).not.toBe('true')
      })

      it('explains a refusal of the API with the same message', async () => {
        const changeStatus = vi.fn(async () => ({ product: null, errorKind: 'domain_configured', checks: null }))
        renderDetail({ loading: false, product: { ...web, product_status: 'active' }, errorKind: null }, { changeStatus })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Move to draft' })) })
        expect(changeStatus).toHaveBeenCalledWith('draft')
        expect(state.showToast).toHaveBeenCalledWith('ERROR', lock)
      })
    })

    it('says an archived website stays online', async () => {
      renderDetail({ loading: false, product: { ...web, product_status: 'active' }, errorKind: null })
      const menu = await openMore()
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Archive' }))
      const dialog = await screen.findByRole('alertdialog', { name: 'Archive Prueba web?' })
      expect(within(dialog).getByText('For now this only labels the website as archived. It stays online at fleet-mountain-7zoeit-stores.my-sites.app; you can bring it back at any time.')).toBeTruthy()
    })
  })
})

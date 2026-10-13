import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const state = vi.hoisted(() => ({ props: {}, historyProps: {}, emit: vi.fn(), showToast: vi.fn() }))

vi.mock('../../../../../index', () => ({
  BuilderProductDetail: ({ UIComponent, ...props }) => <UIComponent {...props} {...state.props} />,
  BuilderAppBuilds: ({ UIComponent, ...props }) => <UIComponent {...props} {...state.historyProps} />,
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
vi.mock('react-qr-code', () => ({ default: ({ value, size, ...props }) => <svg data-value={value} {...props} /> }))
vi.mock('../BuilderAppSettings', () => ({
  BuilderAppColors: () => <div>colors tab</div>,
  BuilderAppFiles: ({ focusGroup }) => <div>files tab {focusGroup}</div>
}))
vi.mock('../BuilderAppConstants', () => ({ BuilderAppConstantsList: () => <div>constants tab</div> }))
vi.mock('../BuilderAppCredentials', () => ({ BuilderAppCredentialsForm: () => <div>credentials tab</div> }))
vi.mock('../../Shared', () => ({
  Confirm: ({ open, title, acceptText, onAccept, onCancel, children }) => open
    ? (
      <div role='dialog' aria-label={title}>
        {children}
        <button onClick={onCancel}>Keep</button>
        <button onClick={onAccept}>{acceptText}</button>
      </div>
      )
    : null,
  Modal: ({ open, children, onClose }) => open
    ? (
      <div>
        <button onClick={onClose}>Close dialog</button>
        {children}
      </div>
      )
    : null,
  Pagination: ({ currentPage, totalPages, handleChangePage }) => (
    <button onClick={() => handleChangePage(currentPage + 1)}>Page {currentPage} of {totalPages}</button>
  )
}))

import { BuilderProduct } from '../BuilderProductDetail'

const app = {
  id: 310,
  name: 'Repartidores',
  version: '1.2.0',
  base: { id: 14, platforms: ['ios', 'android'] },
  platforms: [],
  builds: []
}
const product = { id: 41, code: 'a8k2m', name: 'Repartidores', product_type: 'driver_app', product_status: 'draft', apps: [app] }
const attempt = (fields) => ({
  id: 1,
  platform: 'ios',
  mode: 'ad-hoc',
  type: null,
  status: 'pending',
  app_version: '1.2.0',
  requested_by_type: 'project_user',
  created_at: '2026-10-08 10:42:00',
  updated_at: '2026-10-08 10:50:00',
  retryable: false,
  ...fields
})
const answer = (fields = {}) => ({ ok: true, result: null, errorCodes: [], checks: null, ...fields })

const renderDetail = (extra = {}, status = 'draft') => {
  state.props = {
    productState: { loading: false, product: { ...product, product_status: status }, errorKind: null },
    reloadProduct: vi.fn(),
    statusState: { loading: false },
    changeStatus: vi.fn(),
    checksEnabled: status !== 'archived',
    checksState: { loading: false, checks: { platforms: {} }, error: false },
    reloadChecks: vi.fn(),
    onAppChanged: vi.fn(),
    latestBuildsState: { loading: false, error: false, platforms: {} },
    reloadLatestBuilds: vi.fn(),
    buildsHistoryVersion: 0,
    requestBuild: vi.fn(async () => answer({ result: attempt({ id: 9 }) })),
    retryBuild: vi.fn(async () => answer()),
    cancelBuild: vi.fn(async () => answer()),
    getBuildLog: vi.fn(async () => answer({ result: { attempt_id: 1, log: 'line 1\nline 2' } })),
    getBuildDownload: vi.fn(async () => answer({ result: { url: 'https://files.test/app.ipa' } })),
    adHocInstallUrl: 'http://api/builder/apps/310/downloads/ios/ad-hoc/ipa',
    buildGuides: { android_aab: 'https://guides.test/aab' },
    ...extra
  }
  return renderWithProviders(<BuilderProduct productId='41' />)
}

const column = (name) => within(screen.getByRole('region', { name: 'Builds' })).getByText(name, { selector: 'strong' }).closest('div').parentElement

describe('Builds card', () => {
  beforeEach(() => {
    state.showToast.mockReset()
    window.history.replaceState(null, '', '/builder/41')
  })

  it('shows each platform: running, successful behind its changes, and never built', () => {
    renderDetail({
      latestBuildsState: {
        loading: false,
        error: false,
        platforms: {
          ios: { latest: attempt({ id: 5, mode: 'app-store', status: 'building' }), successful: attempt({ id: 4, status: 'successful' }), pending_changes: false },
          android: { latest: attempt({ id: 6, platform: 'android', mode: 'release', type: 'bundle', status: 'successful' }), successful: attempt({ id: 6, platform: 'android', mode: 'release', type: 'bundle', status: 'successful' }), pending_changes: true }
        }
      }
    })
    const ios = column('iOS')
    expect(within(ios).getByText('Building')).toBeTruthy()
    expect(within(ios).getByText('App Store · v1.2.0')).toBeTruthy()
    expect(within(ios).getByRole('button', { name: 'Cancel build' })).toBeTruthy()
    expect(within(ios).getByRole('button', { name: 'Build' }).disabled).toBe(true)
    expect(within(ios).getByText('iOS is already building.')).toBeTruthy()
    expect(within(ios).getByText('Last successful')).toBeTruthy()
    expect(within(ios).getByRole('button', { name: 'Install on iPhone' })).toBeTruthy()

    const android = column('Android')
    expect(within(android).getByRole('button', { name: 'Download AAB' })).toBeTruthy()
    expect(within(android).getByText('Changes since this build. Build again to include them.')).toBeTruthy()
    expect(within(android).getByRole('link', { name: /Next step: upload it in Play Console/ }).getAttribute('href')).toBe('https://guides.test/aab')
    expect(within(android).getByRole('button', { name: 'Build' }).disabled).toBe(false)
  })

  it('offers no cancel while the file is checked, and retry when the API allows it', () => {
    renderDetail({
      latestBuildsState: {
        loading: false,
        error: false,
        platforms: {
          ios: { latest: attempt({ status: 'finishing' }), successful: null, pending_changes: null },
          android: { latest: attempt({ id: 2, platform: 'android', mode: 'release', type: 'assemble', status: 'failed', error_code: 'build_timed_out', retryable: true }), successful: null, pending_changes: null }
        }
      }
    })
    expect(within(column('iOS')).queryByRole('button', { name: 'Cancel build' })).toBeNull()
    const android = column('Android')
    expect(within(android).getByText('The build took too long and was stopped.')).toBeTruthy()
    expect(within(android).getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  it('shows the install QR of an ad hoc build on demand', () => {
    renderDetail({
      latestBuildsState: { loading: false, error: false, platforms: { ios: { latest: attempt({ status: 'successful' }), successful: attempt({ status: 'successful' }), pending_changes: false } } }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Install on iPhone' }))
    expect(screen.getByRole('img', { name: 'QR code to install the app' }).getAttribute('data-value')).toBe('http://api/builder/apps/310/downloads/ios/ad-hoc/ipa')
  })

  it('downloads through a fresh link', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const getBuildDownload = vi.fn(async () => answer({ result: { url: 'https://files.test/app.ipa' } }))
    renderDetail({
      getBuildDownload,
      latestBuildsState: { loading: false, error: false, platforms: { ios: { latest: attempt({ id: 4, status: 'successful' }), successful: attempt({ id: 4, status: 'successful' }), pending_changes: false } } }
    })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Download IPA' })) })
    expect(getBuildDownload).toHaveBeenCalledWith(4)
    expect(click).toHaveBeenCalled()
    click.mockRestore()
  })

  it('builds in the chosen mode and confirms with a toast', async () => {
    const requestBuild = vi.fn(async () => answer({ result: attempt({ id: 9 }) }))
    renderDetail({
      requestBuild,
      latestBuildsState: { loading: false, error: false, platforms: { android: { latest: null, successful: null, pending_changes: null } } }
    })
    fireEvent.click(within(column('Android')).getByRole('button', { name: 'Build' }))
    const dialog = screen.getByRole('dialog', { name: 'Build for Android' })
    // A draft starts on the mode to try
    expect(within(dialog).getByRole('radio', { name: /APK/ }).checked).toBe(true)
    fireEvent.click(within(dialog).getByRole('radio', { name: /AAB/ }))
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Build' })) })
    expect(requestBuild).toHaveBeenCalledWith('android', { mode: 'release', type: 'bundle' })
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Android build requested. Its status updates here.')
    expect(screen.queryByRole('dialog', { name: 'Build for Android' })).toBeNull()
  })

  it('lists what blocks the build and links each item to its tab', async () => {
    const requestBuild = vi.fn(async () => answer({
      ok: false,
      errorCodes: ['build.blocked'],
      checks: [{ code: 'missing_credentials', level: 'warning', platform: 'ios', fields: ['api_key_file'] }]
    }))
    renderDetail({
      requestBuild,
      checksState: {
        loading: false,
        error: false,
        checks: { platforms: { ios: { problems: [{ code: 'missing_constant', level: 'error' }] } } }
      },
      latestBuildsState: { loading: false, error: false, platforms: { ios: { latest: null, successful: null, pending_changes: null } } }
    })
    fireEvent.click(within(column('iOS')).getByRole('button', { name: 'Build' }))
    const dialog = screen.getByRole('dialog', { name: 'Build for iOS' })
    expect(within(dialog).getByText('Ordering is reviewing 1 issue(s) in the base. They don’t stop this build.')).toBeTruthy()
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Build' })) })
    expect(within(dialog).getByText('Complete these before building for iOS:')).toBeTruthy()
    expect(within(dialog).getByText('Upload API key file (.p8). If you already uploaded it, upload it again.')).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Build' }).disabled).toBe(true)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fix' }))
    expect(screen.queryByRole('dialog', { name: 'Build for iOS' })).toBeNull()
    expect(screen.getByText('credentials tab')).toBeTruthy()
  })

  it('warns that a retry uses the attempt’s settings, and can build with the current ones', async () => {
    const requestBuild = vi.fn(async () => answer({ result: attempt({ id: 9 }) }))
    const failed = attempt({ id: 2, mode: 'app-store', status: 'failed', retryable: true })
    renderDetail({ requestBuild, latestBuildsState: { loading: false, error: false, platforms: { ios: { latest: failed, successful: null, pending_changes: null } } } })
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    const dialog = screen.getByRole('dialog', { name: 'Retry this build?' })
    expect(within(dialog).getByText(/Changes you made after it aren’t included/)).toBeTruthy()
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Build with current settings' })) })
    expect(requestBuild).toHaveBeenCalledWith('ios', { mode: 'app-store', type: null })
  })

  it('explains a refused cancel', async () => {
    const cancelBuild = vi.fn(async () => answer({ ok: false, errorCodes: ['build.not_running'] }))
    renderDetail({ cancelBuild, latestBuildsState: { loading: false, error: false, platforms: { ios: { latest: attempt({ status: 'queued' }), successful: null, pending_changes: null } } } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel build' }))
    const dialog = screen.getByRole('dialog', { name: 'Cancel this iOS build?' })
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel build' })) })
    expect(state.showToast).toHaveBeenCalledWith('ERROR', 'This build already finished. There’s nothing to cancel.')
  })

  it('opens the log with why the build failed', async () => {
    const getBuildLog = vi.fn(async () => answer({ result: { attempt_id: 2, log: 'step 1\nERROR' } }))
    renderDetail({ getBuildLog, latestBuildsState: { loading: false, error: false, platforms: { ios: { latest: attempt({ id: 2, status: 'failed', error_code: 'invalid_local_certificates' }), successful: null, pending_changes: null } } } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'View log' })) })
    const dialog = screen.getByRole('dialog', { name: 'Build log · iOS · Ad hoc · v1.2.0' })
    expect(getBuildLog).toHaveBeenCalledWith(2)
    expect(within(dialog).getByText('The iOS certificates saved for this app are no longer valid.')).toBeTruthy()
    expect(within(dialog).getByLabelText('Build log').textContent).toBe('step 1\nERROR')
  })

  it('says there is no log yet', async () => {
    const getBuildLog = vi.fn(async () => answer({ ok: false, errorCodes: ['build.no_log'] }))
    renderDetail({ getBuildLog, latestBuildsState: { loading: false, error: false, platforms: { ios: { latest: attempt({ status: 'pending' }), successful: null, pending_changes: null } } } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'View log' })) })
    expect(screen.getByText('There’s no log yet. It appears once the build starts.')).toBeTruthy()
  })

  it('tells an archived app how to build again', async () => {
    const changeStatus = vi.fn(async () => ({ product: { ...product, product_status: 'draft' }, errorKind: null, checks: null }))
    renderDetail({ changeStatus }, 'archived')
    expect(screen.getByText('Archived apps don’t build')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Build' })).toBeNull()
    const [, cardMoveToDraft] = screen.getAllByRole('button', { name: 'Move to draft' })
    await act(async () => { fireEvent.click(cardMoveToDraft) })
    expect(changeStatus).toHaveBeenCalledWith('draft')
  })

  it('lists what each app misses when activating is refused', async () => {
    const checks = [{
      app_id: 310,
      errors: 1,
      warnings: 1,
      platforms: { android: { problems: [{ code: 'empty_constant', level: 'warning', subject: { name: 'Maps key' } }, { code: 'x', level: 'error' }] } }
    }]
    const changeStatus = vi.fn(async () => ({ product: null, errorKind: 'incomplete', checks }))
    renderDetail({ changeStatus })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Activate' })) })
    expect(state.showToast).not.toHaveBeenCalled()
    const dialog = screen.getByRole('alertdialog', { name: 'Repartidores can’t be activated yet' })
    expect(within(dialog).getByText('Repartidores · Android')).toBeTruthy()
    expect(within(dialog).getByText('Set a value for Maps key')).toBeTruthy()
    expect(within(dialog).getByText('Ordering is reviewing an issue in the base. It doesn’t stop your builds.')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fix' }))
    expect(screen.getByText('constants tab')).toBeTruthy()
  })
})

describe('Builds tab', () => {
  const history = (builds, extra = {}) => ({
    historyState: { loading: false, error: false, builds, pagination: { total_pages: 1 } },
    reloadHistory: vi.fn(),
    filters: { platform: null, statuses: [] },
    changeFilters: vi.fn(),
    page: 1,
    pageSize: 10,
    changePage: vi.fn(),
    ...extra
  })

  beforeEach(() => window.history.replaceState(null, '', '/builder/41?tab=builds'))

  it('shows each attempt with the actions it allows', () => {
    state.historyProps = history([
      attempt({ id: 9, mode: 'app-store', status: 'building' }),
      attempt({ id: 8, platform: 'android', mode: 'release', type: 'bundle', status: 'successful' }),
      attempt({ id: 7, mode: 'app-store', status: 'failed', error_code: 'build_timed_out', retry_of_id: 6, retry_number: 1, requested_by_type: 'system', retryable: true }),
      attempt({ id: 5, platform: 'android', mode: 'release', type: 'bundle', status: 'successful' }),
      attempt({ id: 4, status: 'finishing' })
    ])
    renderDetail()
    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByRole('button', { name: 'Cancel' })).toBeTruthy()
    expect(within(rows[1]).getByRole('button', { name: 'Download' })).toBeTruthy()
    expect(within(rows[2]).getByText('Retry 1')).toBeTruthy()
    expect(within(rows[2]).getByText('Automatic')).toBeTruthy()
    expect(within(rows[2]).getByText('The build took too long and was stopped.')).toBeTruthy()
    expect(within(rows[2]).getByRole('button', { name: 'Retry' })).toBeTruthy()
    // A newer AAB replaced this file
    expect(within(rows[3]).queryByRole('button', { name: 'Download' })).toBeNull()
    expect(within(rows[4]).queryByRole('button', { name: 'Cancel' })).toBeNull()
  })

  it('filters by grouped status and pages', () => {
    const changeFilters = vi.fn()
    const changePage = vi.fn()
    state.historyProps = history([attempt({})], { changeFilters, changePage, historyState: { loading: false, error: false, builds: [attempt({})], pagination: { total_pages: 3 } } })
    renderDetail()
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'waiting' } })
    expect(changeFilters).toHaveBeenCalledWith({ statuses: ['pending', 'queued'] })
    fireEvent.change(screen.getByLabelText('Platform'), { target: { value: 'android' } })
    expect(changeFilters).toHaveBeenCalledWith({ platform: 'android' })
    fireEvent.click(screen.getByRole('button', { name: 'Page 1 of 3' }))
    expect(changePage).toHaveBeenCalledWith(2)
  })

  it('says when there are no builds yet', () => {
    state.historyProps = history([])
    renderDetail()
    expect(screen.getByText('No builds yet')).toBeTruthy()
  })
})

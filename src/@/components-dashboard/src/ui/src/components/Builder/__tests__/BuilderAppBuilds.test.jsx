import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
vi.mock('react-qr-code', () => ({ default: ({ value, size, ...props }) => <svg data-value={value} {...props} /> }))
vi.mock('../BuilderAppSettings', () => ({
  BuilderAppColors: () => <div>colors tab</div>,
  BuilderAppFiles: ({ focusGroup }) => <div>files tab {focusGroup}</div>
}))
vi.mock('../BuilderAppConstants', () => ({ BuilderAppConstantsList: () => <div>constants tab</div> }))
vi.mock('../BuilderAppCredentials', () => ({ BuilderAppCredentialsForm: () => <div>credentials tab</div> }))
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
// the links last 24 hours from the fake now of the install tests
const NOW = Date.parse('2026-10-08T12:00:00Z')
const installLink = (fields = {}) => ({ url: 'https://files.test/install/1', expires_at: '2026-10-09T12:00:00Z', platform: 'android', mode: 'release', file: 'apk', ...fields })
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
    createInstallLink: vi.fn(async () => answer({ result: installLink() })),
    buildGuides: { android_aab: 'https://guides.test/aab' },
    ...extra
  }
  return renderWithProviders(<BuilderProduct productId='41' />)
}

// redesign B2: each platform column is a group named by its platform
const column = (name) => within(screen.getByRole('region', { name: 'Builds' })).getByRole('group', { name })
// A P/RadioGroup option is a button: its state is aria-checked
const isChecked = (radio) => radio.getAttribute('aria-checked') === 'true'

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
    // redesign B2: Product buttons
    expect(within(ios).getByRole('button', { name: 'Build' }).classList.contains('odc-btn')).toBe(true)
    // the successful ad hoc build is the latest of its own type, on its tab
    expect(within(ios).queryByRole('button', { name: 'Install on iPhone' })).toBeNull()
    fireEvent.click(within(ios).getByRole('tab', { name: /^Ad hoc/ }))
    expect(within(ios).queryByText('Last successful')).toBeNull()
    expect(within(ios).getByRole('button', { name: 'Install on iPhone' })).toBeTruthy()

    const android = column('Android')
    expect(within(android).getByRole('button', { name: 'Download AAB' })).toBeTruthy()
    expect(within(android).getByText('Changes since this build. Build again to include them.')).toBeTruthy()
    expect(within(android).getByRole('link', { name: /Next step: upload it in Play Console/ }).getAttribute('href')).toBe('https://guides.test/aab')
    expect(within(android).getByRole('button', { name: 'Build' }).disabled).toBe(false)
  })

  it('draws a skeleton per platform while the builds load', () => {
    renderDetail({ latestBuildsState: { loading: true, error: false, platforms: null } })
    const card = screen.getByRole('region', { name: 'Builds' })
    expect(card.getAttribute('aria-busy')).toBe('true')
    // redesign B2: P/Skeleton, one block per platform of the base
    expect(card.querySelectorAll('.odc-skeleton')).toHaveLength(2)
  })

  it('says the builds could not load and tries again', () => {
    const reloadLatestBuilds = vi.fn()
    renderDetail({ reloadLatestBuilds, latestBuildsState: { loading: false, error: true, platforms: null } })
    const alert = within(screen.getByRole('region', { name: 'Builds' })).getByRole('alert')
    expect(alert.textContent).toContain('We couldn’t load the builds.')
    const retry = within(alert).getByRole('button', { name: 'Try again' })
    expect(retry.classList.contains('odc-btn')).toBe(true) // redesign B2
    fireEvent.click(retry)
    expect(reloadLatestBuilds).toHaveBeenCalled()
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

  describe('install on a phone', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
      vi.setSystemTime(NOW)
    })
    afterEach(() => vi.useRealTimers())

    const apk = attempt({ id: 7, platform: 'android', mode: 'release', type: 'assemble', status: 'successful' })
    const adHoc = attempt({ id: 3, status: 'successful' })
    const renderInstall = (platform, build, extra = {}) => renderDetail({
      latestBuildsState: { loading: false, error: false, platforms: { [platform]: { latest: build, successful: build, pending_changes: false } } },
      ...extra
    })
    const flush = () => act(async () => { await Promise.resolve() })

    it('asks for the link of a release APK when the panel opens and draws its QR', async () => {
      const createInstallLink = vi.fn(async () => answer({ result: installLink() }))
      renderInstall('android', apk, { createInstallLink })
      const android = column('Android')
      expect(within(android).queryByRole('button', { name: 'Install on iPhone' })).toBeNull()
      const install = within(android).getByRole('button', { name: 'Install on Android' })
      expect(install.getAttribute('aria-expanded')).toBe('false')
      expect(createInstallLink).not.toHaveBeenCalled()
      fireEvent.click(install)
      expect(install.getAttribute('aria-expanded')).toBe('true')
      expect(within(android).getByText('Preparing the install link…')).toBeTruthy()
      await flush()
      expect(createInstallLink).toHaveBeenCalledWith(7)
      expect(within(android).getByRole('img', { name: 'QR code to install the app' }).getAttribute('data-value')).toBe('https://files.test/install/1')
      expect(within(android).getByText('Scan with the phone’s camera to download the APK. Android asks to allow installing apps from this source the first time.')).toBeTruthy()
      expect(within(android).getByText('Expires in 24 h 0 min · date:2026-10-09 12:00:00')).toBeTruthy()
      expect(within(android).queryByRole('link', { name: /Register devices or use MDM/ })).toBeNull()
    })

    it('counts down, and once the link expires asks for a new one', async () => {
      const createInstallLink = vi.fn()
        .mockResolvedValueOnce(answer({ result: installLink({ expires_at: '2026-10-08T12:02:00Z' }) }))
        .mockResolvedValueOnce(answer({ result: installLink({ url: 'https://files.test/install/2' }) }))
      renderInstall('android', apk, { createInstallLink })
      const android = column('Android')
      fireEvent.click(within(android).getByRole('button', { name: 'Install on Android' }))
      await flush()
      expect(within(android).getByText(/^Expires in 2 min/)).toBeTruthy()
      act(() => { vi.advanceTimersByTime(60000) })
      expect(within(android).getByText(/^Expires in 1 min/)).toBeTruthy()
      act(() => { vi.advanceTimersByTime(60000) })
      expect(within(android).queryByRole('img', { name: 'QR code to install the app' })).toBeNull()
      expect(within(android).getByText('This link expired.')).toBeTruthy()
      fireEvent.click(within(android).getByRole('button', { name: 'Generate a new link' }))
      await flush()
      expect(createInstallLink).toHaveBeenCalledTimes(2)
      expect(within(android).getByRole('img', { name: 'QR code to install the app' }).getAttribute('data-value')).toBe('https://files.test/install/2')
    })

    it('keeps a valid link when the panel closes and opens again', async () => {
      const createInstallLink = vi.fn(async () => answer({ result: installLink() }))
      renderInstall('android', apk, { createInstallLink })
      const install = within(column('Android')).getByRole('button', { name: 'Install on Android' })
      fireEvent.click(install)
      await flush()
      fireEvent.click(install)
      expect(screen.queryByRole('img', { name: 'QR code to install the app' })).toBeNull()
      fireEvent.click(install)
      await flush()
      expect(createInstallLink).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('img', { name: 'QR code to install the app' }).getAttribute('data-value')).toBe('https://files.test/install/1')
    })

    it('says a newer build replaced the file, and tries again', async () => {
      const createInstallLink = vi.fn()
        .mockResolvedValueOnce(answer({ ok: false, errorCodes: ['build.artifact_replaced'] }))
        .mockResolvedValueOnce(answer({ result: installLink() }))
      renderInstall('android', apk, { createInstallLink })
      const android = column('Android')
      fireEvent.click(within(android).getByRole('button', { name: 'Install on Android' }))
      await flush()
      const alert = within(android).getByRole('alert')
      expect(alert.textContent).toContain('A newer build replaced this file. Install that one instead.')
      expect(within(android).queryByRole('img', { name: 'QR code to install the app' })).toBeNull()
      fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
      await flush()
      expect(createInstallLink).toHaveBeenCalledTimes(2)
      expect(within(android).getByRole('img', { name: 'QR code to install the app' })).toBeTruthy()
    })

    it('offers no install for an AAB, which goes to Play Console', () => {
      const aab = attempt({ id: 6, platform: 'android', mode: 'release', type: 'bundle', status: 'successful' })
      renderInstall('android', aab)
      const android = column('Android')
      expect(within(android).getByRole('button', { name: 'Download AAB' })).toBeTruthy()
      expect(within(android).queryByRole('button', { name: 'Install on Android' })).toBeNull()
    })

    it('offers no install for an App Store build', () => {
      renderInstall('ios', attempt({ mode: 'app-store', status: 'successful' }))
      expect(within(column('iOS')).queryByRole('button', { name: 'Install on iPhone' })).toBeNull()
    })

    it('installs an ad hoc build on an iPhone the same way', async () => {
      const createInstallLink = vi.fn(async () => answer({ result: installLink({ url: 'https://files.test/install/ios', platform: 'ios', mode: 'ad-hoc', file: 'manifest' }) }))
      renderInstall('ios', adHoc, { createInstallLink, buildGuides: { ios_ad_hoc: 'https://guides.test/ad-hoc' } })
      const ios = column('iOS')
      expect(within(ios).queryByRole('button', { name: 'Install on Android' })).toBeNull()
      const install = within(ios).getByRole('button', { name: 'Install on iPhone' })
      expect(install.getAttribute('aria-expanded')).toBe('false')
      fireEvent.click(install)
      await flush()
      expect(createInstallLink).toHaveBeenCalledWith(3)
      expect(install.getAttribute('aria-expanded')).toBe('true')
      expect(within(ios).getByRole('img', { name: 'QR code to install the app' }).getAttribute('data-value')).toBe('https://files.test/install/ios')
      expect(within(ios).getByText('Scan with the iPhone’s camera. Only registered devices can install it.')).toBeTruthy()
      expect(within(ios).getByText(/^Expires in 24 h 0 min/)).toBeTruthy()
      expect(within(ios).getByRole('link', { name: /Register devices or use MDM/ }).getAttribute('href')).toBe('https://guides.test/ad-hoc')
    })
  })

  // The download link is asked for on click and followed in this tab, on purpose (see `download` in useBuildActions): no new tab or
  // window (asked for after the request, Safari blocked it as a pop-up and nothing was downloaded) and no frame (a file that failed
  // there would say nothing).
  describe('download', () => {
    const FILE = 'https://files.test/app.ipa?signed'
    const iosBuilt = { loading: false, error: false, platforms: { ios: { latest: attempt({ id: 4, status: 'successful' }), successful: attempt({ id: 4, status: 'successful' }), pending_changes: false } } }
    /** A request that waits for `finish(answer)` or `fail(error)`. */
    const pendingDownload = () => {
      const pending = {}
      pending.getBuildDownload = vi.fn(() => new Promise((resolve, reject) => {
        pending.finish = resolve
        pending.fail = reject
      }))
      return pending
    }
    let open
    let click

    beforeEach(() => {
      open = vi.spyOn(window, 'open').mockImplementation(() => null)
      click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    })
    afterEach(() => {
      open.mockRestore()
      click.mockRestore()
    })

    it('follows the link in this tab when it arrives: no new tab, no window, no frame', async () => {
      const pending = pendingDownload()
      renderDetail({ getBuildDownload: pending.getBuildDownload, latestBuildsState: iosBuilt })
      fireEvent.click(screen.getByRole('button', { name: 'Download IPA' }))

      expect(pending.getBuildDownload).toHaveBeenCalledTimes(1)
      expect(pending.getBuildDownload).toHaveBeenCalledWith(4)
      expect(screen.getByRole('button', { name: 'Preparing…' }).disabled).toBe(true)
      // nothing is opened in the click and nothing is followed before the link arrives
      expect(open).not.toHaveBeenCalled()
      expect(click).not.toHaveBeenCalled()

      await act(async () => { pending.finish(answer({ result: { url: FILE } })) })
      expect(click).toHaveBeenCalledTimes(1)
      const link = click.mock.contexts[0]
      expect(link.href).toBe(FILE)
      expect(link.hasAttribute('target')).toBe(false)
      // the storage is not told which page of the Dashboard asked for the file
      expect(link.rel).toBe('noopener noreferrer')
      expect(open).not.toHaveBeenCalled()
      expect(document.querySelector('iframe')).toBeNull()
      expect(state.showToast).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Download IPA' }).disabled).toBe(false)
    })

    it('says why the API refused the download and goes nowhere', async () => {
      const pending = pendingDownload()
      renderDetail({ getBuildDownload: pending.getBuildDownload, latestBuildsState: iosBuilt })
      fireEvent.click(screen.getByRole('button', { name: 'Download IPA' }))
      await act(async () => { pending.finish(answer({ ok: false, errorCodes: [] })) })

      expect(state.showToast).toHaveBeenCalledTimes(1)
      expect(state.showToast).toHaveBeenCalledWith('ERROR', 'We couldn’t download the file. Try again.')
      expect(click).not.toHaveBeenCalled()
      expect(open).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Download IPA' }).disabled).toBe(false)
    })

    it('does the same when the answer has no link or the request fails, and takes the next click', async () => {
      const pending = pendingDownload()
      renderDetail({ getBuildDownload: pending.getBuildDownload, latestBuildsState: iosBuilt })

      fireEvent.click(screen.getByRole('button', { name: 'Download IPA' }))
      await act(async () => { pending.finish(answer({ result: {} })) })
      expect(state.showToast).toHaveBeenCalledTimes(1)
      expect(click).not.toHaveBeenCalled()

      fireEvent.click(screen.getByRole('button', { name: 'Download IPA' }))
      await act(async () => { pending.fail(new TypeError('Failed to fetch')) })
      expect(state.showToast).toHaveBeenCalledTimes(2)
      expect(state.showToast).toHaveBeenLastCalledWith('ERROR', 'We couldn’t download the file. Try again.')
      expect(click).not.toHaveBeenCalled()
      // the button is not left busy
      expect(screen.getByRole('button', { name: 'Download IPA' }).disabled).toBe(false)

      fireEvent.click(screen.getByRole('button', { name: 'Download IPA' }))
      await act(async () => { pending.finish(answer({ result: { url: FILE } })) })
      expect(pending.getBuildDownload).toHaveBeenCalledTimes(3)
      expect(click).toHaveBeenCalledTimes(1)
      expect(click.mock.contexts[0].href).toBe(FILE)
      expect(click.mock.contexts[0].hasAttribute('target')).toBe(false)
      expect(state.showToast).toHaveBeenCalledTimes(2)
      expect(open).not.toHaveBeenCalled()
    })

    it('asks for one link and follows it once when the button is clicked twice', async () => {
      const pending = pendingDownload()
      renderDetail({ getBuildDownload: pending.getBuildDownload, latestBuildsState: iosBuilt })
      const button = screen.getByRole('button', { name: 'Download IPA' })
      // both clicks before the button is drawn again as disabled
      act(() => {
        fireEvent.click(button)
        fireEvent.click(button)
      })
      expect(pending.getBuildDownload).toHaveBeenCalledTimes(1)
      // and once it is disabled
      fireEvent.click(screen.getByRole('button', { name: 'Preparing…' }))
      expect(pending.getBuildDownload).toHaveBeenCalledTimes(1)

      await act(async () => { pending.finish(answer({ result: { url: FILE } })) })
      expect(click).toHaveBeenCalledTimes(1)
      expect(click.mock.contexts[0].hasAttribute('target')).toBe(false)
      expect(open).not.toHaveBeenCalled()
      expect(state.showToast).not.toHaveBeenCalled()
    })
  })

  it('builds in the chosen mode and confirms with a toast', async () => {
    const requestBuild = vi.fn(async () => answer({ result: attempt({ id: 9 }) }))
    renderDetail({
      requestBuild,
      latestBuildsState: { loading: false, error: false, platforms: { android: { latest: null, successful: null, pending_changes: null } } }
    })
    fireEvent.click(within(column('Android')).getByRole('button', { name: 'Build' }))
    const dialog = await screen.findByRole('dialog', { name: 'Build for Android' })
    // A draft starts on the mode to try (redesign B2: P/RadioGroup, checked by aria-checked)
    expect(within(dialog).getByRole('radiogroup', { name: 'What do you need?' })).toBeTruthy()
    expect(isChecked(within(dialog).getByRole('radio', { name: /APK/ }))).toBe(true)
    // Each mode keeps its guide, in a new tab
    const guide = within(dialog).getByRole('link', { name: /AAB/ })
    expect(guide.getAttribute('href')).toBe('https://guides.test/aab')
    expect(guide.getAttribute('target')).toBe('_blank')
    fireEvent.click(within(dialog).getByRole('radio', { name: /AAB/ }))
    expect(isChecked(within(dialog).getByRole('radio', { name: /AAB/ }))).toBe(true)
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
    const dialog = await screen.findByRole('dialog', { name: 'Build for iOS' })
    expect(within(dialog).getByText('Ordering is reviewing 1 issue(s) in the base. They don’t stop this build.')).toBeTruthy()
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Build' })) })
    expect(within(dialog).getByRole('alert').textContent).toContain('Complete these before building for iOS:')
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
    const dialog = await screen.findByRole('dialog', { name: 'Retry this build?' })
    expect(within(dialog).getByText(/Changes you made after it aren’t included/)).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Retry' })).toBeTruthy()
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Build with current settings' })) })
    expect(requestBuild).toHaveBeenCalledWith('ios', { mode: 'app-store', type: null })
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'iOS build requested. Its status updates here.')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Retry this build?' })).toBeNull())
  })

  it('retries the attempt with its own settings', async () => {
    const retryBuild = vi.fn(async () => answer())
    const failed = attempt({ id: 2, mode: 'app-store', status: 'failed', retryable: true })
    renderDetail({ retryBuild, latestBuildsState: { loading: false, error: false, platforms: { ios: { latest: failed, successful: null, pending_changes: null } } } })
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    const dialog = await screen.findByRole('dialog', { name: 'Retry this build?' })
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Retry' })) })
    expect(retryBuild).toHaveBeenCalledWith(failed)
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Retrying the iOS build.')
  })

  it('explains a refused cancel', async () => {
    const cancelBuild = vi.fn(async () => answer({ ok: false, errorCodes: ['build.not_running'] }))
    renderDetail({ cancelBuild, latestBuildsState: { loading: false, error: false, platforms: { ios: { latest: attempt({ status: 'queued' }), successful: null, pending_changes: null } } } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel build' }))
    // redesign B2: P/ConfirmDialog (alertdialog), Keep building first
    const dialog = await screen.findByRole('alertdialog', { name: 'Cancel this iOS build?' })
    expect(within(dialog).getByText('It stops now and leaves no file. You can build again at any time.')).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Keep building' })).toBeTruthy()
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel build' })) })
    expect(state.showToast).toHaveBeenCalledWith('ERROR', 'This build already finished. There’s nothing to cancel.')
  })

  it('keeps building when the cancel is not confirmed', async () => {
    const cancelBuild = vi.fn(async () => answer())
    renderDetail({ cancelBuild, latestBuildsState: { loading: false, error: false, platforms: { ios: { latest: attempt({ status: 'queued' }), successful: null, pending_changes: null } } } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel build' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Cancel this iOS build?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep building' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(cancelBuild).not.toHaveBeenCalled()
  })

  it('opens the log with why the build failed', async () => {
    const getBuildLog = vi.fn(async () => answer({ result: { attempt_id: 2, log: 'step 1\nERROR' } }))
    renderDetail({ getBuildLog, latestBuildsState: { loading: false, error: false, platforms: { ios: { latest: attempt({ id: 2, status: 'failed', error_code: 'invalid_local_certificates' }), successful: null, pending_changes: null } } } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'View log' })) })
    const dialog = await screen.findByRole('dialog', { name: 'Build log · iOS · Ad hoc · v1.2.0' })
    expect(getBuildLog).toHaveBeenCalledWith(2)
    expect(within(dialog).getByText('The iOS certificates saved for this app are no longer valid.')).toBeTruthy()
    const box = within(dialog).getByLabelText('Build log')
    expect(box.textContent).toBe('step 1\nERROR')
    expect(box.getAttribute('tabindex')).toBe('0')
  })

  it('copies the log and downloads it as text', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    URL.createObjectURL = vi.fn(() => 'blob:log')
    URL.revokeObjectURL = vi.fn()
    const getBuildLog = vi.fn(async () => answer({ result: { attempt_id: 2, log: 'step 1\nERROR' } }))
    renderDetail({ getBuildLog, latestBuildsState: { loading: false, error: false, platforms: { ios: { latest: attempt({ id: 2, status: 'failed' }), successful: null, pending_changes: null } } } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'View log' })) })
    const dialog = await screen.findByRole('dialog', { name: /^Build log/ })
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Copy' })) })
    expect(writeText).toHaveBeenCalledWith('step 1\nERROR')
    expect(within(dialog).getAllByRole('status').map(node => node.textContent)).toContain('Copied')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Download .txt' }))
    expect(click).toHaveBeenCalled()
    expect(click.mock.contexts.at(-1).download).toBe('build-2.txt')
    click.mockRestore()
  })

  it('says there is no log yet', async () => {
    const getBuildLog = vi.fn(async () => answer({ ok: false, errorCodes: ['build.no_log'] }))
    renderDetail({ getBuildLog, latestBuildsState: { loading: false, error: false, platforms: { ios: { latest: attempt({ status: 'pending' }), successful: null, pending_changes: null } } } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'View log' })) })
    const dialog = await screen.findByRole('dialog', { name: /^Build log/ })
    expect(within(dialog).getByRole('alert').textContent).toContain('There’s no log yet. It appears once the build starts.')
    expect(within(dialog).getByRole('button', { name: 'Try again' })).toBeTruthy()
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

describe('Builds card file types', () => {
  beforeEach(() => {
    state.showToast.mockReset()
    window.history.replaceState(null, '', '/builder/41')
  })

  const android = (fields) => attempt({ platform: 'android', mode: 'release', type: 'assemble', ...fields })
  const platforms = (ios, androidItem) => ({ loading: false, error: false, platforms: { ...(ios && { ios }), ...(androidItem && { android: androidItem }) } })
  const attempts = (list) => ({ loading: false, error: false, attempts: list })
  const tabNames = (group) => within(group).getAllByRole('tab').map(tab => tab.textContent)
  const selected = (group) => within(group).getAllByRole('tab').find(tab => tab.getAttribute('aria-selected') === 'true')

  // app 1413: an APK (572) built, then an AAB (573): the APK is still the latest file of its type
  const apk572 = android({ id: 572, status: 'successful', app_version: '2.0.1' })
  const aab573 = android({ id: 573, type: 'bundle', status: 'successful', app_version: '2.0.1' })
  const app1413 = {
    latestBuildsState: platforms(null, { latest: aab573, successful: aab573, pending_changes: false }),
    buildAttemptsState: attempts([aab573, apk572])
  }

  it('has a tab per file type on each platform, each with its status', () => {
    renderDetail({
      latestBuildsState: platforms(
        { latest: attempt({ id: 5, mode: 'app-store', status: 'failed' }), successful: null, pending_changes: null },
        { latest: android({ id: 6, status: 'building' }), successful: null, pending_changes: null }
      ),
      buildAttemptsState: attempts([android({ id: 6, status: 'building' }), attempt({ id: 5, mode: 'app-store', status: 'failed' })])
    })
    const ios = column('iOS')
    expect(within(ios).getByRole('tablist', { name: 'iOS file types' })).toBeTruthy()
    expect(tabNames(ios)).toEqual(['Ad hoc, Not built yet', 'App Store, Failed'])
    expect(within(ios).getByRole('tab', { name: 'App Store, Failed' }).querySelector('.odc-bb-dot').dataset.kind).toBe('failed')
    const androidColumn = column('Android')
    expect(tabNames(androidColumn)).toEqual(['APK, Building', 'AAB, Not built yet'])
    expect(within(androidColumn).getByRole('tab', { name: 'APK, Building' }).querySelector('.odc-bb-dot').dataset.kind).toBe('progress')
    // no debug build, no debug tab
    expect(within(androidColumn).queryByRole('tab', { name: /debug/ })).toBeNull()
  })

  it('opens on the type of the platform’s latest attempt', () => {
    renderDetail(app1413)
    const column1413 = column('Android')
    expect(selected(column1413).textContent).toBe('AAB, Successful')
    expect(within(column1413).getByRole('button', { name: 'Download AAB' })).toBeTruthy()
    expect(within(column1413).queryByRole('button', { name: 'Install on Android' })).toBeNull()
  })

  it('installs the APK of app 1413 although its latest build is an AAB', async () => {
    // a link that hasn't expired on the real clock
    const createInstallLink = vi.fn(async () => answer({ result: installLink({ expires_at: new Date(Date.now() + 3600000).toISOString() }) }))
    renderDetail({ ...app1413, createInstallLink })
    const column1413 = column('Android')
    fireEvent.click(within(column1413).getByRole('tab', { name: 'APK, Successful' }))
    const panel = within(column1413).getByRole('tabpanel')
    expect(within(panel).getByText('APK · v2.0.1')).toBeTruthy()
    expect(within(panel).getByRole('button', { name: 'Download APK' })).toBeTruthy()
    fireEvent.click(within(panel).getByRole('button', { name: 'Install on Android' }))
    await act(async () => { await Promise.resolve() })
    expect(createInstallLink).toHaveBeenCalledWith(572)
    expect(within(panel).getByRole('img', { name: 'QR code to install the app' })).toBeTruthy()
  })

  it('says when a type has no builds yet', () => {
    renderDetail({
      latestBuildsState: platforms({ latest: attempt({ id: 3, status: 'successful' }), successful: attempt({ id: 3, status: 'successful' }), pending_changes: false }),
      buildAttemptsState: attempts([attempt({ id: 3, status: 'successful' })])
    })
    const ios = column('iOS')
    fireEvent.click(within(ios).getByRole('tab', { name: 'App Store, Not built yet' }))
    expect(within(ios).getByText('No builds of this type yet.')).toBeTruthy()
    expect(within(ios).queryByRole('button', { name: /^Download/ })).toBeNull()
  })

  it('adds the debug APK tab only when there is a debug build', () => {
    const debug = android({ id: 40, mode: 'debug', status: 'successful' })
    renderDetail({
      latestBuildsState: platforms(null, { latest: apk572, successful: apk572, pending_changes: false }),
      buildAttemptsState: attempts([apk572, debug])
    })
    const androidColumn = column('Android')
    expect(tabNames(androidColumn)).toEqual(['APK, Successful', 'AAB, Not built yet', 'APK debug, Successful'])
    fireEvent.click(within(androidColumn).getByRole('tab', { name: 'APK debug, Successful' }))
    expect(within(androidColumn).getByText('Debug · v1.2.0')).toBeTruthy()
    expect(within(androidColumn).getByRole('button', { name: 'Install on Android' })).toBeTruthy()
    expect(within(androidColumn).queryByRole('link', { name: /Next step/ })).toBeNull()
  })

  it('shows a failed attempt of a type with the actions of its last successful one', () => {
    const failed = android({ id: 580, status: 'failed', error_code: 'build_timed_out', retryable: true })
    renderDetail({
      latestBuildsState: platforms(null, { latest: failed, successful: aab573, pending_changes: true }),
      buildAttemptsState: attempts([failed, aab573, apk572])
    })
    const androidColumn = column('Android')
    expect(selected(androidColumn).textContent).toBe('APK, Failed')
    expect(within(androidColumn).getByText('The build took too long and was stopped.')).toBeTruthy()
    expect(within(androidColumn).getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(within(androidColumn).getByText('Last successful')).toBeTruthy()
    expect(within(androidColumn).getByRole('button', { name: 'Download APK' })).toBeTruthy()
    expect(within(androidColumn).getByRole('button', { name: 'Install on Android' })).toBeTruthy()
    // the pending changes belong to the platform's latest successful build, the AAB
    expect(within(androidColumn).queryByText('Changes since this build. Build again to include them.')).toBeNull()
    fireEvent.click(within(androidColumn).getByRole('tab', { name: 'AAB, Successful' }))
    expect(within(androidColumn).getByText('Changes since this build. Build again to include them.')).toBeTruthy()
  })

  it('says which file types were built before the app changed, each on its own', () => {
    const byType = (apk, aab) => [
      { id: 573, mode: 'release', type: 'bundle', pending_changes: aab },
      { id: 572, mode: 'release', type: 'assemble', pending_changes: apk }
    ]
    const notice = 'Changes since this build. Build again to include them.'
    // the AAB was built after the change: only the APK is behind
    renderDetail({
      latestBuildsState: platforms(null, { latest: aab573, successful: aab573, pending_changes: false, successful_by_type: byType(true, false) }),
      buildAttemptsState: attempts([aab573, apk572])
    })
    const androidColumn = column('Android')
    expect(selected(androidColumn).textContent).toBe('AAB, Successful')
    expect(within(androidColumn).queryByText(notice)).toBeNull()
    fireEvent.click(within(androidColumn).getByRole('tab', { name: 'APK, Successful' }))
    expect(within(androidColumn).getByText(notice)).toBeTruthy()
  })

  it('says both file types are behind when both were built before the change', () => {
    const notice = 'Changes since this build. Build again to include them.'
    renderDetail({
      latestBuildsState: platforms(null, {
        latest: aab573,
        successful: aab573,
        pending_changes: true,
        successful_by_type: [
          { id: 573, mode: 'release', type: 'bundle', pending_changes: true },
          { id: 572, mode: 'release', type: 'assemble', pending_changes: true }
        ]
      }),
      buildAttemptsState: attempts([aab573, apk572])
    })
    const androidColumn = column('Android')
    expect(within(androidColumn).getByText(notice)).toBeTruthy()
    fireEvent.click(within(androidColumn).getByRole('tab', { name: 'APK, Successful' }))
    expect(within(androidColumn).getByText(notice)).toBeTruthy()
  })

  it('moves between the types with the arrow keys', async () => {
    const user = userEvent.setup()
    renderDetail(app1413)
    const column1413 = column('Android')
    await user.click(within(column1413).getByRole('tab', { name: 'AAB, Successful' }))
    await user.keyboard('{ArrowLeft}')
    expect(selected(column1413).textContent).toBe('APK, Successful')
    expect(document.activeElement).toBe(selected(column1413))
    expect(within(column1413).getByRole('button', { name: 'Install on Android' })).toBeTruthy()
    await user.keyboard('{End}')
    expect(selected(column1413).textContent).toBe('AAB, Successful')
  })

  it('keeps the tab picked until a new attempt arrives, then opens its type', () => {
    const view = renderDetail(app1413)
    fireEvent.click(within(column('Android')).getByRole('tab', { name: 'APK, Successful' }))
    // the same latest attempt, reloaded: the picked tab stays
    state.props = { ...state.props, latestBuildsState: platforms(null, { latest: { ...aab573 }, successful: aab573, pending_changes: true }) }
    view.rerender(<BuilderProduct productId='41' />)
    expect(selected(column('Android')).textContent).toBe('APK, Successful')
    // a new AAB build
    const building = android({ id: 590, type: 'bundle', status: 'pending' })
    state.props = { ...state.props, latestBuildsState: platforms(null, { latest: building, successful: aab573, pending_changes: true }) }
    view.rerender(<BuilderProduct productId='41' />)
    const androidColumn = column('Android')
    expect(selected(androidColumn).textContent).toBe('AAB, Pending')
    expect(within(androidColumn).getByRole('button', { name: 'Cancel build' })).toBeTruthy()
    expect(within(androidColumn).getByText('Last successful')).toBeTruthy()
  })

  it('shows the type that was built when its build ends, although another tab was picked while it ran', () => {
    const building = android({ id: 590, type: 'bundle', status: 'building' })
    const view = renderDetail({
      latestBuildsState: platforms(null, { latest: building, successful: apk572, pending_changes: false }),
      buildAttemptsState: attempts([building, apk572])
    })
    expect(selected(column('Android')).textContent).toBe('AAB, Building')
    fireEvent.click(within(column('Android')).getByRole('tab', { name: 'APK, Successful' }))
    expect(selected(column('Android')).textContent).toBe('APK, Successful')
    // the same build, one status later: the picked tab stays while it runs
    state.props = { ...state.props, latestBuildsState: platforms(null, { latest: { ...building, status: 'finishing' }, successful: apk572, pending_changes: false }) }
    view.rerender(<BuilderProduct productId='41' />)
    expect(selected(column('Android')).textContent).toBe('APK, Successful')
    // it ends: its type is the one shown
    const built = { ...building, status: 'successful' }
    state.props = { ...state.props, latestBuildsState: platforms(null, { latest: built, successful: built, pending_changes: false }) }
    view.rerender(<BuilderProduct productId='41' />)
    expect(selected(column('Android')).textContent).toBe('AAB, Successful')
    // and a tab picked now stays
    fireEvent.click(within(column('Android')).getByRole('tab', { name: 'APK, Successful' }))
    state.props = { ...state.props, latestBuildsState: platforms(null, { latest: { ...built }, successful: built, pending_changes: true }) }
    view.rerender(<BuilderProduct productId='41' />)
    expect(selected(column('Android')).textContent).toBe('APK, Successful')
  })

  describe('Build opens the dialog on the file type of the tab that is open', () => {
    const adHoc7 = attempt({ id: 7, status: 'successful' })
    const checkedIn = (dialog) => within(dialog).getAllByRole('radio').filter(isChecked).map(radio => radio.textContent)
    const openBuild = async (name) => {
      fireEvent.click(within(column(name)).getByRole('button', { name: 'Build' }))
      return screen.findByRole('dialog', { name: `Build for ${name}` })
    }

    it('starts on the APK from the APK tab although the latest build is an AAB, and on the AAB from its tab', async () => {
      renderDetail(app1413)
      // the tab the card opens on: the latest attempt's
      let dialog = await openBuild('Android')
      expect(checkedIn(dialog)).toEqual([expect.stringMatching(/^AAB/)])
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

      fireEvent.click(within(column('Android')).getByRole('tab', { name: 'APK, Successful' }))
      dialog = await openBuild('Android')
      expect(checkedIn(dialog)).toEqual([expect.stringMatching(/^APK/)])
    })

    it('starts on App Store from its tab although the latest build is Ad hoc, and on Ad hoc from its own', async () => {
      renderDetail({
        latestBuildsState: platforms({ latest: adHoc7, successful: adHoc7, pending_changes: false }),
        buildAttemptsState: attempts([adHoc7])
      }, 'active')
      fireEvent.click(within(column('iOS')).getByRole('tab', { name: 'App Store, Not built yet' }))
      let dialog = await openBuild('iOS')
      expect(checkedIn(dialog)).toEqual([expect.stringMatching(/^App Store/)])
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

      fireEvent.click(within(column('iOS')).getByRole('tab', { name: 'Ad hoc, Successful' }))
      dialog = await openBuild('iOS')
      expect(checkedIn(dialog)).toEqual([expect.stringMatching(/^Ad hoc/)])
    })

    it('lets the type be changed in the dialog, builds it and opens its tab', async () => {
      const building = android({ id: 591, type: 'bundle', status: 'pending' })
      const requestBuild = vi.fn(async () => answer({ result: building }))
      const view = renderDetail({ ...app1413, requestBuild })
      fireEvent.click(within(column('Android')).getByRole('tab', { name: 'APK, Successful' }))
      const dialog = await openBuild('Android')
      expect(checkedIn(dialog)).toEqual([expect.stringMatching(/^APK/)])
      fireEvent.click(within(dialog).getByRole('radio', { name: /AAB/ }))
      expect(checkedIn(dialog)).toEqual([expect.stringMatching(/^AAB/)])
      await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Build' })) })
      expect(requestBuild).toHaveBeenCalledWith('android', { mode: 'release', type: 'bundle' })

      // the controller puts the new attempt as the platform's latest: its tab opens, not the one that was picked
      state.props = { ...state.props, latestBuildsState: platforms(null, { latest: building, successful: aab573, pending_changes: false }) }
      view.rerender(<BuilderProduct productId='41' />)
      expect(selected(column('Android')).textContent).toBe('AAB, Pending')
    })

    it('starts on its own default from a tab the dialog does not build (a debug APK) or with no build yet', async () => {
      const debug = android({ id: 40, mode: 'debug', status: 'successful' })
      renderDetail({
        latestBuildsState: platforms({ latest: null, successful: null, pending_changes: null }, { latest: debug, successful: debug, pending_changes: false }),
        buildAttemptsState: attempts([debug])
      })
      expect(selected(column('Android')).textContent).toBe('APK debug, Successful')
      let dialog = await openBuild('Android')
      // the latest attempt's type, as before
      expect(checkedIn(dialog)).toEqual([expect.stringMatching(/^APK/)])
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

      // a draft never built starts on the one to try
      dialog = await openBuild('iOS')
      expect(checkedIn(dialog)).toEqual([expect.stringMatching(/^Ad hoc/)])
    })
  })

  it('says the types could not load and reads them again', () => {
    const reloadBuildAttempts = vi.fn()
    renderDetail({
      latestBuildsState: platforms(null, { latest: aab573, successful: aab573, pending_changes: false }),
      buildAttemptsState: { loading: false, error: true, attempts: null },
      reloadBuildAttempts
    })
    const androidColumn = column('Android')
    fireEvent.click(within(androidColumn).getByRole('tab', { name: 'APK, Not built yet' }))
    expect(within(androidColumn).getByText('We couldn’t load the builds.')).toBeTruthy()
    fireEvent.click(within(androidColumn).getByRole('button', { name: 'Try again' }))
    expect(reloadBuildAttempts).toHaveBeenCalled()
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
    // redesign B2: P/DataTable
    expect(screen.getByRole('table').classList.contains('odc-table')).toBe(true)
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

  // The history shares the Builds card's download (useBuildActions): the link is followed in this tab, never in a new one
  it('downloads an attempt of the history in this tab', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    let finish
    const getBuildDownload = vi.fn(() => new Promise(resolve => { finish = resolve }))
    state.historyProps = history([attempt({ id: 8, platform: 'android', mode: 'release', type: 'bundle', status: 'successful' })])
    renderDetail({ getBuildDownload })
    fireEvent.click(screen.getByRole('button', { name: 'Download' }))
    expect(getBuildDownload).toHaveBeenCalledWith(8)
    expect(screen.getByRole('button', { name: 'Preparing…' }).disabled).toBe(true)

    await act(async () => { finish(answer({ result: { url: 'https://files.test/app.aab?signed' } })) })
    expect(click).toHaveBeenCalledTimes(1)
    expect(click.mock.contexts[0].href).toBe('https://files.test/app.aab?signed')
    expect(click.mock.contexts[0].hasAttribute('target')).toBe(false)
    expect(open).not.toHaveBeenCalled()
    open.mockRestore()
    click.mockRestore()
  })

  it('filters by grouped status and pages', async () => {
    const changeFilters = vi.fn()
    const changePage = vi.fn()
    state.historyProps = history([attempt({})], { changeFilters, changePage, historyState: { loading: false, error: false, builds: [attempt({})], pagination: { total_pages: 3 } } })
    renderDetail()
    // redesign B2: P/SelectField (a combobox and its listbox) in place of the native selects; same values and labels
    fireEvent.click(screen.getByRole('combobox', { name: /^Status/ }))
    expect((await screen.findAllByRole('option')).map(option => option.textContent)).toEqual(['All', 'Waiting', 'In progress', 'Successful', 'Failed', 'Cancelled'])
    fireEvent.click(screen.getByRole('option', { name: 'Waiting' }))
    expect(changeFilters).toHaveBeenCalledWith({ statuses: ['pending', 'queued'] })
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    fireEvent.click(screen.getByRole('combobox', { name: /^Platform/ }))
    expect((await screen.findAllByRole('option')).map(option => option.textContent)).toEqual(['All', 'iOS', 'Android'])
    fireEvent.click(screen.getByRole('option', { name: 'Android' }))
    expect(changeFilters).toHaveBeenCalledWith({ platform: 'android' })
    // redesign B2: P/Pagination; the API counts pages only, so the next page is offered while there is one
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(changePage).toHaveBeenCalledWith(2)
    // review of B2: without a total the page status still names the last page the API counts, never «of null»
    expect(document.body.textContent).toContain('Page 1 of 3')
    expect(document.body.textContent).not.toContain('of null')
  })

  it('shows the filters chosen and goes back to All', async () => {
    const changeFilters = vi.fn()
    state.historyProps = history([attempt({})], { changeFilters, filters: { platform: 'ios', statuses: ['building', 'finishing'] } })
    renderDetail()
    expect(screen.getByRole('combobox', { name: /^Platform/ }).textContent).toBe('iOS')
    expect(screen.getByRole('combobox', { name: /^Status/ }).textContent).toBe('In progress')
    fireEvent.click(screen.getByRole('combobox', { name: /^Status/ }))
    fireEvent.click(await screen.findByRole('option', { name: 'All' }))
    expect(changeFilters).toHaveBeenCalledWith({ statuses: [] })
  })

  // review of #433: main's numbered pages jumped to any page with total_pages alone; without a total the page field stays,
  // the last page comes from total_pages and the range makes up no «of N»
  it('jumps to any page when the API counts pages but sends no total', () => {
    const changePage = vi.fn()
    state.historyProps = history([attempt({})], { changePage, historyState: { loading: false, error: false, builds: [attempt({})], pagination: { total_pages: 3 } } })
    renderDetail()
    const field = screen.getByRole('textbox', { name: 'Page' })
    fireEvent.change(field, { target: { value: '3' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(changePage).toHaveBeenCalledWith(3)
    expect(document.body.textContent).not.toMatch(/of 30\b/)
  })

  it('jumps to any page when the API gives the total', () => {
    const changePage = vi.fn()
    state.historyProps = history([attempt({})], { changePage, historyState: { loading: false, error: false, builds: [attempt({})], pagination: { total_pages: 3, total: 25 } } })
    renderDetail()
    const field = screen.getByRole('textbox', { name: 'Page' })
    fireEvent.change(field, { target: { value: '3' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(changePage).toHaveBeenCalledWith(3)
  })

  it('pages only when there is more than one page', () => {
    state.historyProps = history([attempt({})])
    renderDetail()
    expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull()
  })

  it('says the history could not load and tries again', () => {
    const reloadHistory = vi.fn()
    state.historyProps = history([], { reloadHistory, historyState: { loading: false, error: true, builds: [], pagination: null } })
    renderDetail()
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('We couldn’t load the builds')
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(reloadHistory).toHaveBeenCalled()
  })

  it('says when there are no builds yet', () => {
    state.historyProps = history([])
    renderDetail()
    expect(screen.getByText('No builds yet')).toBeTruthy()
    expect(screen.getByText('Build from the card above.')).toBeTruthy()
  })

  it('says when no build matches the filters', () => {
    state.historyProps = history([], { filters: { platform: 'android', statuses: [] } })
    renderDetail()
    expect(screen.getByText('No builds match these filters')).toBeTruthy()
    expect(screen.queryByText('Build from the card above.')).toBeNull()
  })
})

/* eslint-disable import/first */
// redesign my-products B4 (; D2, D3, M-MP-05): the «Builds» section of the app editor. Covered: the state of the last build
// per platform as a P/StatusBadge, the version line (its keywords in <b> without innerHTML), what is still missing to build as a
// notice apart (with a link to the section that fixes each field, and the state label still there), the file types of each platform
// as the Builder's tabs (the one that opens, the last build of each, its QR and download, a type never built, a type a phone does
// not install), the Build dialog (it opens on the type of the tab, the type can be changed, main's body of `buildApp`, what is
// missing, the same rule of disabled as main), a failed build (logs, certificates, the error), the build error dialog and an app
// whose lists are null. The QR is a signed install link asked for when its tab is shown, and a download asks for its own link:
// neither uses the public `downloads/*` route. The controller's props are simulated; the QR drawing is a stand-in that records its
// props. Everything else is the real thing.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mockState = vi.hoisted(() => ({ texts: {}, showToast: null }))

// A key can be given another text for a test; every other key gives its default
const translate = (key, text) => mockState.texts[key] ?? text

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, translate],
  useApi: () => [{ root: 'https://api.example.test' }],
  useUtils: () => [{ parseDate: (date) => `on ${date}` }],
  useToast: () => [null, { showToast: mockState.showToast }],
  ToastType: { Success: 'success', Error: 'error' }
}))
vi.mock('react-qr-code', () => ({
  default: ({ value, size, viewBox, ...rest }) => <svg data-value={value} data-size={size} data-viewbox={viewBox} {...rest} />
}))

import { BuildsSection } from '../BuildsSection'

const dashboardTheme = createDashboardTheme(theme)

// The last build of a platform. An Android build has its type (`assemble`: APK, `bundle`: AAB); an iOS one has none.
const buildOf = (platform, over = {}) => ({
  platform,
  status: 'successful',
  app_version: '1.2.0',
  mode: 'release',
  ...(platform === 'android' && { type: 'assemble' }),
  job_id: 'job-9',
  updated_at: '2026-01-02',
  ...over
})

// An attempt of the app's history (`GET builder/apps/{id}/builds`), newest first there
const attemptOf = (platform, over = {}) => ({
  id: 1,
  platform,
  mode: platform === 'ios' ? 'ad-hoc' : 'release',
  type: platform === 'android' ? 'assemble' : null,
  status: 'successful',
  app_version: '1.2.0',
  created_at: '2026-01-01 10:00:00',
  updated_at: '2026-01-01 10:20:00',
  ...over
})

// An app with everything it needs to build for both platforms, and a finished Android build
const makeApp = (over = {}) => ({
  id: 7,
  name: 'Repartidores',
  description: 'Driver app',
  package: 'com.demo.app',
  version: '1.2.0',
  base: { code: 'app_marketplace_x', platforms: ['ios', 'android'] },
  baseConstants: [{ code: 'apple_merchant_id', value: 'merchant.com.demo' }],
  android_credentials: { key_alias: 'alias', store_file: 'store.jks' },
  ios_credentials: { team_id: 'T1', api_key_id: 'K1', api_key_issuer_id: 'I1', api_key_file: 'key.p8' },
  builds: [buildOf('android')],
  built_apps: {},
  ...over
})

// A signed install link of the platform, mode and file, valid for 24 hours from now
const signedLink = ({ platform, mode, file }, expiresIn = 24 * 3600 * 1000) => ({
  url: `https://api.example.test/builder/install/${platform}-${mode}/${file}?expires=1&signature=s`,
  expires_at: new Date(Date.now() + expiresIn).toISOString(),
  platform,
  mode,
  file
})

const show = (app, props = {}) => {
  const handlers = {
    buildApp: vi.fn(async () => ({ ok: true })),
    loadBuildAttempts: vi.fn(),
    setBuildAppState: vi.fn(),
    downloadApp: vi.fn(async () => ({ ok: true, errorCodes: [] })),
    createInstallLink: vi.fn(async (entry) => ({ ok: true, result: signedLink(entry), errorCodes: [] })),
    getBuildLogs: vi.fn(),
    deleteCertificates: vi.fn(),
    onNavigate: vi.fn()
  }
  const all = {
    app,
    appId: app?.id,
    buildAppState: { loading: false, result: null, error: null },
    downloadAppState: { loading: false, result: null, error: null },
    buildAttemptsState: { loading: false, attempts: null, error: false },
    ...handlers,
    ...props
  }
  const view = renderWithProviders(<BuildsSection {...all} />, { theme: dashboardTheme })
  return {
    ...view,
    ...handlers,
    again: (next = {}) => view.rerender(<BuildsSection {...all} {...next} />)
  }
}

const android = () => screen.getByRole('region', { name: 'Android' })
const ios = () => screen.getByRole('region', { name: 'iOS' })

// The badge of the platform's last build, in its head (the tab of its type says its status too)
const badgeOf = (region) => region.querySelector('.odc-apb-head .odc-badge')

// The facts under the tabs of a platform: each label with its value
const factsOf = (region) => [...region.querySelectorAll('dl > div')].map(row => [
  row.querySelector('dt').textContent,
  row.querySelector('dd').textContent
])

// The file types of a platform: its tabs (each named by its type and the status of its last build), the one that is open
const tabNames = (region) => within(region).getAllByRole('tab').map(node => node.textContent)
const selected = (region) => within(region).getAllByRole('tab').find(node => node.getAttribute('aria-selected') === 'true')?.textContent
const openTab = (region, name) => fireEvent.click(within(region).getByRole('tab', { name }))
// What each request of an install link asked for, in order
const asked = (view) => view.createInstallLink.mock.calls.map(([entry]) => `${entry.platform}/${entry.mode}/${entry.file}`)
const settle = () => act(async () => { await Promise.resolve() })

beforeEach(() => {
  mockState.texts = {}
  mockState.showToast = vi.fn()
})

describe('BuildsSection · state and version', () => {
  it('paints one region per platform, sorted, with the last build as a badge only where there is one', () => {
    show(makeApp())

    expect(screen.getAllByRole('heading', { level: 3 }).map(node => node.textContent)).toEqual(['Android', 'iOS'])
    expect(badgeOf(android()).textContent).toBe('Successful')
    expect(badgeOf(android()).getAttribute('data-family')).toBe('done')
    expect(badgeOf(ios())).toBeNull()
  })

  it.each([
    ['failed', 'Failed', 'cancel'],
    ['error_request', 'Error request', 'cancel'],
    ['pending', 'Pending', 'progress'],
    ['queued', 'Queued', 'progress'],
    ['building', 'Building', 'progress'],
    ['finishing', 'Finishing', 'progress'],
    ['something_else', 'something_else', 'review']
  ])('maps the build status %s to the label %s in the %s family', (status, label, family) => {
    show(makeApp({ builds: [buildOf('android', { status })] }))

    expect(badgeOf(android()).textContent).toBe(label)
    expect(badgeOf(android()).getAttribute('data-family')).toBe(family)
  })

  it('says if the app is updated or a new version is available, and names the one Build button of the platform in <b>', () => {
    show(makeApp())

    expect(within(android()).getByText('Your app is updated')).toBeTruthy()
    expect(within(android()).getByText('Your app is updated').closest('.odc-notice').getAttribute('data-tone')).toBe('info')
    // iOS has no build: the app's version is the news
    expect(within(ios()).getByText('New version (1.2.0) is available:')).toBeTruthy()
    expect(within(ios()).getByText('New version (1.2.0) is available:').closest('.odc-notice').getAttribute('data-tone')).toBe('warning')
    // one Build per platform: the line says so in the singular, with no «Build buttons» and no «Store» button that does not exist
    expect([...document.querySelectorAll('.odc-apb-sub')].map(node => node.textContent)).toEqual(['Click Build to rebuild.', 'Click Build to rebuild.'])
    expect([...document.querySelectorAll('b')].map(node => node.textContent)).toEqual(['Build', 'Build'])
    for (const notice of document.querySelectorAll('.odc-notice')) expect(notice.textContent).not.toMatch(/Store|buttons/)
  })

  it('names the button in that line by the label the button has, in any language', () => {
    mockState.texts.BUILDER_BUILD = 'Compilar'
    mockState.texts.BUILD_CLICK_TO_REBUILD = 'Haz clic en _button_ para volver a compilar.'
    show(makeApp())

    expect(android().querySelector('.odc-apb-sub').textContent).toBe('Haz clic en Compilar para volver a compilar.')
    expect([...document.querySelectorAll('b')].map(node => node.textContent)).toEqual(['Compilar', 'Compilar'])
    expect(within(android()).getByRole('button', { name: 'Compilar' })).toBeTruthy()
  })

  it('never turns the text of a translation into markup', () => {
    mockState.texts.BUILD_CLICK_TO_REBUILD = 'Click <img src="x" alt="injected"> _button_'
    show(makeApp())

    expect(document.querySelector('img')).toBeNull()
    expect(android().querySelector('.odc-apb-sub').textContent).toBe('Click <img src="x" alt="injected"> Build')
  })

  it('writes the facts in a list, figures apart: the app\'s always, those of a build only where there is one', () => {
    show(makeApp())

    expect(factsOf(android())).toEqual([
      ['Version', '1.2.0'],
      ['Build version', '1.2.0'],
      ['Package', 'com.demo.app'],
      ['Job', 'job-9'],
      ['Last build', 'on 2026-01-02']
    ])
    // iOS was never built: nothing of a build, and no dashes in its place
    expect(factsOf(ios())).toEqual([
      ['Version', '1.2.0'],
      ['Package', 'com.demo.app']
    ])
    expect([...android().querySelectorAll('dd .odc-figure')].map(node => node.textContent)).toEqual(['1.2.0', '1.2.0', 'job-9', 'on 2026-01-02'])
  })
})

describe('BuildsSection · what is missing', () => {
  it('names what the platform still needs apart from the state, and sends the link to the section that fixes it', async () => {
    const user = userEvent.setup()
    const app = makeApp({
      builds: [buildOf('ios', { status: 'pending' })],
      ios_credentials: { team_id: 'T1', api_key_id: 'K1', api_key_issuer_id: 'I1' }
    })
    const view = show(app)

    expect(within(ios()).getByText('To build for iOS, fill:')).toBeTruthy()
    // the state label is still there: the notice does not replace it
    expect(badgeOf(ios()).textContent).toBe('Pending')
    expect(badgeOf(ios()).getAttribute('data-family')).toBe('progress')
    const notice = within(ios()).getByText('To build for iOS, fill:').closest('.odc-notice')
    expect(notice.getAttribute('data-tone')).toBe('warning')
    expect(within(notice).getAllByRole('listitem')).toHaveLength(1)
    expect(within(notice).getByText('Credentials')).toBeTruthy()

    await user.click(within(notice).getByRole('button', { name: 'Api key file' }))
    expect(view.onNavigate).toHaveBeenCalledWith('credentials')
  })

  it('links the general fields and the constants to their own sections', async () => {
    const user = userEvent.setup()
    const view = show(makeApp({ description: '', baseConstants: [] }))

    const notice = within(ios()).getByText('To build for iOS, fill:').closest('.odc-notice')
    expect(within(notice).getAllByRole('listitem').map(item => item.textContent)).toEqual([
      'DescriptionGeneral',
      'Apple merchant idConstants'
    ])
    await user.click(within(notice).getByRole('button', { name: 'Apple merchant id' }))
    expect(view.onNavigate).toHaveBeenLastCalledWith('constants')
    await user.click(within(notice).getByRole('button', { name: 'Description' }))
    expect(view.onNavigate).toHaveBeenLastCalledWith('general')
  })

  it('shows no notice when nothing is missing', () => {
    show(makeApp())

    expect(screen.queryByText(/To build for/)).toBeNull()
  })

  it('does not throw when the lists are null or the platforms are missing', () => {
    expect(() => show(makeApp({ baseConstants: null, ios_credentials: null, android_credentials: null }))).not.toThrow()
    expect(within(ios()).getByText('To build for iOS, fill:')).toBeTruthy()
    expect(within(android()).getByText('To build for Android, fill:')).toBeTruthy()
  })

  it('paints nothing, and does not throw, without platforms', () => {
    const { container } = show(makeApp({ base: { code: 'app_marketplace_x' } }))
    expect(container.firstChild).toBeNull()

    const none = show({ ...makeApp(), base: undefined })
    expect(none.container.firstChild).toBeNull()
  })
})

// The file types of a platform are the Builder's tabs (same labels, the status of each as a dot read out after its name): iOS Ad
// hoc and App Store; Android APK, AAB and the debug files only My Products builds. Each tab has the last build of ITS type, its QR
// when a phone installs it and its download.
describe('BuildsSection · file types', () => {
  // the report: the last iOS build was for the App Store, and an Ad hoc one from before is still in the storage
  const appStoreLast = (over = {}) => makeApp({
    builds: [buildOf('ios', { attempt_id: 12, mode: 'app-store', updated_at: '2026-11-10 18:00:00' })],
    built_apps: { ios: { 'ad-hoc': { ipa: true }, 'app-store': { ipa: true } } },
    ...over
  })

  it('has a tab per file type on each platform, with the Builder\'s labels and the status of each', () => {
    show(makeApp({
      builds: [buildOf('android', { attempt_id: 4 }), buildOf('ios', { attempt_id: 5, mode: 'app-store', status: 'failed' })],
      // the debug APK was left by a build from before the attempts: it is there, so it was built
      built_apps: { android: { release: { assemble: { apk: true, zip: true } }, debug: { assemble: { apk: true, zip: true } } } }
    }))

    expect(within(ios()).getByRole('tablist', { name: 'iOS file types' })).toBeTruthy()
    expect(tabNames(ios())).toEqual(['Ad hoc, Not built yet', 'App Store, Failed'])
    expect(within(ios()).getByRole('tab', { name: 'App Store, Failed' }).querySelector('.odc-bb-dot').dataset.kind).toBe('failed')
    expect(within(android()).getByRole('tablist', { name: 'Android file types' })).toBeTruthy()
    expect(tabNames(android())).toEqual(['APK, Successful', 'AAB, Not built yet', 'APK debug, Successful', 'AAB debug, Not built yet'])
    expect(within(android()).getByRole('tab', { name: 'APK debug, Successful' }).querySelector('.odc-bb-dot').dataset.kind).toBe('success')
  })

  it('opens on the type of the platform\'s last successful build, and the Ad hoc QR is one click away', async () => {
    const view = show(appStoreLast())

    expect(selected(ios())).toBe('App Store, Successful')
    expect(within(ios()).getByText('App Store · v1.2.0')).toBeTruthy()
    // an App Store build has no QR: it says why, and keeps its download
    expect(within(ios()).queryByRole('img')).toBeNull()
    expect(within(ios()).getByText('An App Store build is not installed with a QR: it is uploaded to App Store Connect. To install the app on an iPhone with a QR, build Ad hoc.')).toBeTruthy()
    expect(within(ios()).getByRole('button', { name: 'Download IPA' })).toBeTruthy()
    expect(asked(view)).toEqual([])

    openTab(ios(), 'Ad hoc, Successful')
    const qr = await within(ios()).findByRole('img', { name: 'QR code to install Ad hoc' })
    expect(qr.getAttribute('data-value')).toBe('https://api.example.test/builder/install/ios-ad-hoc/ipa?expires=1&signature=s')
    expect(within(ios()).getByText('Scan with the iPhone’s camera. Only registered devices can install it.')).toBeTruthy()
    expect(within(ios()).getByRole('button', { name: 'Download IPA' })).toBeTruthy()
    expect(asked(view)).toEqual(['ios/ad-hoc/ipa'])
  })

  it('asks for the link of a type when its tab is shown, once: coming back to it asks for nothing', async () => {
    const view = show(appStoreLast())
    openTab(ios(), 'Ad hoc, Successful')
    await within(ios()).findByRole('img', { name: 'QR code to install Ad hoc' })

    openTab(ios(), 'App Store, Successful')
    expect(within(ios()).queryByRole('img')).toBeNull()
    openTab(ios(), 'Ad hoc, Successful')
    expect(within(ios()).getByRole('img', { name: 'QR code to install Ad hoc' })).toBeTruthy()
    expect(within(ios()).queryByText('Preparing the install link…')).toBeNull()
    await settle()
    expect(asked(view)).toEqual(['ios/ad-hoc/ipa'])
  })

  it('opens on the type of the newest successful build when the last one failed, and on the first file without attempts', () => {
    const files = { android: { release: { assemble: { apk: true, zip: true } }, debug: { assemble: { apk: true, zip: true } } } }
    const builds = [buildOf('android', { attempt_id: 9, type: 'bundle', status: 'failed' })]
    const view = show(makeApp({ builds, built_apps: files }))
    // nothing says yet which build was the last successful one: the first type with a file
    expect(selected(android())).toBe('APK, Successful')

    view.again({
      buildAttemptsState: {
        loading: false,
        error: false,
        attempts: [
          attemptOf('android', { id: 9, type: 'bundle', status: 'failed' }),
          attemptOf('android', { id: 8, mode: 'debug' }),
          attemptOf('android', { id: 7 })
        ]
      }
    })
    expect(selected(android())).toBe('APK debug, Successful')
    expect(tabNames(android())).toEqual(['APK, Successful', 'AAB, Failed', 'APK debug, Successful', 'AAB debug, Not built yet'])
  })

  it('says how to get the file of a type that was never built, instead of an empty panel', () => {
    show(makeApp({ builds: [buildOf('ios', { attempt_id: 12, mode: 'app-store' })], built_apps: { ios: { 'app-store': { ipa: true } } } }))

    openTab(ios(), 'Ad hoc, Not built yet')
    expect(within(ios()).getByRole('tabpanel').textContent).toBe('There is no Ad hoc build yet. Build it to install it with a QR.')
    expect(within(ios()).queryByRole('button', { name: /^Download/ })).toBeNull()

    openTab(android(), 'AAB, Not built yet')
    expect(within(android()).getByRole('tabpanel').textContent).toBe('There is no AAB build yet. Build it to download its file.')
  })

  it('says why a file a phone does not install has no QR (App Store, AAB), and keeps its download', () => {
    const view = show(makeApp({
      builds: [buildOf('android', { type: 'bundle' }), buildOf('ios', { mode: 'app-store' })],
      built_apps: {
        android: { release: { bundle: { aab: true, zip: true } }, debug: { bundle: { aab: true } } },
        ios: { 'app-store': { ipa: true } }
      }
    }))

    expect(selected(android())).toBe('AAB, Successful')
    expect(within(android()).getByText('An AAB is not installed with a QR: it is uploaded in Play Console. To install the app on a phone with a QR, build an APK.')).toBeTruthy()
    expect(within(android()).getByRole('button', { name: 'Download AAB' })).toBeTruthy()
    openTab(android(), 'AAB debug, Successful')
    expect(within(android()).getByText('An AAB is not installed with a QR. To install the app on a phone with a QR, build an APK.')).toBeTruthy()
    expect(within(android()).getByRole('button', { name: 'Download AAB' })).toBeTruthy()
    expect(selected(ios())).toBe('App Store, Successful')
    expect(within(ios()).getByRole('button', { name: 'Download IPA' })).toBeTruthy()

    expect(screen.queryByRole('img')).toBeNull()
    expect(view.createInstallLink).not.toHaveBeenCalled()
  })

  it('shows the last build of each type from the attempts: what it is, its status and its date', () => {
    show(appStoreLast(), {
      buildAttemptsState: {
        loading: false,
        error: false,
        attempts: [
          attemptOf('ios', { id: 12, mode: 'app-store', updated_at: '2026-11-10 18:00:00' }),
          attemptOf('ios', { id: 11, mode: 'ad-hoc', status: 'failed', app_version: '1.1.1', created_at: '2026-11-09 09:00:00' }),
          attemptOf('ios', { id: 10, mode: 'ad-hoc', app_version: '1.1.0', updated_at: '2026-11-08 08:30:00' })
        ]
      }
    })

    const panel = () => within(ios()).getByRole('tabpanel')
    expect(within(panel()).getByText('App Store · v1.2.0')).toBeTruthy()
    expect(within(panel()).getByText('Successful')).toBeTruthy()
    expect(within(panel()).getByText('on 2026-11-10 18:00:00')).toBeTruthy()

    // the last Ad hoc build failed: the file the storage keeps is the one of the successful build before it
    openTab(ios(), 'Ad hoc, Failed')
    expect(within(panel()).getByText('Ad hoc · v1.1.1')).toBeTruthy()
    expect(within(panel()).getByText('Failed')).toBeTruthy()
    expect(within(panel()).getByText('on 2026-11-09 09:00:00')).toBeTruthy()
    expect(within(panel()).getByText('Last successful')).toBeTruthy()
    expect(within(panel()).getByText('Ad hoc · v1.1.0 · on 2026-11-08 08:30:00')).toBeTruthy()
  })

  // The facts under the tabs are those of the build of the tab that is open, never of the platform's last build of another type
  it('shows the version, the job and the date of the build of the tab that is open, and changes them with the tab', () => {
    show(appStoreLast({ version: '1.3.0' }), {
      buildAttemptsState: {
        loading: false,
        error: false,
        attempts: [
          attemptOf('ios', { id: 12, mode: 'app-store', updated_at: '2026-11-10 18:00:00' }),
          attemptOf('ios', { id: 10, mode: 'ad-hoc', app_version: '1.1.0', job_id: 'job-10', updated_at: '2026-11-08 08:30:00' })
        ]
      }
    })

    // App Store is the platform's last build: its job is the build's
    expect(selected(ios())).toBe('App Store, Successful')
    expect(factsOf(ios())).toEqual([
      ['Version', '1.3.0'],
      ['Build version', '1.2.0'],
      ['Package', 'com.demo.app'],
      ['Job', 'job-9'],
      ['Last build', 'on 2026-11-10 18:00:00']
    ])

    // Ad hoc: its own version, job and date, and not the job of the App Store build
    openTab(ios(), 'Ad hoc, Successful')
    expect(within(ios()).getByText('Ad hoc · v1.1.0')).toBeTruthy()
    expect(factsOf(ios())).toEqual([
      ['Version', '1.3.0'],
      ['Build version', '1.1.0'],
      ['Package', 'com.demo.app'],
      ['Job', 'job-10'],
      ['Last build', 'on 2026-11-08 08:30:00']
    ])

    openTab(ios(), 'App Store, Successful')
    expect(factsOf(ios()).map(([label]) => label)).toEqual(['Version', 'Build version', 'Package', 'Job', 'Last build'])
  })

  // An attempt without `job_id` (from before the API sent it, or an API not deployed yet, or one that never got a job) shows no Job
  it('shows no job under a tab whose attempt has none, whether the field is missing or null', () => {
    show(appStoreLast({ version: '1.3.0' }), {
      buildAttemptsState: {
        loading: false,
        error: false,
        attempts: [
          attemptOf('ios', { id: 12, mode: 'app-store', updated_at: '2026-11-10 18:00:00' }),
          attemptOf('ios', { id: 10, mode: 'ad-hoc', app_version: '1.1.0', job_id: null, updated_at: '2026-11-08 08:30:00' })
        ]
      }
    })

    openTab(ios(), 'Ad hoc, Successful')
    expect(factsOf(ios()).map(([label]) => label)).toEqual(['Version', 'Build version', 'Package', 'Last build'])
    expect(ios().textContent).not.toContain('job-9')
  })

  it('shows nothing of another type\'s build under a type that was never built: only what is the app\'s', () => {
    show(makeApp({ builds: [buildOf('android', { attempt_id: 4 })], built_apps: { android: { release: { assemble: { apk: true, zip: true } } } } }))
    expect(factsOf(android()).map(([label]) => label)).toEqual(['Version', 'Build version', 'Package', 'Job', 'Last build'])

    openTab(android(), 'AAB debug, Not built yet')
    expect(within(android()).getByText('There is no AAB debug build yet. Build it to download its file.')).toBeTruthy()
    expect(factsOf(android())).toEqual([
      ['Version', '1.2.0'],
      ['Package', 'com.demo.app']
    ])
    expect(android().textContent).not.toContain('job-9')
    expect(android().textContent).not.toContain('on 2026-01-02')
    // the state of the platform's last build is still in its head
    expect(badgeOf(android()).textContent).toBe('Successful')
  })

  it('shows the facts of the type that is being built while its first build runs', () => {
    show(makeApp({ builds: [buildOf('ios', { attempt_id: 20, mode: 'ad-hoc', status: 'building', job_id: 'job-20', updated_at: '2026-11-11 17:30:00' })] }))

    expect(selected(ios())).toBe('Ad hoc, Building')
    expect(factsOf(ios())).toEqual([
      ['Version', '1.2.0'],
      ['Build version', '1.2.0'],
      ['Package', 'com.demo.app'],
      ['Job', 'job-20'],
      ['Last build', 'on 2026-11-11 17:30:00']
    ])
  })

  it('says the file of a finished build is gone when the storage no longer has it', () => {
    show(makeApp({ builds: [buildOf('android', { attempt_id: 4 })], built_apps: {} }))

    expect(selected(android())).toBe('APK, Successful')
    expect(within(android()).getByText('This build’s file is no longer available. Build again to get a new one.')).toBeTruthy()
    expect(within(android()).queryByRole('button', { name: /^Download/ })).toBeNull()
  })

  it('asks for the attempts once when it opens, not on every render', () => {
    const view = show(appStoreLast())
    expect(view.loadBuildAttempts).toHaveBeenCalledTimes(1)

    view.again({ app: appStoreLast({ version: '1.3.0' }) })
    openTab(ios(), 'Ad hoc, Successful')
    expect(view.loadBuildAttempts).toHaveBeenCalledTimes(1)
  })

  it('keeps the tab that was picked while the platform has the same last build', () => {
    const view = show(appStoreLast())
    openTab(ios(), 'Ad hoc, Successful')

    view.again({ app: appStoreLast({ version: '1.3.0' }) })
    expect(selected(ios())).toBe('Ad hoc, Successful')
  })

  it('moves between the types with the arrow keys', async () => {
    const user = userEvent.setup()
    show(appStoreLast())

    await user.click(within(ios()).getByRole('tab', { name: 'App Store, Successful' }))
    await user.keyboard('{ArrowLeft}')
    expect(selected(ios())).toBe('Ad hoc, Successful')
    expect(await within(ios()).findByRole('img', { name: 'QR code to install Ad hoc' })).toBeTruthy()
  })
})

// «Build» opens the Builder's Build dialog on the file type of the tab that is open; the type can be changed there. What is still
// missing is listed in the dialog, which does not build until it is fixed.
describe('BuildsSection · the Build dialog', () => {
  const files = { android: { release: { assemble: { apk: true, zip: true }, bundle: { aab: true, zip: true } } } }
  const dialogOf = (platform) => screen.findByRole('dialog', { name: `Build for ${platform}` })
  const radio = (dialog, name) => within(dialog).getByRole('radio', { name })
  const checked = (dialog) => within(dialog).getAllByRole('radio').filter(node => node.getAttribute('aria-checked') === 'true').map(node => node.textContent)
  const build = (region) => within(region).getByRole('button', { name: 'Build' })

  it('offers one Build per platform, as the primary button', () => {
    show(makeApp({ builds: [] }))

    expect(build(android()).getAttribute('data-variant')).toBe('primary')
    expect(build(ios()).getAttribute('data-variant')).toBe('primary')
    expect(within(android()).queryByRole('button', { name: /Build (PRO|Test|AAB)/ })).toBeNull()
  })

  it('opens on the file type of the tab that is open', async () => {
    const user = userEvent.setup()
    show(makeApp({ built_apps: files }))

    expect(selected(android())).toBe('APK, Successful')
    await user.click(build(android()))
    let dialog = await dialogOf('Android')
    expect(within(dialog).getAllByRole('radio').map(node => node.textContent.replace(/\s.*$/, ''))).toHaveLength(4)
    expect(checked(dialog)).toEqual([expect.stringMatching(/^APK(?! debug)/)])
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    openTab(android(), 'AAB, Successful')
    await user.click(build(android()))
    dialog = await dialogOf('Android')
    expect(checked(dialog)).toEqual([expect.stringMatching(/^AAB(?! debug)/)])
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    openTab(android(), 'AAB debug, Not built yet')
    await user.click(build(android()))
    dialog = await dialogOf('Android')
    expect(checked(dialog)).toEqual([expect.stringMatching(/^AAB debug/)])
  })

  it('builds the type of the tab with main\'s body: an iOS build has no type', async () => {
    const user = userEvent.setup()
    const view = show(makeApp({ builds: [buildOf('ios', { mode: 'app-store' })], built_apps: { ios: { 'app-store': { ipa: true } } } }))

    openTab(ios(), 'Ad hoc, Not built yet')
    await user.click(build(ios()))
    const dialog = await dialogOf('iOS')
    expect(checked(dialog)).toEqual([expect.stringMatching(/^Ad hoc/)])
    await user.click(within(dialog).getByRole('button', { name: 'Build' }))

    expect(view.buildApp).toHaveBeenCalledWith({ appId: 7, platform: 'ios', mode: 'ad-hoc' })
    expect(view.buildApp.mock.calls[0][0]).not.toHaveProperty('type')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Build for iOS' })).toBeNull())
  })

  it('lets the type be changed before building', async () => {
    const user = userEvent.setup()
    const view = show(makeApp({ built_apps: files }))

    await user.click(build(android()))
    const dialog = await dialogOf('Android')
    expect(checked(dialog)).toEqual([expect.stringMatching(/^APK(?! debug)/)])
    await user.click(radio(dialog, /^AAB debug/))
    expect(checked(dialog)).toEqual([expect.stringMatching(/^AAB debug/)])
    await user.click(within(dialog).getByRole('button', { name: 'Build' }))
    expect(view.buildApp).toHaveBeenLastCalledWith({ appId: 7, platform: 'android', mode: 'debug', type: 'bundle' })
  })

  it.each([
    [/^APK(?! debug)/, { mode: 'release', type: 'assemble' }],
    [/^AAB(?! debug)/, { mode: 'release', type: 'bundle' }],
    [/^APK debug/, { mode: 'debug', type: 'assemble' }],
    [/^AAB debug/, { mode: 'debug', type: 'bundle' }]
  ])('builds the Android option %s with its mode and type', async (name, body) => {
    const user = userEvent.setup()
    const view = show(makeApp({ builds: [] }))

    await user.click(build(android()))
    const dialog = await dialogOf('Android')
    await user.click(radio(dialog, name))
    await user.click(within(dialog).getByRole('button', { name: 'Build' }))
    expect(view.buildApp).toHaveBeenCalledWith({ appId: 7, platform: 'android', ...body })
  })

  it('opens the tab of the type that was built once the build is asked for, and shows it when it ends', async () => {
    const user = userEvent.setup()
    const view = show(makeApp({ built_apps: files, builds: [buildOf('android', { attempt_id: 1 })] }))
    expect(selected(android())).toBe('APK, Successful')

    await user.click(build(android()))
    const dialog = await dialogOf('Android')
    await user.click(radio(dialog, /^AAB(?! debug)/))
    await user.click(within(dialog).getByRole('button', { name: 'Build' }))
    // the controller puts the new build in the app
    view.again({ app: makeApp({ built_apps: files, builds: [buildOf('android', { attempt_id: 2, type: 'bundle', status: 'pending' })] }) })
    expect(selected(android())).toBe('AAB, Pending')

    // another tab is looked at while it builds: when the build ends, the type that was built is the one shown
    openTab(android(), 'APK, Successful')
    expect(selected(android())).toBe('APK, Successful')
    view.again({ app: makeApp({ built_apps: files, builds: [buildOf('android', { attempt_id: 2, type: 'bundle' })] }) })
    expect(selected(android())).toBe('AAB, Successful')
    expect(within(android()).getByRole('button', { name: 'Download AAB' })).toBeTruthy()
  })

  it('keeps the type that was built in sight when its build fails', () => {
    const view = show(makeApp({ built_apps: files, builds: [buildOf('android', { attempt_id: 1 })] }))

    view.again({ app: makeApp({ built_apps: files, builds: [buildOf('android', { attempt_id: 2, type: 'bundle', status: 'building' })] }) })
    expect(selected(android())).toBe('AAB, Building')
    view.again({ app: makeApp({ built_apps: files, builds: [buildOf('android', { attempt_id: 2, type: 'bundle', status: 'failed' })] }) })
    expect(selected(android())).toBe('AAB, Failed')
  })

  it('lists what is missing in the dialog, with the way to fix it, and does not build', async () => {
    const user = userEvent.setup()
    const view = show(makeApp({ android_credentials: {} }))

    await user.click(build(android()))
    const dialog = await dialogOf('Android')
    expect(within(dialog).getByText('Complete these before building for Android:')).toBeTruthy()
    expect(within(dialog).getAllByRole('listitem').map(item => item.querySelector('span:not(.odc-badge)')?.textContent ?? item.textContent)).toHaveLength(2)
    expect(within(dialog).getByText('Key alias')).toBeTruthy()
    expect(within(dialog).getByText('Store file')).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Build' })).toBeDisabled()

    await user.click(within(dialog).getAllByRole('button', { name: 'Fix' })[0])
    expect(view.onNavigate).toHaveBeenCalledWith('credentials')
    expect(screen.queryByRole('dialog', { name: 'Build for Android' })).toBeNull()
    expect(view.buildApp).not.toHaveBeenCalled()
  })

  it('closes when the build is refused: the «Build error» dialog says why', async () => {
    const user = userEvent.setup()
    const buildApp = vi.fn(async () => ({ ok: false }))
    show(makeApp({ builds: [] }), { buildApp })

    await user.click(build(ios()))
    await user.click(within(await dialogOf('iOS')).getByRole('button', { name: 'Build' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Build for iOS' })).toBeNull())
    expect(buildApp).toHaveBeenCalledTimes(1)
  })

  it('disables only the Build of a platform that is still building, and says why', () => {
    show(makeApp({ builds: [buildOf('android', { status: 'building' })] }))

    expect(build(android())).toBeDisabled()
    expect(within(android()).getByText('Android is already building.')).toBeTruthy()
    expect(build(android()).getAttribute('aria-describedby')).toBe(within(android()).getByText('Android is already building.').id)
    expect(build(ios())).toBeEnabled()
    expect(within(ios()).queryByText(/is already building/)).toBeNull()
  })

  it.each(['successful', 'failed', 'error_request'])('keeps Build enabled when the last build is %s', (status) => {
    show(makeApp({ builds: [buildOf('android', { status })] }))

    expect(build(android())).toBeEnabled()
  })

  it('disables every Build while a build is being requested', () => {
    show(makeApp({ builds: [] }), { buildAppState: { loading: true, result: null, error: null } })

    expect(build(android())).toBeDisabled()
    expect(build(ios())).toBeDisabled()
  })
})

describe('BuildsSection · QR codes and downloads', () => {
  const builtApps = {
    android: {
      release: { assemble: { apk: true, zip: true } },
      debug: { assemble: { apk: true, zip: true } }
    }
  }
  const qrOf = (name) => within(android()).findByRole('img', { name: `QR code to install ${name}` })

  it('asks for a signed install link when the QR is shown and draws it, never the public downloads route', async () => {
    const view = show(makeApp({ built_apps: builtApps }))

    const qr = await qrOf('APK')
    expect(qr.getAttribute('data-value')).toBe('https://api.example.test/builder/install/android-release/apk?expires=1&signature=s')
    expect(qr.getAttribute('data-size')).toBe('256')
    expect(qr.getAttribute('data-viewbox')).toBe('0 0 256 256')
    expect(within(android()).getByText('Scan with the phone’s camera to download the APK. Android asks to allow installing apps from this source the first time.')).toBeTruthy()
    // only the link of the tab that is open
    expect(asked(view)).toEqual(['android/release/apk'])
    openTab(android(), 'APK debug, Successful')
    expect((await qrOf('APK debug')).getAttribute('data-value')).toContain('/android-debug/apk')
    expect(asked(view)).toEqual(['android/release/apk', 'android/debug/apk'])
    expect(document.querySelector('[data-value*="/downloads/"]')).toBeNull()
    // its expiry under it
    expect(within(android()).getByText(/^Expires in 2[34] h \d+ min · on \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)).toBeTruthy()
  })

  it('waits for the link with a placeholder, and says why it could not be made with a way to try again', async () => {
    const user = userEvent.setup()
    let answer
    const createInstallLink = vi.fn(() => new Promise(resolve => { answer = resolve }))
    show(makeApp({ built_apps: { android: { release: { assemble: { apk: true } } } } }), { createInstallLink })

    expect(within(android()).getByText('Preparing the install link…')).toBeTruthy()
    expect(within(android()).queryByRole('img')).toBeNull()
    await act(async () => answer({ ok: false, result: null, errorCodes: ['build.artifact_missing'] }))

    const alert = within(android()).getByRole('alert')
    expect(alert.textContent).toContain('This build’s file is no longer available. Build again to get a new one.')
    createInstallLink.mockImplementation(async (entry) => ({ ok: true, result: signedLink(entry), errorCodes: [] }))
    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(await qrOf('APK')).toBeTruthy()
    expect(createInstallLink).toHaveBeenCalledTimes(2)
  })

  it('offers a new link once it expired', async () => {
    const user = userEvent.setup()
    const createInstallLink = vi.fn(async (entry) => ({ ok: true, result: signedLink(entry, -1000), errorCodes: [] }))
    show(makeApp({ built_apps: { android: { release: { assemble: { apk: true } } } } }), { createInstallLink })

    expect(await within(android()).findByText('This link expired.')).toBeTruthy()
    expect(within(android()).queryByRole('img')).toBeNull()
    createInstallLink.mockImplementation(async (entry) => ({ ok: true, result: signedLink(entry), errorCodes: [] }))
    await user.click(within(android()).getByRole('button', { name: 'Generate a new link' }))
    expect(await qrOf('APK')).toBeTruthy()
  })

  it('asks for a new link when a newer build of its mode finishes, not while it builds', async () => {
    const view = show(makeApp({ built_apps: builtApps, builds: [buildOf('android', { attempt_id: 1 })] }))
    await qrOf('APK')
    expect(asked(view)).toEqual(['android/release/apk'])

    view.again({ app: makeApp({ built_apps: builtApps, builds: [buildOf('android', { attempt_id: 2, status: 'building' })] }) })
    expect(asked(view)).toEqual(['android/release/apk'])
    view.again({ app: makeApp({ built_apps: builtApps, builds: [buildOf('android', { attempt_id: 2 })] }) })
    await waitFor(() => expect(asked(view)).toEqual(['android/release/apk', 'android/release/apk']))
  })

  it('does not ask again when the build that finishes is an AAB: the APK of its mode is the one it was', async () => {
    const files = { android: { release: { assemble: { apk: true }, bundle: { aab: true } }, debug: { assemble: { apk: true } } } }
    const view = show(makeApp({ built_apps: files, builds: [buildOf('android', { attempt_id: 1 })] }))
    await qrOf('APK')
    expect(asked(view)).toEqual(['android/release/apk'])

    view.again({ app: makeApp({ built_apps: files, builds: [buildOf('android', { attempt_id: 2, type: 'bundle', status: 'building' })] }) })
    view.again({ app: makeApp({ built_apps: files, builds: [buildOf('android', { attempt_id: 2, type: 'bundle', updated_at: '2026-01-03' })] }) })
    await settle()
    expect(asked(view)).toEqual(['android/release/apk'])

    // and the next APK of the mode does renew it
    view.again({ app: makeApp({ built_apps: files, builds: [buildOf('android', { attempt_id: 3, status: 'building' })] }) })
    view.again({ app: makeApp({ built_apps: files, builds: [buildOf('android', { attempt_id: 3, updated_at: '2026-01-04' })] }) })
    await waitFor(() => expect(asked(view)).toEqual(['android/release/apk', 'android/release/apk']))
  })

  it('does not ask again for the QR of another mode: a debug build renews only the debug one', async () => {
    const view = show(makeApp({ built_apps: builtApps, builds: [buildOf('android', { attempt_id: 1 })] }))
    await qrOf('APK')
    openTab(android(), 'APK debug, Successful')
    await qrOf('APK debug')
    expect(asked(view)).toEqual(['android/release/apk', 'android/debug/apk'])

    view.again({ app: makeApp({ built_apps: builtApps, builds: [buildOf('android', { attempt_id: 2, mode: 'debug', status: 'building' })] }) })
    view.again({ app: makeApp({ built_apps: builtApps, builds: [buildOf('android', { attempt_id: 2, mode: 'debug' })] }) })
    await waitFor(() => expect(view.createInstallLink).toHaveBeenCalledTimes(3))
    await settle()
    expect(asked(view)).toEqual(['android/release/apk', 'android/debug/apk', 'android/debug/apk'])
  })

  it('renews a link that names the build before although its QR was not on screen when the newer build finished', async () => {
    const files = { android: { release: { assemble: { apk: true }, bundle: { aab: true } }, debug: { assemble: { apk: true } } } }
    const view = show(makeApp({ built_apps: files, builds: [buildOf('android', { attempt_id: 1 })] }))
    await qrOf('APK')
    // the AAB tab is the one open: the QR of the APK is not on screen
    openTab(android(), 'AAB, Successful')
    expect(within(android()).queryByRole('img')).toBeNull()
    expect(asked(view)).toEqual(['android/release/apk'])

    // a release APK ends and its tab opens: the link it had is still valid, but it names the build before
    view.again({ app: makeApp({ built_apps: files, builds: [buildOf('android', { attempt_id: 2 })] }) })
    expect(selected(android())).toBe('APK, Successful')
    await waitFor(() => expect(asked(view)).toEqual(['android/release/apk', 'android/release/apk']))
    await settle()
    expect(asked(view)).toHaveLength(2)
  })

  it('asks once for a link that was never asked for when its build finishes and its tab opens', async () => {
    const files = { android: { release: { assemble: { apk: true }, bundle: { aab: true } } } }
    const view = show(makeApp({ built_apps: files, builds: [buildOf('android', { attempt_id: 1, type: 'bundle' })] }))
    expect(selected(android())).toBe('AAB, Successful')
    expect(asked(view)).toEqual([])

    view.again({ app: makeApp({ built_apps: files, builds: [buildOf('android', { attempt_id: 2 })] }) })
    await qrOf('APK')
    await settle()
    expect(asked(view)).toEqual(['android/release/apk'])
  })

  it('renews the iOS Ad hoc QR by its mode alone (an iOS build has no type), and an App Store build leaves it', async () => {
    const files = { ios: { 'ad-hoc': { ipa: true }, 'app-store': { ipa: true } } }
    const view = show(makeApp({ built_apps: files, builds: [buildOf('ios', { attempt_id: 1, mode: 'ad-hoc' })] }))
    await within(ios()).findByRole('img', { name: 'QR code to install Ad hoc' })
    expect(asked(view)).toEqual(['ios/ad-hoc/ipa'])

    view.again({ app: makeApp({ built_apps: files, builds: [buildOf('ios', { attempt_id: 2, mode: 'app-store' })] }) })
    await settle()
    expect(asked(view)).toEqual(['ios/ad-hoc/ipa'])

    view.again({ app: makeApp({ built_apps: files, builds: [buildOf('ios', { attempt_id: 3, mode: 'ad-hoc' })] }) })
    await waitFor(() => expect(asked(view)).toEqual(['ios/ad-hoc/ipa', 'ios/ad-hoc/ipa']))
  })

  it('asks again when a build finishes while its link was being asked for, and never draws the link of the build before', async () => {
    const files = { android: { release: { assemble: { apk: true } } } }
    const answers = []
    const createInstallLink = vi.fn(() => new Promise(resolve => { answers.push(resolve) }))
    const linkOf = (url) => ({ ok: true, result: { ...signedLink({ platform: 'android', mode: 'release', file: 'apk' }), url }, errorCodes: [] })
    const view = show(makeApp({ built_apps: files, builds: [buildOf('android', { attempt_id: 1 })] }), { createInstallLink })
    expect(createInstallLink).toHaveBeenCalledTimes(1)

    view.again({ app: makeApp({ built_apps: files, builds: [buildOf('android', { attempt_id: 2 })] }) })
    // one request per file at a time: the renewal waits for the one on its way
    expect(createInstallLink).toHaveBeenCalledTimes(1)
    await act(async () => answers[0](linkOf('https://api.example.test/builder/install/1/apk')))
    expect(createInstallLink).toHaveBeenCalledTimes(2)
    expect(within(android()).queryByRole('img')).toBeNull()
    expect(within(android()).getByText('Preparing the install link…')).toBeTruthy()

    await act(async () => answers[1](linkOf('https://api.example.test/builder/install/2/apk')))
    expect(within(android()).getByRole('img', { name: 'QR code to install APK' }).getAttribute('data-value')).toBe('https://api.example.test/builder/install/2/apk')
    expect(createInstallLink).toHaveBeenCalledTimes(2)
  })

  it('asks for nothing else once the section is gone, even with a renewal waiting', async () => {
    const files = { android: { release: { assemble: { apk: true } } } }
    const answers = []
    const createInstallLink = vi.fn(() => new Promise(resolve => { answers.push(resolve) }))
    const view = show(makeApp({ built_apps: files, builds: [buildOf('android', { attempt_id: 1 })] }), { createInstallLink })
    view.again({ app: makeApp({ built_apps: files, builds: [buildOf('android', { attempt_id: 2 })] }) })

    view.unmount()
    await act(async () => answers[0]({ ok: true, result: signedLink({ platform: 'android', mode: 'release', file: 'apk' }), errorCodes: [] }))
    expect(createInstallLink).toHaveBeenCalledTimes(1)
  })

  it('asks for the link of a download with the platform, mode and file of its type', async () => {
    const user = userEvent.setup()
    const view = show(makeApp({ built_apps: builtApps }))
    await qrOf('APK')

    await user.click(within(android()).getByRole('button', { name: 'Download APK' }))
    expect(view.downloadApp).toHaveBeenCalledWith({ type: 'android|release|apk', platform: 'android', mode: 'release', file: 'apk' })
    expect(mockState.showToast).not.toHaveBeenCalled()
  })

  it('says why a download failed', async () => {
    const user = userEvent.setup()
    const downloadApp = vi.fn(async () => ({ ok: false, errorCodes: ['build.artifact_replaced'] }))
    show(makeApp({ builds: [buildOf('ios', { mode: 'ad-hoc' })], built_apps: { ios: { 'ad-hoc': { ipa: true } } } }), { downloadApp })
    await within(ios()).findByRole('img')

    await user.click(within(ios()).getByRole('button', { name: 'Download IPA' }))
    expect(downloadApp).toHaveBeenCalledWith({ type: 'ios|ad-hoc|ipa', platform: 'ios', mode: 'ad-hoc', file: 'ipa' })
    expect(mockState.showToast).toHaveBeenCalledWith('error', 'A newer Ad hoc build replaced this file. Download that one instead.')
  })

  it('says nothing when the click was ignored because another download is in progress (the controller answers nothing)', async () => {
    const user = userEvent.setup()
    const downloadApp = vi.fn(async () => null)
    show(makeApp({ built_apps: builtApps }), { downloadApp })
    await qrOf('APK')

    await user.click(within(android()).getByRole('button', { name: 'Download APK' }))
    expect(downloadApp).toHaveBeenCalledTimes(1)
    expect(mockState.showToast).not.toHaveBeenCalled()
  })

  it('marks the download that is in progress and ignores the repeats', async () => {
    const user = userEvent.setup()
    const view = show(makeApp({ built_apps: builtApps }), { downloadAppState: { loading: true, type: 'android|release|apk', result: null, error: null } })
    await qrOf('APK')

    const button = within(android()).getByRole('button', { name: 'Download APK' })
    expect(button.getAttribute('aria-busy')).toBe('true')
    await user.click(button)
    expect(view.downloadApp).not.toHaveBeenCalled()
  })

  it('does not mark the download of another type as busy', async () => {
    show(makeApp({ built_apps: builtApps }), { downloadAppState: { loading: true, type: 'android|debug|apk', result: null, error: null } })
    await qrOf('APK')

    expect(within(android()).getByRole('button', { name: 'Download APK' }).getAttribute('aria-busy')).toBeNull()
  })
})

// The expiry under the QR follows the link drawn: also the one a renewal gave («Generate a new link», a newer build)
describe('BuildsSection · the expiry of an install link, also after it is renewed', () => {
  const files = { android: { release: { assemble: { apk: true } } } }
  const MINUTE = 60000
  const DAY = 24 * 60 * MINUTE
  const flush = () => act(async () => { await Promise.resolve() })
  const linkFor = (expiresIn, url) => async (entry) => ({
    ok: true,
    result: { ...signedLink(entry, expiresIn), ...(url && { url }) },
    errorCodes: []
  })

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(Date.parse('2026-11-10T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('counts down, expires, and after «Generate a new link» counts the new one down until it expires too', async () => {
    const createInstallLink = vi.fn()
      .mockImplementationOnce(linkFor(2 * MINUTE))
      .mockImplementationOnce(linkFor(DAY, 'https://api.example.test/builder/install/renewed'))
    show(makeApp({ built_apps: files }), { createInstallLink })
    await flush()

    expect(within(android()).getByText('Expires in 2 min · on 2026-11-10 12:02:00')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(MINUTE) })
    expect(within(android()).getByText(/^Expires in 1 min/)).toBeTruthy()
    act(() => { vi.advanceTimersByTime(MINUTE) })
    expect(within(android()).getByText('This link expired.')).toBeTruthy()
    expect(within(android()).queryByRole('img')).toBeNull()

    fireEvent.click(within(android()).getByRole('button', { name: 'Generate a new link' }))
    await flush()
    expect(createInstallLink).toHaveBeenCalledTimes(2)
    expect(within(android()).getByRole('img', { name: 'QR code to install APK' }).getAttribute('data-value')).toBe('https://api.example.test/builder/install/renewed')
    expect(within(android()).queryByText('This link expired.')).toBeNull()
    expect(within(android()).getByText('Expires in 24 h 0 min · on 2026-11-11 12:02:00')).toBeTruthy()

    // the countdown goes on with the new link
    act(() => { vi.advanceTimersByTime(90 * MINUTE) })
    expect(within(android()).getByText(/^Expires in 22 h 30 min/)).toBeTruthy()
    act(() => { vi.advanceTimersByTime(DAY - 90 * MINUTE - 1000) })
    expect(within(android()).getByRole('img', { name: 'QR code to install APK' })).toBeTruthy()
    expect(within(android()).getByText(/^Expires in 1 min/)).toBeTruthy()

    // and the new one expires at its own end, with the way to ask for another
    act(() => { vi.advanceTimersByTime(1000) })
    expect(within(android()).getByText('This link expired.')).toBeTruthy()
    expect(within(android()).queryByRole('img')).toBeNull()
    expect(within(android()).getByRole('button', { name: 'Generate a new link' })).toBeTruthy()
  })

  it('counts down the link a newer build gave, from its own expiry, and expires it', async () => {
    const createInstallLink = vi.fn()
      .mockImplementationOnce(linkFor(DAY))
      .mockImplementationOnce(linkFor(DAY, 'https://api.example.test/builder/install/build-2'))
    const view = show(makeApp({ built_apps: files, builds: [buildOf('android', { attempt_id: 1 })] }), { createInstallLink })
    await flush()
    act(() => { vi.advanceTimersByTime(6 * 60 * MINUTE) })
    expect(within(android()).getByText(/^Expires in 18 h 0 min/)).toBeTruthy()

    view.again({ app: makeApp({ built_apps: files, builds: [buildOf('android', { attempt_id: 2 })] }) })
    await flush()
    expect(within(android()).getByRole('img', { name: 'QR code to install APK' }).getAttribute('data-value')).toBe('https://api.example.test/builder/install/build-2')
    expect(within(android()).getByText('Expires in 24 h 0 min · on 2026-11-11 18:00:00')).toBeTruthy()

    // the end of the link before (18 hours from now) is not this one's
    act(() => { vi.advanceTimersByTime(18 * 60 * MINUTE) })
    expect(within(android()).getByText(/^Expires in 6 h 0 min/)).toBeTruthy()
    act(() => { vi.advanceTimersByTime(6 * 60 * MINUTE) })
    expect(within(android()).getByText('This link expired.')).toBeTruthy()
    expect(within(android()).getByRole('button', { name: 'Generate a new link' })).toBeTruthy()
  })

  it('expires the link a renewal gave after waiting for the request on its way', async () => {
    const answers = []
    const createInstallLink = vi.fn(() => new Promise(resolve => { answers.push(resolve) }))
    const entry = { platform: 'android', mode: 'release', file: 'apk' }
    const view = show(makeApp({ built_apps: files, builds: [buildOf('android', { attempt_id: 1 })] }), { createInstallLink })
    view.again({ app: makeApp({ built_apps: files, builds: [buildOf('android', { attempt_id: 2 })] }) })
    // the answer on its way would expire in two minutes; the one asked for again lasts its 24 hours
    await act(async () => answers[0]({ ok: true, result: signedLink(entry, 2 * MINUTE), errorCodes: [] }))
    await act(async () => answers[1]({ ok: true, result: signedLink(entry, DAY), errorCodes: [] }))

    expect(within(android()).getByText(/^Expires in 24 h 0 min/)).toBeTruthy()
    act(() => { vi.advanceTimersByTime(2 * MINUTE) })
    expect(within(android()).queryByText('This link expired.')).toBeNull()
    expect(within(android()).getByText(/^Expires in 23 h 58 min/)).toBeTruthy()
    act(() => { vi.advanceTimersByTime(DAY - 2 * MINUTE) })
    expect(within(android()).getByText('This link expired.')).toBeTruthy()
  })
})

// redesign my-products R1-06: a fact aligns its value to the top even if another of its row takes two lines, and the
// package breaks at its dots, never in the middle of a word
describe('BuildsSection · facts (R1-06)', () => {
  const css = readFileSync(resolve('src/@/components-dashboard/src/ui/src/components/MyProducts/AppEditor/app-builds.css'), 'utf8')
  const ruleOf = (selector) => {
    const start = css.indexOf(`${selector} {`)
    return start === -1 ? '' : css.slice(start, css.indexOf('}', start))
  }

  it('aligns the content of each fact cell to the top, by its own class', () => {
    show(makeApp())

    const cells = [...android().querySelectorAll('dl.odc-apb-facts > div')]
    expect(cells).toHaveLength(5)
    for (const cell of cells) expect(cell.classList.contains('odc-apb-fact')).toBe(true)
    expect(ruleOf('.odc-apb-fact')).toMatch(/align-content:\s*start/)
  })

  it('breaks the package at its dots with <wbr>, without changing its text', () => {
    show(makeApp({ package: 'com.ordering.onlineorderingappv5' }))

    const value = [...android().querySelectorAll('dl > div')].find(row => row.querySelector('dt').textContent === 'Package').querySelector('dd')
    expect(value.textContent).toBe('com.ordering.onlineorderingappv5')
    expect(value.querySelectorAll('wbr')).toHaveLength(2)
    // every <wbr> follows a dot
    for (const node of value.querySelectorAll('wbr')) expect(node.previousSibling.textContent.endsWith('.')).toBe(true)
  })

  it('puts no <wbr> in the other facts or in a package without dots', () => {
    show(makeApp({ package: 'demo' }))

    expect(android().querySelectorAll('dl wbr')).toHaveLength(0)
  })
})

describe('BuildsSection · a failed build', () => {
  const failed = () => makeApp({
    builds: [buildOf('android', { status: 'failed', error_code: 'E42', error_description: 'The signing key was rejected' })]
  })

  it('offers the logs and the certificates, and says what failed', async () => {
    const user = userEvent.setup()
    const view = show(failed())

    expect(badgeOf(android()).textContent).toBe('Failed')
    expect(badgeOf(android()).getAttribute('data-family')).toBe('cancel')
    await user.click(within(android()).getByRole('button', { name: 'See Logs' }))
    expect(view.getBuildLogs).toHaveBeenCalledWith({ platform: 'android' })

    expect(within(android()).getByText('Error code: E42')).toBeTruthy()
    expect(within(android()).getByText('Error description: The signing key was rejected')).toBeTruthy()
  })

  // the API sends a key as the description; a known code says what to do, an unknown key never shows raw
  it('reads a known failure code instead of the API key', () => {
    show(makeApp({
      builds: [buildOf('ios', { status: 'failed', error_code: 'missing_credentials', error_description: 'API_BUILD_ERROR_MISSING_CREDENTIALS' })]
    }))
    expect(within(ios()).getByText('Error code: missing_credentials')).toBeTruthy()
    expect(within(ios()).getByText(/^Error description: A credentials file is missing/)).toBeTruthy()
    expect(within(ios()).queryByText(/API_BUILD_ERROR_MISSING_CREDENTIALS/)).toBeNull()
  })

  it('says the generic failure for an unknown API key', () => {
    show(makeApp({
      builds: [buildOf('android', { status: 'failed', error_code: 'weird', error_description: 'API_BUILD_ERROR_SOMETHING_NEW' })]
    }))
    expect(within(android()).getByText('Error description: Build failed. Check the logs.')).toBeTruthy()
    expect(within(android()).queryByText(/API_BUILD_ERROR_SOMETHING_NEW/)).toBeNull()
  })

  // redesign D-80 (owner, 2026-10-19): deleting the certificates asks first (C8)
  it('asks before deleting the certificates and deletes them only when confirmed', async () => {
    const user = userEvent.setup()
    const view = show(failed())

    const opener = within(android()).getByRole('button', { name: 'Delete certificates' })
    await user.click(opener)
    expect(view.deleteCertificates).not.toHaveBeenCalled()

    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Delete the Android certificates?')).toBeTruthy()
    expect(within(dialog).getByText('To build the app again you will have to upload them again.')).toBeTruthy()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())

    await user.click(within(dialog).getByRole('button', { name: 'Delete certificates' }))
    expect(view.deleteCertificates).toHaveBeenCalledTimes(1)
    expect(view.deleteCertificates).toHaveBeenCalledWith({ platform: 'android' })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('deletes nothing on Cancel and gives the focus back to the button', async () => {
    const user = userEvent.setup()
    const view = show(failed())

    const opener = within(android()).getByRole('button', { name: 'Delete certificates' })
    await user.click(opener)
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(view.deleteCertificates).not.toHaveBeenCalled()
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('names the platform the certificates belong to', async () => {
    const user = userEvent.setup()
    show(makeApp({ builds: [buildOf('ios', { status: 'failed' })] }))

    await user.click(within(ios()).getByRole('button', { name: 'Delete certificates' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Delete the iOS certificates?')).toBeTruthy()
  })

  it('does not offer them to the platform whose build did not fail, or to a successful one', () => {
    show(failed())

    expect(within(ios()).queryByRole('button', { name: 'See Logs' })).toBeNull()
    expect(within(ios()).queryByRole('button', { name: 'Delete certificates' })).toBeNull()
  })

  it('says nothing about an error that did not come', () => {
    show(makeApp({ builds: [buildOf('android', { status: 'failed' })] }))

    expect(screen.queryByText(/Error code/)).toBeNull()
    expect(screen.queryByText(/Error description/)).toBeNull()
  })
})

describe('BuildsSection · build error', () => {
  it('shows the error of the request in a dialog and clears it on close', async () => {
    const user = userEvent.setup()
    const state = { loading: false, result: ['The builder is busy'], error: true }
    const view = show(makeApp(), { buildAppState: state })

    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Build error')).toBeTruthy()
    expect(within(dialog).getByText('The builder is busy')).toBeTruthy()

    await user.click(within(dialog).getByRole('button', { name: 'Accept' }))
    expect(view.setBuildAppState).toHaveBeenCalledWith({ loading: false, result: null, error: null })
  })

  it('has no dialog when there is no error', () => {
    show(makeApp())

    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

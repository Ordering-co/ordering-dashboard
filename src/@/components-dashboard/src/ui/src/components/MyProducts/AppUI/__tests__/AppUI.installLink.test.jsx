/* eslint-disable import/first */
// Opening an app of My Products asks for the QR's install link ONCE, and for the app's build attempts ONCE. Here the real pieces
// are wired as in the page: `AppUI` (`AppsController`) → `AppEditor` → `BuildApps` → the Builds section. The app arrives already
// loaded (ProductsBuilderList gives it) and the controller then loads its actions and constants: the editor, and with it the Builds
// section, must be mounted once, after that load, not once before it and again after (each mount of a QR asks the API for a signed
// link). Only the QR of the file type that is open is asked for: the one of another tab is asked for when its tab opens.
// The contexts and the network are simulated; the other sections of the editor are stand-ins.
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderWithProviders, defaultTheme } from '~/__tests__/helpers/testUtils'

// What the contexts give (hoisted: the mocks below read it)
const runtime = vi.hoisted(() => ({
  socket: { on: () => {}, off: () => {}, join: () => {}, leave: () => {} },
  io: { connected: true, on: () => {}, off: () => {} },
  translate: (_key, text) => text,
  api: [{ root: 'https://api.test/v400/en/demo', project: 'demo' }, { configurations: { subdomain: 'orderingplus' } }],
  toast: [null, { showToast: () => {} }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))

// the controllers read their contexts by path
vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'jwt', user: { id: 7 } }] }))
vi.mock('../../../../../../contexts/ApiContext', () => ({ useApi: () => runtime.api }))
vi.mock('../../../../../../contexts/ToastContext', () => ({ useToast: () => runtime.toast, ToastType: runtime.ToastType }))
vi.mock('../../../../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, runtime.translate] }))
vi.mock('../../../../../../contexts/WebsocketContext', () => ({
  useWebsocket: () => runtime.socket,
  useSocketInstance: () => runtime.io
}))
// the UI reads the barrel: the two controllers are the real ones
vi.mock('../../../../../../index', async () => {
  const { AppsController } = await vi.importActual('../../../../../../components/AppsController')
  const { BuildApps } = await vi.importActual('../../../../../../components/BuildApps')
  return {
    AppsController,
    BuildApps,
    useLanguage: () => [{}, runtime.translate],
    useApi: () => runtime.api,
    useUtils: () => [{ parseDate: (date) => `on ${date}` }],
    useToast: () => runtime.toast,
    ToastType: runtime.ToastType
  }
})
vi.mock('../../../../contexts/InfoShareContext', () => ({ useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: () => {} }] }))
vi.mock('../../../../utils', () => ({ learnOptionsValues: (keys) => keys }))
vi.mock('../../../Shared/LearnDropDown', () => ({ LearnDropDown: () => null }))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => false }))
vi.mock('../../OrderingWebsite/SectionsEditor/AdvancedSection', () => ({ AdvancedSection: () => null }))
vi.mock('../../AppEditor/GeneralSection', () => ({ GeneralSection: () => null }))
vi.mock('../../AppEditor/ConstantsSection', () => ({ ConstantsSection: () => null }))
vi.mock('../../AppEditor/CredentialsSection', () => ({ CredentialsSection: () => null }))
vi.mock('../../AppEditor/FilesSection', () => ({ FilesSection: () => null }))
vi.mock('../../AppEditor/ImagesSection', () => ({ ImagesSection: () => null, ResourcesSection: () => null }))
vi.mock('../../AppEditor/ColorsSection', () => ({ ColorsSection: () => null }))
vi.mock('react-qr-code', () => ({ default: ({ value, size, viewBox, ...rest }) => <svg data-value={value} {...rest} /> }))

import { AppUI } from '../index'

const theme = { ...defaultTheme, images: { myProducts: {} } }

// The app as ProductsBuilderList gives it: a driver app with a Pro and a Test APK
const app = {
  id: 677,
  name: 'Driver app',
  package: 'com.demo.driver',
  version: '1.2.0',
  base: { code: 'app_driver_x', platforms: ['android'] },
  builds: [{ platform: 'android', status: 'successful', mode: 'release', type: 'assemble', app_version: '1.2.0', attempt_id: 4, updated_at: '2026-11-10 12:00:00' }],
  built_apps: { android: { release: { assemble: { apk: true, zip: true } }, debug: { assemble: { apk: true } } } }
}

const answer = (result) => ({ ok: true, status: 200, json: async () => ({ error: false, result }) })
const fetchMock = vi.fn()
const requests = () => fetchMock.mock.calls.map(([url, options = {}]) => `${options.method ?? 'GET'} ${url}`)
const linkRequests = () => requests().filter((line) => line.includes('/install-link/'))
const attemptRequests = () => requests().filter((line) => line.includes('/builds?'))

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url) => {
    const install = String(url).match(/\/install-link\/(\w+)\/([\w-]+)\/(\w+)$/)
    if (install) {
      const [, platform, mode, file] = install
      return answer({ url: `https://api.test/builder/install/${mode}/${file}?signature=s`, expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), platform, mode, file })
    }
    if (String(url).endsWith('/sites')) return answer([{ id: 5, code: 'app_driver_x', name: 'Driver app' }])
    return answer([])
  })
  vi.stubGlobal('fetch', fetchMock)
})

describe('My Products · opening an app', () => {
  it('asks for the install link of the QR that is shown once, and for the build attempts once', async () => {
    renderWithProviders(<AppUI app={app} productId={677} />, { theme, initialEntries: ['/my-products/apps?id=677'] })

    expect(await screen.findByRole('img', { name: 'QR code to install APK' })).toBeTruthy()
    // the load of the app (its actions and constants) has ended and the editor is the one drawn
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/builder/apps/677/base_constants'))).toBe(true))

    expect(linkRequests()).toEqual([
      'POST https://api.test/v400/en/demo/builder/apps/677/install-link/android/release/apk'
    ])
    expect(attemptRequests()).toEqual([
      'GET https://api.test/v400/en/demo/builder/apps/677/builds?page=1&page_size=50'
    ])

    // the QR of another file type is asked for when its tab opens, once
    fireEvent.click(screen.getByRole('tab', { name: 'APK debug, Successful' }))
    expect(await screen.findByRole('img', { name: 'QR code to install APK debug' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'APK, Successful' }))
    fireEvent.click(screen.getByRole('tab', { name: 'APK debug, Successful' }))
    expect(linkRequests()).toEqual([
      'POST https://api.test/v400/en/demo/builder/apps/677/install-link/android/release/apk',
      'POST https://api.test/v400/en/demo/builder/apps/677/install-link/android/debug/apk'
    ])
    expect(attemptRequests()).toHaveLength(1)
  })
})

// My Products › Builds by file type: the Builder's types plus the debug files, the file of each and the platform's last build read
// as the attempt it is.
import { describe, expect, it } from 'vitest'

import { getBuildTypeTabs } from '../../../Builder/utils'
import { APP_BUILD_FILES, APP_BUILD_MODE_OPTIONS, APP_BUILD_TYPE_TABS, getAppBuildTypeValue, linkKey, toLatestAttempt } from '../buildTypes'

const t = (_key, fallback) => fallback

describe('My Products build types', () => {
  it('reads the type of a build as the Builder does, with the debug AAB apart from the debug APK', () => {
    expect(getAppBuildTypeValue({ platform: 'ios', mode: 'ad-hoc' })).toBe('ad-hoc')
    expect(getAppBuildTypeValue({ platform: 'ios', mode: 'app-store' })).toBe('app-store')
    expect(getAppBuildTypeValue({ platform: 'android', mode: 'release', type: 'assemble' })).toBe('assemble')
    expect(getAppBuildTypeValue({ platform: 'android', mode: 'release', type: 'bundle' })).toBe('bundle')
    expect(getAppBuildTypeValue({ platform: 'android', mode: 'debug', type: 'assemble' })).toBe('debug')
    expect(getAppBuildTypeValue({ platform: 'android', mode: 'debug', type: 'bundle' })).toBe('debug-bundle')
    expect(getAppBuildTypeValue(null)).toBeNull()
  })

  it('has a tab, a file and a Build option for every type, with the same values', () => {
    for (const platform of ['ios', 'android']) {
      const values = APP_BUILD_TYPE_TABS[platform].map(tab => tab.value)
      expect(APP_BUILD_FILES[platform].map(entry => entry.tab)).toEqual(values)
      expect(APP_BUILD_MODE_OPTIONS[platform].map(option => option.value).sort()).toEqual([...values].sort())
      // an option builds the file of its tab
      for (const option of APP_BUILD_MODE_OPTIONS[platform]) {
        const entry = APP_BUILD_FILES[platform].find(item => item.tab === option.value)
        expect(getAppBuildTypeValue({ platform, mode: option.mode, type: option.type })).toBe(option.value)
        expect(entry.mode).toBe(option.mode)
        expect(entry.buildType ?? null).toBe(option.type)
      }
    }
    expect(APP_BUILD_TYPE_TABS.ios.map(tab => tab.label(t))).toEqual(['Ad hoc', 'App Store'])
    expect(APP_BUILD_TYPE_TABS.android.map(tab => tab.label(t))).toEqual(['APK', 'AAB', 'APK debug', 'AAB debug'])
  })

  it('installs only an APK or an Ad hoc IPA, and names each link by platform, mode and file', () => {
    const installable = [...APP_BUILD_FILES.ios, ...APP_BUILD_FILES.android].filter(entry => entry.installable).map(linkKey)
    expect(installable).toEqual(['ios|ad-hoc|ipa', 'android|release|apk', 'android|debug|apk'])
    const keys = [...APP_BUILD_FILES.ios, ...APP_BUILD_FILES.android].map(linkKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('reads from built_apps whether the storage has the file of each type', () => {
    const files = {
      ios: { 'ad-hoc': { ipa: false }, 'app-store': { ipa: true } },
      android: { release: { assemble: { apk: true, zip: true }, bundle: { aab: false, zip: false } }, debug: { bundle: { aab: true } } }
    }
    const built = (platform) => APP_BUILD_FILES[platform].filter(entry => entry.built(files)).map(entry => entry.tab)
    expect(built('ios')).toEqual(['app-store'])
    expect(built('android')).toEqual(['assemble', 'debug-bundle'])
    expect(APP_BUILD_FILES.ios.some(entry => entry.built(undefined))).toBe(false)
  })

  it('reads the platform\'s last build as its attempt: its id, a cancelled one as cancelled, and not the row\'s creation date', () => {
    expect(toLatestAttempt({ platform: 'ios', mode: 'ad-hoc', status: 'successful', attempt_id: 31, created_at: '2025-01-01', updated_at: '2026-11-10' }))
      .toEqual({ id: 31, platform: 'ios', mode: 'ad-hoc', status: 'successful', updated_at: '2026-11-10' })
    expect(toLatestAttempt({ platform: 'ios', mode: 'ad-hoc', status: 'failed', error_code: 'build_cancelled', attempt_id: 32 }).status).toBe('cancelled')
    // a build from before the attempts
    expect(toLatestAttempt({ platform: 'android', mode: 'release', type: 'assemble', status: 'successful' }).id).toBeNull()
    expect(toLatestAttempt(undefined)).toBeNull()
    expect(toLatestAttempt({ status: 'queued' })).toBeNull()
  })

  it('gives each of its tabs the last build of its type, from the attempts and the platform\'s last build', () => {
    const attempts = [
      { id: 9, platform: 'android', mode: 'debug', type: 'bundle', status: 'building', created_at: '2026-11-11 09:00:00' },
      { id: 8, platform: 'android', mode: 'debug', type: 'assemble', status: 'successful' },
      { id: 7, platform: 'android', mode: 'release', type: 'assemble', status: 'failed' },
      { id: 6, platform: 'android', mode: 'release', type: 'assemble', status: 'successful' },
      { id: 5, platform: 'ios', mode: 'ad-hoc', type: null, status: 'successful' }
    ]
    // the socket moved the platform's last build on: its copy wins over the history's
    const latest = toLatestAttempt({ platform: 'android', mode: 'debug', type: 'bundle', status: 'successful', attempt_id: 9, created_at: '2025-01-01' })
    const { tabs } = getBuildTypeTabs('android', { latest }, attempts, t, { types: APP_BUILD_TYPE_TABS.android, typeValueOf: getAppBuildTypeValue })
    expect(tabs.map(tab => [tab.value, tab.label, tab.latest?.id ?? null, tab.successful?.id ?? null])).toEqual([
      ['assemble', 'APK', 7, 6],
      ['bundle', 'AAB', null, null],
      ['debug', 'APK debug', 8, 8],
      ['debug-bundle', 'AAB debug', 9, 9]
    ])
    const debugBundle = tabs.find(tab => tab.value === 'debug-bundle').latest
    expect(debugBundle.status).toBe('successful')
    expect(debugBundle.created_at).toBe('2026-11-11 09:00:00')
  })
})

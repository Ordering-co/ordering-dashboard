import { describe, expect, it } from 'vitest'

import {
  getBuildActionError,
  getBuildFailureText,
  getBuildFileLabel,
  getBuildKind,
  getBuildModeLabel,
  getBuildStatusLabel,
  getBuildTypeTabs,
  getBuildTypeValue,
  getCheckProblems,
  getDefaultBuildOption,
  getReplacedBuildIds,
  getRequesterLabel,
  getTimeLeftLabel,
  isBuildCancellable,
  isBuildInstallable,
  isBuildRunning,
  toApiUtcDateTime,
  toPlatformChecks
} from '../utils'

describe('Builder build helpers', () => {
  it('shows a cancelled build as neutral, not in progress', () => {
    expect(getBuildKind('cancelled')).toBe('never')
    expect(getBuildStatusLabel('cancelled')).toBe('Cancelled')
  })

  it('cancels only before Jenkins is done', () => {
    for (const status of ['pending', 'queued', 'building']) expect(isBuildCancellable({ status })).toBe(true)
    expect(isBuildCancellable({ status: 'finishing' })).toBe(false)
    expect(isBuildRunning({ status: 'finishing' })).toBe(true)
    expect(isBuildRunning({ status: 'cancelled' })).toBe(false)
    expect(isBuildRunning(null)).toBe(false)
  })

  it('names modes and files', () => {
    expect(getBuildModeLabel({ platform: 'ios', mode: 'app-store' })).toBe('App Store')
    expect(getBuildModeLabel({ platform: 'ios', mode: 'ad-hoc' })).toBe('Ad hoc')
    expect(getBuildModeLabel({ platform: 'android', mode: 'release', type: 'bundle' })).toBe('AAB')
    expect(getBuildModeLabel({ platform: 'android', mode: 'release', type: 'assemble' })).toBe('APK')
    expect(getBuildModeLabel({ platform: 'android', mode: 'debug', type: 'assemble' })).toBe('Debug')
    expect(getBuildFileLabel({ platform: 'ios' })).toBe('IPA')
    expect(getBuildFileLabel({ platform: 'android', type: 'bundle' })).toBe('AAB')
    expect(getBuildFileLabel({ platform: 'android', type: 'assemble' })).toBe('APK')
  })

  it('starts the Build dialog on the latest mode, else by the product status', () => {
    expect(getDefaultBuildOption('ios', { platform: 'ios', mode: 'ad-hoc' }, 'active')).toBe('ad-hoc')
    expect(getDefaultBuildOption('android', { platform: 'android', mode: 'release', type: 'assemble' }, 'active')).toBe('assemble')
    expect(getDefaultBuildOption('ios', null, 'active')).toBe('app-store')
    expect(getDefaultBuildOption('ios', null, 'draft')).toBe('ad-hoc')
    expect(getDefaultBuildOption('android', null, 'active')).toBe('bundle')
    expect(getDefaultBuildOption('android', { platform: 'android', mode: 'debug', type: 'assemble' }, 'draft')).toBe('assemble')
    // the file type of the tab Build was pressed on wins over the latest attempt's, when the dialog offers it
    expect(getDefaultBuildOption('ios', { platform: 'ios', mode: 'ad-hoc' }, 'active', { initial: 'app-store' })).toBe('app-store')
    expect(getDefaultBuildOption('android', { platform: 'android', mode: 'release', type: 'bundle' }, 'draft', { initial: 'assemble' })).toBe('assemble')
    expect(getDefaultBuildOption('android', { platform: 'android', mode: 'release', type: 'bundle' }, 'draft', { initial: 'debug' })).toBe('bundle')
    expect(getDefaultBuildOption('android', null, 'draft', { initial: null })).toBe('assemble')
    // another list of options (My Products'), with a type the section does not build
    const options = [{ value: 'assemble' }, { value: 'debug' }]
    expect(getDefaultBuildOption('android', null, 'active', { options, initial: 'debug' })).toBe('debug')
    expect(getDefaultBuildOption('android', null, 'active', { options })).toBe('assemble')
  })

  it('says who asked for a build', () => {
    expect(getRequesterLabel('project_user')).toBe('Your team')
    expect(getRequesterLabel('staff')).toBe('Ordering')
    expect(getRequesterLabel('system')).toBe('Automatic')
    expect(getRequesterLabel('server')).toBe('Automatic')
  })

  it('explains a failure with our text for known codes and the API one otherwise', () => {
    expect(getBuildFailureText({ error_code: 'build_timed_out', error_description: 'Timed out' })).toBe('The build took too long and was stopped.')
    expect(getBuildFailureText({ error_code: 'missing_credentials', error_description: 'The iOS api_key_file is missing.' }))
      .toBe('A credentials file is missing (the App Store Connect .p8 key, the .jks keystore or the Play Store JSON). Upload it again in Credentials and build again.')
    expect(getBuildFailureText({ error_code: 'something_new', error_description: 'Gradle failed' })).toBe('Gradle failed')
    expect(getBuildFailureText({ error_code: null, error_description: null })).toBe('Build failed. Check the logs.')
  })

  it('hides downloads a newer build of the same mode replaced', () => {
    const builds = [
      { id: 9, platform: 'android', mode: 'release', type: 'bundle', status: 'successful' },
      { id: 8, platform: 'android', mode: 'release', type: 'assemble', status: 'successful' },
      { id: 7, platform: 'android', mode: 'release', type: 'bundle', status: 'failed' },
      { id: 6, platform: 'android', mode: 'release', type: 'bundle', status: 'successful' },
      { id: 5, platform: 'ios', mode: 'ad-hoc', type: null, status: 'successful' }
    ]
    expect([...getReplacedBuildIds(builds)]).toEqual([6])
  })

  it('tells the file type of an attempt', () => {
    expect(getBuildTypeValue({ platform: 'ios', mode: 'ad-hoc' })).toBe('ad-hoc')
    expect(getBuildTypeValue({ platform: 'ios', mode: 'app-store' })).toBe('app-store')
    expect(getBuildTypeValue({ platform: 'android', mode: 'release', type: 'bundle' })).toBe('bundle')
    expect(getBuildTypeValue({ platform: 'android', mode: 'release', type: 'assemble' })).toBe('assemble')
    expect(getBuildTypeValue({ platform: 'android', mode: 'release', type: null })).toBe('assemble')
    expect(getBuildTypeValue({ platform: 'android', mode: 'debug', type: 'assemble' })).toBe('debug')
    expect(getBuildTypeValue(null)).toBeNull()
  })

  it('groups the attempts of a platform by file type, newest first (app 1413)', () => {
    const apk = { id: 572, platform: 'android', mode: 'release', type: 'assemble', status: 'successful' }
    const aab = { id: 573, platform: 'android', mode: 'release', type: 'bundle', status: 'successful' }
    const failedApk = { id: 574, platform: 'android', mode: 'release', type: 'assemble', status: 'failed' }
    const ios = { id: 575, platform: 'ios', mode: 'ad-hoc', status: 'successful' }
    // `/latest`'s copy of the latest attempt wins over the history's
    const live = { ...failedApk, status: 'building' }
    const { tabs, current } = getBuildTypeTabs('android', { latest: live, successful: aab }, [ios, failedApk, aab, apk])
    expect(current).toBe('assemble')
    expect(tabs.map(tab => [tab.value, tab.label, tab.latest?.id, tab.latest?.status, tab.successful?.id])).toEqual([
      ['assemble', 'APK', 574, 'building', 572],
      ['bundle', 'AAB', 573, 'successful', 573]
    ])
  })

  it('adds the debug tab only with a debug attempt, and opens on the first tab without attempts', () => {
    expect(getBuildTypeTabs('ios', null, []).tabs.map(tab => tab.label)).toEqual(['Ad hoc', 'App Store'])
    expect(getBuildTypeTabs('ios', null, []).current).toBe('ad-hoc')
    const debug = { id: 3, platform: 'android', mode: 'debug', type: 'assemble', status: 'failed' }
    const { tabs, current } = getBuildTypeTabs('android', { latest: debug, successful: null }, [])
    expect(tabs.map(tab => tab.label)).toEqual(['APK', 'AAB', 'APK debug'])
    expect(current).toBe('debug')
  })

  it('reads the checks of a refused build like those of the panel', () => {
    const checks = toPlatformChecks([
      { code: 'missing_file', level: 'warning', platform: 'android', subject: { name: 'Notification icon', group: 'resources_notifications' } },
      { code: 'empty_constant', level: 'warning', subject: { name: 'Maps key' } }
    ], 'android')
    expect(getCheckProblems(checks).map(problem => [problem.platform, problem.tab, problem.text])).toEqual([
      ['android', 'files', 'Upload Notification icon'],
      ['android', 'constants', 'Set a value for Maps key']
    ])
    const shaped = { platforms: { ios: { problems: [] } } }
    expect(toPlatformChecks(shaped, 'ios')).toBe(shaped)
  })

  it.each([
    ['build', ['build.in_progress'], { platform: 'ios' }, 'iOS is already building. Wait for it to finish or cancel it.'],
    ['build', ['platform.unsupported'], { platform: 'android' }, 'This app’s base doesn’t build for Android.'],
    ['build', ['mode.in'], { platform: 'ios' }, 'We couldn’t start the build. Try again.'],
    ['retry', ['build.not_latest'], {}, 'Only the latest build of each platform can be retried.'],
    ['cancel', ['build.not_latest'], {}, 'Only the latest build of each platform can be cancelled.'],
    ['cancel', ['build.not_running'], {}, 'This build already finished. There’s nothing to cancel.'],
    ['retry', ['build.source_missing'], {}, 'This attempt’s files are no longer kept. Start a new build to use the current settings.'],
    ['log', ['build.no_log'], {}, 'There’s no log yet. It appears once the build starts.'],
    ['log', ['build.log_unavailable'], {}, 'The build service isn’t responding. Try again in a few minutes.'],
    ['download', ['build.artifact_replaced'], { mode: 'AAB' }, 'A newer AAB build replaced this file. Download that one instead.'],
    ['download', [], {}, 'We couldn’t download the file. Try again.'],
    ['install', ['build.artifact_replaced'], {}, 'A newer build replaced this file. Install that one instead.'],
    ['install', ['build.not_installable'], {}, 'This file can’t be installed on a phone.'],
    ['install', ['build.artifact_missing'], {}, 'This build’s file is no longer available. Build again to get a new one.'],
    ['install', [], {}, 'We couldn’t create the install link. Try again.']
  ])('explains a refused %s (%s)', (action, codes, vars, text) => {
    expect(getBuildActionError(action, codes, vars)).toBe(text)
  })

  it('installs on a phone only an ad hoc IPA or an APK', () => {
    expect(isBuildInstallable({ platform: 'ios', mode: 'ad-hoc' })).toBe(true)
    expect(isBuildInstallable({ platform: 'ios', mode: 'app-store' })).toBe(false)
    expect(isBuildInstallable({ platform: 'android', mode: 'release', type: 'assemble' })).toBe(true)
    expect(isBuildInstallable({ platform: 'android', mode: 'debug', type: 'assemble' })).toBe(true)
    expect(isBuildInstallable({ platform: 'android', mode: 'release', type: 'bundle' })).toBe(false)
    expect(isBuildInstallable(null)).toBe(false)
  })

  it('says how long is left, in minutes rounded up', () => {
    expect(getTimeLeftLabel(24 * 3600000)).toBe('24 h 0 min')
    expect(getTimeLeftLabel(3600000 + 61000)).toBe('1 h 2 min')
    expect(getTimeLeftLabel(59 * 60000)).toBe('59 min')
    expect(getTimeLeftLabel(1000)).toBe('1 min')
    expect(getTimeLeftLabel(0)).toBe('less than a minute')
  })

  it('reads an ISO moment as the API’s UTC date time', () => {
    expect(toApiUtcDateTime('2026-10-09T12:00:00Z')).toBe('2026-10-09 12:00:00')
    expect(toApiUtcDateTime('2026-10-09T14:00:00+02:00')).toBe('2026-10-09 12:00:00')
    expect(toApiUtcDateTime('nope')).toBeNull()
  })
})

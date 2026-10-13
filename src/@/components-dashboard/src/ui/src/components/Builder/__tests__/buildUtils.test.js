import { describe, expect, it } from 'vitest'

import {
  getBuildActionError,
  getBuildFailureText,
  getBuildFileLabel,
  getBuildKind,
  getBuildModeLabel,
  getBuildStatusLabel,
  getCheckProblems,
  getDefaultBuildOption,
  getReplacedBuildIds,
  getRequesterLabel,
  isBuildCancellable,
  isBuildRunning,
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
    ['download', [], {}, 'We couldn’t download the file. Try again.']
  ])('explains a refused %s (%s)', (action, codes, vars, text) => {
    expect(getBuildActionError(action, codes, vars)).toBe(text)
  })
})

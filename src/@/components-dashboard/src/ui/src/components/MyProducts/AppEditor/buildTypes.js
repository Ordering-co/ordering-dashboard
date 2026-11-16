import { BUILD_MODE_OPTIONS, BUILD_TYPE_TABS, getBuildTypeValue } from '../../Builder/utils'

// My Products › Builds, by file type, as the Builder's Builds card reads them (same values, labels and order), plus the debug files
// only My Products builds. A file type is what api-core keeps one file of (`apps/app_{id}/{platform}_{mode}_builded.{file}`):
//   iOS      `ad-hoc` (Ad hoc IPA) · `app-store` (App Store IPA)
//   Android  `assemble` (release APK) · `bundle` (release AAB) · `debug` (debug APK) · `debug-bundle` (debug AAB)

/** The file type of a build or an attempt: the Builder's, with the debug AAB apart from the debug APK. */
export const getAppBuildTypeValue = (build) => {
  if (build?.platform === 'android' && build.mode === 'debug' && build.type === 'bundle') return 'debug-bundle'
  return getBuildTypeValue(build)
}

const APK_DEBUG = (t) => t('BUILDER_BUILD_APK_DEBUG', 'APK debug')
const AAB_DEBUG = (t) => t('BUILDER_BUILD_AAB_DEBUG', 'AAB debug')

/** The tabs of each platform, in order: the Builder's and the debug files. */
export const APP_BUILD_TYPE_TABS = {
  ios: BUILD_TYPE_TABS.ios,
  android: [
    ...BUILD_TYPE_TABS.android,
    { value: 'debug', label: APK_DEBUG },
    { value: 'debug-bundle', label: AAB_DEBUG }
  ]
}

/** What the Build dialog offers: the Builder's options and the debug files. */
export const APP_BUILD_MODE_OPTIONS = {
  ios: BUILD_MODE_OPTIONS.ios,
  android: [
    ...BUILD_MODE_OPTIONS.android,
    {
      value: 'debug',
      mode: 'debug',
      type: 'assemble',
      guide: null,
      label: APK_DEBUG,
      description: (t) => t('BUILDER_BUILD_MODE_APK_DEBUG_HELP', 'A test build. Install it directly on Android devices.')
    },
    {
      value: 'debug-bundle',
      mode: 'debug',
      type: 'bundle',
      guide: null,
      label: AAB_DEBUG,
      description: (t) => t('BUILDER_BUILD_MODE_AAB_DEBUG_HELP', 'A test bundle. It is not for Google Play.')
    }
  ]
}

/**
 * The file of each type: what names its signed links (platform, mode and file: api-core install-link / download-link, never the
 * public `downloads/*` route), the type of the Android build that leaves it (`buildType`; an iOS build has none), whether a phone
 * installs it from a QR (`installable`: an APK or an Ad hoc IPA; an AAB or an App Store IPA go to their store) and whether the
 * storage has it (`built`, from the app's `built_apps`).
 */
export const APP_BUILD_FILES = {
  ios: [
    { tab: 'ad-hoc', platform: 'ios', mode: 'ad-hoc', file: 'ipa', installable: true, built: (files) => !!files?.ios?.['ad-hoc']?.ipa },
    { tab: 'app-store', platform: 'ios', mode: 'app-store', file: 'ipa', installable: false, built: (files) => !!files?.ios?.['app-store']?.ipa }
  ],
  android: [
    { tab: 'assemble', platform: 'android', mode: 'release', file: 'apk', buildType: 'assemble', installable: true, built: (files) => !!(files?.android?.release?.assemble?.apk || files?.android?.release?.assemble?.zip) },
    { tab: 'bundle', platform: 'android', mode: 'release', file: 'aab', buildType: 'bundle', installable: false, built: (files) => !!(files?.android?.release?.bundle?.aab || files?.android?.release?.bundle?.zip) },
    { tab: 'debug', platform: 'android', mode: 'debug', file: 'apk', buildType: 'assemble', installable: true, built: (files) => !!(files?.android?.debug?.assemble?.apk || files?.android?.debug?.assemble?.zip) },
    { tab: 'debug-bundle', platform: 'android', mode: 'debug', file: 'aab', buildType: 'bundle', installable: false, built: (files) => !!(files?.android?.debug?.bundle?.aab || files?.android?.debug?.bundle?.zip) }
  ]
}

/** What a link of My Products names: the platform, the mode and the file. */
export const linkKey = (entry) => `${entry.platform}|${entry.mode}|${entry.file}`

/**
 * The platform's last build (the row of `app.builds`) as the attempt it is, to read it with the attempts of the history: its
 * `attempt_id` is the attempt's id (none for a build from before the attempts). That row never says `cancelled`: a cancelled build
 * is `failed` with `build_cancelled`. Its `created_at` is the row's, not the attempt's, so it is left out.
 */
export const toLatestAttempt = (build) => {
  if (!build?.platform) return null
  const { created_at: _rowCreatedAt, attempt_id: attemptId, ...rest } = build
  return {
    ...rest,
    id: attemptId ?? null,
    status: build.status === 'failed' && build.error_code === 'build_cancelled' ? 'cancelled' : build.status
  }
}

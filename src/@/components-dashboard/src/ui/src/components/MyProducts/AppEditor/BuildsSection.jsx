import React, { useEffect, useId, useRef, useState } from 'react'
import QRCode from 'react-qr-code'

import { ToastType, useLanguage, useToast, useUtils } from '../../../../../index'
import { AlertDialog, Button, ConfirmDialog, InlineNotice, Skeleton, StatusBadge } from '../../Shared/Product'
import { CircleAlert, Download } from '../../Shared/Icon'
import { buildUtilities } from '../BasicAppSettings/utils'
import { getMissingBuildFields } from './buildReadiness'
import {
  getBuildActionError,
  getBuildErrorMessage,
  getBuildFailureText,
  getBuildTypeTabs,
  getTimeLeftLabel,
  isBuildRunning,
  toApiUtcDateTime
} from '../../Builder/utils'
import { BuildPill, BuildTypeTabs, usePickedBuildType } from '../../Builder/BuilderAppBuilds/BuildsCard'
import { BuildDialog } from '../../Builder/BuilderAppBuilds/BuildDialogs'
import { useInstallLinks, useLinkCountdown } from '../../Builder/BuilderAppBuilds/useInstallLinks'
import { APP_BUILD_FILES, APP_BUILD_MODE_OPTIONS, APP_BUILD_TYPE_TABS, getAppBuildTypeValue, linkKey, toLatestAttempt } from './buildTypes'
import './app-builds.css'

// redesign my-products B4 (D2/M-MP-05): Build › Builds. What main's Build tab painted, by platform and with the
// same data (the version line, the QR codes and downloads, the facts of the last build, the logs and certificates of a failed one,
// main's body of `buildApp`), but with the state of the last build as a badge and what is still missing to build said before the
// button is pressed (a notice apart, with a link to the section that fixes each field). The app's name and description are not
// painted: the page header has them.
// redesign D-80 (owner, 2026-10-19, C8): deleting a platform's certificates asks first, on P/ConfirmDialog (danger), since
// the app cannot be built again until they are uploaded again. The controller toasts the result.
// The editor gives `onNavigate(sectionId)` and paints the section's h2; this paints h3 per platform.
//
// The files of a platform are read by file type, as in the Builder's Builds card (its tabs, its labels, its status dot): iOS Ad hoc
// and App Store; Android APK, AAB and their debug ones. Each tab has the last build of ITS type (from the app's attempts and the
// platform's last build), the QR of its file when a phone installs it (an APK, an Ad hoc IPA) and its download. So the Ad hoc QR is
// one click away although the last build was for the App Store; a type a phone does not install (App Store, AAB) says why it has
// no QR, and a type that was never built says how to get its file instead of showing nothing. The tab that opens is the one of the
// platform's last successful build; a build that is asked for opens its own.
// «Build» opens the Builder's Build dialog on the file type of the tab that is open, which can be changed there before building.
// The QR and the downloads never use the public `downloads/*` route: a QR is a signed link of 24 hours asked for when its tab is
// shown, with its expiry under it and «Generate a new link» once it expires (useInstallLinks, same texts as the Builder); a download
// asks for a link of 15 minutes on click.
// The facts under the tabs follow the tab too: the version, the job and the date are those of the build of the type that is open
// (none for a type never built), next to what is the app's (its version, its package). The version line names the one Build button.

const AVAILABLE_STATUS = ['successful', 'failed', 'error_request']
const has = (map, key) => Object.prototype.hasOwnProperty.call(map, key)

// The dates of a build and of an install link's expiry, as the Builder's Builds card writes them (its DATE_TIME)
const LINK_DATE_TIME = 'MMM D, YYYY h:mm A'

// The build an install link names, when the last build of the platform is the one that left the entry's file: finished, of its
// mode and, on Android, of its type (`assemble` leaves the APK, `bundle` the AAB: an AAB build leaves the APK's link as it was).
// An iOS build has no type. Null while it builds, or when the last build is of another file.
const successStampOf = (build, entry) => {
  if (build?.status !== 'successful' || build.mode !== entry.mode) return null
  if (entry.buildType && build.type !== entry.buildType) return null
  return `${build.attempt_id ?? ''}|${build.updated_at ?? ''}`
}

// The family of the badge of the last build of a platform
const STATUS_FAMILY = {
  successful: 'done',
  failed: 'cancel',
  error_request: 'cancel',
  pending: 'progress',
  queued: 'progress',
  building: 'progress',
  finishing: 'progress'
}

// What the QR of each platform is for, in the Builder's words (its InstallPanel)
const INSTALL_HELP = {
  ios: (t) => t('BUILDER_INSTALL_HELP', 'Scan with the iPhone’s camera. Only registered devices can install it.'),
  android: (t) => t('BUILDER_INSTALL_ANDROID_HELP', 'Scan with the phone’s camera to download the APK. Android asks to allow installing apps from this source the first time.')
}

// Why a file a phone does not install has no QR, and which build gives one
const NO_QR = {
  'app-store': (t) => t('BUILD_NO_QR_APP_STORE', 'An App Store build is not installed with a QR: it is uploaded to App Store Connect. To install the app on an iPhone with a QR, build Ad hoc.'),
  bundle: (t) => t('BUILD_NO_QR_AAB', 'An AAB is not installed with a QR: it is uploaded in Play Console. To install the app on a phone with a QR, build an APK.'),
  'debug-bundle': (t) => t('BUILD_NO_QR_AAB_DEBUG', 'An AAB is not installed with a QR. To install the app on a phone with a QR, build an APK.')
}

// redesign my-products R1-06: a text that may break after each dot (a package: `com.ordering.app`), never inside a word
const withDotBreaks = (text) => {
  const parts = String(text).split('.')
  return parts.map((part, index) => (
    <React.Fragment key={index}>
      {part}
      {index < parts.length - 1 && <>.<wbr /></>}
    </React.Fragment>
  ))
}

// the API's description of a failed build can be a raw key (API_BUILD_ERROR_MISSING_CREDENTIALS). The builder's
// reading of the failure (a known code says what to do) is used; a description that is still a key gives the generic text.
const API_KEY = /^[A-Z][A-Z0-9_]+$/
const failureDescription = (build, t) => {
  const text = getBuildFailureText(build, t)
  return API_KEY.test(text) ? getBuildErrorMessage(null, t) : text
}

// The subtitle of the version line, with the Build button it names in <b>, as nodes (the text of a translation is never markup).
// The button is named by its own label, so the line says what the button says in every language.
const withButton = (text, button) => String(text).split('_button_').map((part, index) => (
  <React.Fragment key={index}>
    {index > 0 && <b>{button}</b>}
    {part}
  </React.Fragment>
))

/**
 * The QR of a file a phone installs: a signed link of 24 hours, asked for when it is shown (a link still valid is kept: opening its
 * tab again asks for nothing). Its expiry under it, and a new one once it expires. The link is asked for by what it names
 * (`linkKey`), as the Builder's InstallPanel does by attempt. A newer build of its mode and type renews it from the platform
 * (AppPlatformBuilds), whether its tab is open or not.
 */
const InstallQr = (props) => {
  const { entry, install, requestInstallLink, label, modeLabel, formatDate } = props
  const [, t] = useLanguage()
  const link = install?.link ?? null
  const { now, expiresAt, expired } = useLinkCountdown(link)
  const key = linkKey(entry)

  useEffect(() => {
    requestInstallLink(entry)
  }, [key])

  const renew = () => requestInstallLink(entry, { renew: true })
  const loading = !install || install.loading

  return (
    <div className='odc-apb-install' aria-busy={loading ? 'true' : 'false'}>
      {loading && <Skeleton shape='box' className='odc-apb-qr-skeleton' />}
      {link && !expired && (
        <QRCode className='odc-apb-qr' role='img' aria-label={label} size={256} value={link.url} viewBox='0 0 256 256' />
      )}
      {loading && <span className='odc-muted'>{t('BUILDER_INSTALL_LINK_PREPARING', 'Preparing the install link…')}</span>}
      {!loading && !link && (
        <InlineNotice
          tone='danger'
          icon={CircleAlert}
          role='alert'
          action={<Button size='sm' variant='ghost' onClick={renew}>{t('BUILDER_RETRY', 'Try again')}</Button>}
        >
          {getBuildActionError('install', install.errorCodes, { platform: entry.platform, mode: modeLabel }, t)}
        </InlineNotice>
      )}
      {link && !expired && (
        <span className='odc-muted'>
          {t('BUILDER_INSTALL_LINK_EXPIRES', 'Expires in _time_ · _date_')
            .replace('_time_', getTimeLeftLabel(expiresAt - now, t))
            .replace('_date_', formatDate(toApiUtcDateTime(link.expires_at)))}
        </span>
      )}
      {expired && (
        <>
          <span className='odc-muted'>{t('BUILDER_INSTALL_LINK_EXPIRED', 'This link expired.')}</span>
          <Button size='sm' onClick={renew}>{t('BUILDER_INSTALL_LINK_RENEW', 'Generate a new link')}</Button>
        </>
      )}
    </div>
  )
}

/**
 * One file type of a platform: its last build (what it is, its status and its date), and its file when the storage has one: the QR
 * that installs it, or why it has none, and its download. Without a file it says how to get it.
 */
const AppBuildTypePanel = (props) => {
  const { tab, entry, built, install, requestInstallLink, download, downloading, formatDate } = props
  const [, t] = useLanguage()
  const latest = tab.latest
  const successful = tab.successful
  const describe = (attempt) => [tab.label, attempt.app_version && `v${attempt.app_version}`].filter(Boolean).join(' · ')
  const dateOf = (attempt) => formatDate(attempt.status === 'successful' ? attempt.updated_at : (attempt.created_at ?? attempt.updated_at))

  return (
    <>
      {latest && (
        <div className='odc-bb-summary'>
          <span className='odc-bb-summary-head'>
            <span>{describe(latest)}</span>
            <BuildPill status={latest.status} />
          </span>
          <span className='odc-bb-muted'>{dateOf(latest)}</span>
        </div>
      )}

      {/* the file the storage keeps is the one of the last successful build of the type, not of a later one that failed */}
      {built && latest && successful && successful.id !== latest.id && (
        <div className='odc-bb-successful'>
          <small>{t('BUILDER_LAST_SUCCESSFUL', 'Last successful')}</small>
          <span>{[describe(successful), dateOf(successful)].join(' · ')}</span>
        </div>
      )}

      {built && entry.installable && (
        <div className='odc-apb-file'>
          <InstallQr
            entry={entry}
            install={install}
            requestInstallLink={requestInstallLink}
            label={t('BUILD_QR_LABEL', 'QR code to install _mode_').replace('_mode_', tab.label)}
            modeLabel={tab.label}
            formatDate={formatDate}
          />
          {INSTALL_HELP[entry.platform] && <p className='odc-bb-muted'>{INSTALL_HELP[entry.platform](t)}</p>}
        </div>
      )}

      {built && !entry.installable && NO_QR[tab.value] && (
        <p className='odc-bb-muted'>{NO_QR[tab.value](t)}</p>
      )}

      {built && (
        <div className='odc-bb-actions'>
          <Button icon={Download} busy={downloading} onClick={() => download(entry, tab.label)}>
            {t('BUILDER_DOWNLOAD_FILE', 'Download _file_').replace('_file_', entry.file.toUpperCase())}
          </Button>
        </div>
      )}

      {/* a type without a file is not an empty panel: it says how to get the file (while its first build runs, its status says
          it), or that the file of a build that did finish is gone */}
      {!built && !isBuildRunning(latest) && (
        <p className='odc-bb-muted'>
          {successful
            ? getBuildActionError('download', ['build.artifact_missing'], { platform: entry.platform, mode: tab.label }, t)
            : (entry.installable
                ? t('BUILD_TYPE_EMPTY_INSTALL', 'There is no _type_ build yet. Build it to install it with a QR.')
                : t('BUILD_TYPE_EMPTY_DOWNLOAD', 'There is no _type_ build yet. Build it to download its file.')
              ).replace('_type_', tab.label)}
        </p>
      )}
    </>
  )
}

/**
 * The tab a platform opens on: the type of its last build while it runs or once it is successful (and of one that was seen running
 * here, however it ended: what was just built stays in sight); otherwise the type of its newest successful build, then the first
 * type with a file, then the type of that last build.
 */
const openTabOf = (tabs, latest, builtHere, isBuilt) => {
  const latestValue = getAppBuildTypeValue(latest)
  const latestTab = tabs.some(tab => tab.value === latestValue) ? latestValue : null
  if (latestTab && (isBuildRunning(latest) || latest.status === 'successful' || builtHere)) return latestTab
  const newest = tabs
    .filter(tab => tab.successful && isBuilt(tab))
    .sort((a, b) => Number(b.successful.id) - Number(a.successful.id))[0]
  return newest?.value ?? tabs.find(isBuilt)?.value ?? latestTab ?? tabs[0]?.value ?? null
}

// no build was seen running yet
const NO_BUILD = {}

/**
 * The files of a platform by file type (the Builder's tabs), and its Build button, which opens the dialog on the type of the tab
 * that is open. `children(build)` draws what goes between them with the last build of the type of that tab (null when the type
 * was never built). A link is renewed here, not in its QR: when a newer build of its mode and type finishes, the link that was asked
 * for names the build before, whether its tab is open or not (a link never asked for is asked for when its tab opens).
 */
const AppPlatformBuilds = (props) => {
  const { platform, name, build, builtApps, attempts, installLinks, requestInstallLink, download, downloadAppState, formatDate, disabled, busy, onBuild, children } = props
  const [, t] = useLanguage()
  const runningId = useId()
  const entries = APP_BUILD_FILES[platform] ?? []
  const latest = toLatestAttempt(build)
  const { tabs: allTabs } = getBuildTypeTabs(platform, { latest }, attempts ?? [], t, { types: APP_BUILD_TYPE_TABS[platform] ?? [], typeValueOf: getAppBuildTypeValue })
  // only the types My Products builds: each has its file
  const tabs = allTabs.filter(tab => entries.some(entry => entry.tab === tab.value))
  const entryOf = (tab) => entries.find(entry => entry.tab === tab.value)
  const isBuilt = (tab) => entryOf(tab).built(builtApps)

  // a build seen running here keeps its tab open when it ends, whatever its result
  const seenRunning = useRef(NO_BUILD)
  if (isBuildRunning(latest)) seenRunning.current = latest.id
  const current = openTabOf(tabs, latest, !!latest && seenRunning.current === latest.id, isBuilt)
  const [value, pick] = usePickedBuildType(tabs, current, latest)

  const stamps = entries.map(entry => successStampOf(build, entry))
  const known = useRef(null)
  const linksRef = useRef(installLinks)
  linksRef.current = installLinks
  useEffect(() => {
    const before = known.current
    known.current = stamps
    if (!before) return
    entries.forEach((entry, index) => {
      if (!stamps[index] || before[index] === stamps[index]) return
      if (linksRef.current[linkKey(entry)]) requestInstallLink(entry, { renew: true })
    })
  }, [stamps.join('\n')])

  // a platform My Products has no file types for builds nothing here: what follows is about its last build
  if (!tabs.length) return children(latest)

  return (
    <>
      <BuildTypeTabs
        platformLabel={name}
        tabs={tabs}
        value={value}
        onValueChange={pick}
        // a file from before the attempts has no build to read its status from: it is there, so it was built
        statusOf={(tab) => tab.latest?.status ?? (isBuilt(tab) ? 'successful' : undefined)}
      >
        {(tab) => {
          const entry = entryOf(tab)
          return (
            <AppBuildTypePanel
              tab={tab}
              entry={entry}
              built={isBuilt(tab)}
              install={installLinks[linkKey(entry)]}
              requestInstallLink={requestInstallLink}
              download={download}
              downloading={!!downloadAppState?.loading && downloadAppState?.type === linkKey(entry)}
              formatDate={formatDate}
            />
          )
        }}
      </BuildTypeTabs>

      {/* what follows the tabs (the facts of the build) is about the build of the tab that is open, not the platform's last one */}
      {children(tabs.find(tab => tab.value === value)?.latest ?? null)}

      <div className='odc-apb-actions'>
        <Button
          variant='primary'
          disabled={disabled || busy}
          aria-describedby={busy ? runningId : undefined}
          onClick={() => onBuild(platform, value)}
        >
          {t('BUILDER_BUILD', 'Build')}
        </Button>
        {busy && (
          <span id={runningId} className='odc-bb-muted'>
            {t('BUILDER_BUILD_RUNNING', '_platform_ is already building.').replace('_platform_', name)}
          </span>
        )}
      </div>
    </>
  )
}

export const BuildsSection = (props) => {
  const {
    app,
    buildApp,
    buildAppState,
    setBuildAppState,
    downloadApp,
    downloadAppState,
    createInstallLink,
    buildAttemptsState,
    loadBuildAttempts,
    getBuildLogs,
    deleteCertificates,
    onNavigate
  } = props

  const [, t] = useLanguage()
  const [{ parseDate }] = useUtils()
  const [, { showToast }] = useToast()
  const { installLinks, requestInstallLink } = useInstallLinks(createInstallLink, linkKey)
  const formatDate = (value) => value ? parseDate(value, { outputFormat: LINK_DATE_TIME }) : ''
  const { isAppUpdated, buildStatusText, textRequieredFields } = buildUtilities()
  const ids = useId()

  // the Build dialog that is open: `{ platform, option }`, `option` being the file type of the tab its button was on
  const [buildFor, setBuildFor] = useState(null)
  // redesign D-80 (owner, 2026-10-19): the platform whose certificates are waiting for the owner's confirmation. The
  // name is kept apart so the title does not go blank while the dialog closes.
  const [certificatesDialog, setCertificatesDialog] = useState({ open: false, platform: null, name: '' })

  // the last builds of each file type: asked for once per app (the controller keeps them), not on every visit to the section
  useEffect(() => {
    if (app?.id) loadBuildAttempts?.()
  }, [app?.id])

  const platforms = app?.base?.platforms
  if (!app || !platforms) return null

  const platformNames = { android: t('ANDROID', 'Android'), ios: t('IOS', 'iOS') }
  const statusLabels = {
    successful: t('SUCCESSFUL', 'Successful'),
    failed: t('FAILED', 'Failed'),
    error_request: t('ERROR_REQUEST', 'Error request'),
    pending: t('PENDING', 'Pending'),
    queued: t('QUEUED', 'Queued'),
    building: t('BUILDING', 'Building'),
    finishing: t('FINISHING', 'Finishing')
  }
  const sectionNames = {
    general: t('GENERAL', 'General'),
    constants: t('CONSTANTS_SETTINGS', 'Constants'),
    credentials: t('BUILDER_CREDENTIALS', 'Credentials')
  }

  const loading = !!buildAppState?.loading
  const builds = app.builds ?? []
  // The facts under the tabs: the app's (its version, its package) and those of the build of the tab that is open (its version, its
  // job, its date), each only when it is known. A type that was never built shows none of another type's; the type itself is not a
  // fact here, the tab and the line of its build say it. The job is the `job_id` of the build of the tab (the API sends it in each
  // attempt); an attempt without one (older, or an API that does not send it yet) shows none.
  const factsOf = (shown) => [
    [t('VERSION', 'Version'), app.version ?? '-', true],
    shown?.app_version && [t('BUILD_VERSION', 'Build version'), shown.app_version, true],
    [t('PACKAGE', 'Package'), app.package ?? '-', false, true],
    shown?.job_id && [t('BUILD_JOB', 'Job'), shown.job_id, true],
    shown?.updated_at && [t('LAST_BUILD', 'Last build'), parseDate(shown.updated_at), true]
  ].filter(Boolean)

  const download = async (entry, label) => {
    const answer = await downloadApp({ type: linkKey(entry), platform: entry.platform, mode: entry.mode, file: entry.file })
    if (answer && !answer.ok) {
      showToast(ToastType.Error, getBuildActionError('download', answer.errorCodes, { platform: entry.platform, mode: label ?? '' }, t))
    }
  }

  // What the app still misses to build for the platform, as the problems the Build dialog lists (each with the way to its section)
  const problemsOf = (platform) => getMissingBuildFields(app, platform).map(({ field, section }) => ({
    key: field,
    platform,
    owner: 'customer',
    text: textRequieredFields[field] ?? field,
    tab: section
  }))

  // The build the dialog asks for, with main's body. The dialog closes with the answer: a refused build is said by the «Build
  // error» dialog below, as before, and a build that was taken opens the tab of its type (it is the platform's last build now).
  const submitBuild = async (platform, { mode, type }) => {
    await buildApp({
      appId: app.id,
      platform,
      mode,
      ...(platform !== 'ios' && { type })
    })
    setBuildFor(null)
    return { ok: true, errorCodes: [] }
  }

  return (
    <div className='odc-apb'>
      {[...platforms].sort().map((platform) => {
        const build = builds.find((item) => item.platform === platform)
        const name = has(platformNames, platform) ? platformNames[platform] : platform
        const headingId = `${ids}-${platform}`
        const updated = isAppUpdated(build?.app_version, app.version)
        const version = buildStatusText(updated)
        const missing = getMissingBuildFields(app, platform)
        const platformBusy = builds.some((item) => item.platform === platform) && !AVAILABLE_STATUS.includes(build?.status)
        return (
          <section key={platform} className='odc-apb-platform' aria-labelledby={headingId}>
            <div className='odc-apb-head'>
              <h3 id={headingId} className='odc-apb-title'>{name}</h3>
              {build?.status && (
                <StatusBadge
                  family={has(STATUS_FAMILY, build.status) ? STATUS_FAMILY[build.status] : 'review'}
                  label={has(statusLabels, build.status) ? statusLabels[build.status] : build.status}
                />
              )}
            </div>

            <InlineNotice tone={updated === 1 ? 'info' : 'warning'}>
              <strong>{version.title}</strong>
              <span className='odc-apb-sub'>{withButton(version.subtitle, t('BUILDER_BUILD', 'Build'))}</span>
            </InlineNotice>

            {missing.length > 0 && (
              <InlineNotice tone='warning'>
                <span>{t('BUILD_MISSING_FIELDS_INTRO', 'To build for _platform_, fill:').replace('_platform_', name)}</span>
                <ul className='odc-apb-missing'>
                  {missing.map(({ field, section }) => (
                    <li key={field}>
                      <Button variant='link' onClick={() => onNavigate?.(section)}>{textRequieredFields[field] ?? field}</Button>
                      <span className='odc-muted'>{sectionNames[section]}</span>
                    </li>
                  ))}
                </ul>
              </InlineNotice>
            )}

            <AppPlatformBuilds
              platform={platform}
              name={name}
              build={build}
              builtApps={app.built_apps}
              attempts={buildAttemptsState?.attempts}
              installLinks={installLinks}
              requestInstallLink={requestInstallLink}
              download={download}
              downloadAppState={downloadAppState}
              formatDate={formatDate}
              disabled={loading}
              busy={platformBusy}
              onBuild={(platform, option) => setBuildFor({ platform, option })}
            >
              {(shown) => (
                <>
                  <dl className='odc-apb-facts'>
                    {factsOf(shown).map(([label, value, figure, dotted]) => (
                      <div key={label} className='odc-apb-fact'>
                        <dt>{label}</dt>
                        <dd>{figure ? <span className='odc-figure'>{value}</span> : dotted ? withDotBreaks(value) : value}</dd>
                      </div>
                    ))}
                  </dl>

                  {build?.status === 'failed' && (
                    <div className='odc-apb-failed'>
                      <div className='odc-apb-actions'>
                        <Button onClick={() => getBuildLogs({ platform })}>{t('SEE_LOGS', 'See Logs')}</Button>
                        <Button onClick={() => setCertificatesDialog({ open: true, platform, name })}>{t('DELETE_CERTIFICATES', 'Delete certificates')}</Button>
                      </div>
                      {(build.error_code || build.error_description) && (
                        <div className='odc-apb-error'>
                          {build.error_code && <p>{t('ERROR_CODE', 'Error code')}: {build.error_code}</p>}
                          {build.error_description && <p>{t('ERROR_DESCRIPTION', 'Error description')}: {failureDescription(build, t)}</p>}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </AppPlatformBuilds>
          </section>
        )
      })}

      {buildFor && (
        <BuildDialog
          platform={buildFor.platform}
          options={APP_BUILD_MODE_OPTIONS[buildFor.platform]}
          initial={buildFor.option}
          checkProblems={problemsOf(buildFor.platform)}
          onSubmit={submitBuild}
          onClose={() => setBuildFor(null)}
          onGoToTab={(section) => onNavigate?.(section)}
        />
      )}
      <ConfirmDialog
        open={certificatesDialog.open}
        tone='danger'
        title={t('BUILD_DELETE_CERTIFICATES_TITLE', 'Delete the _platform_ certificates?').replace('_platform_', certificatesDialog.name)}
        confirmLabel={t('DELETE_CERTIFICATES', 'Delete certificates')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={() => {
          deleteCertificates({ platform: certificatesDialog.platform })
          setCertificatesDialog((current) => ({ ...current, open: false }))
        }}
        onCancel={() => setCertificatesDialog((current) => ({ ...current, open: false }))}
      >
        <p>{t('BUILD_DELETE_CERTIFICATES_BODY', 'To build the app again you will have to upload them again.')}</p>
      </ConfirmDialog>
      <AlertDialog
        open={!!buildAppState?.error}
        title={t('BUILD_ERROR', 'Build error')}
        content={buildAppState?.result}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('ACCEPT', 'Accept')}
        onClose={() => setBuildAppState({ ...buildAppState, error: null, result: null })}
      />
    </div>
  )
}

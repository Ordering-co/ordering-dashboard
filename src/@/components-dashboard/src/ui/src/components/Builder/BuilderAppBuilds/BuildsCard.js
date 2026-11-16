import React, { useEffect, useState } from 'react'
import QRCode from 'react-qr-code'

import { useLanguage } from '../../../../../index'
import { CircleAlert, Package, TriangleAlert } from '../../Shared/Icon'
import { Button, EmptyState, InlineNotice, Skeleton, TabPanel, Tabs } from '../../Shared/Product'
import { GuideLink, PlatformIcon } from '../BuilderShared'
import {
  getBuildActionError,
  getBuildFailureText,
  getBuildFileLabel,
  getBuildKind,
  getBuildModeLabel,
  getBuildOptionValue,
  getBuildStatusLabel,
  getBuildTypeTabs,
  getPlatformLabel,
  getRequesterLabel,
  getTimeLeftLabel,
  hasPendingChanges,
  isBuildCancellable,
  isBuildInstallable,
  isBuildRunning,
  toApiUtcDateTime
} from '../utils'
import { useLinkCountdown } from './useInstallLinks'
import './builder-builds.css'

// redesign B2: the Builds card on Product pieces (Button, InlineNotice, EmptyState, Skeleton) and odc-bb-* CSS. Same
// controller props, states, texts, conditions and actions as main; the download link is still asked for on click only.

const DATE_TIME = 'MMM D, YYYY h:mm A'
// the one visible date format of the builds (main's), shared by the card, the history and the dialogs
export { DATE_TIME }

/** The tutorial for what to do with a successful file, by its mode. */
const NEXT_STEPS = {
  'app-store': { guide: 'ios_app_store', label: (t) => t('BUILDER_BUILD_NEXT_STEP_APP_STORE', 'Next step: upload it to App Store Connect') },
  bundle: { guide: 'android_aab', label: (t) => t('BUILDER_BUILD_NEXT_STEP_AAB', 'Next step: upload it in Play Console') }
}

/** An attempt's status, coloured by its kind (never built, in progress, successful, failed). */
export const BuildPill = ({ status }) => {
  const [, t] = useLanguage()
  return <span className='odc-bb-pill' data-kind={getBuildKind(status)}>{getBuildStatusLabel(status, t)}</span>
}

/** The install button and panel of each platform whose file a phone installs. */
const INSTALL_TEXTS = {
  ios: {
    title: (t) => t('BUILDER_INSTALL_ON_IPHONE', 'Install on iPhone'),
    help: (t) => t('BUILDER_INSTALL_HELP', 'Scan with the iPhone’s camera. Only registered devices can install it.'),
    guide: { key: 'ios_ad_hoc', label: (t) => t('BUILDER_INSTALL_GUIDE', 'Register devices or use MDM') }
  },
  android: {
    title: (t) => t('BUILDER_INSTALL_ON_ANDROID', 'Install on Android'),
    help: (t) => t('BUILDER_INSTALL_ANDROID_HELP', 'Scan with the phone’s camera to download the APK. Android asks to allow installing apps from this source the first time.'),
    guide: null
  }
}

/** The box the install QR takes: 112px and the padding of the CSS. */
const QR_BOX = 'calc(var(--od-space-9) + var(--od-space-5))'

/**
 * The QR of an attempt's install link, which lasts 24 hours: asked for when
 * the panel opens, its expiry under it, and a new one once it expires.
 */
const InstallPanel = (props) => {
  const { attempt, actions, texts, guides, formatDate, panelId } = props
  const [, t] = useLanguage()
  const install = actions.installLinks?.[attempt.id]
  const link = install?.link ?? null
  const { now, expiresAt, expired } = useLinkCountdown(link)

  useEffect(() => {
    actions.requestInstallLink(attempt)
  }, [attempt.id])

  const renew = () => actions.requestInstallLink(attempt, { renew: true })
  const loading = !install || install.loading

  return (
    <div className='odc-bb-install' id={panelId} aria-busy={loading ? 'true' : 'false'}>
      {loading && <Skeleton size={QR_BOX} block={QR_BOX} shape='box' />}
      {link && !expired && (
        <QRCode value={link.url} size={112} role='img' aria-label={t('BUILDER_INSTALL_QR', 'QR code to install the app')} />
      )}
      <div>
        <strong>{texts.title(t)}</strong>
        {loading && <span className='odc-bb-muted'>{t('BUILDER_INSTALL_LINK_PREPARING', 'Preparing the install link…')}</span>}
        {!loading && !link && (
          <InlineNotice
            tone='danger'
            icon={CircleAlert}
            role='alert'
            action={<Button size='sm' variant='ghost' onClick={renew}>{t('BUILDER_RETRY', 'Try again')}</Button>}
          >
            {getBuildActionError('install', install.errorCodes, { platform: attempt.platform, mode: getBuildModeLabel(attempt, t) }, t)}
          </InlineNotice>
        )}
        {link && !expired && (
          <>
            <span>{texts.help(t)}</span>
            <span className='odc-bb-muted'>
              {t('BUILDER_INSTALL_LINK_EXPIRES', 'Expires in _time_ · _date_')
                .replace('_time_', getTimeLeftLabel(expiresAt - now, t))
                .replace('_date_', formatDate(toApiUtcDateTime(link.expires_at), DATE_TIME))}
            </span>
          </>
        )}
        {expired && (
          <>
            <span className='odc-bb-muted'>{t('BUILDER_INSTALL_LINK_EXPIRED', 'This link expired.')}</span>
            <Button size='sm' onClick={renew}>{t('BUILDER_INSTALL_LINK_RENEW', 'Generate a new link')}</Button>
          </>
        )}
        {texts.guide && <GuideLink href={guides?.[texts.guide.key]}>{texts.guide.label(t)}</GuideLink>}
      </div>
    </div>
  )
}

/** Download, install on a phone (iOS ad hoc, Android APK) and the next step of a successful attempt. */
const SuccessfulActions = (props) => {
  const { attempt, actions, guides, formatDate, extra } = props
  const [, t] = useLanguage()
  const [installOpen, setInstallOpen] = useState(false)
  const texts = INSTALL_TEXTS[attempt.platform]
  const installable = !!texts && !!actions.requestInstallLink && isBuildInstallable(attempt)
  const next = NEXT_STEPS[getBuildOptionValue(attempt)]
  const panelId = `builder-install-${attempt.id}`
  const downloading = actions.downloadingId === attempt.id
  return (
    <>
      <div className='odc-bb-actions'>
        <Button disabled={downloading} onClick={() => actions.download(attempt)}>
          {downloading
            ? t('BUILDER_DOWNLOAD_PREPARING', 'Preparing…')
            : t('BUILDER_DOWNLOAD_FILE', 'Download _file_').replace('_file_', getBuildFileLabel(attempt))}
        </Button>
        {installable && (
          <Button
            aria-expanded={installOpen ? 'true' : 'false'}
            aria-controls={panelId}
            onClick={() => setInstallOpen(!installOpen)}
          >
            {texts.title(t)}
          </Button>
        )}
        {extra}
        {next && <GuideLink href={guides?.[next.guide]}>{next.label(t)}</GuideLink>}
      </div>
      {installable && installOpen && (
        <InstallPanel attempt={attempt} actions={actions} texts={texts} guides={guides} formatDate={formatDate} panelId={panelId} />
      )}
    </>
  )
}

/**
 * One file type of a platform (APK, AAB, ad hoc…): its latest attempt, with
 * its status and actions, and the latest successful one of that type when
 * the latest isn't it; the file the storage still keeps.
 */
const BuildTypePanel = (props) => {
  const { tab, item, actions, guides, formatDate, attemptsState, reloadAttempts } = props
  const [, t] = useLanguage()
  const latest = tab.latest
  const successful = tab.successful
  const latestIsSuccessful = latest?.status === 'successful'

  const requested = (attempt) => [
    t('BUILDER_REQUESTED_BY', 'Requested by _who_').replace('_who_', getRequesterLabel(attempt.requested_by_type, t)),
    formatDate(attempt.created_at, DATE_TIME)
  ].join(' · ')

  const describe = (attempt) => [getBuildModeLabel(attempt, t), attempt.app_version && `v${attempt.app_version}`].filter(Boolean).join(' · ')

  if (!latest) {
    // the attempts of each type come from the history: until it answers, an empty type may not be empty
    if (attemptsState?.error) {
      return (
        <InlineNotice
          tone='warning'
          icon={TriangleAlert}
          className='odc-bb-notice'
          action={reloadAttempts && <Button size='sm' variant='ghost' onClick={reloadAttempts}>{t('BUILDER_RETRY', 'Try again')}</Button>}
        >
          {t('BUILDER_BUILDS_LOAD_ERROR', 'We couldn’t load the builds.')}
        </InlineNotice>
      )
    }
    if (attemptsState?.loading && !attemptsState.attempts) {
      return <Skeleton block='var(--od-space-7)' />
    }
    return <p className='odc-bb-muted'>{t('BUILDER_BUILD_TYPE_NONE', 'No builds of this type yet.')}</p>
  }

  const viewLog = <Button onClick={() => actions.openLog(latest)}>{t('BUILDER_VIEW_LOG', 'View log')}</Button>

  return (
    <>
      <div className='odc-bb-summary'>
        <span className='odc-bb-summary-head'>
          <span>{describe(latest)}</span>
          <BuildPill status={latest.status} />
        </span>
        <span className='odc-bb-muted'>
          {latestIsSuccessful ? formatDate(latest.updated_at, DATE_TIME) : requested(latest)}
        </span>
        {latest.status === 'finishing' && (
          <span className='odc-bb-muted'>{t('BUILDER_BUILD_FINISHING_HELP', 'Checking the file. It can’t be cancelled now.')}</span>
        )}
      </div>

      {latest.status === 'failed' && (
        <InlineNotice tone='danger' icon={CircleAlert} className='odc-bb-notice'>{getBuildFailureText(latest, t)}</InlineNotice>
      )}

      {latestIsSuccessful && (
        <SuccessfulActions attempt={latest} actions={actions} guides={guides} formatDate={formatDate} extra={viewLog} />
      )}

      {!latestIsSuccessful && (
        <div className='odc-bb-actions'>
          {viewLog}
          {isBuildCancellable(latest) && (
            <Button onClick={() => actions.askCancel(latest)}>{t('BUILDER_CANCEL_BUILD', 'Cancel build')}</Button>
          )}
          {latest.retryable && (
            <Button onClick={() => actions.askRetry(latest)}>{t('BUILDER_RETRY_BUILD', 'Retry')}</Button>
          )}
        </div>
      )}

      {successful && successful.id !== latest.id && (
        <div className='odc-bb-successful'>
          <small>{t('BUILDER_LAST_SUCCESSFUL', 'Last successful')}</small>
          <span>{[describe(successful), formatDate(successful.updated_at, DATE_TIME)].join(' · ')}</span>
          <SuccessfulActions attempt={successful} actions={actions} guides={guides} formatDate={formatDate} />
        </div>
      )}

      {/* each file type has its own answer: a build of the AAB leaves the APK with its changes */}
      {hasPendingChanges(item, successful) && (
        <InlineNotice tone='warning' icon={TriangleAlert} className='odc-bb-notice'>
          {t('BUILDER_PENDING_CHANGES', 'Changes since this build. Build again to include them.')}
        </InlineNotice>
      )}
    </>
  )
}

/**
 * The file types of a platform as tabs (APK, AAB, Ad hoc, App Store…), each
 * with the status of its latest attempt as a dot (read out after its name),
 * and the panel of the one that is open (`children(tab)`). Shared by the
 * Builder's Builds card and My Products, so both read the same.
 */
export const BuildTypeTabs = (props) => {
  const { platformLabel, tabs, value, onValueChange, statusOf = (tab) => tab.latest?.status, children } = props
  const [, t] = useLanguage()
  return (
    <Tabs
      size='sm'
      wrap
      activateOnFocus
      className='odc-bb-types'
      label={t('BUILDER_BUILD_TYPES', '_platform_ file types').replace('_platform_', platformLabel)}
      value={value}
      onValueChange={onValueChange}
      items={tabs.map(tab => ({
        value: tab.value,
        label: (
          <>
            <span className='odc-bb-dot' data-kind={getBuildKind(statusOf(tab))} aria-hidden='true' />
            {tab.label}
            <span className='odc-sr-only'>{`, ${getBuildStatusLabel(statusOf(tab), t)}`}</span>
          </>
        )
      }))}
    >
      {tabs.map(tab => (
        <TabPanel key={tab.value} value={tab.value} className='odc-bb-type-panel'>
          {children(tab)}
        </TabPanel>
      ))}
    </Tabs>
  )
}

/**
 * The tab a platform's builds are open on: the one the user picked, for the
 * build it was picked with, else `current`. A pick lasts until a new build
 * arrives (it opens its own type) and, when it was made while that build was
 * running, until it ends: a build that finishes is shown on its type.
 */
export const usePickedBuildType = (tabs, current, latest) => {
  const [picked, setPicked] = useState(null)
  const stamp = `${latest?.id ?? ''}|${isBuildRunning(latest) ? 'running' : 'ended'}`
  const valid = picked && picked.stamp === stamp && tabs.some(tab => tab.value === picked.value)
  return [valid ? picked.value : current, (value) => setPicked({ value, stamp })]
}

/**
 * Where one platform stands, by file type: a tab per type (APK, AAB and a
 * debug APK when there is one; Ad hoc and App Store), each with its latest
 * attempt and its status as a dot. It opens on the type of the platform's
 * latest attempt; a tab the user picks stays until a new attempt arrives or
 * the one that was running ends. Build opens its dialog on the type of the
 * tab that is open.
 */
const PlatformBuilds = (props) => {
  const { platform, item, actions, guides, formatDate, attemptsState, reloadAttempts } = props
  const [, t] = useLanguage()
  const latest = item?.latest ?? null
  const running = isBuildRunning(latest)
  const platformLabel = getPlatformLabel(platform)
  const titleId = `builder-builds-${platform}`
  const runningId = `builder-builds-${platform}-running`
  const { tabs, current } = getBuildTypeTabs(platform, item, attemptsState?.attempts || [], t)
  const [value, pick] = usePickedBuildType(tabs, current, latest)

  return (
    <div className='odc-bb-column' role='group' aria-labelledby={titleId}>
      <div className='odc-bb-column-head'>
        <strong id={titleId}><PlatformIcon platform={platform} />{platformLabel}</strong>
      </div>

      {!latest && (
        <p className='odc-bb-muted'>{t('BUILDER_BUILD_NONE_HELP', 'Build it to get a file you can install or upload to the store.')}</p>
      )}

      {latest && tabs.length > 0 && (
        <BuildTypeTabs platformLabel={platformLabel} tabs={tabs} value={value} onValueChange={pick}>
          {(tab) => (
            <BuildTypePanel
              tab={tab}
              item={item}
              actions={actions}
              guides={guides}
              formatDate={formatDate}
              attemptsState={attemptsState}
              reloadAttempts={reloadAttempts}
            />
          )}
        </BuildTypeTabs>
      )}

      <div className='odc-bb-foot'>
        {/* redesign B2: the reason of the disabled Build is its description too */}
        <Button
          variant='primary'
          disabled={running}
          aria-describedby={running ? runningId : undefined}
          // the dialog starts on the file type of the tab that is open (with no build yet, on its own default)
          onClick={() => actions.openBuild(platform, latest ? value : null)}
        >
          {t('BUILDER_BUILD', 'Build')}
        </Button>
        {running && (
          <span id={runningId} className='odc-bb-muted'>
            {t('BUILDER_BUILD_RUNNING', '_platform_ is already building.').replace('_platform_', platformLabel)}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * The Builds card of the app detail: one column per platform the
 * base builds. An archived app doesn't build, so it says how to bring it back.
 */
export const BuilderBuildsCard = (props) => {
  const { latestState, reloadLatest, attemptsState, reloadAttempts, platformOrder, productStatus, actions, guides, formatDate, onSeeAll, onChangeStatus, statusBusy } = props
  const [, t] = useLanguage()

  if (productStatus === 'archived') {
    return (
      <section className='odc-root odc-bb-card' aria-labelledby='builder-archived-title'>
        {/* redesign B2: Shared/Icon has no archive glyph; Package is the closest box */}
        <EmptyState
          icon={Package}
          titleAs='h2'
          title={<span id='builder-archived-title'>{t('BUILDER_ARCHIVED_NO_BUILDS', 'Archived apps don’t build')}</span>}
          description={t('BUILDER_ARCHIVED_NO_BUILDS_HELP', 'Move it to draft or activate it to build again. Installed apps keep working.')}
          action={(
            <div className='odc-bb-actions'>
              <Button disabled={statusBusy} onClick={() => onChangeStatus('draft')}>{t('BUILDER_MOVE_TO_DRAFT', 'Move to draft')}</Button>
              <Button variant='primary' disabled={statusBusy} onClick={() => onChangeStatus('active')}>{t('BUILDER_ACTIVATE', 'Activate')}</Button>
            </div>
          )}
        />
      </section>
    )
  }

  const { loading, platforms, error } = latestState
  const order = platforms
    ? [...platformOrder.filter(platform => platforms[platform]), ...Object.keys(platforms).filter(platform => !platformOrder.includes(platform))]
    : platformOrder

  return (
    <section className='odc-root odc-bb-card' aria-labelledby='builder-builds-title' aria-busy={loading && !platforms ? 'true' : 'false'}>
      <header className='odc-bb-head'>
        <h2 id='builder-builds-title'>{t('BUILDER_BUILDS', 'Builds')}</h2>
        <Button variant='link' onClick={onSeeAll}>{t('BUILDER_SEE_ALL_BUILDS', 'See all builds')}</Button>
      </header>
      {error && !platforms && (
        <InlineNotice
          tone='warning'
          icon={TriangleAlert}
          role='alert'
          className='odc-bb-notice'
          action={<Button size='sm' variant='ghost' onClick={reloadLatest}>{t('BUILDER_RETRY', 'Try again')}</Button>}
        >
          {t('BUILDER_BUILDS_LOAD_ERROR', 'We couldn’t load the builds.')}
        </InlineNotice>
      )}
      {!platforms && !error && (
        <div className='odc-bb-grid'>
          {/* main: a 180px block per platform */}
          {order.map(platform => <Skeleton key={platform} block='calc(var(--od-space-10) + var(--od-space-7))' />)}
        </div>
      )}
      {platforms && order.length === 0 && (
        <p className='odc-bb-muted'>{t('BUILDER_BUILDS_NO_PLATFORMS', 'This app’s base doesn’t build any platform yet.')}</p>
      )}
      {platforms && order.length > 0 && (
        <div className='odc-bb-grid'>
          {order.map(platform => (
            <PlatformBuilds
              key={platform}
              platform={platform}
              item={platforms[platform]}
              attemptsState={attemptsState}
              reloadAttempts={reloadAttempts}
              actions={actions}
              guides={guides}
              formatDate={formatDate}
            />
          ))}
        </div>
      )}
    </section>
  )
}

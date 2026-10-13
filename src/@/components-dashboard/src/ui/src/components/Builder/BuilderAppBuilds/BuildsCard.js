import React, { useState } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import QRCode from 'react-qr-code'
import { Archive, ExclamationTriangle } from 'react-bootstrap-icons'

import { useLanguage } from '../../../../../index'
import { Button } from '../../../styles'
import { BuilderMessage, GuideLink, PlatformIcon } from '../BuilderShared'
import {
  getBuildFailureText,
  getBuildFileLabel,
  getBuildKind,
  getBuildModeLabel,
  getBuildOptionValue,
  getBuildStatusLabel,
  getPlatformLabel,
  getRequesterLabel,
  isBuildCancellable,
  isBuildRunning
} from '../utils'
import {
  BuildActions,
  BuildColumn,
  BuildColumnHead,
  BuildFooter,
  BuildsCard,
  BuildsGrid,
  BuildSuccessful,
  BuildSummary,
  InstallPanel,
  LinkButton,
  MutedText,
  Notice,
  Pill
} from '../styles'

const DATE_TIME = 'MMM D, YYYY h:mm A'

/** The tutorial for what to do with a successful file, by its mode. */
const NEXT_STEPS = {
  'app-store': { guide: 'ios_app_store', label: (t) => t('BUILDER_BUILD_NEXT_STEP_APP_STORE', 'Next step: upload it to App Store Connect') },
  bundle: { guide: 'android_aab', label: (t) => t('BUILDER_BUILD_NEXT_STEP_AAB', 'Next step: upload it in Play Console') }
}

/** Download, install on an iPhone (ad hoc) and the next step of a successful attempt. */
const SuccessfulActions = (props) => {
  const { attempt, actions, installUrl, guides, extra } = props
  const [, t] = useLanguage()
  const [installOpen, setInstallOpen] = useState(false)
  const adHoc = attempt.platform === 'ios' && attempt.mode === 'ad-hoc'
  const next = NEXT_STEPS[getBuildOptionValue(attempt)]
  const panelId = `builder-install-${attempt.id}`
  return (
    <>
      <BuildActions>
        <Button
          type='button'
          color='primary'
          outline
          borderRadius='8px'
          disabled={actions.downloadingId === attempt.id}
          onClick={() => actions.download(attempt)}
        >
          {actions.downloadingId === attempt.id
            ? t('BUILDER_DOWNLOAD_PREPARING', 'Preparing…')
            : t('BUILDER_DOWNLOAD_FILE', 'Download _file_').replace('_file_', getBuildFileLabel(attempt))}
        </Button>
        {adHoc && installUrl && (
          <Button
            type='button'
            color='primary'
            outline
            borderRadius='8px'
            aria-expanded={installOpen ? 'true' : 'false'}
            aria-controls={panelId}
            onClick={() => setInstallOpen(!installOpen)}
          >
            {t('BUILDER_INSTALL_ON_IPHONE', 'Install on iPhone')}
          </Button>
        )}
        {extra}
        {next && <GuideLink href={guides?.[next.guide]}>{next.label(t)}</GuideLink>}
      </BuildActions>
      {adHoc && installOpen && installUrl && (
        <InstallPanel id={panelId}>
          <QRCode value={installUrl} size={112} role='img' aria-label={t('BUILDER_INSTALL_QR', 'QR code to install the app')} />
          <div>
            <strong>{t('BUILDER_INSTALL_ON_IPHONE', 'Install on iPhone')}</strong>
            <span>{t('BUILDER_INSTALL_HELP', 'Scan with the iPhone’s camera. Only registered devices can install it.')}</span>
            <GuideLink href={guides?.ios_ad_hoc}>{t('BUILDER_INSTALL_GUIDE', 'Register devices or use MDM')}</GuideLink>
          </div>
        </InstallPanel>
      )}
    </>
  )
}

/** Where one platform stands: its latest attempt, its latest successful one and whether it is behind. */
const PlatformBuilds = (props) => {
  const { platform, item, actions, installUrl, guides, formatDate } = props
  const [, t] = useLanguage()
  const latest = item?.latest ?? null
  const successful = item?.successful ?? null
  const running = isBuildRunning(latest)
  const latestIsSuccessful = latest?.status === 'successful'
  const platformLabel = getPlatformLabel(platform)

  const requested = (attempt) => [
    t('BUILDER_REQUESTED_BY', 'Requested by _who_').replace('_who_', getRequesterLabel(attempt.requested_by_type, t)),
    formatDate(attempt.created_at, DATE_TIME)
  ].join(' · ')

  const describe = (attempt) => [getBuildModeLabel(attempt, t), attempt.app_version && `v${attempt.app_version}`].filter(Boolean).join(' · ')

  const viewLog = latest && (
    <Button type='button' color='secundary' borderRadius='8px' onClick={() => actions.openLog(latest)}>
      {t('BUILDER_VIEW_LOG', 'View log')}
    </Button>
  )

  return (
    <BuildColumn aria-labelledby={`builder-builds-${platform}`}>
      <BuildColumnHead>
        <strong id={`builder-builds-${platform}`}><PlatformIcon platform={platform} />{platformLabel}</strong>
        <Pill kind={getBuildKind(latest?.status)}>{getBuildStatusLabel(latest?.status, t)}</Pill>
      </BuildColumnHead>

      {!latest && (
        <MutedText small>{t('BUILDER_BUILD_NONE_HELP', 'Build it to get a file you can install or upload to the store.')}</MutedText>
      )}

      {latest && (
        <BuildSummary>
          <span>{describe(latest)}</span>
          <MutedText small>
            {latestIsSuccessful ? formatDate(latest.updated_at, DATE_TIME) : requested(latest)}
          </MutedText>
          {latest.status === 'finishing' && (
            <MutedText small>{t('BUILDER_BUILD_FINISHING_HELP', 'Checking the file. It can’t be cancelled now.')}</MutedText>
          )}
        </BuildSummary>
      )}

      {latest?.status === 'failed' && <Notice tone='error' role='status'>{getBuildFailureText(latest, t)}</Notice>}

      {latest && latestIsSuccessful && (
        <SuccessfulActions attempt={latest} actions={actions} installUrl={installUrl} guides={guides} extra={viewLog} />
      )}

      {latest && !latestIsSuccessful && (
        <BuildActions>
          {viewLog}
          {isBuildCancellable(latest) && (
            <Button type='button' color='secundary' borderRadius='8px' onClick={() => actions.askCancel(latest)}>
              {t('BUILDER_CANCEL_BUILD', 'Cancel build')}
            </Button>
          )}
          {latest.retryable && (
            <Button type='button' color='secundary' borderRadius='8px' onClick={() => actions.askRetry(latest)}>
              {t('BUILDER_RETRY_BUILD', 'Retry')}
            </Button>
          )}
        </BuildActions>
      )}

      {successful && successful.id !== latest?.id && (
        <BuildSuccessful>
          <small>{t('BUILDER_LAST_SUCCESSFUL', 'Last successful')}</small>
          <span>{[describe(successful), formatDate(successful.updated_at, DATE_TIME)].join(' · ')}</span>
          <SuccessfulActions attempt={successful} actions={actions} installUrl={installUrl} guides={guides} />
        </BuildSuccessful>
      )}

      {successful && item?.pending_changes === true && (
        <Notice role='status'>
          <ExclamationTriangle aria-hidden='true' color='#7A5000' />
          <span>{t('BUILDER_PENDING_CHANGES', 'Changes since this build. Build again to include them.')}</span>
        </Notice>
      )}

      <BuildFooter>
        <Button type='button' color='primary' borderRadius='8px' disabled={running} onClick={() => actions.openBuild(platform)}>
          {t('BUILDER_BUILD', 'Build')}
        </Button>
        {running && (
          <MutedText small>{t('BUILDER_BUILD_RUNNING', '_platform_ is already building.').replace('_platform_', platformLabel)}</MutedText>
        )}
      </BuildFooter>
    </BuildColumn>
  )
}

/**
 * The Builds card of the app detail: one column per platform the
 * base builds. An archived app doesn't build, so it says how to bring it back.
 */
export const BuilderBuildsCard = (props) => {
  const { latestState, reloadLatest, platformOrder, productStatus, actions, installUrl, guides, formatDate, onSeeAll, onChangeStatus, statusBusy } = props
  const [, t] = useLanguage()

  if (productStatus === 'archived') {
    return (
      <BuildsCard aria-labelledby='builder-archived-title'>
        <BuilderMessage
          icon={<Archive aria-hidden='true' />}
          title={<span id='builder-archived-title'>{t('BUILDER_ARCHIVED_NO_BUILDS', 'Archived apps don’t build')}</span>}
          text={t('BUILDER_ARCHIVED_NO_BUILDS_HELP', 'Move it to draft or activate it to build again. Installed apps keep working.')}
        >
          <BuildActions>
            <Button type='button' color='primary' outline borderRadius='8px' disabled={statusBusy} onClick={() => onChangeStatus('draft')}>
              {t('BUILDER_MOVE_TO_DRAFT', 'Move to draft')}
            </Button>
            <Button type='button' color='primary' borderRadius='8px' disabled={statusBusy} onClick={() => onChangeStatus('active')}>
              {t('BUILDER_ACTIVATE', 'Activate')}
            </Button>
          </BuildActions>
        </BuilderMessage>
      </BuildsCard>
    )
  }

  const { loading, platforms, error } = latestState
  const order = platforms
    ? [...platformOrder.filter(platform => platforms[platform]), ...Object.keys(platforms).filter(platform => !platformOrder.includes(platform))]
    : platformOrder

  return (
    <BuildsCard aria-labelledby='builder-builds-title' aria-busy={loading && !platforms ? 'true' : 'false'}>
      <header>
        <h2 id='builder-builds-title'>{t('BUILDER_BUILDS', 'Builds')}</h2>
        <LinkButton type='button' onClick={onSeeAll}>{t('BUILDER_SEE_ALL_BUILDS', 'See all builds')}</LinkButton>
      </header>
      {error && !platforms && (
        <Notice role='alert'>
          <ExclamationTriangle aria-hidden='true' color='#7A5000' />
          <span>{t('BUILDER_BUILDS_LOAD_ERROR', 'We couldn’t load the builds.')}</span>
          <LinkButton type='button' onClick={reloadLatest}>{t('BUILDER_RETRY', 'Try again')}</LinkButton>
        </Notice>
      )}
      {!platforms && !error && (
        <BuildsGrid>
          {order.map(platform => <Skeleton key={platform} height={180} borderRadius={10} />)}
        </BuildsGrid>
      )}
      {platforms && order.length === 0 && (
        <MutedText>{t('BUILDER_BUILDS_NO_PLATFORMS', 'This app’s base doesn’t build any platform yet.')}</MutedText>
      )}
      {platforms && order.length > 0 && (
        <BuildsGrid>
          {order.map(platform => (
            <PlatformBuilds
              key={platform}
              platform={platform}
              item={platforms[platform]}
              actions={actions}
              installUrl={installUrl}
              guides={guides}
              formatDate={formatDate}
            />
          ))}
        </BuildsGrid>
      )}
    </BuildsCard>
  )
}

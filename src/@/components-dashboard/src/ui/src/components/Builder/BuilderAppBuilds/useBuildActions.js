import React, { useState } from 'react'

import { ToastType, useLanguage, useToast } from '../../../../../index'
import { Confirm } from '../../Shared'
import { getBuildActionError, getBuildModeLabel, getPlatformLabel } from '../utils'
import { BuildDialog, BuildLogDialog, RetryDialog } from './BuildDialogs'

/**
 * The build actions of the app detail, shared by the Builds card and the
 * history: the Build dialog, the log, retry and cancel (both confirmed) and
 * downloads. Returns the handlers and the dialogs to render once.
 */
export const useBuildActions = (props) => {
  const {
    requestBuild,
    retryBuild,
    cancelBuild,
    getBuildLog,
    getBuildDownload,
    latestPlatforms,
    productStatus,
    versions,
    checkProblems,
    guides,
    formatDate,
    onGoToTab
  } = props

  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const [buildFor, setBuildFor] = useState(null)
  const [logFor, setLogFor] = useState(null)
  const [retryFor, setRetryFor] = useState(null)
  const [cancelFor, setCancelFor] = useState(null)
  const [busy, setBusy] = useState(false)
  const [downloadingId, setDownloadingId] = useState(null)

  const platformText = (text, platform) => text.replace('_platform_', getPlatformLabel(platform))

  const submitBuild = async (platform, option) => {
    const answer = await requestBuild(platform, option)
    if (answer.ok) {
      setBuildFor(null)
      showToast(ToastType.Success, platformText(t('BUILDER_BUILD_REQUESTED', '_platform_ build requested. Its status updates here.'), platform))
    }
    return answer
  }

  const runRetry = async () => {
    const attempt = retryFor
    setBusy(true)
    const answer = await retryBuild(attempt)
    setBusy(false)
    setRetryFor(null)
    if (answer.ok) {
      showToast(ToastType.Success, platformText(t('BUILDER_BUILD_RETRYING', 'Retrying the _platform_ build.'), attempt.platform))
      return
    }
    showToast(ToastType.Error, getBuildActionError('retry', answer.errorCodes, { platform: attempt.platform }, t))
  }

  /** "Build with current settings": the attempt's mode, the current configuration. */
  const runNewBuild = async () => {
    const attempt = retryFor
    setBusy(true)
    const answer = await requestBuild(attempt.platform, { mode: attempt.mode, type: attempt.type })
    setBusy(false)
    setRetryFor(null)
    if (answer.ok) {
      showToast(ToastType.Success, platformText(t('BUILDER_BUILD_REQUESTED', '_platform_ build requested. Its status updates here.'), attempt.platform))
      return
    }
    // The dialog lists what is missing and lets the customer fix it
    if (answer.errorCodes.includes('build.blocked')) {
      setBuildFor(attempt.platform)
      return
    }
    showToast(ToastType.Error, getBuildActionError('build', answer.errorCodes, { platform: attempt.platform }, t))
  }

  const runCancel = async () => {
    const attempt = cancelFor
    setCancelFor(null)
    const answer = await cancelBuild(attempt)
    if (answer.ok) {
      showToast(ToastType.Success, platformText(t('BUILDER_BUILD_CANCELLED_TOAST', '_platform_ build cancelled.'), attempt.platform))
      return
    }
    showToast(ToastType.Error, getBuildActionError('cancel', answer.errorCodes, { platform: attempt.platform }, t))
  }

  /** The link lasts 15 minutes, so it is asked for on click. */
  const download = async (attempt) => {
    if (downloadingId) return
    setDownloadingId(attempt.id)
    const answer = await getBuildDownload(attempt.id)
    setDownloadingId(null)
    if (answer.ok && answer.result?.url) {
      const link = document.createElement('a')
      link.href = answer.result.url
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.click()
      return
    }
    showToast(ToastType.Error, getBuildActionError('download', answer.errorCodes, { platform: attempt.platform, mode: getBuildModeLabel(attempt, t) }, t))
  }

  const dialogs = (
    <>
      {buildFor && (
        <BuildDialog
          platform={buildFor}
          latest={latestPlatforms?.[buildFor]?.latest ?? null}
          productStatus={productStatus}
          version={versions?.[buildFor]}
          checkProblems={checkProblems}
          guides={guides}
          onSubmit={submitBuild}
          onClose={() => setBuildFor(null)}
          onGoToTab={onGoToTab}
        />
      )}
      {logFor && (
        <BuildLogDialog attempt={logFor} getBuildLog={getBuildLog} formatDate={formatDate} onClose={() => setLogFor(null)} />
      )}
      {retryFor && (
        <RetryDialog
          attempt={retryFor}
          busy={busy}
          formatDate={formatDate}
          onRetry={runRetry}
          onBuildNew={runNewBuild}
          onClose={() => setRetryFor(null)}
        />
      )}
      <Confirm
        open={!!cancelFor}
        width='min(440px, calc(100vw - 72px))'
        title={cancelFor ? platformText(t('BUILDER_CANCEL_TITLE', 'Cancel this _platform_ build?'), cancelFor.platform) : ''}
        acceptText={t('BUILDER_CANCEL_BUILD', 'Cancel build')}
        cancelText={t('BUILDER_KEEP_BUILDING', 'Keep building')}
        onAccept={runCancel}
        onCancel={() => setCancelFor(null)}
        onClose={() => setCancelFor(null)}
      >
        <p>{t('BUILDER_CANCEL_HELP', 'It stops now and leaves no file. You can build again at any time.')}</p>
      </Confirm>
    </>
  )

  return {
    openBuild: setBuildFor,
    openLog: setLogFor,
    askRetry: setRetryFor,
    askCancel: setCancelFor,
    download,
    downloadingId,
    dialogs
  }
}

import React, { useRef, useState } from 'react'

import { ToastType, useLanguage, useToast } from '../../../../../index'
import { ConfirmDialog } from '../../Shared/Product'
import { getBuildActionError, getBuildModeLabel, getBuildOptionValue, getPlatformLabel } from '../utils'
import { BuildDialog, BuildLogDialog, RetryDialog } from './BuildDialogs'
import { useInstallLinks } from './useInstallLinks'

/**
 * The build actions of the app detail, shared by the Builds card and the
 * history: the Build dialog (`openBuild(platform, option)` opens it on the
 * file type of the tab its button is on), the log, retry and cancel (both
 * confirmed) and downloads. Returns the handlers and the dialogs to render once.
 */
export const useBuildActions = (props) => {
  const {
    requestBuild,
    retryBuild,
    cancelBuild,
    getBuildLog,
    getBuildDownload,
    createInstallLink,
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
  // the Build dialog that is open: `{ platform, option }`, `option` being the file type it starts on (null: its default)
  const [buildFor, setBuildFor] = useState(null)
  const [logFor, setLogFor] = useState(null)
  const [retryFor, setRetryFor] = useState(null)
  const [cancelFor, setCancelFor] = useState(null)
  const [busy, setBusy] = useState(false)
  const [downloadingId, setDownloadingId] = useState(null)
  // a download link is being asked for (read on click, not from the render the click was made in)
  const downloading = useRef(false)
  // the install link of each attempt, by its id: { loading, link, errorCodes }
  const { installLinks, requestInstallLink } = useInstallLinks(
    createInstallLink && ((attempt) => createInstallLink(attempt.id)),
    (attempt) => attempt.id
  )
  // the attempt the cancel confirmation names, kept while it closes
  const cancelShown = useRef(null)
  if (cancelFor) cancelShown.current = cancelFor

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
      setBuildFor({ platform: attempt.platform, option: getBuildOptionValue(attempt) })
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

  /**
   * Downloads the attempt's file through a link of 15 minutes, asked for on click. One download at a time: a click while a link is
   * being asked for is ignored.
   *
   * The link is followed in this tab on purpose, as My Products does (`downloadApp`, components/BuildApps). The storage answers it
   * as an attachment (api-core signs it with `ResponseContentDisposition`, `ProductBuildController::download`), so the browser
   * downloads the file and the Dashboard stays. The other ways are not better:
   * - a new tab (`target='_blank'` or `window.open`) asked for once the link arrives is outside the click, and Safari and other
   *   pop-up blockers drop it: nothing was downloaded and nothing said so. Opened in the click, before the request, it stays there
   *   empty once the file is downloaded;
   * - a hidden frame keeps the Dashboard when the storage answers an error instead of the file, but then nobody sees that error
   *   (the page cannot read a frame of another origin): the button would do nothing, with no way to say why.
   * What is left is a storage that answers an error page to a link signed a moment ago: the browser shows it in place of the
   * Dashboard, and Back returns to it.
   */
  const download = async (attempt) => {
    if (downloading.current) return
    downloading.current = true
    setDownloadingId(attempt.id)
    let answer
    try {
      answer = await getBuildDownload(attempt.id)
    } catch (err) {
      answer = { ok: false, errorCodes: [] }
    }
    downloading.current = false
    setDownloadingId(null)
    const url = answer?.ok ? answer.result?.url : null
    if (!url) {
      showToast(ToastType.Error, getBuildActionError('download', answer?.errorCodes || [], { platform: attempt.platform, mode: getBuildModeLabel(attempt, t) }, t))
      return
    }
    const link = document.createElement('a')
    link.href = url
    // the storage is not told which page of the Dashboard asked for the file
    link.rel = 'noopener noreferrer'
    link.click()
  }

  const dialogs = (
    <>
      {buildFor && (
        <BuildDialog
          platform={buildFor.platform}
          initial={buildFor.option}
          latest={latestPlatforms?.[buildFor.platform]?.latest ?? null}
          productStatus={productStatus}
          version={versions?.[buildFor.platform]}
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
      {/* redesign B2: P/ConfirmDialog (alertdialog, the focus starts on Keep building) */}
      <ConfirmDialog
        open={!!cancelFor}
        title={cancelShown.current ? platformText(t('BUILDER_CANCEL_TITLE', 'Cancel this _platform_ build?'), cancelShown.current.platform) : ''}
        confirmLabel={t('BUILDER_CANCEL_BUILD', 'Cancel build')}
        cancelLabel={t('BUILDER_KEEP_BUILDING', 'Keep building')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={runCancel}
        onCancel={() => setCancelFor(null)}
      >
        {t('BUILDER_CANCEL_HELP', 'It stops now and leaves no file. You can build again at any time.')}
      </ConfirmDialog>
    </>
  )

  return {
    // `option`: the file type of the tab the button is on, which the dialog starts on
    openBuild: (platform, option = null) => setBuildFor({ platform, option }),
    openLog: setLogFor,
    askRetry: setRetryFor,
    askCancel: setCancelFor,
    download,
    downloadingId,
    installLinks,
    requestInstallLink,
    dialogs
  }
}

import React, { useEffect } from 'react'
import dayjs from 'dayjs'

import { useApi, useLanguage } from '../../../../../index'
import { Button, Status } from '../../Shared/Product'
import { fillTemplate } from './fillTemplate'
import { clearRun, isRunResolved, menuGrew, saveRun } from './menuImportRuns'
import { useBusinessMenuSnapshot } from './useBusinessMenuSnapshot'
import { useMenuImportRun } from './useMenuImportRun'
import './importer-store-panel.css'

const formatTime = (iso) => dayjs(iso).format('h:mm A')

// the four tones of main's line, on the families of the Product Status (a dot and the words, never colour alone)
const FAMILY_OF_TONE = { progress: 'progress', success: 'done', danger: 'cancel', warning: 'pending' }

/**
 * What the stored run of an importer says, as one line (main sync, the redesign of `ImportRunStatus` of main's
 * ImportersPanel, commits 30af024c, ac049f23 and fc6cf47f; same reads, same copy keys, same writes to the stored run).
 * The copy names what we know, never «unknown»: a lost connection reads as «may still be running» until «Check now» sees the menu
 * grow (resolved) or not grow (failed). Growth is reported as such, never as «Completed» (only the server confirms that).
 * Only mounted for a run that is shown, so the menu read hook exists only then, and nothing is requested until «Check now».
 */
const RunStatusView = ({ run, runRef, onRetry }) => {
  const [, t] = useLanguage()
  const { loading, failed, refetch } = useBusinessMenuSnapshot(runRef.businessId)

  const counts = (menu) => fillTemplate(
    t('IMPORTER_RUN_MENU_COUNTS', '{{categories}} categories, {{products}} products'),
    menu
  )
  const unchangedMessage = t(
    'IMPORTER_RUN_UNCHANGED_FAILED',
    'The menu did not grow, so the import did not finish.'
  )
  const checkedWithoutGrowth =
    run.status === 'unknown' &&
    Boolean(run.checkedAt) &&
    Boolean(run.menuBefore) &&
    Boolean(run.menuAfter) &&
    !menuGrew(run.menuBefore, run.menuAfter)

  // a check that already saw no growth closes the run as failed, also when it is read back after a reload
  useEffect(() => {
    if (!checkedWithoutGrowth) return
    saveRun(runRef, {
      ...run,
      status: 'failed',
      finishedAt: run.checkedAt,
      errorMessage: unchangedMessage
    })
  }, [checkedWithoutGrowth, run, runRef, unchangedMessage])

  const handleCheck = async () => {
    const snapshot = await refetch()
    if (!snapshot) return
    const checkedAt = new Date().toISOString()
    if (run.menuBefore && !menuGrew(run.menuBefore, snapshot)) {
      saveRun(runRef, {
        ...run,
        status: 'failed',
        menuAfter: snapshot,
        checkedAt,
        finishedAt: checkedAt,
        errorMessage: unchangedMessage
      })
      return
    }
    saveRun(runRef, { ...run, menuAfter: snapshot, checkedAt })
  }

  const handleDismiss = () => clearRun(runRef)

  const dismissButton = (
    <Button variant='ghost' size='sm' onClick={handleDismiss}>
      {t('IMPORTER_RUN_DISMISS', 'Dismiss')}
    </Button>
  )

  const retryButton = (
    <Button variant='link' onClick={onRetry}>
      {t('IMPORTER_RETRY', 'Retry')}
    </Button>
  )

  const checkButton = (
    <Button variant='link' onClick={handleCheck} disabled={loading}>
      {loading
        ? t('IMPORTER_RUN_CHECKING', 'Checking…')
        : t('IMPORTER_RUN_CHECK_NOW', 'Check now')}
    </Button>
  )

  const lostConnection = () => {
    if (isRunResolved(run)) {
      return {
        tone: 'success',
        text: fillTemplate(
          t('IMPORTER_RUN_MENU_GREW_RESOLVED', 'Menu grew from {{before}} to {{after}} products after the import · checked {{time}}'),
          { before: run.menuBefore.products, after: run.menuAfter.products, time: formatTime(run.checkedAt) }
        ),
        actions: dismissButton
      }
    }
    const checkedText = () => {
      if (!run.checkedAt || !run.menuAfter) {
        return fillTemplate(
          t('IMPORTER_RUN_CONNECTION_LOST', 'Connection lost — the import may still be running. Started {{time}}'),
          { time: formatTime(run.startedAt) }
        )
      }
      if (!run.menuBefore) {
        return fillTemplate(
          t('IMPORTER_RUN_STILL_RUNNING_COUNTS', 'The import may still be running — {{counts}} now. Checked {{time}}'),
          { counts: counts(run.menuAfter), time: formatTime(run.checkedAt) }
        )
      }
      return fillTemplate(
        t('IMPORTER_RUN_CONNECTION_LOST', 'Connection lost — the import may still be running. Started {{time}}'),
        { time: formatTime(run.startedAt) }
      )
    }
    return {
      tone: 'warning',
      text: checkedText(),
      detail: failed ? t('IMPORTER_RUN_MENU_CHECK_FAILED', 'Could not check the menu right now.') : null,
      actions: (
        <>
          {checkButton}
          {dismissButton}
        </>
      )
    }
  }

  const byStatus = {
    importing: () => ({
      tone: 'progress',
      text: fillTemplate(t('IMPORTER_RUN_IMPORTING_SINCE', 'Importing since {{time}}'), { time: formatTime(run.startedAt) })
    }),
    success: () => ({
      tone: 'success',
      text: [
        fillTemplate(t('IMPORTER_RUN_COMPLETED_AT', 'Completed {{time}}'), { time: formatTime(run.finishedAt) }),
        run.menuAfter && counts(run.menuAfter)
      ].filter(Boolean).join(' · '),
      actions: dismissButton
    }),
    failed: () => ({
      tone: 'danger',
      text: fillTemplate(
        t('IMPORTER_RUN_FAILED_AT', 'Failed {{time}} — {{message}}'),
        { time: formatTime(run.finishedAt), message: run.errorMessage || '' }
      ),
      actions: (
        <>
          {retryButton}
          {dismissButton}
        </>
      )
    }),
    unknown: lostConnection
  }

  const view = checkedWithoutGrowth
    ? {
        tone: 'danger',
        text: fillTemplate(
          t('IMPORTER_RUN_FAILED_AT', 'Failed {{time}} — {{message}}'),
          { time: formatTime(run.checkedAt), message: unchangedMessage }
        ),
        actions: (
          <>
            {retryButton}
            {dismissButton}
          </>
        )
      }
    : byStatus[run.status]?.()
  if (!view) return null

  return (
    <div className='isp-run' data-testid='importer-run-status' data-tone={view.tone}>
      {/* the live line: the words (and the detail, when a check fails) are announced when they change; the buttons are not part of it */}
      <div className='isp-run-live' role='status'>
        <Status family={FAMILY_OF_TONE[view.tone]} label={view.text} wrap />
        {view.detail && <p className='isp-run-detail'>{view.detail}</p>}
      </div>
      {view.actions && <div className='isp-run-actions'>{view.actions}</div>}
    </div>
  )
}

/**
 * One line under an importer of the store panel: what happened to the last import of this store and importer. The run is read from
 * the store of runs (`useMenuImportRun`, localStorage by project, business and importer; expired and stale runs are resolved there),
 * so nothing is requested for it. `hidden` is for the importer whose dialog is open (the dialog shows the same status).
 * `onRetry` opens the importer again.
 */
export const ImporterRunStatus = ({ card, business, onRetry, hidden = false }) => {
  const [ordering] = useApi()
  const runRef = { project: ordering?.project, businessId: business?.id, source: card.id }
  const run = useMenuImportRun(runRef)
  if (!run || hidden) return null
  return <RunStatusView run={run} runRef={runRef} onRetry={onRetry} />
}

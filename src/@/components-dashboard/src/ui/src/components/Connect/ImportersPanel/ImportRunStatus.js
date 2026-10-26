import React, { useEffect } from 'react'
import dayjs from 'dayjs'
import { useLanguage } from '../../../../../index'
import { fillTemplate } from '../Importers/fillTemplate'
import { useBusinessMenuSnapshot } from '../Importers/useBusinessMenuSnapshot'
import { saveRun, clearRun, isRunResolved, menuGrew } from '../Importers/menuImportRuns'

import {
  RunStatus,
  RunStatusLine,
  RunStatusDot,
  RunStatusText,
  RunActions,
  RunActionButton
} from './styles'

const TIME_FORMAT = 'h:mm A'
const formatTime = (iso) => dayjs(iso).format(TIME_FORMAT)

/**
 * One line under the importer: what happened to the last import of this business and source.
 * The copy names what we know, never "unknown": a lost connection reads as "may still be
 * running" until `Check now` sees the menu grow (resolved) or sees no growth (failed).
 * Growth is reported as such, never as "completed" (only the server confirms that).
 */
export const ImportRunStatus = ({ run, runRef, onRetry }) => {
  const [, t] = useLanguage()
  const { loading, failed, refetch } = useBusinessMenuSnapshot(runRef?.businessId)

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
    <RunActionButton type='button' $muted onClick={handleDismiss}>
      {t('IMPORTER_RUN_DISMISS', 'Dismiss')}
    </RunActionButton>
  )

  const checkButton = (
    <RunActionButton type='button' onClick={handleCheck} disabled={loading}>
      {loading
        ? t('IMPORTER_RUN_CHECKING', 'Checking…')
        : t('IMPORTER_RUN_CHECK_NOW', 'Check now')}
    </RunActionButton>
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
          <RunActionButton type='button' onClick={onRetry}>
            {t('IMPORTER_RETRY', 'Retry')}
          </RunActionButton>
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
          <RunActionButton type='button' onClick={onRetry}>
            {t('IMPORTER_RETRY', 'Retry')}
          </RunActionButton>
          {dismissButton}
        </>
        )
      }
    : byStatus[run.status]?.()
  if (!view) return null

  return (
    <RunStatus data-testid='importer-run-status' data-tone={view.tone}>
      <RunStatusLine>
        <RunStatusDot $tone={view.tone} aria-hidden='true' />
        <RunStatusText $tone={view.tone}>{view.text}</RunStatusText>
      </RunStatusLine>
      {view.detail && <RunStatusText $tone='neutral' $block>{view.detail}</RunStatusText>}
      {view.actions && <RunActions>{view.actions}</RunActions>}
    </RunStatus>
  )
}

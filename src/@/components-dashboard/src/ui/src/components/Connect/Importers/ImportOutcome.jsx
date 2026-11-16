import React from 'react'
import { useUtils } from '../../../../../index'
import { CircleAlert, CircleCheck, LoaderCircle, WifiOff } from '../../Shared/Icon'
import { Button } from '../../Shared/Product'
import { useMenuImportRun } from './useMenuImportRun'
import { isRunResolved } from './menuImportRuns'
import { logStamp } from './importerLogsModel'
import { fillTemplate } from './fillTemplate'
import './importer-dialog.css'

/*
 * (main sync, 6f58d106): the run state of `main` for the redesigned import dialogs (MenuImportDialog, GloriaFoodImportDialog).
 * `main` shows an import as importing / success / failed / unknown (useMenuImport) and resumes a stored run after a reload
 * (useMenuImportRun). Same states, same i18n keys, same wording as MenuImportModal/ImportStatusView; the shell is the redesign's:
 * a verdict line (role=status), the detail under it, and the actions in the footer of P/Dialog (secondary first, primary last).
 * A failed import is not here: the dialogs keep it inline, in the form, as the redesign did (IM-03).
 */

/**
 * The state of the run as the dialog has to show it: the live status of the hook or, when the hook is idle, the run a previous
 * session left importing or unknown (a resolved one, or one that finished, is not shown again).
 */
export const useImportRunView = ({ project, businessId, source, status }) => {
  const runRef = { project, businessId, source }
  const storedRun = useMenuImportRun(runRef)
  const resumedStatus = status === 'idle' &&
    ['importing', 'unknown'].includes(storedRun?.status) &&
    !isRunResolved(storedRun)
    ? storedRun.status
    : null
  return { runRef, storedRun, viewStatus: resumedStatus || status }
}

/** The import is running: what it does and, when known, since when. */
export const ImportRunning = ({ message, startedAt }) => {
  // main shows the start with a fixed format ('MMM D, YYYY h:mm A'); the redesign paints it with the project's date format
  // (parseDate, decision 13), as ImporterLogs does. `startedAt` is an ISO instant: logStamp turns it into the Date parseDate reads.
  const [{ parseDate }] = useUtils()
  const startedAtDate = logStamp(startedAt)
  return (
    <div className='odc-imp-status' aria-live='polite'>
      <LoaderCircle className='odc-icon odc-imp-spinner' aria-hidden='true' />
      <div className='odc-imp-status-text'>
        <p>{message}</p>
        {startedAtDate && (
          <p className='odc-imp-hint'>
            <time dateTime={startedAt}>{parseDate(startedAtDate)}</time>
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * The verdict of a finished import (`success`, `unknown` or, for several stores, `partial`) and what to do about it. `result` is the
 * hook's, when there is one; `nameOf(id)` names a store of a `partial` result.
 */
export const ImportOutcome = ({ status, result, t, nameOf = String, storeCount = 1 }) => {
  // the service queued the import for several stores (or counted fewer than it was sent): it may still be running
  if (status === 'queued') {
    return (
      <div className='odc-imp-outcome'>
        <p className='odc-imp-success' data-tone='warning' role='status'>
          <LoaderCircle className='odc-icon' aria-hidden='true' />
          <span>{t('IMPORTER_STATUS_QUEUED_TITLE', 'The import is still running')}</span>
        </p>
        <p className='odc-imp-detail'>
          {fillTemplate(
            t('IMPORTER_STATUS_QUEUED_BODY', 'The menu is still being imported into {{count}} stores. Check the products in a few minutes before importing again.'),
            { count: result?.total ?? storeCount }
          )}
        </p>
      </div>
    )
  }

  if (status === 'partial' && result) {
    const pending = result.pending || []
    return (
      <div className='odc-imp-outcome'>
        <p className='odc-imp-success' data-tone='warning' role='status'>
          <CircleAlert className='odc-icon' aria-hidden='true' />
          <span>
            {fillTemplate(
              t('IMPORTER_PARTIAL_TITLE', 'Menu imported to {{applied}} of {{total}} stores'),
              { applied: result.appliedCount, total: result.total }
            )}
          </span>
        </p>
        {result.quotaMessage && <p className='odc-imp-detail'>{result.quotaMessage}</p>}
        {result.failed?.length > 0 && (
          <ul className='odc-imp-detail odc-imp-failures' aria-label={t('IMPORTER_PARTIAL_FAILED', 'Stores that failed')}>
            {result.failed.map(({ businessId, message }) => (
              <li key={businessId}><bdi className='odc-imp-store-name'>{nameOf(businessId)}</bdi>: {message}</li>
            ))}
          </ul>
        )}
        {pending.length > 0 && (
          <p className='odc-imp-detail'>
            {fillTemplate(
              pending.length === 1
                ? t('IMPORTER_PARTIAL_PENDING_ONE', '1 store was not imported: {{names}}')
                : t('IMPORTER_PARTIAL_PENDING', '{{count}} stores were not imported: {{names}}'),
              { count: pending.length, names: pending.map(nameOf).join(', ') }
            )}
          </p>
        )}
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className='odc-imp-outcome'>
        <p className='odc-imp-success' role='status'>
          <CircleCheck className='odc-icon' aria-hidden='true' />
          <span>{t('IMPORTER_STATUS_SUCCESS', 'Menu imported successfully')}</span>
        </p>
        {result && (
          <p className='odc-imp-detail'>
            {fillTemplate(
              t('IMPORTER_SUCCESS_APPLIED_COUNT', 'Menu imported to {{count}} store(s)'),
              { count: result.appliedCount ?? 0 }
            )}
          </p>
        )}
      </div>
    )
  }

  if (status === 'unknown') {
    return (
      <div className='odc-imp-outcome'>
        <p className='odc-imp-success' data-tone='warning' role='status'>
          <WifiOff className='odc-icon' aria-hidden='true' />
          <span>{t('IMPORTER_STATUS_UNKNOWN_TITLE', 'We lost the connection to the importer')}</span>
        </p>
        <p className='odc-imp-detail'>
          {t(
            'IMPORTER_STATUS_UNKNOWN_BODY',
            'The import may still be running on the server. Check the products in a few minutes before importing again.'
          )}
        </p>
        {/* several stores: Retry sends them all again, and some may already have the menu */}
        {storeCount > 1 && (
          <p className='odc-imp-detail'>
            {fillTemplate(
              t('IMPORTER_STATUS_UNKNOWN_STORES', 'Some of the {{count}} stores may already have the new menu. Retry imports it again into all of them.'),
              { count: storeCount }
            )}
          </p>
        )}
      </div>
    )
  }

  return null
}

/**
 * The footer of the outcome. The primary action takes `primaryRef` (it is where the focus goes). «Import another» only exists when the
 * hook confirmed the success (`onImportAnother`), as in main.
 */
export const ImportOutcomeActions = ({ status, t, primaryRef, onGoToProducts, onCheckProducts, onImportAnother, onRetry, onClose, retryCount = 0 }) => {
  // some stores did not get the menu; Retry sends only those
  if (status === 'partial') {
    return (
      <>
        <Button onClick={onClose}>{t('CLOSE', 'Close')}</Button>
        {retryCount > 0 && (
          <Button ref={primaryRef} variant='primary' onClick={onRetry}>
            {retryCount === 1
              ? t('IMPORTER_RETRY_ONE_STORE', 'Retry 1 store')
              : fillTemplate(t('IMPORTER_RETRY_STORES', 'Retry {{count}} stores'), { count: retryCount })}
          </Button>
        )}
      </>
    )
  }

  if (status === 'success') {
    return (
      <>
        {onImportAnother && (
          <Button onClick={onImportAnother}>{t('IMPORTER_IMPORT_ANOTHER', 'Import another menu')}</Button>
        )}
        <Button ref={primaryRef} variant='primary' onClick={onGoToProducts}>
          {t('IMPORTER_GO_TO_PRODUCTS', 'Go to products')}
        </Button>
      </>
    )
  }

  if (status === 'queued') {
    return (
      <>
        <Button onClick={onClose}>{t('CLOSE', 'Close')}</Button>
        <Button ref={primaryRef} variant='primary' onClick={onCheckProducts}>
          {t('IMPORTER_CHECK_PRODUCTS', 'Check products')}
        </Button>
      </>
    )
  }

  if (status === 'unknown') {
    return (
      <>
        <Button onClick={onRetry}>
          {retryCount > 1
            ? fillTemplate(t('IMPORTER_RETRY_STORES', 'Retry {{count}} stores'), { count: retryCount })
            : t('IMPORTER_RETRY', 'Retry')}
        </Button>
        <Button ref={primaryRef} variant='primary' onClick={onCheckProducts}>
          {t('IMPORTER_CHECK_PRODUCTS', 'Check products')}
        </Button>
      </>
    )
  }

  return null
}

import React, { useMemo, useRef, useState } from 'react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

import { useLanguage, useUtils } from '../../../../../index'
import { CircleAlert, Download, FileText, Trash2 } from '../../Shared/Icon'
import { Button, Checkbox, ConfirmDialog, EmptyState, Skeleton, Status } from '../../Shared/Product'
import { Field, focusFrameControl } from '../../Shared/Product/Field'
import { cardBySource, SOURCE_FILTERS, formatBytes, logStamp, selectionState, statusCopy, statusFamily, visibleSelection } from './importerLogsModel'
import { useImportRawLogs } from './useImportRawLogs'
import './importer-store-panel.css'

dayjs.extend(relativeTime)

const SKELETON_ROWS = 5

const LogsSkeleton = ({ label }) => (
  <div className='isp-skeleton' role='status' aria-busy='true' aria-label={label} data-testid='importers-logs-skeleton'>
    {Array.from({ length: SKELETON_ROWS }, (_, index) => (
      <div key={index} className='isp-skeleton-row'>
        <Skeleton shape='box' size='var(--od-x-icon-lg)' block='var(--od-x-icon-lg)' />
        <span className='isp-skeleton-text'>
          <Skeleton size='45%' />
          <Skeleton size='65%' />
        </span>
      </div>
    ))}
  </div>
)

/**
 * The Logs tab of the store panel of /connect/importers (redesign IM-B, , decision D4): the raw files the importer kept
 * for this store, in Product. It is `Connect/ImportersPanel/ImportRawLogsTab` of main with the same hook (`useImportRawLogs`, which
 * fetches, downloads and deletes, and gives the toasts) and the same words, plus: the filter is a select (IM-05, decision 35), the
 * error is readable and retries (IM-04), and the date is the project's with «ago» beside it (IM-06, decision 13).
 * redesign D-77 (owner, 2026-10-19): Delete asks first (C8, a Product ConfirmDialog); main deleted at once.
 *  - `business`: the row of the list; `onGoToImporters`: the way back from the empty state.
 */
export const ImporterLogs = ({ business, onGoToImporters }) => {
  const [, t] = useLanguage()
  const [{ parseDate }] = useUtils()
  const [sourceFilter, setSourceFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState([])
  const filterRef = useRef(null)
  const deleteRef = useRef(null)
  // `count` stays while the dialog fades out, so its title does not change when the selection clears
  const [asking, setAsking] = useState({ open: false, count: 0 })
  // Where the focus goes when the confirmation closes: the filter after a delete (the Delete button went off with the selection), else the Delete button
  const focusFilterOnClose = useRef(false)
  const {
    logs,
    loading,
    error,
    refetch,
    downloadLog,
    downloadingId,
    deleteLogs,
    deleting
  } = useImportRawLogs({
    businessId: business?.id,
    enabled: Boolean(business?.id)
  })

  const idsOf = (list) => list.map((log) => log.id).filter(Boolean)
  const filteredLogs = useMemo(
    () => (sourceFilter === 'all' ? logs : logs.filter((log) => log.source === sourceFilter)),
    [logs, sourceFilter]
  )
  const visibleIds = useMemo(() => idsOf(filteredLogs), [filteredLogs])
  // What counts as selected is what is visible: a log that left (the filter, a delete, a reload) is not selected any more
  const selected = useMemo(() => visibleSelection(selectedIds, visibleIds), [selectedIds, visibleIds])
  const allState = selectionState(selected, visibleIds)

  const changeFilter = (next) => {
    setSourceFilter(next)
    // as main: the selection is trimmed to what the new filter shows
    const nextVisible = idsOf(next === 'all' ? logs : logs.filter((log) => log.source === next))
    setSelectedIds((previous) => visibleSelection(previous, nextVisible))
  }

  const toggleAll = () => {
    if (allState === true) {
      setSelectedIds((previous) => previous.filter((id) => !visibleIds.includes(id)))
      return
    }
    setSelectedIds((previous) => [...new Set([...previous, ...visibleIds])])
  }

  const toggleOne = (id, checked) => {
    setSelectedIds((previous) => {
      if (checked) return previous.includes(id) ? previous : [...previous, id]
      return previous.filter((item) => item !== id)
    })
  }

  // redesign D-77 (owner, 2026-10-19): the Delete button only asks; the confirmation is what deletes
  const askDelete = () => {
    if (!selected.length || deleting) return
    focusFilterOnClose.current = false
    setAsking({ open: true, count: selected.length })
  }

  const handleDelete = async () => {
    if (!selected.length || deleting) return
    const result = await deleteLogs(selected)
    if (result?.deleted) {
      setSelectedIds((previous) => previous.filter((id) => !(result.ids || []).includes(id)))
      // the button that was pressed goes off with the selection: the focus stays in the tab, on the filter (when the dialog closes)
      focusFilterOnClose.current = true
    }
    setAsking((current) => ({ ...current, open: false }))
  }

  const { count } = asking
  const confirmCopy = count === 1
    ? {
        title: t('IMPORTER_LOGS_DELETE_TITLE_ONE', 'Delete 1 log?'),
        confirmLabel: t('IMPORTER_LOGS_DELETE_CONFIRM_ONE', 'Delete log')
      }
    : {
        title: t('IMPORTER_LOGS_DELETE_TITLE_OTHER', 'Delete _count_ logs?').replace('_count_', String(count)),
        confirmLabel: t('IMPORTER_LOGS_DELETE_CONFIRM_OTHER', 'Delete _count_ logs').replace('_count_', String(count))
      }

  const hasLogs = logs.length > 0
  const isGlobalEmpty = !loading && !error && !hasLogs
  const isFilterEmpty = !loading && !error && hasLogs && filteredLogs.length === 0
  const hasList = !loading && !error && filteredLogs.length > 0

  return (
    <div className='isp-logs' data-testid='importers-logs-tab'>
      <p className='isp-hint'>{t('IMPORTER_LOGS_CAPACITY_HINT', 'Keeping the latest 10 per importer')}</p>

      {/* IM-05 (decision 35): the filter is a native select inside a Product field; its 44px area on a phone is the part's */}
      <Field label={t('IMPORTERS_LOGS_FILTER_LABEL', 'Importer')} className='isp-filter'>
        <span className='isp-select-part' onMouseDown={(event) => focusFrameControl(event.currentTarget, event, 'select')}>
          <select
            ref={filterRef}
            className='isp-select'
            value={sourceFilter}
            onChange={(event) => changeFilter(event.target.value)}
            data-testid='importers-logs-filter'
          >
            {SOURCE_FILTERS.map((filter) => (
              <option key={filter.id} value={filter.id}>{t(filter.labelKey, filter.labelDefault)}</option>
            ))}
          </select>
        </span>
      </Field>

      {loading && <LogsSkeleton label={t('LOADING', 'Loading')} />}

      {/* redesign IM-04: the failure says what failed (the hook's message) and offers the retry */}
      {!loading && error && (
        <EmptyState
          tone='error'
          icon={CircleAlert}
          title={error.message || t('IMPORTER_LOGS_ERROR', 'Could not load import logs.')}
          action={<Button onClick={() => refetch?.()}>{t('TRY_AGAIN', 'Try again')}</Button>}
          data-testid='importers-logs-error'
        />
      )}

      {isGlobalEmpty && (
        <EmptyState
          icon={FileText}
          title={t('IMPORTER_LOGS_EMPTY_TITLE', 'No import logs yet')}
          description={t('IMPORTER_LOGS_EMPTY_BODY', 'After a successful import, the original source data is saved here so you can download and review it.')}
          action={(
            <>
              <ol className='isp-steps'>
                <li>{t('IMPORTER_LOGS_EMPTY_STEP_1', 'Run an import from the Importers tab.')}</li>
                <li>{t('IMPORTER_LOGS_EMPTY_STEP_2', 'Return here to download the latest file.')}</li>
              </ol>
              <Button variant='primary' onClick={onGoToImporters} data-testid='importers-logs-go-to-importers'>
                {t('IMPORTER_LOGS_GO_TO_IMPORTERS', 'Go to Importers')}
              </Button>
            </>
          )}
          data-testid='importers-logs-empty'
        />
      )}

      {isFilterEmpty && (
        <EmptyState
          title={t('IMPORTER_LOGS_FILTER_EMPTY', 'No logs match this importer filter.')}
          data-testid='importers-logs-filter-empty'
        />
      )}

      <ConfirmDialog
        open={asking.open}
        tone='danger'
        busy={deleting}
        title={confirmCopy.title}
        confirmLabel={confirmCopy.confirmLabel}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        finalFocus={() => (focusFilterOnClose.current ? filterRef.current : deleteRef.current)}
        onConfirm={handleDelete}
        onCancel={() => setAsking((current) => ({ ...current, open: false }))}
      >
        {t('IMPORTER_LOGS_DELETE_BODY', "Their source files can no longer be downloaded. This can't be undone.")}
      </ConfirmDialog>

      {hasList && (
        <>
          <div className='isp-bar' data-testid='importers-logs-selection-bar'>
            <Checkbox checked={allState} onCheckedChange={toggleAll} data-testid='importers-logs-select-all'>
              {t('IMPORTER_LOGS_SELECT_ALL', 'Select all')}
            </Checkbox>
            <span className='isp-count' role='status'>
              {selected.length > 0 && (
                <span data-testid='importers-logs-selected-count'>
                  {t('IMPORTER_LOGS_SELECTED_COUNT', '{{count}} selected').replace('{{count}}', String(selected.length))}
                </span>
              )}
            </span>
            <Button
              icon={Trash2}
              disabled={!selected.length || deleting}
              onClick={askDelete}
              ref={deleteRef}
              data-testid='importers-logs-delete-selected'
            >
              {deleting ? t('IMPORTER_LOGS_DELETING', 'Deleting…') : t('IMPORTER_LOGS_DELETE', 'Delete')}
            </Button>
          </div>

          <ul className='isp-log-list' data-testid='importers-logs-list'>
            {filteredLogs.map((log) => {
              const card = cardBySource[log.source]
              const downloadable = Boolean(log.downloadable)
              const downloading = downloadingId === log.id
              const isSelected = selected.includes(log.id)
              const stamp = logStamp(log.createdAt)
              return (
                <li
                  key={log.id}
                  className='isp-log'
                  data-selected={isSelected ? '' : undefined}
                  data-testid={`importers-log-row-${log.id}`}
                >
                  <span className='isp-log-select'>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => toggleOne(log.id, checked)}
                      label={t('IMPORTER_LOGS_SELECT_ROW', 'Select log')}
                      data-testid={`importers-log-select-${log.id}`}
                    />
                  </span>
                  <span className='isp-logo' style={card ? { background: card.logoColor } : undefined} aria-hidden='true'>
                    {card?.logoLabel || (log.source || '?').slice(0, 2).toUpperCase()}
                  </span>
                  <div className='isp-log-main'>
                    <p className='isp-log-name'>{card ? t(card.titleKey, card.titleDefault) : log.source}</p>
                    {/* redesign IM-06 (decision 13): the project's date format, and «ago» beside it */}
                    <p className='isp-log-meta'>
                      <span>
                        {stamp ? <time dateTime={log.createdAt}>{parseDate(stamp)}</time> : '—'}
                      </span>
                      {stamp && (
                        <>
                          <span aria-hidden='true'>·</span>
                          <span>{dayjs(log.createdAt).fromNow()}</span>
                        </>
                      )}
                    </p>
                    <p className='isp-log-meta'>
                      <span>{formatBytes(log.compressedBytes)}{' / '}{formatBytes(log.uncompressedBytes)}</span>
                    </p>
                  </div>
                  <span className='isp-log-status'>
                    <Status family={statusFamily(log.status)} label={statusCopy(log.status, t)} wrap />
                  </span>
                  <Button
                    className='isp-log-download'
                    icon={Download}
                    disabled={!downloadable || downloading}
                    title={downloadable ? t('IMPORTER_LOGS_DOWNLOAD', 'Download') : t('IMPORTER_LOGS_DOWNLOAD_UNAVAILABLE', 'Download unavailable')}
                    onClick={() => downloadLog(log)}
                    data-testid={`importers-log-download-${log.id}`}
                  >
                    {downloading ? t('IMPORTER_LOGS_DOWNLOADING', 'Downloading…') : t('IMPORTER_LOGS_DOWNLOAD', 'Download')}
                  </Button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

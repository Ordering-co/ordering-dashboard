import React, { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { Download, FileEarmarkArrowDown, Trash } from 'react-bootstrap-icons'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { useLanguage } from '../../../../../index'
import { Button, Checkbox } from '../../../styles'
import { DragScroll } from '../../Shared'
import { IMPORTER_CARDS } from '../Importers/importerCards'
import { useImportRawLogs } from '../Importers/useImportRawLogs'

import {
  CapacityHint,
  EmptyLogs,
  FilterChip,
  FilterRow,
  FilterScrollWrap,
  ImporterLogo,
  LogMeta,
  LogRow,
  LogRowMain,
  LogRowSelect,
  LogsDeleteButton,
  LogsEmptyBody,
  LogsEmptyIcon,
  LogsEmptyState,
  LogsEmptySteps,
  LogsEmptyTitle,
  LogsFilterEmpty,
  LogsSelectionBar,
  LogsSelectionCount,
  LogsSelectionLabel,
  LogsSelectionLeft,
  LogsSkeletonList,
  LogsSkeletonMain,
  LogsSkeletonRow,
  LogStatus,
  LogsList
} from './styles'

dayjs.extend(relativeTime)

const SOURCE_FILTERS = [
  { id: 'all', labelKey: 'IMPORTER_LOGS_FILTER_ALL', labelDefault: 'All' },
  ...IMPORTER_CARDS.map((card) => ({
    id: card.id,
    labelKey: card.titleKey,
    labelDefault: card.titleDefault
  }))
]

const SKELETON_ROW_COUNT = 5

const cardBySource = Object.fromEntries(IMPORTER_CARDS.map((card) => [card.id, card]))

const formatBytes = (value) => {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const n = Number(value)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

const statusCopy = (status, t) => {
  switch (status) {
    case 'ready':
      return t('IMPORTER_LOGS_STATUS_READY', 'Ready')
    case 'skipped_too_large':
      return t('IMPORTER_LOGS_STATUS_SKIPPED_TOO_LARGE', 'Too large')
    case 'skipped_duplicate':
      return t('IMPORTER_LOGS_STATUS_SKIPPED_DUPLICATE', 'Duplicate')
    case 'failed':
      return t('IMPORTER_LOGS_STATUS_FAILED', 'Failed')
    default:
      return status || '—'
  }
}

const LogsSkeletonRows = () => (
  <LogsSkeletonList data-testid='importers-logs-skeleton'>
    {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
      <LogsSkeletonRow key={index} data-testid={`importers-logs-skeleton-row-${index}`}>
        <LogsSkeletonMain>
          <Skeleton circle width={40} height={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Skeleton width='45%' height={14} style={{ marginBottom: 8 }} />
            <Skeleton width='65%' height={12} style={{ marginBottom: 6 }} />
            <Skeleton width={56} height={11} />
          </div>
        </LogsSkeletonMain>
        <Skeleton width={108} height={40} borderRadius={8} />
      </LogsSkeletonRow>
    ))}
  </LogsSkeletonList>
)

const LogsEmptyPanel = ({ t, onGoToImporters }) => (
  <LogsEmptyState data-testid='importers-logs-empty'>
    <LogsEmptyIcon aria-hidden='true'>
      <FileEarmarkArrowDown size={22} />
    </LogsEmptyIcon>
    <LogsEmptyTitle>
      {t('IMPORTER_LOGS_EMPTY_TITLE', 'No import logs yet')}
    </LogsEmptyTitle>
    <LogsEmptyBody>
      {t(
        'IMPORTER_LOGS_EMPTY_BODY',
        'After a successful import, the original source data is saved here so you can download and review it.'
      )}
    </LogsEmptyBody>
    <LogsEmptySteps>
      <li data-step='1'>
        {t('IMPORTER_LOGS_EMPTY_STEP_1', 'Run an import from the Importers tab.')}
      </li>
      <li data-step='2'>
        {t('IMPORTER_LOGS_EMPTY_STEP_2', 'Return here to download the latest file.')}
      </li>
    </LogsEmptySteps>
    <Button
      color='primary'
      borderRadius='8px'
      onClick={onGoToImporters}
      data-testid='importers-logs-go-to-importers'
    >
      {t('IMPORTER_LOGS_GO_TO_IMPORTERS', 'Go to Importers')}
    </Button>
  </LogsEmptyState>
)

export const ImportRawLogsTab = ({ business, onGoToImporters }) => {
  const [, t] = useLanguage()
  const [sourceFilter, setSourceFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState([])
  const {
    logs,
    loading,
    error,
    downloadLog,
    downloadingId,
    deleteLogs,
    deleting
  } = useImportRawLogs({
    businessId: business?.id,
    enabled: Boolean(business?.id)
  })

  const filteredLogs = useMemo(() => {
    if (sourceFilter === 'all') return logs
    return logs.filter((log) => log.source === sourceFilter)
  }, [logs, sourceFilter])

  const filteredLogIds = useMemo(
    () => filteredLogs.map((log) => log.id).filter(Boolean),
    [filteredLogs]
  )

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => filteredLogIds.includes(id)))
  }, [filteredLogIds])

  const selectedCount = selectedIds.length
  const allVisibleSelected = filteredLogIds.length > 0 &&
    filteredLogIds.every((id) => selectedIds.includes(id))
  const someVisibleSelected = filteredLogIds.some((id) => selectedIds.includes(id))

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredLogIds.includes(id)))
      return
    }
    setSelectedIds((prev) => [...new Set([...prev, ...filteredLogIds])])
  }

  const toggleSelectOne = (logId, checked) => {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(logId) ? prev : [...prev, logId]
      return prev.filter((id) => id !== logId)
    })
  }

  const handleDeleteSelected = async () => {
    if (!selectedIds.length || deleting) return
    const result = await deleteLogs(selectedIds)
    if (result?.deleted) {
      setSelectedIds((prev) => prev.filter((id) => !(result.ids || []).includes(id)))
    }
  }

  const hasLogs = logs.length > 0
  const isFilterEmpty = !loading && !error && hasLogs && filteredLogs.length === 0
  const isGlobalEmpty = !loading && !error && !hasLogs

  return (
    <div data-testid='importers-logs-tab'>
      <CapacityHint>
        {t('IMPORTER_LOGS_CAPACITY_HINT', 'Keeping the latest 10 per importer')}
      </CapacityHint>

      <FilterScrollWrap data-testid='importers-logs-filters-scroll'>
        <DragScroll>
          <FilterRow data-testid='importers-logs-filters'>
            {SOURCE_FILTERS.map((filter) => (
              <FilterChip
                key={filter.id}
                type='button'
                $active={sourceFilter === filter.id}
                onClick={() => setSourceFilter(filter.id)}
                data-testid={`importers-logs-filter-${filter.id}`}
              >
                {t(filter.labelKey, filter.labelDefault)}
              </FilterChip>
            ))}
          </FilterRow>
        </DragScroll>
      </FilterScrollWrap>

      {loading && <LogsSkeletonRows />}

      {!loading && error && (
        <EmptyLogs data-testid='importers-logs-error'>
          {error.message || t('IMPORTER_LOGS_ERROR', 'Could not load import logs.')}
        </EmptyLogs>
      )}

      {!loading && !error && isGlobalEmpty && (
        <LogsEmptyPanel t={t} onGoToImporters={onGoToImporters} />
      )}

      {!loading && !error && isFilterEmpty && (
        <LogsFilterEmpty data-testid='importers-logs-filter-empty'>
          {t('IMPORTER_LOGS_FILTER_EMPTY', 'No logs match this importer filter.')}
        </LogsFilterEmpty>
      )}

      {!loading && !error && filteredLogs.length > 0 && (
        <>
          <LogsSelectionBar data-testid='importers-logs-selection-bar'>
            <LogsSelectionLeft>
              <Checkbox
                checked={allVisibleSelected}
                ref={(input) => {
                  if (input) input.indeterminate = someVisibleSelected && !allVisibleSelected
                }}
                onChange={toggleSelectAll}
                aria-label={t('IMPORTER_LOGS_SELECT_ALL', 'Select all')}
                data-testid='importers-logs-select-all'
              />
              <LogsSelectionLabel
                type='button'
                onClick={toggleSelectAll}
                data-testid='importers-logs-select-all-label'
              >
                {t('IMPORTER_LOGS_SELECT_ALL', 'Select all')}
              </LogsSelectionLabel>
              {selectedCount > 0 && (
                <LogsSelectionCount data-testid='importers-logs-selected-count'>
                  {t('IMPORTER_LOGS_SELECTED_COUNT', '{{count}} selected').replace(
                    '{{count}}',
                    String(selectedCount)
                  )}
                </LogsSelectionCount>
              )}
            </LogsSelectionLeft>
            <LogsDeleteButton
              color='secondary'
              borderRadius='8px'
              disabled={!selectedCount || deleting}
              onClick={handleDeleteSelected}
              data-testid='importers-logs-delete-selected'
            >
              <Trash size={14} style={{ marginRight: 6 }} />
              {deleting
                ? t('IMPORTER_LOGS_DELETING', 'Deleting…')
                : t('IMPORTER_LOGS_DELETE', 'Delete')}
            </LogsDeleteButton>
          </LogsSelectionBar>

          <LogsList data-testid='importers-logs-list'>
            {filteredLogs.map((log, index) => {
              const card = cardBySource[log.source]
              const downloadable = Boolean(log.downloadable)
              const isDownloading = downloadingId === log.id
              const isSelected = selectedIds.includes(log.id)
              return (
                <LogRow
                  key={log.id}
                  data-testid={`importers-log-row-${log.id}`}
                  $selected={isSelected}
                  style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                >
                  <LogRowSelect>
                    <Checkbox
                      checked={isSelected}
                      onChange={(event) => toggleSelectOne(log.id, event.target.checked)}
                      aria-label={t('IMPORTER_LOGS_SELECT_ROW', 'Select log')}
                      data-testid={`importers-log-select-${log.id}`}
                    />
                  </LogRowSelect>
                  <LogRowMain>
                    <ImporterLogo $color={card?.logoColor || '#909BA9'} aria-hidden='true'>
                      {card?.logoLabel || (log.source || '?').slice(0, 2).toUpperCase()}
                    </ImporterLogo>
                    <div>
                      <p className='title'>
                        {card
                          ? t(card.titleKey, card.titleDefault)
                          : log.source}
                      </p>
                      <LogMeta>
                        <span>
                          {log.createdAt
                            ? dayjs(log.createdAt).fromNow()
                            : '—'}
                        </span>
                        <span aria-hidden='true'>·</span>
                        <span>
                          {formatBytes(log.compressedBytes)}
                          {' / '}
                          {formatBytes(log.uncompressedBytes)}
                        </span>
                      </LogMeta>
                      <LogStatus $tone={log.status}>
                        {statusCopy(log.status, t)}
                      </LogStatus>
                    </div>
                  </LogRowMain>
                  <Button
                    color='primary'
                    borderRadius='8px'
                    disabled={!downloadable || isDownloading}
                    title={
                      downloadable
                        ? t('IMPORTER_LOGS_DOWNLOAD', 'Download')
                        : t('IMPORTER_LOGS_DOWNLOAD_UNAVAILABLE', 'Download unavailable')
                    }
                    onClick={() => downloadLog(log)}
                    data-testid={`importers-log-download-${log.id}`}
                  >
                    <Download size={14} style={{ marginRight: 6 }} />
                    {isDownloading
                      ? t('IMPORTER_LOGS_DOWNLOADING', 'Downloading…')
                      : t('IMPORTER_LOGS_DOWNLOAD', 'Download')}
                  </Button>
                </LogRow>
              )
            })}
          </LogsList>
        </>
      )}
    </div>
  )
}

import React from 'react'

import { BuilderAppBuilds as BuilderAppBuildsController, useLanguage } from '../../../../../index'
import { CircleAlert, History } from '../../Shared/Icon'
import { Button, DataTable, EmptyState, Pagination, SelectField } from '../../Shared/Product'
import {
  BUILD_STATUS_FILTERS,
  getBuildFailureText,
  getBuildModeLabel,
  getPlatformLabel,
  getReplacedBuildIds,
  getRequesterLabel,
  isBuildCancellable
} from '../utils'
import { BuildPill, DATE_TIME } from './BuildsCard'
import './builder-builds.css'

export { BuilderBuildsCard } from './BuildsCard'
export { useBuildActions } from './useBuildActions'

// redesign B2: the Builds tab on P/SelectField (the same values and labels as main's native selects), P/DataTable,
// P/EmptyState and P/Pagination. Same controller, filters, states, row actions and conditions as main.

const SKELETON_ROWS = 4 // main drew 4 loading rows

// «Showing _from_–_to_ of _total_» with each number in its own node
const fill = (template, values) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{values[name]}</React.Fragment> : part
})

const BuildHistoryUI = (props) => {
  const {
    historyState,
    reloadHistory,
    filters,
    changeFilters,
    page,
    pageSize,
    changePage,
    platformOrder,
    productStatus,
    actions,
    formatDate
  } = props
  const [, t] = useLanguage()
  const { loading, builds, pagination, error } = historyState
  const replaced = getReplacedBuildIds(builds)
  const statusFilter = BUILD_STATUS_FILTERS.find(item => item.statuses.join(',') === filters.statuses.join(','))?.value || ''
  const filtered = !!filters.platform || filters.statuses.length > 0
  const totalPages = Number(pagination?.total_pages) || 0
  const total = Number(pagination?.total)
  // a total that can fill the pages the API counts (api-core sends one through its common paginator)
  const knownTotal = total > (totalPages - 1) * pageSize
  const allLabel = t('BUILDER_FILTER_ALL', 'All')

  const changeStatusFilter = (value) => {
    const option = BUILD_STATUS_FILTERS.find(item => item.value === value)
    changeFilters({ statuses: option ? option.statuses : [] })
  }

  const columns = [
    { id: 'platform', header: t('BUILDER_PLATFORM', 'Platform'), cell: build => getPlatformLabel(build.platform) },
    { id: 'build', header: t('BUILDER_BUILD', 'Build'), cell: build => getBuildModeLabel(build, t) },
    { id: 'version', header: t('BUILDER_VERSION', 'Version'), cell: build => build.app_version || '—' },
    {
      id: 'status',
      header: t('BUILDER_STATUS', 'Status'),
      wrap: true,
      cell: build => (
        <div className='odc-bb-status'>
          <span>
            <BuildPill status={build.status} />
            {build.retry_of_id && (
              <span className='odc-bb-muted'>{t('BUILDER_RETRY_NUMBER', 'Retry _number_').replace('_number_', build.retry_number || 1)}</span>
            )}
          </span>
          {build.status === 'failed' && <small>{getBuildFailureText(build, t)}</small>}
        </div>
      )
    },
    { id: 'requested', header: t('BUILDER_REQUESTED_BY_COLUMN', 'Requested by'), cell: build => getRequesterLabel(build.requested_by_type, t) },
    { id: 'date', header: t('BUILDER_DATE', 'Date'), cell: build => <span className='odc-bb-nowrap'>{formatDate(build.created_at, DATE_TIME)}</span> },
    {
      id: 'actions',
      header: null,
      srHeader: t('ACTIONS', 'Actions'),
      align: 'end',
      cell: build => (
        <div className='odc-bb-row-actions'>
          <Button variant='link' size='sm' onClick={() => actions.openLog(build)}>{t('BUILDER_LOG', 'Log')}</Button>
          {isBuildCancellable(build) && (
            <Button variant='link' size='sm' onClick={() => actions.askCancel(build)}>{t('CANCEL', 'Cancel')}</Button>
          )}
          {build.retryable && productStatus !== 'archived' && (
            <Button variant='link' size='sm' onClick={() => actions.askRetry(build)}>{t('BUILDER_RETRY_BUILD', 'Retry')}</Button>
          )}
          {build.status === 'successful' && !replaced.has(build.id) && (
            <Button variant='link' size='sm' disabled={actions.downloadingId === build.id} onClick={() => actions.download(build)}>
              {actions.downloadingId === build.id ? t('BUILDER_DOWNLOAD_PREPARING', 'Preparing…') : t('BUILDER_DOWNLOAD', 'Download')}
            </Button>
          )}
        </div>
      )
    }
  ]

  const renderBody = () => {
    if (error) {
      return (
        <EmptyState
          tone='error'
          icon={CircleAlert}
          titleAs='h2'
          title={t('BUILDER_BUILDS_HISTORY_ERROR', 'We couldn’t load the builds')}
          description={t('BUILDER_LOAD_ERROR_HELP', 'Check your connection and try again.')}
          action={<Button variant='primary' onClick={reloadHistory}>{t('BUILDER_RETRY', 'Try again')}</Button>}
        />
      )
    }
    if (!loading && !builds.length) {
      return (
        <EmptyState
          icon={History}
          titleAs='h2'
          title={filtered
            ? t('BUILDER_BUILDS_NO_MATCH', 'No builds match these filters')
            : t('BUILDER_BUILDS_EMPTY', 'No builds yet')}
          description={filtered ? null : t('BUILDER_BUILDS_EMPTY_HELP', 'Build from the card above.')}
        />
      )
    }
    return (
      <DataTable
        label={t('BUILDER_BUILDS_HISTORY', 'Build history')}
        columns={columns}
        rows={builds}
        getRowId={build => build.id}
        // main: skeleton rows only before the first rows; a reload keeps the rows (the section says it is busy)
        loading={loading && !builds.length}
        loadingLabel={t('LOADING', 'Loading')}
        skeletonRows={SKELETON_ROWS}
      />
    )
  }

  return (
    <section className='odc-root odc-bb-history' aria-label={t('BUILDER_BUILDS_HISTORY', 'Build history')} aria-busy={loading ? 'true' : 'false'}>
      <div className='odc-bb-filters'>
        <SelectField
          label={t('BUILDER_PLATFORM', 'Platform')}
          value={filters.platform || ''}
          onValueChange={(value) => changeFilters({ platform: value || null })}
          options={[
            { value: '', label: allLabel },
            ...platformOrder.map(platform => ({ value: platform, label: getPlatformLabel(platform) }))
          ]}
        />
        <SelectField
          label={t('BUILDER_STATUS', 'Status')}
          value={statusFilter}
          onValueChange={changeStatusFilter}
          options={[
            { value: '', label: allLabel },
            ...BUILD_STATUS_FILTERS.map(option => ({ value: option.value, label: option.label(t) }))
          ]}
        />
      </div>
      {renderBody()}
      {totalPages > 1 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          // main's numbered pages needed total_pages alone: without a total that fills them, the last page comes from
          // total_pages (so the page field stays) and the range below makes up no «of N» (review of #433)
          total={knownTotal ? total : totalPages * pageSize}
          onPageChange={changePage}
          busy={loading}
          label={t('PAGINATION', 'Pagination')}
          previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
          nextLabel={t('NEXT_PAGE', 'Next page')}
          // main's numbered pages let you jump to any page: the page field keeps that
          showPageInput
          pageLabel={t('PAGE', 'Page')}
          pageOfLabel={(count, figureOf) => fill(t('PAGE_OF_TOTAL', 'of _total_'), { total: figureOf(count) })}
          // without a real total: the range alone, and never past the rows on screen
          rangeLabel={(from, to, count, figureOf) => knownTotal
            ? fill(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from: figureOf(from), to: figureOf(to), total: figureOf(count) })
            : <>{figureOf(from)}–{figureOf(builds.length ? Math.min(to, from + builds.length - 1) : to)}</>}
          pageStatusLabel={(current, pages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(pages ?? totalPages))}
        />
      )}
    </section>
  )
}

/** The Builds tab: every attempt of the app, newest first. */
export const BuilderAppBuildsHistory = (props) => (
  <BuilderAppBuildsController {...props} UIComponent={BuildHistoryUI} />
)

import React from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { ClockHistory, ExclamationCircle } from 'react-bootstrap-icons'

import { BuilderAppBuilds as BuilderAppBuildsController, useLanguage } from '../../../../../index'
import { Button } from '../../../styles'
import { Pagination } from '../../Shared'
import { BuilderMessage } from '../BuilderShared'
import {
  BUILD_STATUS_FILTERS,
  getBuildFailureText,
  getBuildKind,
  getBuildModeLabel,
  getBuildStatusLabel,
  getPlatformLabel,
  getReplacedBuildIds,
  getRequesterLabel,
  isBuildCancellable
} from '../utils'
import {
  HistoryFilters,
  HistoryMessage,
  LinkButton,
  MutedText,
  PaginationWrapper,
  Pill,
  RowActions,
  StatusCell,
  Table,
  TableCard
} from '../styles'

export { BuilderBuildsCard } from './BuildsCard'
export { useBuildActions } from './useBuildActions'

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

  const changeStatusFilter = (value) => {
    const option = BUILD_STATUS_FILTERS.find(item => item.value === value)
    changeFilters({ statuses: option ? option.statuses : [] })
  }

  const renderBody = () => {
    if (error) {
      return (
        <HistoryMessage>
          <BuilderMessage
            role='alert'
            tone='error'
            icon={<ExclamationCircle aria-hidden='true' />}
            title={t('BUILDER_BUILDS_HISTORY_ERROR', 'We couldn’t load the builds')}
            text={t('BUILDER_LOAD_ERROR_HELP', 'Check your connection and try again.')}
          >
            <Button color='primary' borderRadius='8px' onClick={reloadHistory}>{t('BUILDER_RETRY', 'Try again')}</Button>
          </BuilderMessage>
        </HistoryMessage>
      )
    }
    if (loading && !builds.length) {
      return <div aria-busy='true' style={{ padding: '0 20px 20px' }}><Skeleton count={4} height={44} style={{ marginBottom: 8 }} /></div>
    }
    if (!builds.length) {
      return (
        <HistoryMessage>
          <BuilderMessage
            icon={<ClockHistory aria-hidden='true' />}
            title={filtered
              ? t('BUILDER_BUILDS_NO_MATCH', 'No builds match these filters')
              : t('BUILDER_BUILDS_EMPTY', 'No builds yet')}
            text={filtered ? null : t('BUILDER_BUILDS_EMPTY_HELP', 'Build from the card above.')}
          />
        </HistoryMessage>
      )
    }
    return (
      <Table aria-busy={loading ? 'true' : 'false'}>
        <thead>
          <tr>
            <th scope='col'>{t('BUILDER_PLATFORM', 'Platform')}</th>
            <th scope='col'>{t('BUILDER_BUILD', 'Build')}</th>
            <th scope='col'>{t('BUILDER_VERSION', 'Version')}</th>
            <th scope='col'>{t('BUILDER_STATUS', 'Status')}</th>
            <th scope='col'>{t('BUILDER_REQUESTED_BY_COLUMN', 'Requested by')}</th>
            <th scope='col'>{t('BUILDER_DATE', 'Date')}</th>
            <th scope='col'><span className='sr-only'>{t('ACTIONS', 'Actions')}</span></th>
          </tr>
        </thead>
        <tbody>
          {builds.map(build => (
            <tr key={build.id} style={{ cursor: 'default' }}>
              <td>{getPlatformLabel(build.platform)}</td>
              <td>{getBuildModeLabel(build, t)}</td>
              <td>{build.app_version || '—'}</td>
              <td>
                <StatusCell>
                  <span>
                    <Pill kind={getBuildKind(build.status)}>{getBuildStatusLabel(build.status, t)}</Pill>
                    {build.retry_of_id && (
                      <MutedText small>{t('BUILDER_RETRY_NUMBER', 'Retry _number_').replace('_number_', build.retry_number || 1)}</MutedText>
                    )}
                  </span>
                  {build.status === 'failed' && <small>{getBuildFailureText(build, t)}</small>}
                </StatusCell>
              </td>
              <td>{getRequesterLabel(build.requested_by_type, t)}</td>
              <td style={{ whiteSpace: 'nowrap' }}>{formatDate(build.created_at, 'MMM D, YYYY h:mm A')}</td>
              <td>
                <RowActions>
                  <LinkButton type='button' onClick={() => actions.openLog(build)}>{t('BUILDER_LOG', 'Log')}</LinkButton>
                  {isBuildCancellable(build) && (
                    <LinkButton type='button' onClick={() => actions.askCancel(build)}>{t('CANCEL', 'Cancel')}</LinkButton>
                  )}
                  {build.retryable && productStatus !== 'archived' && (
                    <LinkButton type='button' onClick={() => actions.askRetry(build)}>{t('BUILDER_RETRY_BUILD', 'Retry')}</LinkButton>
                  )}
                  {build.status === 'successful' && !replaced.has(build.id) && (
                    <LinkButton type='button' disabled={actions.downloadingId === build.id} onClick={() => actions.download(build)}>
                      {actions.downloadingId === build.id ? t('BUILDER_DOWNLOAD_PREPARING', 'Preparing…') : t('BUILDER_DOWNLOAD', 'Download')}
                    </LinkButton>
                  )}
                </RowActions>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    )
  }

  return (
    <TableCard as='section' aria-label={t('BUILDER_BUILDS_HISTORY', 'Build history')} style={{ maxWidth: 1100 }}>
      <HistoryFilters>
        <label>
          {t('BUILDER_PLATFORM', 'Platform')}
          <select value={filters.platform || ''} onChange={(e) => changeFilters({ platform: e.target.value || null })}>
            <option value=''>{t('BUILDER_FILTER_ALL', 'All')}</option>
            {platformOrder.map(platform => <option key={platform} value={platform}>{getPlatformLabel(platform)}</option>)}
          </select>
        </label>
        <label>
          {t('BUILDER_STATUS', 'Status')}
          <select value={statusFilter} onChange={(e) => changeStatusFilter(e.target.value)}>
            <option value=''>{t('BUILDER_FILTER_ALL', 'All')}</option>
            {BUILD_STATUS_FILTERS.map(option => <option key={option.value} value={option.value}>{option.label(t)}</option>)}
          </select>
        </label>
      </HistoryFilters>
      {renderBody()}
      {totalPages > 1 && (
        <PaginationWrapper>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            handleChangePage={changePage}
            defaultPageSize={pageSize}
            isHidePagecontrol
          />
        </PaginationWrapper>
      )}
    </TableCard>
  )
}

/** The Builds tab: every attempt of the app, newest first. */
export const BuilderAppBuildsHistory = (props) => (
  <BuilderAppBuildsController {...props} UIComponent={BuildHistoryUI} />
)

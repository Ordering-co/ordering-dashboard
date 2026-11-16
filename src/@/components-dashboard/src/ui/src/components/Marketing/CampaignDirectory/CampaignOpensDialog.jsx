import React, { useState } from 'react'

import { CampaignUserList as CampaignUserListController, useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { DataTable, Dialog, EmptyState, Pagination } from '../../Shared/Product'
import { Mail, TriangleAlert } from '../../Shared/Icon'
import './campaigns-table.css'

// redesign CA-B4 (decision 2; defect M-CA8): the people who opened a campaign, in a Product Dialog (it was a legacy Modal with a
// hand-made table). The controller (`K/CampaignUserList`) fetches `/marketing_campaigns/:id/users` once, when the dialog opens;
// this draws what it gives (`userListState`). Same filter as today (only the users with `open_at`) and the same client-side
// pagination (10 per page). Today's third column always read 1 (the list keeps only users with `open_at`), so it carries no
// information and is gone.

const PAGE_SIZES = [10, 25, 50]
const DEFAULT_PAGE_SIZE = 10
const SKELETON_ROWS = 8 // as today

// «Showing _from_–_to_ of _total_»: the numbers become .odc-figure nodes (decision 11) and keep their direction in RTL
const fillTemplate = (template, values, figure) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{figure(values[name])}</React.Fragment> : part
})

const errorText = (t, error) => {
  const first = (Array.isArray(error) ? error.flat(Infinity) : [error])
    .map(item => (typeof item === 'string' ? item : item?.message))
    .find(Boolean)
  return translateApiMessage(t, first, undefined)
}

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))

const OpensList = ({ userListState }) => {
  const [, t] = useLanguage()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const loading = Boolean(userListState?.loading)
  const error = userListState?.error
  const opened = (userListState?.users || []).filter(entry => entry?.open_at)
  const lastPage = Math.max(1, Math.ceil(opened.length / pageSize))
  const shown = Math.min(page, lastPage)
  const rows = opened
    .slice((shown - 1) * pageSize, shown * pageSize)
    .map((entry, index) => ({ ...entry, rowKey: (shown - 1) * pageSize + index }))

  if (!loading && hasError(error)) {
    return (
      <EmptyState
        tone='error'
        icon={TriangleAlert}
        title={t('CAMPAIGNS_OPENS_ERROR', "We couldn't load the opens.")}
        description={errorText(t, error)}
      />
    )
  }

  const na = t('NA', 'N/A')
  const columns = [
    { id: 'user', header: t('USER', 'User'), rowHeader: true, wrap: true, skeleton: { lines: 1 }, cell: entry => <span dir='auto'>{entry?.user?.name || na}</span> },
    { id: 'email', header: t('EMAIL_ADDRESS', 'Email Address'), wrap: true, skeleton: { lines: 1 }, cell: entry => <span dir='auto' className='odc-campaign-opens-email'>{entry?.user?.email || na}</span> }
  ]

  return (
    <div className='odc-campaign-opens'>
      <DataTable
        label={t('CAMPAIGNS_OPENS_LIST', 'Opens list')}
        columns={columns}
        rows={rows}
        getRowId={entry => entry.rowKey}
        loading={loading}
        loadingLabel={t('CAMPAIGNS_OPENS_LOADING', 'Loading opens')}
        skeletonRows={SKELETON_ROWS}
        empty={<EmptyState icon={Mail} title={t('CAMPAIGNS_OPENS_EMPTY', 'No opens yet')} />}
      />
      {!loading && opened.length > 0 && (
        <div className='odc-campaign-opens-foot'>
          <Pagination
            page={shown}
            pageSize={pageSize}
            total={opened.length}
            pageSizeOptions={PAGE_SIZES}
            onPageChange={setPage}
            onPageSizeChange={(size, nextPage) => {
              setPageSize(size)
              setPage(nextPage)
            }}
            label={t('PAGINATION', 'Pagination')}
            previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
            nextLabel={t('NEXT_PAGE', 'Next page')}
            pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
            rangeLabel={(from, to, total, figure) => fillTemplate(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from, to, total }, figure)}
            pageStatusLabel={(current, total) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(total))}
          />
        </div>
      )}
    </div>
  )
}

/**
 * The opens of one campaign. `campaign` is the row (its `id` and `name`); `open` / `onOpenChange(open)` are the host's.
 * The controller mounts only while the dialog is open, so nothing is fetched until the person asks, and every opening
 * fetches again (the count of the row may have moved).
 */
export const CampaignOpensDialog = ({ campaign, open = false, onOpenChange }) => {
  const [, t] = useLanguage()
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size='md'
      title={t('CAMPAIGNS_OPENS_TITLE', 'Opens · _name_').replace('_name_', campaign?.name ?? '')}
      closeLabel={t('CLOSE', 'Close')}
    >
      {open && campaign && (
        <CampaignUserListController
          key={campaign.id}
          campaignId={campaign.id}
          isOpens
          UIComponent={OpensList}
        />
      )}
    </Dialog>
  )
}

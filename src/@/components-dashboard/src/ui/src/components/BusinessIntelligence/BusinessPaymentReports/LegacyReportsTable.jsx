import React from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { DataTable, EmptyState, Pagination } from '../../Shared/Product'
import { Inbox, RefreshCw, TriangleAlert } from '../../Shared/Icon'
import { figure, fillTemplate } from '../AnalyticsKit/reportPillParts'
import './store-reports.css'
import { formatAmount } from '../../../../../utils/businessPayments'

// redesign business-payments FC1 (D4, D9, D11): the legacy (EatStreet) reports of the store, as `main` has them (`BPR:860-923`) in
// a Product `DataTable`. D4 leaves this table as it was: the columns keep their names and their keys («Prepaid total», «Deposit
// amount»). D7 only changes the invoices, so on a phone the table keeps all its columns and scrolls sideways like `main`'s.
// It fetches nothing: `legacy` is the controller's (import, list, page) and `legacyDetail` opens the panel of a report.

const PAGE_SIZES = [10, 25, 50] // the options of `main`'s Shared/UI Pagination
const SKELETON_ROWS = 3

const sameId = (a, b) => a != null && b != null && String(a) === String(b)

// the first text of an API error, which comes as a string, a list of them or `{ message }`
const firstMessage = (error) => (Array.isArray(error) ? error : [error]).map(item => (typeof item === 'string' ? item : item?.message)).find(Boolean)

export const LegacyReportsTable = ({ legacy, legacyDetail }) => {
  const [, t] = useLanguage()
  const [{ parseDate, parsePrice }] = useUtils()

  const list = legacy?.list || {}
  const reports = Array.isArray(list.reports) ? list.reports : []
  const syncing = Boolean(legacy?.importing || list.loading)

  const dayText = (value) => (value ? parseDate(value, { dateOnly: true, utc: false }) : null)
  const money = (amount) => <bdi dir='ltr' className='odc-figure'>{formatAmount(parsePrice, amount)}</bdi>

  // the same keys and texts as `main`: PERIOD, ORDERS, PREPAID_TOTAL, COMMISSION, TOTAL_CHARGES, DEPOSIT_AMOUNT
  const columns = [
    { id: 'period', header: t('PERIOD', 'Period'), locked: true, rowHeader: true, skeleton: { lines: 1 }, cell: report => <bdi>{[dayText(report.start_date), dayText(report.end_date)].filter(Boolean).join(' – ')}</bdi> },
    { id: 'orders', header: t('ORDERS', 'Orders'), align: 'end', skeleton: { lines: 1 }, cell: report => <bdi dir='ltr' className='odc-figure'>{report.num_orders}</bdi> },
    { id: 'prepaid', header: t('PREPAID_TOTAL', 'Prepaid total'), align: 'end', skeleton: { lines: 1 }, cell: report => money(report.order_total) },
    { id: 'commission', header: t('COMMISSION', 'Commission'), align: 'end', skeleton: { lines: 1 }, cell: report => money(report.commission) },
    { id: 'charges', header: t('TOTAL_CHARGES', 'Total charges'), align: 'end', skeleton: { lines: 1 }, cell: report => money(report.total_charges) },
    { id: 'deposit', header: t('DEPOSIT_AMOUNT', 'Deposit amount'), align: 'end', skeleton: { lines: 1 }, cell: report => money(report.deposit_amount) }
  ]
  const label = t('LEGACY_REPORTS', 'Legacy Reports')

  // ---- importing or loading the list: the table is not shown, as in `main` ----
  if (syncing) {
    return (
      <div className='odc-bp-sync'>
        <EmptyState icon={RefreshCw} role='status' aria-busy='true' title={t('SYNCING_EXTERNAL_REPORTS', 'Syncing reports...')} />
        <DataTable label={label} columns={columns} rows={[]} getRowId={report => report.id} loading skeletonRows={SKELETON_ROWS} loadingLabel={t('LOADING', 'Loading')} />
      </div>
    )
  }

  // ---- nothing to list: the failure of the import or of the list (translated), else «No reports found» ----
  if (reports.length === 0) {
    const failure = legacy?.importError ?? list.error
    if (failure) {
      return (
        <EmptyState
          tone='error'
          icon={TriangleAlert}
          title={translateApiMessage(t, firstMessage(failure), t('BUSINESS_PAYMENTS_LEGACY_FAILED', "We couldn't load the legacy reports."))}
        />
      )
    }
    return <EmptyState icon={Inbox} title={t('NO_EXTERNAL_REPORTS', 'No reports found')} />
  }

  // ---- the foot: only with more than one page, as `main` ----
  const pagination = list.pagination
  const totalPages = Number(pagination?.total_pages) || 0
  const knownTotal = pagination?.total != null && Number.isFinite(Number(pagination.total)) ? Number(pagination.total) : undefined
  const page = legacy.page || 1
  const foot = totalPages > 1 && (
    <div className='odc-bp-foot'>
      <Pagination
        page={page}
        pageSize={legacy.pageSize}
        // R5: main's table jumped straight to a page. The page field needs a total; without the API's,
        // the pages give its upper bound, and the range then says «Page X of Y» instead of reading that number.
        total={knownTotal ?? totalPages * legacy.pageSize}
        itemCount={reports.length}
        pageSizeOptions={PAGE_SIZES}
        onPageChange={next => legacy.setPage(next)}
        onPageSizeChange={size => legacy.setPageSize(size)}
        showPageInput
        pageLabel={t('PAGE', 'Page')}
        pageOfLabel={(pages, figureOf) => fillTemplate(t('PAGE_OF_TOTAL', 'of _total_'), { total: pages }, figureOf)}
        label={t('PAGINATION', 'Pagination')}
        previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
        nextLabel={t('NEXT_PAGE', 'Next page')}
        pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
        rangeLabel={(from, to) => (knownTotal == null
          ? fillTemplate(t('PAGE_STATUS', 'Page _page_ of _total_'), { page, total: totalPages }, figure)
          : fillTemplate(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from, to, total: knownTotal }, figure))}
        pageStatusLabel={(current, pages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(pages ?? totalPages))}
      />
    </div>
  )

  const active = reports.find(report => sameId(report.id, legacyDetail?.reportId))
  return (
    <>
      <DataTable
        label={label}
        columns={columns}
        rows={reports}
        getRowId={report => report.id}
        activeRowId={active?.id}
        onOpenRow={report => legacyDetail?.open(report.id)}
      />
      {foot}
    </>
  )
}

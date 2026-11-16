import React, { useMemo } from 'react'

import { useLanguage } from '../../../../../index'
import { downloadCsv, toCsv } from '../../../../../utils/businessReports'
import { sumRows } from '../../../../../utils/homeMetrics'
import { orderStatus } from '../../../utils/orderStatus'
import { Download } from '../../Shared/Icon'
import { BarList, CardAction, ReportCard, SatisfactionScores, orderStatusLabel } from '../AnalyticsKit'
import { Figure, fillTemplate } from './BusinessSummary'
import './business-analytics.css'

// redesign bi FD (D8, D10; BI-09, BI-12, BI-13, BI-16, BI-20): the ranked blocks of the page. «What sells» (products and categories) and
// «Service» (orders by status and customer satisfaction). Each card has its CSV, with the name of file and the columns of `main`.

const SCORE_KEYS = ['general', 'quality', 'delivery', 'service', 'package']

const rowsOf = (block) => (Array.isArray(block?.data) ? block.data : [])

/** The English name of a status for the CSV, as `main` wrote it (the list of `orderStatus`); an unknown one reads «Status N» and never throws. */
const csvStatusName = (status) => {
  const number = status == null || (typeof status === 'string' && status.trim() === '') ? NaN : Number(status)
  const entry = orderStatus.find(item => item.key === number)
  return entry ? entry.value : `Status ${status}`
}

const hasScore = (scores, key) => {
  const value = scores?.[key]
  return value != null && value !== '' && Number.isFinite(Number(value)) && Number(value) > 0
}

const CsvAction = ({ title, disabled, onClick }) => {
  const [, t] = useLanguage()
  return <CardAction icon={Download} label={`${t('DOWNLOAD_CSV', 'Download CSV')}: ${title}`} onClick={onClick} disabled={disabled} />
}

/** A ranking card (top products, top categories): the list in the order of the API with the value as it comes, and its CSV. */
const RankingCard = ({ title, block, fileName, onRetry }) => {
  const [, t] = useLanguage()
  const rows = rowsOf(block)
  const items = useMemo(() => rows.map((row, index) => ({ id: `${index}-${row.name}`, name: row.name, value: row.sales })), [rows])
  const unavailable = Boolean(block?.loading) || Boolean(block?.error) || rows.length === 0

  const handleDownload = () => {
    downloadCsv(`${fileName}_${Date.now()}.csv`, toCsv([t('NAME', 'Name'), `${t('SALES', 'Sales')}(%)`], rows.map(row => [row.name, row.sales])))
  }

  return (
    <ReportCard
      title={title}
      actions={<CsvAction title={title} disabled={unavailable} onClick={handleDownload} />}
      loading={Boolean(block?.loading)}
      error={block?.error}
      onRetry={onRetry}
      empty={rows.length === 0}
    >
      <BarList label={title} nameHeader={t('NAME', 'Name')} valueHeader={t('SALES', 'Sales')} items={items} />
    </ReportCard>
  )
}

const OrdersByStatus = ({ block, onRetry }) => {
  const [, t] = useLanguage()
  const title = t('BUSINESS_REPORTS_ORDERS_BY_STATUS', 'Orders by status')
  const rows = rowsOf(block)
  const total = sumRows(rows, 'orders')
  // highest first; the API order breaks a tie. There is no «All» bar: the total is the first line (D8)
  const items = useMemo(
    () => [...rows]
      .sort((a, b) => Number(b.orders) - Number(a.orders))
      .map((row, index) => ({ id: `${index}-${row.status}`, name: orderStatusLabel(t, row.status), value: row.orders })),
    [rows, t]
  )
  const unavailable = Boolean(block?.loading) || Boolean(block?.error) || rows.length === 0

  const handleDownload = () => {
    downloadCsv(`orders_status_${Date.now()}.csv`, toCsv([t('STATUS', 'Status'), t('ORDERS', 'Orders')], rows.map(row => [csvStatusName(row.status), row.orders])))
  }

  const totalText = total === 1
    ? t('BUSINESS_REPORTS_ORDERS_TOTAL_ONE', '_count_ order')
    : t('BUSINESS_REPORTS_ORDERS_TOTAL_OTHER', '_count_ orders')

  return (
    <ReportCard
      title={title}
      actions={<CsvAction title={title} disabled={unavailable} onClick={handleDownload} />}
      loading={Boolean(block?.loading)}
      error={block?.error}
      onRetry={onRetry}
      empty={rows.length === 0}
    >
      <p className='odc-bi-total'>{fillTemplate(totalText, { count: <Figure>{total}</Figure> })}</p>
      <BarList label={title} nameHeader={t('STATUS', 'Status')} valueHeader={t('ORDERS', 'Orders')} items={items} />
    </ReportCard>
  )
}

const CustomerSatisfaction = ({ block, onRetry }) => {
  const [, t] = useLanguage()
  const title = t('BUSINESS_REPORTS_CUSTOMER_SATISFACTION', 'Customer satisfaction')
  const scores = block?.data
  const empty = !SCORE_KEYS.some(key => hasScore(scores, key))
  const unavailable = Boolean(block?.loading) || Boolean(block?.error) || empty

  // the raw keys and values of the API, as `main` wrote them (P8 keeps the shape of the file)
  const handleDownload = () => {
    downloadCsv(`customer_satification_${Date.now()}.csv`, toCsv([t('TYPE', 'Type'), t('RATE', 'Rate')], Object.keys(scores ?? {}).map(key => [key, scores[key]])))
  }

  return (
    <ReportCard
      title={title}
      actions={<CsvAction title={title} disabled={unavailable} onClick={handleDownload} />}
      loading={Boolean(block?.loading)}
      error={block?.error}
      onRetry={onRetry}
      empty={empty}
      emptyText={t('BUSINESS_REPORTS_NO_REVIEWS', 'No reviews in this period.')}
    >
      <SatisfactionScores scores={scores} />
    </ReportCard>
  )
}

/**
 * `section='products'`: top products and top categories. `section='service'`: orders by status and customer satisfaction.
 * Two cards side by side from 1024 px, one column on a phone.
 */
export const BusinessBreakdowns = ({
  section,
  topProductList,
  topCategoryList,
  orderStatusList,
  customerSatisfactionList,
  reloadBlock
}) => {
  const [, t] = useLanguage()

  if (section === 'service') {
    return (
      <div className='odc-bi-grid'>
        <OrdersByStatus block={orderStatusList} onRetry={() => reloadBlock?.('orderStatus')} />
        <CustomerSatisfaction block={customerSatisfactionList} onRetry={() => reloadBlock?.('customerSatisfaction')} />
      </div>
    )
  }

  return (
    <div className='odc-bi-grid'>
      <RankingCard
        title={t('BUSINESS_REPORTS_TOP_PRODUCTS', 'Top products')}
        block={topProductList}
        fileName='top_products'
        onRetry={() => reloadBlock?.('topProduct')}
      />
      <RankingCard
        title={t('BUSINESS_REPORTS_TOP_CATEGORIES', 'Top categories')}
        block={topCategoryList}
        fileName='top_categories'
        onRetry={() => reloadBlock?.('topCategory')}
      />
    </div>
  )
}

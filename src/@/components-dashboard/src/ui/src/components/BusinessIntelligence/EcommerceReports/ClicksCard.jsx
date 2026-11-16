import React, { useState } from 'react'

import { useLanguage } from '../../../../../index'
import { downloadCsv } from '../../../../../utils/businessReports'
import { clicksCsv, clicksFileName, clicksTotal } from '../../../../../utils/clicksReport'
import { Button, Skeleton } from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { Download } from '../../Shared/Icon'
import { BarList, CardAction, ReportCard } from '../AnalyticsKit'
import { figure, fillTemplate } from '../AnalyticsKit/reportPillParts'
import './ecommerce-reports.css'

// redesign ecommerce FC (D6, D7, D10; C4): the card of one kind of click of /intelligence/ecommerce_reports. `main` painted, per kind, a line chart
// of every row (with «Expand») and the top 10 as a list, with two download buttons that gave the same rows. redesign (n.º 20, P1): the
// chart and its «Expand» are gone (the same numbers twice; with 271 products the chart is unreadable); the card keeps the top 10, «Show all N»
// (every row, in place) and ONE download (D7). It paints the rows it is given, already sorted by `clickRows`; the state of the block (loading,
// error, empty) is the kit card's. Self-contained: it takes its own rows and nothing of the page, so another report can mount it.

// one literal t() call per title: the i18n scanner only sees literals
const TITLES = {
  Business: t => t('ECOMMERCE_CLICKS_STORES', 'Clicks on stores'),
  Product: t => t('ECOMMERCE_CLICKS_PRODUCTS', 'Clicks on products'),
  Category: t => t('ECOMMERCE_CLICKS_CATEGORIES', 'Clicks on categories')
}

const TOP = 10

/**
 * @param {object}   props
 * @param {string}   props.type       'Business', 'Product' or 'Category': the key of `result.click` of the API.
 * @param {Array}    props.rows       `[{ id, name, value }]` (`clickRows`): sorted by clicks, descending.
 * @param {boolean}  props.loading    The first load: the skeleton.
 * @param {boolean}  props.updating   A new load with the old rows on screen: they stay, dimmed, and cannot be downloaded.
 * @param {*}        props.error      The error of the load, if any.
 * @param {Function} props.onRetry    «Try again» of the error.
 */
export const ClicksCard = ({ type, rows, loading, updating, error, onRetry }) => {
  const [, t] = useLanguage()
  const isPhone = useIsPhone()
  const [showAll, setShowAll] = useState(false)

  const title = TITLES[type](t)
  const clicksLabel = t('CLICKS', 'Clicks')
  const topLabel = t('ECOMMERCE_CLICKS_TOP', 'Top 10')
  const allLabel = t('ALL', 'All')
  const empty = rows.length === 0
  const hasMore = rows.length > TOP
  // a list that shrinks to 10 or fewer (new filters) has nothing to expand: it paints the top as it is
  const expanded = showAll && hasMore
  const heading = expanded ? allLabel : topLabel

  // nothing to download while it loads, after an error or without rows; the old rows are not downloaded under new filters
  const unavailable = Boolean(loading) || Boolean(error) || empty
  const actions = (
    <CardAction
      icon={Download}
      label={`${t('DOWNLOAD_CSV', 'Download CSV')}: ${title}`}
      onClick={() => downloadCsv(clicksFileName(type), clicksCsv(type, rows, t))}
      disabled={unavailable || Boolean(updating)}
    />
  )

  return (
    <ReportCard
      title={title}
      headingLevel={2}
      actions={actions}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={empty}
      emptyText={t('ECOMMERCE_CLICKS_EMPTY', 'No clicks in this period.')}
      skeleton={<Skeleton size='100%' block={isPhone ? 'var(--od-x-chart-height-compact)' : 'var(--od-x-chart-height)'} />}
    >
      <div className='odc-ec-clicks-body' aria-busy={updating ? 'true' : undefined} data-stale={updating ? '' : undefined}>
        <p className='odc-ec-clicks-summary'>
          {fillTemplate(t('ECOMMERCE_CLICKS_SUMMARY', '_clicks_ clicks · _count_ in the list'), { clicks: clicksTotal(rows), count: rows.length }, figure)}
        </p>
        <div className='odc-ec-clicks-top'>
          <h3 className='odc-ec-clicks-top-title'>{heading}</h3>
          <BarList label={`${heading}: ${title}`} items={expanded ? rows : rows.slice(0, TOP)} nameHeader={title} valueHeader={clicksLabel} />
          {hasMore && (
            <div className='odc-ec-clicks-more'>
              <Button variant='link' aria-expanded={expanded} onClick={() => setShowAll(!expanded)}>
                {expanded
                  ? t('SHOW_LESS', 'Show less')
                  : fillTemplate(t('ECOMMERCE_CLICKS_SHOW_ALL', 'Show all _count_'), { count: rows.length }, figure)}
              </Button>
            </div>
          )}
        </div>
      </div>
    </ReportCard>
  )
}

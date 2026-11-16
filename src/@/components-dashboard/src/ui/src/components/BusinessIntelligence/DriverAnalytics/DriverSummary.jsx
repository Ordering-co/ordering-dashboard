import React, { useId, useRef } from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { Button, InlineNotice, Metric, MetricGrid } from '../../Shared/Product'
import { formatDuration } from '../AnalyticsKit'
import { Figure } from '../BusinessAnalytics/BusinessSummary'
import '../BusinessAnalytics/business-analytics.css'

// redesign drivers FC2 (D1, D2, D3, D10; DR-05, DR-18, DR-19; auditors 8, 11): the seven figures of the period, as the six of Business
// but without a comparison with the period before (D2: `main` has none). The figures come from the controller (`totals`); this file
// only writes them. Orders and sales are the sums of the first series (as `main`), the five times are averages of the period.

const DASH = '—'

// The blocks that feed a figure: the prop that carries each one and the key `reloadBlock` takes
const FIGURE_BLOCKS = [
  ['ordersList', 'orders'],
  ['salesList', 'sales'],
  ['acceptSpendList', 'acceptSpend'],
  ['arrivedPickUpSpendList', 'arrivedPickUpSpend'],
  ['pickUpSpendList', 'pickUpSpend'],
  ['deliverySpendList', 'deliverySpend'],
  ['completeSpendList', 'completeSpend']
]

const isFailed = (block) => Boolean(block) && !block.loading && Boolean(block.error)

/**
 * The seven figures: orders, sales, driver time to accept, wait at pickup, time to pick up, time to deliver and time to complete.
 * A figure of a block that loads is a skeleton of its own box the first time and the last figure, dimmed, afterwards; of a block that
 * failed, a dash with one warning under the grid whose «Try again» reloads only the blocks that failed.
 */
export const DriverSummary = ({
  totals,
  reloadBlock,
  ordersList,
  salesList,
  acceptSpendList,
  arrivedPickUpSpendList,
  pickUpSpendList,
  deliverySpendList,
  completeSpendList
}) => {
  const [, t] = useLanguage()
  const [{ parsePrice }] = useUtils()
  const headingId = useId()
  const headingRef = useRef(null)
  // redesign drivers FC2 (R1 F3 of Business): the last figures that were painted whole, by figure key. While a new period or filter
  // loads they stay (dimmed, aria-busy) instead of skeletons, so the summary keeps its height; the skeletons are only for the first load
  const lastShown = useRef({})

  const blocks = { ordersList, salesList, acceptSpendList, arrivedPickUpSpendList, pickUpSpendList, deliverySpendList, completeSpendList }

  // redesign drivers FC2 (D3): «Average in this period» under every time, as `main`'s cards were averages
  const averageHelp = [{ text: t('BUSINESS_REPORTS_AVERAGE_IN_PERIOD', 'Average in this period'), secondary: true }]
  const time = (seconds) => <Figure>{formatDuration(t, seconds)}</Figure>

  const figures = [
    {
      key: 'orders',
      label: t('ORDERS', 'Orders'),
      deps: [ordersList],
      value: () => <Figure>{totals?.orders == null ? DASH : String(totals.orders)}</Figure>,
      refs: []
    },
    {
      key: 'sales',
      label: t('SALES', 'Sales'),
      deps: [salesList],
      // redesign drivers FC2 (DR-05): the currency always, not only with a country chosen (that filtered nothing in `main`)
      value: () => <Figure>{totals?.sales == null ? DASH : parsePrice(totals.sales)}</Figure>,
      refs: []
    },
    {
      key: 'accept',
      label: t('DRIVER_REPORTS_TIME_TO_ACCEPT', 'Driver time to accept'),
      deps: [acceptSpendList],
      value: () => time(totals?.acceptSeconds),
      refs: averageHelp
    },
    {
      key: 'arrived',
      label: t('BUSINESS_REPORTS_WAIT_AT_PICKUP', 'Wait at pickup'),
      deps: [arrivedPickUpSpendList],
      value: () => time(totals?.arrivedSeconds),
      refs: averageHelp
    },
    {
      key: 'pickup',
      label: t('DRIVER_REPORTS_TIME_TO_PICK_UP', 'Time to pick up'),
      deps: [pickUpSpendList],
      value: () => time(totals?.pickupSeconds),
      refs: averageHelp
    },
    {
      key: 'delivery',
      label: t('DRIVER_REPORTS_TIME_TO_DELIVER', 'Time to deliver'),
      deps: [deliverySpendList],
      value: () => time(totals?.deliverySeconds),
      refs: averageHelp
    },
    {
      key: 'complete',
      label: t('DRIVER_REPORTS_TIME_TO_COMPLETE', 'Time to complete'),
      deps: [completeSpendList],
      value: () => time(totals?.completeSeconds),
      refs: averageHelp
    }
  ]

  const failedBlocks = FIGURE_BLOCKS.filter(([prop]) => isFailed(blocks[prop]))
  const busy = figures.some(figure => figure.deps.some(block => block?.loading))

  // the retry button leaves with the notice, so the focus goes to the title of the region first (Business D10)
  const retryFigures = () => {
    headingRef.current?.focus()
    failedBlocks.forEach(([, key]) => reloadBlock?.(key))
  }

  return (
    <section className='odc-bi-summary' data-slot='bi-summary' aria-labelledby={headingId} aria-busy={busy ? 'true' : undefined}>
      <h2 className='odc-sr-only' id={headingId} ref={headingRef} tabIndex={-1}>{t('BUSINESS_REPORTS_SECTION_SUMMARY', 'Summary')}</h2>
      <MetricGrid className='odc-bi-drivers-summary'>
        {figures.map(figure => {
          const failed = figure.deps.some(isFailed)
          const loading = figure.deps.some(block => block?.loading)
          const value = failed ? <Figure>{DASH}</Figure> : figure.value()
          // the first reference that is painted is the lead one, so the page can reserve its height (R1 F4 of Business)
          const refs = figure.refs.map((ref, index) => (index === 0 ? { ...ref, lead: true } : ref))
          if (!loading) lastShown.current[figure.key] = { value, refs }
          const kept = loading ? lastShown.current[figure.key] : null
          return (
            <Metric
              key={figure.key}
              data-metric={figure.key}
              data-stale={kept ? '' : undefined}
              label={figure.label}
              value={kept ? kept.value : value}
              refs={kept ? kept.refs : refs}
              loading={loading && !kept}
            />
          )
        })}
      </MetricGrid>
      {failedBlocks.length > 0 && (
        <InlineNotice tone='warning' action={<Button onClick={retryFigures}>{t('TRY_AGAIN', 'Try again')}</Button>}>
          {t('BUSINESS_REPORTS_FIGURES_ERROR', 'Some figures could not be loaded.')}
        </InlineNotice>
      )}
    </section>
  )
}

import React from 'react'
import PropTypes from 'prop-types'
import { useLanguage } from '../../../../../index'
import { Metric, MetricGrid } from '../../Shared/Product' // redesign driver-store-status (decision 1): P/ figures, not own cards
import { Dash } from './StoreCards'
import { KpiSection, AlertRef, NoWrap } from './styles'

// redesign W1-8 (T1-8-4): a figure is a metric (decision 11), so it travels in its own .odc-figure node
const Figure = ({ children }) => <bdi className='odc-figure'>{children}</bdi>

// redesign driver-store-status (decision 1 and M-DSS1): four figures. A source that failed paints «—» in its figures
// (the value and the references), never 0. Review r1 (Q-01/Q-02): each figure follows its own source: the stores come from the
// groups (`storesFailed`), the driver figures and «without online drivers» from the drivers (`driversFailed`), the order sum from
// the stores and the orders (it loads and fails with both), «Orders, all time» from the orders alone.
export const KpiCards = (props) => {
  const { kpis, orderCounts, totals, storesWithoutOnline, storesInNoGroup, loading, groupsLoading, ordersLoading, storesFailed, driversFailed, ordersError } = props
  const [, t] = useLanguage()
  const orders = orderCounts || { total: 0, assigned: 0, finished: 0 }
  const sums = totals || { activeUnassigned: 0, finishedToday: 0 }

  const coverageFailed = storesFailed || driversFailed
  const sumFailed = storesFailed || ordersError
  const driver = value => driversFailed ? <Dash bare /> : <Figure>{value}</Figure>
  const order = value => ordersError ? <Dash bare /> : <Figure>{value}</Figure>
  const sum = value => sumFailed ? <Dash bare /> : <Figure>{value}</Figure>
  const alert = !coverageFailed && storesWithoutOnline > 0
  const withoutOnline = <>{coverageFailed ? <Dash bare /> : <Figure>{storesWithoutOnline}</Figure>} {t('WITHOUT_ONLINE_DRIVERS', 'without online drivers')}</>
  // (rows 28-29, live check): «without online drivers» counts the stores of a delivery group only; the stores in none get their
  // own neutral line (the number as a figure inside the translated text), only when there are some. They need no drivers' coverage, so
  // it does not wait for the drivers.
  const noGroup = !storesFailed && storesInNoGroup > 0
    ? t('STORES_IN_NO_DELIVERY_GROUP', '_count_ in no delivery group').split('_count_').flatMap((part, index) => index === 0 ? [part] : [<Figure key={index}>{storesInNoGroup}</Figure>, part])
    : null

  return (
    <KpiSection>
      <MetricGrid>
        <Metric
          label={t('TOTAL_ACTIVE_STORES', 'Total active stores')}
          value={storesFailed ? <Dash /> : <Figure>{kpis.totalStores}</Figure>}
          loading={Boolean(loading)}
          refs={[
            { text: alert ? <AlertRef data-alert=''>{withoutOnline}</AlertRef> : withoutOnline },
            ...(noGroup ? [{ text: <>{noGroup}</> }] : [])
          ]}
        />
        <Metric
          label={t('TOTAL_DRIVERS', 'Total drivers')}
          value={driversFailed ? <Dash /> : <Figure>{kpis.totalDrivers}</Figure>}
          loading={Boolean(loading)}
          refs={[
            // review r1 (Q-05): «(N Busy)» never breaks inside its brackets
            { text: <>{driver(kpis.connectedDrivers)} {t('ONLINE_DRIVERS', 'Online drivers')} <NoWrap data-nowrap=''>({driver(kpis.busyDrivers)} {t('BUSY', 'Busy')})</NoWrap></> },
            { text: <>{driver(kpis.offlineDrivers)} {t('INACTIVE_DRIVERS', 'Offline')}</> }
          ]}
        />
        <Metric
          label={t('ACTIVE_UNASSIGNED', 'Active unassigned')}
          value={sumFailed ? <Dash /> : <Figure>{sums.activeUnassigned}</Figure>}
          loading={Boolean(ordersLoading || groupsLoading)}
          refs={[{ text: t('FINISHED_TODAY', 'Finished today'), value: sum(sums.finishedToday) }]}
        />
        <Metric
          label={t('ORDERS_ALL_TIME', 'Orders, all time')}
          value={ordersError ? <Dash /> : <Figure>{orders.total}</Figure>}
          loading={Boolean(ordersLoading)}
          refs={[{ text: <>{order(orders.assigned)} {t('ASSIGNED', 'assigned')} · {order(orders.finished)} {t('FINISHED', 'finished')}</> }]}
        />
      </MetricGrid>
    </KpiSection>
  )
}

KpiCards.propTypes = {
  kpis: PropTypes.object,
  orderCounts: PropTypes.object,
  totals: PropTypes.object,
  loading: PropTypes.bool,
  groupsLoading: PropTypes.bool,
  ordersLoading: PropTypes.bool,
  storesFailed: PropTypes.bool,
  driversFailed: PropTypes.bool,
  ordersError: PropTypes.bool
}

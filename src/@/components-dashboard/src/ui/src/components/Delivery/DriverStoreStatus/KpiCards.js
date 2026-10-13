import React from 'react'
import PropTypes from 'prop-types'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { useLanguage } from '../../../../../index'
import { KpiRow, KpiCard, KpiLabel, KpiValue, KpiSub } from './styles'

export const KpiCards = (props) => {
  const { kpis, orderCounts, storesWithoutOnline, loading, ordersLoading } = props
  const [, t] = useLanguage()
  const orders = orderCounts || { total: 0, assigned: 0, finished: 0 }

  return (
    <KpiRow>
      <KpiCard>
        <KpiLabel>{t('TOTAL_ACTIVE_STORES', 'Total active stores')}</KpiLabel>
        <KpiValue>{loading ? <Skeleton width={60} /> : kpis.totalStores}</KpiValue>
        <KpiSub alert={!loading && storesWithoutOnline > 0}>
          {loading
            ? <Skeleton width={160} />
            : <>{storesWithoutOnline} {t('WITHOUT_ONLINE_DRIVERS', 'without online drivers')}</>}
        </KpiSub>
      </KpiCard>
      <KpiCard>
        <KpiLabel>{t('TOTAL_DRIVERS', 'Total drivers')}</KpiLabel>
        <KpiValue>{loading ? <Skeleton width={60} /> : kpis.totalDrivers}</KpiValue>
        <KpiSub>
          {loading
            ? <Skeleton width={220} />
            : <>{kpis.connectedDrivers} {t('ONLINE_DRIVERS', 'Online drivers')} ({kpis.busyDrivers} {t('BUSY', 'Busy')}) · {kpis.offlineDrivers} {t('INACTIVE_DRIVERS', 'Offline')}</>}
        </KpiSub>
      </KpiCard>
      <KpiCard>
        <KpiLabel>{t('TOTAL_ORDERS', 'Total orders')}</KpiLabel>
        <KpiValue>{ordersLoading ? <Skeleton width={60} /> : orders.total}</KpiValue>
        <KpiSub>
          {ordersLoading
            ? <Skeleton width={180} />
            : <>{orders.assigned} {t('ASSIGNED', 'assigned')} · {orders.finished} {t('FINISHED', 'finished')}</>}
        </KpiSub>
      </KpiCard>
    </KpiRow>
  )
}

KpiCards.propTypes = {
  kpis: PropTypes.object,
  loading: PropTypes.bool
}

import React from 'react'
import PropTypes from 'prop-types'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { useLanguage } from '../../../../../index'
import { TableWrapper, Table, Th, Tr, Td, ConnectedValue, EmptyState } from './styles'

const SKELETON_ROWS = 10

export const StoresTable = (props) => {
  const { rows, loading, ordersLoading } = props
  const [, t] = useLanguage()

  if (!loading && !rows?.length) {
    return <EmptyState>{t('NO_STORES_TO_SHOW', 'No stores to show')}</EmptyState>
  }

  return (
    <TableWrapper>
      <Table>
        <thead>
          <tr>
            <Th>{t('STORE', 'Store')}</Th>
            <Th align='center'>{t('TOTAL_DRIVERS', 'Total drivers')}</Th>
            <Th align='center'>{t('ONLINE_DRIVERS', 'Online drivers')}</Th>
            <Th align='center'>{t('ACTIVE_UNASSIGNED', 'Active unassigned')}</Th>
            <Th align='center'>{t('FINISHED_TODAY', 'Finished today')}</Th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? [...Array(SKELETON_ROWS)].map((_, index) => (
              <Tr key={`skeleton-${index}`}>
                <Td><Skeleton width={180} /></Td>
                <Td align='center'><Skeleton width={32} /></Td>
                <Td align='center'><Skeleton width={32} /></Td>
                <Td align='center'><Skeleton width={32} /></Td>
                <Td align='center'><Skeleton width={32} /></Td>
              </Tr>
              ))
            : rows.map(row => (
              <Tr key={row.businessId} highlighted={row.connectedDrivers === 0}>
                <Td>{row.name}</Td>
                <Td align='center'>{row.totalDrivers}</Td>
                <Td align='center'>
                  <ConnectedValue zero={row.connectedDrivers === 0}>{row.connectedDrivers}</ConnectedValue>
                </Td>
                <Td align='center'>{ordersLoading ? <Skeleton width={24} /> : row.activeOrders}</Td>
                <Td align='center'>{ordersLoading ? <Skeleton width={24} /> : row.finishedToday}</Td>
              </Tr>
            ))}
        </tbody>
      </Table>
    </TableWrapper>
  )
}

StoresTable.propTypes = {
  rows: PropTypes.array,
  loading: PropTypes.bool
}

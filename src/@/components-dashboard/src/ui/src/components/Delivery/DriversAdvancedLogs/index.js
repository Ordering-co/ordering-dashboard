import React, { useEffect } from 'react'
import { useLanguage, useUtils, DriversAdvancedLogs as DriversAdvancedLogsController } from '../../../../../index'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { Pagination } from '../../Shared'
import { getAttributeName } from '../../../utils'
import { parseLogData } from '../../../../../utils/safeJsonParse'
import { humanizeEvent } from '../DriversGroupLogs/humanizeEvent'
import {
  DriversAdvacedLogsContainer,
  TableWrapper,
  Table,
  UserInfoContainer,
  DateTimeWrapper,
  NoData,
  WrapperPagination,
  DataListTable,
  EventTypeContainer
} from './styles'

export const DriversAdvancedLogsUI = (props) => {
  const {
    logsList,
    paginationProps,
    getDriversAdvancedLogs,
    actionDisabled
  } = props

  const [, t] = useLanguage()
  const [{ parseDate }] = useUtils()

  const handleChangePage = (page) => {
    getDriversAdvancedLogs(page, 10)
  }

  const handleChangePageSize = (pageSize) => {
    const expectedPage = Math.ceil(paginationProps.from / pageSize)
    getDriversAdvancedLogs(expectedPage, pageSize)
  }

  const getValidLogData = (data) => parseLogData(data)

  useEffect(() => {
    if (logsList.loading || logsList.logs.length > 0 || paginationProps.totalPages <= 1) return
    if (paginationProps.currentPage !== paginationProps.totalPages) {
      handleChangePage(paginationProps.currentPage)
    } else {
      handleChangePage(paginationProps.currentPage - 1)
    }
  }, [logsList.logs, paginationProps])

  return (
    <>
      <DriversAdvacedLogsContainer
        disabled={actionDisabled}
      >
        <TableWrapper>
          {(logsList.loading || logsList.logs.length > 0)
            ? (
            <Table aria-label={t('ADVANCED_LOGS', 'Advanced logs')}>
              <thead>
                <tr>
                  <th scope='col'>{t('EVENTS_TYPE', 'Events type')}</th>
                  <th scope='col'>{t('DETAILS', 'Details')}</th>
                  <th scope='col'>{t('EXPORT_DATE', 'Date')}</th>
                </tr>
              </thead>
              <tbody>
              {logsList.loading
                ? (
                    [...Array(10).keys()].map(i => (
                    <tr key={i}>
                      <td>
                        <UserInfoContainer>
                          <p><Skeleton width={100} /></p>
                          <p><Skeleton width={120} /></p>
                        </UserInfoContainer>
                      </td>
                      <td>
                        <DataListTable as='div'><Skeleton width={100} /></DataListTable>
                      </td>
                      <td>
                        <DateTimeWrapper>
                          <Skeleton />
                        </DateTimeWrapper>
                      </td>
                    </tr>
                    ))
                  )
                : (
                    !logsList.error && logsList.logs?.map(log => (
                    <tr key={log.id}>
                      <th scope='row'>
                        <EventTypeContainer>
                          <p>{t((log?.event || '').toUpperCase(), humanizeEvent(log?.event))}</p>
                        </EventTypeContainer>
                      </th>
                      <td>
                        <DataListTable as='ul'>
                          {log?.data && getValidLogData(log?.data).map((item, i) => (
                            <li key={i}>{getAttributeName(item, { parseDate, t })}</li>
                          ))}
                        </DataListTable>
                      </td>
                      <td>
                        <DateTimeWrapper>
                          {parseDate(log.created_at)}
                        </DateTimeWrapper>
                      </td>
                    </tr>
                    ))
                  )}
              </tbody>
            </Table>
              )
            : (
            <NoData>{t('NO_DATA', 'No data')}</NoData>
              )}
        </TableWrapper>
        {logsList?.logs.length > 0 && (
          <WrapperPagination>
            <Pagination
              isHidePagecontrol
              currentPage={paginationProps.currentPage}
              totalPages={paginationProps.totalPages}
              handleChangePage={handleChangePage}
              handleChangePageSize={handleChangePageSize}
            />
          </WrapperPagination>
        )}
      </DriversAdvacedLogsContainer>
    </>
  )
}

export const DriversAdvancedLogs = (props) => {
  const driversGroupLogsProps = {
    ...props,
    UIComponent: DriversAdvancedLogsUI
  }
  return <DriversAdvancedLogsController {...driversGroupLogsProps} />
}

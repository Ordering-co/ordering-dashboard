import React, { useMemo, useState } from 'react'
import { List as MenuIcon, ArrowClockwise } from 'react-bootstrap-icons'
import { useLanguage, DriverStoreStatus as DriverStoreStatusController } from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { IconButton } from '../../../styles'
import { Pagination } from '../../Shared'
import { buildStoreRows, buildGlobalKpis } from './aggregate'
import { KpiCards } from './KpiCards'
import { Filters } from './Filters'
import { StoresTable } from './StoresTable'
import { Container, HeaderContainer, HeaderActions, TableFooter, ReloadButton } from './styles'

const DriverStoreStatusUI = (props) => {
  const {
    drivers,
    driversLoading,
    groups,
    groupsLoading,
    orderCounts,
    activeByBusiness,
    finishedTodayByBusiness,
    ordersLoading,
    onReload
  } = props
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const rows = useMemo(
    () => buildStoreRows({ groups, drivers, activeByBusiness, finishedTodayByBusiness }),
    [groups, drivers, activeByBusiness, finishedTodayByBusiness]
  )
  const kpis = useMemo(() => buildGlobalKpis({ groups, drivers }), [groups, drivers])
  const storesWithoutOnline = useMemo(() => rows.filter(row => row.connectedDrivers === 0).length, [rows])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return rows
    return rows.filter(row => (row.name || '').toLowerCase().includes(query))
  }, [rows, search])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageRows = useMemo(
    () => filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredRows, currentPage, pageSize]
  )

  const handleSearch = (value) => {
    setSearch(value || '')
    setPage(1)
  }

  const handleChangePageSize = (size) => {
    setPageSize(size)
    setPage(1)
  }

  const structureLoading = driversLoading || groupsLoading

  return (
    <Container>
      <HeaderContainer>
        {isCollapse && (
          <IconButton
            color='black'
            onClick={() => handleMenuCollapse(false)}
          >
            <MenuIcon />
          </IconButton>
        )}
        <h1>{t('DRIVER_STORE_STATUS', 'Driver Store Status')}</h1>
        <HeaderActions>
          <ReloadButton
            onClick={onReload}
            disabled={structureLoading || ordersLoading}
          >
            <ArrowClockwise />
            {t('RELOAD', 'Reload')}
          </ReloadButton>
        </HeaderActions>
      </HeaderContainer>
      <KpiCards kpis={kpis} orderCounts={orderCounts} storesWithoutOnline={storesWithoutOnline} loading={structureLoading} ordersLoading={ordersLoading} />
      <Filters search={search} onSearch={handleSearch} />
      <StoresTable rows={pageRows} loading={structureLoading} ordersLoading={ordersLoading} />
      {!structureLoading && totalPages > 1 && (
        <TableFooter>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            handleChangePage={setPage}
            handleChangePageSize={handleChangePageSize}
            defaultPageSize={pageSize}
          />
        </TableFooter>
      )}
    </Container>
  )
}

export const DriverStoreStatus = (props) => {
  return (
    <DriverStoreStatusController {...props} UIComponent={DriverStoreStatusUI} />
  )
}

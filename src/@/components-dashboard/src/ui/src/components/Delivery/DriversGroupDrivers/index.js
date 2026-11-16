import React, { useMemo, useState } from 'react'
import moment from 'moment'
import { useLanguage } from '../../../../../index'
import { Modal } from '../../Shared'
import { Avatar, Button, Checkbox, Pagination } from '../../Shared/Product'
import { DriverTemporalSchedule } from '../DriverTemporalSchedule'
import { FieldError } from '../DriversGroupAddForm/FieldError'
import { DriversGroupPickList, DriversGroupPickRow } from '../DriversGroupPickList'
import './drivers-group-drivers.css'

// redesign (AD-5): the page sizes of main's pagination, the same ones the groups list offers
const PAGE_SIZES = [10, 25, 50]

// «Showing _from_–_to_ of _total_»: the numbers travel in their own node (Pagination's `figure`), the rest is the translation
const fill = (template, values) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{values[name]}</React.Fragment> : part
})

export const DriversGroupDrivers = (props) => {
  const {
    drivers,
    actionState,
    selectedDriverIds,
    selectedDriverTemporaryIds,
    handleSelectDriver,
    handleSelectAllDriver,
    handleSelectDriverTemporary,
    // redesign (AD-6): `{ loading, error }` of each list the panel picks from (the page's); absent in the add form
    pickLists,
    // (P-2 of batch R): opt-in, `{ id, message }` of the add form's check; without it (the edit form) nothing changes
    selectionError
  } = props
  const [, t] = useLanguage()
  const [searchValue, setSearchValue] = useState(null)
  const [driverTemporalSchedule, setDriverTemporalScheduleModal] = useState(false)
  const [driverSchedule, setDriverSchedule] = useState(null)
  // the pagination is local: the list comes whole from the controller
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])

  const handleOpenModal = (driver) => {
    setDriverSchedule(driver)
    setDriverTemporalScheduleModal(true)
  }

  // redesign (AD-6, root cause): derived from `drivers` and the search. Main copied the list into state only when the
  // search text changed, so drivers that arrived after the first paint never showed.
  const filteredDrivers = useMemo(() => {
    const list = drivers ?? []
    if (!searchValue) return list
    const needle = searchValue.toLowerCase()
    return list.filter(driver => (
      driver?.name?.toLowerCase().includes(needle) ||
      driver?.email?.toLowerCase().includes(needle)
    ))
  }, [drivers, searchValue])

  // the page is clamped to the last one the list allows (the list shrinks when drivers or the search change)
  const lastPage = Math.max(1, Math.ceil(filteredDrivers.length / pageSize))
  const currentPage = Math.min(page, lastPage)
  const pageDrivers = filteredDrivers.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleSearch = (value) => {
    setSearchValue(value)
    setPage(1)
  }

  const fullName = driver => `${driver?.name ?? ''} ${driver?.lastname ?? ''}`.trim()

  return (
    <>
      <DriversGroupPickList
        legend={t('DRIVERS', 'Drivers')}
        search={searchValue}
        onSearch={handleSearch}
        searchLabel={t('DRIVERS_GROUPS_SEARCH_DRIVERS', 'Search drivers')}
        clearLabel={t('CLEAR_SEARCH', 'Clear search')}
        placeholder={t('SEARCH', 'Search')}
        onSelectAll={() => handleSelectAllDriver(true)}
        onSelectNone={() => handleSelectAllDriver(false)}
        selectAllLabel={t('SELECT_ALL', 'Select all')}
        selectNoneLabel={t('SELECT_NONE', 'Select none')}
        // (review): the message sits above the list it is about, not under its pages, so Save shows it
        message={selectionError && <FieldError id={selectionError.id}>{selectionError.message}</FieldError>}
        // redesign the fieldset (named by its legend) is the one group the message describes
        groupProps={selectionError ? { 'aria-describedby': selectionError.id, tabIndex: -1 } : undefined}
        loading={Boolean(pickLists?.drivers?.loading)}
        loadingLabel={t('LOADING', 'Loading')}
        error={Boolean(pickLists?.drivers?.error)}
        errorTitle={t('DRIVERS_GROUPS_DRIVERS_LOAD_ERROR', "We couldn't load the drivers.")}
        empty={filteredDrivers.length === 0}
        emptyTitle={t('DRIVERS_GROUPS_NO_DRIVERS', 'No drivers yet')}
        noMatchTitle={t('DRIVERS_GROUPS_LIST_NO_MATCH', 'Nothing matches your search')}
        footer={(
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            total={filteredDrivers.length}
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
            rangeLabel={(from, to, total, figureOf) => fill(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from: figureOf(from), to: figureOf(to), total: figureOf(total) })}
            pageStatusLabel={(current, totalPages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(totalPages))}
          />
        )}
      >
        {pageDrivers.map(driver => {
          const selected = selectedDriverIds.includes(driver.id)
          return (
            <DriversGroupPickRow
              key={driver.id}
              // redesign (AD-3): the person's photo, else the initials of the name (main drew FaUserAlt)
              media={<Avatar kind='person' name={fullName(driver)} src={driver?.photo} />}
              title={fullName(driver)}
              meta={driver?.email}
              checked={selected}
              disabled={Boolean(actionState?.loading)}
              onCheckedChange={next => handleSelectDriver(driver.id, next)}
              extra={selected && (
                <>
                  <Checkbox
                    label={t('TEMPORARY_DRIVER', 'Temporary driver')}
                    checked={Boolean(selectedDriverTemporaryIds?.some((_driver) => _driver?.id === driver.id && _driver?.temporarily_activated))}
                    disabled={Boolean(actionState?.loading)}
                    onCheckedChange={next => handleSelectDriverTemporary(driver?.id, next, moment().endOf('day').utc().format('YYYY-MM-DD HH:mm:ss'))}
                  />
                  <Button
                    variant='link'
                    size='sm'
                    disabled={Boolean(actionState?.loading)}
                    onClick={() => handleOpenModal(selectedDriverTemporaryIds.find((_driver) => (_driver?.id === driver?.id)) ?? { id: driver?.id, temporarily_activated: true, temporary_at: null })}
                  >
                    {t('TEMPORARY_DRIVER', 'Temporary driver')}
                  </Button>
                </>
              )}
            />
          )
        })}
      </DriversGroupPickList>
      <Modal
        width='385px'
        height='auto'
        padding='30px'
        title={t('TEMPORARY_SCHEDULE', 'Temporary schedule')}
        className='odc-dgd-schedule-dialog'
        open={driverTemporalSchedule}
        onClose={() => setDriverTemporalScheduleModal(false)}
      >
        <DriverTemporalSchedule
          driverSchedule={driverSchedule}
          handleSelectDriverTemporary={handleSelectDriverTemporary}
          onClose={() => setDriverTemporalScheduleModal(false)}
        />
      </Modal>
    </>
  )
}

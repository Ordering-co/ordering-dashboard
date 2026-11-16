import React, { useEffect, useRef, useState } from 'react'
import PropTypes, { string } from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { localBlocks, todayDay, toRequestRange } from '../../ui/src/components/Delivery/DriversTimeCalendar/blockData'
import { resolveTimeZone } from '../../utils/timeZone'

// redesign DT-B1 (DT-10, DT-15, DT-20, DT-23, decisión 1): the controller of the drivers' time calendar.
// - The range is `{ from, to }` of local days (DT-20); it turns UTC only in the request (`toRequestRange`).
// - «local» is the zone of the chosen group (`driver_groups.timezone`), the browser's with no group or no zone (`timeZone`).
// - It arrives with every driver, no mode to choose first (decision 1).
// - `getDrivers` keeps the answer of the last request only and never mutates the state it gave (DT-23).
// - The page size the user chose is respected by every page change (DT-10).
// - `addBlock`, `editBlock` and `deleteBlock` return `{ ok: true }` or `{ ok: false, error }`; no failure is swallowed (DT-15).
// The form, the hours and the bodies of the requests live in `ui/.../Delivery/DriversTimeCalendar/blockData.js`.

const DEFAULT_PAGE_SIZE = 10

const asMessages = (result) => (Array.isArray(result) ? result : result == null ? [] : [result])

export const CalendarDriversList = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    paginationSettings,
    propsToFetch
  } = props

  const [ordering] = useApi()
  const [session] = useSession()

  const [range, setRange] = useState(() => ({ from: todayDay(), to: todayDay() }))
  const [selectedGroup, setGroup] = useState(null)
  const [driverIds, setDriverIds] = useState([])
  const [driversList, setDriversList] = useState({ users: [], loading: false, error: null })
  const [paginationProps, setPaginationProps] = useState({
    currentPage: 1,
    pageSize: paginationSettings?.pageSize ?? DEFAULT_PAGE_SIZE,
    totalPages: null,
    totalItems: null,
    from: null,
    to: null
  })

  // What a request reads is the state of the render that started it; `latest` also lets the one that follows an `await`
  // (the reload after a save) see the current page and size, not the ones of a render that is already gone.
  const latest = useRef({})
  latest.current = { range, selectedGroup, driverIds, paginationProps }
  // One number per request: only the last one may write (DT-23)
  const lastRequest = useRef(0)

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.token}`
  }

  const clearDrivers = () => {
    setDriverIds(ids => (ids.length ? [] : ids))
  }

  const setSelectedGroup = (group) => {
    setGroup(group)
    // a new group starts without the driver filter (main, `DriversTimeDisplay/index.js:142-146`)
    clearDrivers()
  }

  const toggleDriver = (driverId) => {
    setDriverIds(ids => (ids.includes(driverId) ? ids.filter(id => id !== driverId) : [...ids, driverId]))
  }

  /**
   * Gets a page of drivers with their blocks in the range.
   * @param {Number} page
   * @param {Number} pageSize
   */
  const getDrivers = async (page, pageSize) => {
    const request = ++lastRequest.current
    const { range: currentRange, selectedGroup: group, driverIds: ids } = latest.current
    try {
      setDriversList(list => ({ ...list, loading: true, error: null }))
      const conditions = [{ attribute: 'level', value: '4' }]
      if (ids.length > 0) conditions.push({ attribute: 'id', value: ids })
      const where = `&where=${JSON.stringify({ conditions, conector: 'AND' })}`
      const { zone } = resolveTimeZone(group?.timezone)
      const [blocksFrom, blocksTo] = toRequestRange(currentRange, zone)
      const endpoint = group?.id ? `${ordering.root}/drivergroups/${group.id}/drivers` : `${ordering.root}/users`
      const response = await fetch(`${endpoint}?delivery_block_from=${blocksFrom}&delivery_block_to=${blocksTo}&page=${page}&page_size=${pageSize}&params=${propsToFetch}${where}`, {
        method: 'GET',
        headers
      })
      const { result, pagination, error } = await response.json()
      if (request !== lastRequest.current) return
      if (error) {
        setDriversList(list => ({ ...list, loading: false, error: result }))
        return
      }
      const users = result.map(user => ({ ...user, delivery_blocks: localBlocks(user.delivery_blocks, zone) }))
      setDriversList({ users, loading: false, error: null })
      setPaginationProps({
        currentPage: pagination?.current_page ?? page,
        pageSize: pagination?.page_size ? pagination.page_size : pageSize,
        totalPages: pagination?.total_pages ?? null,
        totalItems: pagination?.total ?? null,
        from: pagination?.from ?? null,
        to: pagination?.to ?? null
      })
    } catch (err) {
      if (request !== lastRequest.current) return
      if (err.constructor.name !== 'Cancel') {
        setDriversList(list => ({ ...list, loading: false, error: [err.message] }))
      }
    }
  }

  const changePage = (page) => getDrivers(page, latest.current.paginationProps.pageSize)

  const changePageSize = (size) => getDrivers(1, size)

  const reload = () => getDrivers(latest.current.paginationProps.currentPage, latest.current.paginationProps.pageSize)

  // One request for the three verbs: the API refuses → its messages; the network fails → its message (DT-15); it goes
  // well → the current page is loaded again.
  const sendBlock = async (method, driverId, blockId, body) => {
    try {
      const url = `${ordering.root}/drivers/${driverId}/delivery_blocks${blockId == null ? '' : `/${blockId}`}`
      const response = await fetch(url, { method, headers, body: JSON.stringify(body) })
      const { error, result } = await response.json()
      if (error) return { ok: false, error: asMessages(result) }
    } catch (err) {
      return { ok: false, error: [err.message] }
    }
    await reload()
    return { ok: true }
  }

  const addBlock = (driverId, body) => sendBlock('POST', driverId, null, body)

  const editBlock = (driverId, blockId, body) => sendBlock('PUT', driverId, blockId, body)

  const deleteBlock = (driverId, blockId, propagation) => sendBlock('DELETE', driverId, blockId, { propagation })

  useEffect(() => {
    getDrivers(1, latest.current.paginationProps.pageSize)
  }, [selectedGroup?.id, range.from, range.to, driverIds])

  // an answer that arrives after the page is gone writes nothing
  useEffect(() => () => { lastRequest.current += 1 }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          range={range}
          setRange={setRange}
          selectedGroup={selectedGroup}
          setSelectedGroup={setSelectedGroup}
          timeZone={resolveTimeZone(selectedGroup?.timezone)}
          driverIds={driverIds}
          toggleDriver={toggleDriver}
          clearDrivers={clearDrivers}
          driversList={driversList}
          paginationProps={paginationProps}
          getDrivers={getDrivers}
          changePage={changePage}
          changePageSize={changePageSize}
          addBlock={addBlock}
          editBlock={editBlock}
          deleteBlock={deleteBlock}
          reload={reload}
        />
      )}
    </>
  )
}

CalendarDriversList.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Initial page and page size of the list
   */
  paginationSettings: PropTypes.shape({
    initialPage: PropTypes.number,
    pageSize: PropTypes.number
  }),
  /**
   * Array of drivers props to fetch
   */
  propsToFetch: PropTypes.arrayOf(string)
}

const defaultProps = {
  propsToFetch: [],
  paginationSettings: { initialPage: 1, pageSize: DEFAULT_PAGE_SIZE }
}

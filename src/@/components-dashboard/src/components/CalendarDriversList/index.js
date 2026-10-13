import React, { useEffect, useState } from 'react'
import PropTypes, { string } from 'prop-types'
import moment from 'moment'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useSession } from '../../contexts/SessionContext'

export const CalendarDriversList = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    paginationSettings,
    propsToFetch
  } = props

  const [ordering] = useApi()
  const [, t] = useLanguage()
  const [isTimeChangeError, setIsTimeChangeError] = useState({ state: false, error: null })
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [showBreakBlock, setShowBreakBlock] = useState(false)
  const [propagation, setPropagation] = useState('none')
  const [openDeleteModal, setOpenDeleteModal] = useState(false)
  const [stackEventsState, setStackEventsState] = useState({ open: false, events: [], user: null })
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [openEditModal, setOpenEditModal] = useState(false)
  const [filterValues, setFilterValues] = useState({
    driverIds: []
  })
  const [filtOption, setFiltOption] = useState(null)
  const [openModal, setOpenModal] = useState(false)
  const [date, setDate] = useState([moment().startOf('day').utc().format('YYYY-MM-DD HH:mm:ss'), moment().endOf('day').utc().format('YYYY-MM-DD HH:mm:ss')])
  const [selectedBlock, setSelectedBlock] = useState({
    user: null,
    block: null
  })
  const [selectedDate, setSelectedDate] = useState(selectedBlock?.block ? selectedBlock?.block?.start : new Date())
  const actualDate = moment(selectedDate).format('YYYY-MM-DD')
  const [selectedUntilDate, setSelectedUntilDate] = useState(selectedBlock?.block ? selectedBlock?.block?.until : new Date())
  const [scheduleState, setScheduleState] = useState({
    state: {
      start: `${actualDate} 00:00:00`,
      end: `${actualDate} 23:59:00`
    },
    error: null,
    loading: false
  })
  const [ruleState, setRuleState] = useState({ freq: null, byweekday: [] })

  const [paginationProps, setPaginationProps] = useState({
    initialPage: 1,
    currentPage: (paginationSettings.controlType === 'pages' && paginationSettings.initialPage && paginationSettings.initialPage >= 1) ? paginationSettings.initialPage : 1,
    pageSize: paginationSettings.pageSize ?? 10,
    totalItems: null,
    totalPages: null
  })

  const timeErrorList = [
    t('END_TIME_LATER', 'Choose an end time later than the start time.'),
    t('START_TIME_EARLY', 'Choose a start time earlier than the end time.'),
    t('BREAK_END_TIME_EARLY', 'Choose a break end time later than the start/break start time and earlier than end time.'),
    t('BREAK_START_TIME_LATER', 'Choose a break start time later than the start times and earlier than end/break end times.'),
    t('DATE_RANGE_ERROR', 'The difference between dates should not be greater than 31'),
    t('UNTIL_TIME_LATER', 'Choose an until time later than the start time with a difference of 2 months or less.')
  ]

  /**
   * Get session
   */
  const [session] = useSession()

  /**
   * Array to save drivers
   */
  const [driversList, setDriversList] = useState({ users: [], loading: false, error: null })

  const handleSetInitialStates = () => {
    setSelectedBlock({
      user: null,
      block: null
    })
    const initialState = {
      start: `${actualDate} 00:00:00`,
      end: `${actualDate} 23:59:00`
    }
    setScheduleState({
      state: initialState,
      loading: false,
      error: null
    })
    setShowBreakBlock(false)
    setRuleState({ freq: null, byweekday: [] })
    setPropagation('none')
    setSelectedDate(new Date(date[0]))
    setSelectedUntilDate(new Date(date[0]))
    setStackEventsState({ open: false, events: [], user: null })
    setOpenModal(false)
  }
  /**
   * Method to get drivers from API
   * @param {Number} page change time
   * @param {Number} pageSize open or close time
   * @param {Number} selectedGroup
   */
  const getDrivers = async (page, pageSize, selectedGroupId) => {
    try {
      setDriversList({ ...driversList, loading: true })
      const conditions = [{ attribute: 'level', value: '4' }]
      if (filterValues?.driverIds?.length > 0) {
        conditions.push({ attribute: 'id', value: filterValues?.driverIds })
      }
      const where = `&where=${JSON.stringify({
        conditions,
        conector: 'AND'
      })}`

      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        }
      }
      const endpoint = selectedGroupId ? `${ordering.root}/drivergroups/${selectedGroupId}/drivers` : `${ordering.root}/users`
      const response = await fetch(`${endpoint}?delivery_block_from=${date[0]}&delivery_block_to=${date[1]}&page=${page}&page_size=${pageSize}&params=${propsToFetch}${where}`, requestOptions)
      const content = await response.json()

      const { result, pagination, error } = content

      if (error) {
        setDriversList({
          ...driversList,
          loading: false,
          error: result
        })
      } else {
        const formattedUtcToLocalUsers = result.map(user => ({
          ...user,
          delivery_blocks: user.delivery_blocks.map(block => ({
            ...block,
            start: moment(moment.utc(block.start).toDate()).local().format('YYYY-MM-DD HH:mm:ss'),
            end: moment(moment.utc(block.end).toDate()).local().format('YYYY-MM-DD HH:mm:ss'),
            break_start: block.break_start ? moment(moment.utc(block.break_start).toDate()).local().format('YYYY-MM-DD HH:mm:ss') : null,
            break_end: block.break_end ? moment(moment.utc(block.break_end).toDate()).local().format('YYYY-MM-DD HH:mm:ss') : null
          }))
        }))
        driversList.users = formattedUtcToLocalUsers
        setDriversList({
          ...driversList,
          loading: false
        })
        let nextPageItems = 0
        if (pagination.current_page !== pagination.total_pages) {
          const remainingItems = pagination.total - driversList.users.length
          nextPageItems = remainingItems < pagination.page_size ? remainingItems : pagination.page_size
        }
        setPaginationProps({
          ...paginationProps,
          currentPage: pagination.current_page,
          pageSize: pagination.page_size === 0 ? paginationProps.pageSize : pagination.page_size,
          totalPages: pagination.total_pages,
          totalItems: pagination.total,
          from: pagination.from,
          to: pagination.to,
          nextPageItems
        })
      }
    } catch (err) {
      if (err.constructor.name !== 'Cancel') {
        setDriversList({
          ...driversList,
          loading: false,
          error: [err.message]
        })
      }
    }
  }
  /**
   * Method to validate time
   * @param {String} changeTime change time
   * @param {Boolean} isOpen open or close time
   * @param {Boolean} isBreak open break or close break time
   */
  const handleChangeScheduleTime = (changeTime, isOpen, isBreak) => {
    const _date = moment(`${actualDate} ${changeTime}:00`)

    let _isTimeChangeError = false
    if (isOpen) {
      _isTimeChangeError = !isBreak ? _date.isSameOrAfter(scheduleState?.state?.end ? moment(scheduleState?.state?.end) : '23:59') : (_date.isSameOrAfter(scheduleState?.state?.break_end ? moment(scheduleState?.state?.break_end) : '23:59') || _date.isSameOrAfter(scheduleState?.state?.end ? moment(scheduleState?.state?.end) : '23:59') || _date.isSameOrBefore(scheduleState?.state?.start ? moment(scheduleState?.state?.start) : '00:00'))
      if (_isTimeChangeError) {
        setIsTimeChangeError({
          state: true,
          error: isBreak ? 3 : 1
        })
      } else {
        isBreak
          ? setScheduleState({
            ...scheduleState,
            state: {
              ...scheduleState.state,
              break_start: `${actualDate} ${changeTime}:00`,
              break_end: scheduleState?.break_end ?? selectedBlock?.block?.break_end ?? `${actualDate} 23:59:00`
            }
          })
          : setScheduleState({
            ...scheduleState,
            state: {
              ...scheduleState.state,
              start: `${actualDate} ${changeTime}:00`,
              end: scheduleState?.end ?? selectedBlock?.block?.end ?? `${actualDate} 23:59:00`
            }
          })
      }
    } else {
      _isTimeChangeError = !isBreak ? _date.isSameOrBefore(scheduleState?.state?.start ? moment(scheduleState?.state?.start) : '00:00') : (_date.isSameOrBefore(scheduleState?.state?.break_start ? moment(scheduleState?.state?.break_start) : '00:00') || _date.isSameOrBefore(scheduleState?.state?.start ? moment(scheduleState?.state?.start) : '00:00') || _date.isSameOrAfter(scheduleState?.state?.end ? moment(scheduleState?.state?.end) : '23:59'))
      if (_isTimeChangeError && !selectedBlock?.block) {
        setIsTimeChangeError({
          state: true,
          error: isBreak ? 2 : 0
        })
      } else {
        isBreak
          ? setScheduleState({
            ...scheduleState,
            state: {
              ...scheduleState.state,
              break_start: scheduleState?.state?.break_start ?? selectedBlock?.block?.break_start ?? `${actualDate} 00:00:00`,
              break_end: `${actualDate} ${changeTime}:00`
            }
          })
          : setScheduleState({
            ...scheduleState,
            state: {
              ...scheduleState.state,
              start: scheduleState?.state?.start ?? selectedBlock?.block?.start ?? `${actualDate} 00:00:00`,
              end: `${actualDate} ${changeTime}:00`
            }
          })
      }
    }
  }

  /**
  * Method to add block time
  */
  const handleAddBlockTime = async () => {
    try {
      const scheduleUtc = {
        start: moment(scheduleState.state.start).utc().format('YYYY-MM-DD HH:mm:ss'),
        end: moment(scheduleState.state.end).utc().format('YYYY-MM-DD HH:mm:ss')
      }
      if (scheduleState.state.rrule) {
        scheduleUtc.rrule = scheduleState.state.rrule
      }
      if (scheduleState.state.until) {
        scheduleUtc.until = moment(scheduleState.state.until).utc().format('YYYY-MM-DD HH:mm:ss')
      }
      if (scheduleState.state.break_start && showBreakBlock) {
        scheduleUtc.break_start = moment(scheduleState.state.break_start).utc().format('YYYY-MM-DD HH:mm:ss')
      }
      if (scheduleState.state.break_end && showBreakBlock) {
        scheduleUtc.break_end = moment(scheduleState.state.break_end).utc().format('YYYY-MM-DD HH:mm:ss')
      }
      if (scheduleState.state.name) {
        scheduleUtc.name = scheduleState.state.name
      }
      if (scheduleState.state.description) {
        scheduleUtc.description = scheduleState.state.description
      }
      setScheduleState({ ...scheduleState, loading: true })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify(scheduleUtc)
      }
      const response = await fetch(`${ordering.root}/drivers/${selectedBlock?.user?.id}/delivery_blocks`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        await getDrivers(paginationProps.currentPage, paginationProps.pageSize, selectedGroup?.id)
        handleSetInitialStates()
      } else {
        setScheduleState({
          ...scheduleState,
          loading: false,
          error: result
        })
        setAlertState({
          open: true,
          content: result
        })
      }
    } catch (err) {
      setScheduleState({
        ...scheduleState,
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
  * Method to delete block time
  */
  const deleteBlockTime = async () => {
    try {
      setScheduleState({ ...scheduleState, loading: true })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify({
          propagation
        })
      }
      const response = await fetch(`${ordering.root}/drivers/${selectedBlock?.user?.id}/delivery_blocks/${selectedBlock?.block?.id}`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        await getDrivers(paginationProps.currentPage, paginationProps.pageSize, selectedGroup?.id)
        handleSetInitialStates()
        setOpenDeleteModal(false)
      } else {
        setScheduleState({
          ...scheduleState,
          loading: false,
          error: result
        })
      }
    } catch (err) {
      setScheduleState({
        ...scheduleState,
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
  * Method to edit block time
  */
  const editBlockTime = async () => {
    try {
      setScheduleState({ ...scheduleState, loading: true })
      const scheduleUtc = {
        start: moment(scheduleState.state.start).utc().format('YYYY-MM-DD HH:mm:ss'),
        end: moment(scheduleState.state.end).utc().format('YYYY-MM-DD HH:mm:ss')
      }
      if (scheduleState.state.rrule) {
        scheduleUtc.rrule = scheduleState.state.rrule
      }
      if (scheduleState.state.until) {
        scheduleUtc.until = moment(scheduleState.state.until).utc().format('YYYY-MM-DD HH:mm:ss')
      }
      if (scheduleState.state.break_start) {
        scheduleUtc.break_start = moment(scheduleState.state.break_start).utc().format('YYYY-MM-DD HH:mm:ss')
      }
      if (scheduleState.state.break_end) {
        scheduleUtc.break_end = moment(scheduleState.state.break_end).utc().format('YYYY-MM-DD HH:mm:ss')
      }
      if (scheduleState.state.name) {
        scheduleUtc.name = scheduleState.state.name
      }
      if (scheduleState.state.description) {
        scheduleUtc.description = scheduleState.state.description
      }
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify({
          ...scheduleUtc,
          propagation
        })
      }
      const response = await fetch(`${ordering.root}/drivers/${selectedBlock?.user?.id}/delivery_blocks/${selectedBlock?.block?.id}`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        await getDrivers(paginationProps.currentPage, paginationProps.pageSize, selectedGroup?.id)
        handleSetInitialStates()
        setOpenEditModal(false)
      } else {
        setScheduleState({
          ...scheduleState,
          loading: false,
          error: result
        })
        setAlertState({
          open: true,
          content: result
        })
      }
    } catch (err) {
      setScheduleState({
        ...scheduleState,
        loading: false,
        error: [err.message]
      })
    }
  }

  const handleSelectedUntilDate = (date) => {
    // if (moment(date).isSameOrBefore(selectedDate)) return
    setScheduleState({
      ...scheduleState,
      state: {
        ...scheduleState.state,
        until: moment(date).endOf('day').format('YYYY-MM-DD HH:mm:ss')
      }
    })
  }

  const handleChangeDriver = (driverId) => {
    let _driverIds = [...filterValues.driverIds]
    if (!_driverIds.includes(driverId)) {
      _driverIds.push(driverId)
    } else {
      _driverIds = _driverIds.filter((id) => id !== driverId)
    }
    setFilterValues({ ...filterValues, driverIds: _driverIds })
  }

  const handleClearFilters = () => {
    setFilterValues({
      driverIds: []
    })
  }

  const handleClearDriversList = () => {
    setDriversList({
      ...driversList,
      users: []
    })
  }

  useEffect(() => {
    if (selectedGroup?.id && filtOption === 'driver_groups') {
      getDrivers(paginationProps.initialPage, paginationProps.pageSize, selectedGroup?.id)
    }
    if (filtOption === 'drivers') {
      getDrivers(paginationProps.initialPage, paginationProps.pageSize)
    }
  }, [selectedGroup?.id, date, filterValues?.driverIds, filtOption])

  useEffect(() => {
    const _startHour = moment(scheduleState?.state?.start ?? selectedBlock?.block?.start).format('HH:mm')
    const _endHour = moment(scheduleState?.state?.end ?? selectedBlock?.block?.end).format('HH:mm')
    const _breakStartHour = moment(scheduleState?.state?.break_start ?? selectedBlock?.block?.break_start).format('HH:mm')
    const _breakEndHour = moment(scheduleState?.state?.break_end ?? selectedBlock?.block?.break_end).format('HH:mm')

    let changes = showBreakBlock
      ? {
          start: `${actualDate} ${_startHour}:00`,
          end: `${actualDate} ${_endHour}:00`,
          break_start: `${actualDate} ${_breakStartHour}:00`,
          break_end: `${actualDate} ${_breakEndHour}:00`
        }
      : {
          start: `${actualDate} ${_startHour}:00`,
          end: `${actualDate} ${_endHour}:00`
        }
    if (!moment(selectedDate).isSameOrBefore(selectedUntilDate)) {
      changes = {
        ...changes,
        until: moment(selectedDate).endOf('day').format('YYYY-MM-DD HH:mm:ss')
      }
      setSelectedUntilDate(selectedDate)
    }

    setScheduleState({
      ...scheduleState,
      state: {
        ...scheduleState.state,
        ...changes
      }
    })
  }, [selectedDate])

  useEffect(() => {
    setShowBreakBlock(!!(selectedBlock?.block?.break_start))
  }, [selectedBlock?.block?.break_start])

  useEffect(() => {
    if (date[0]) {
      handleSetInitialStates()
    }
  }, [date])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          date={date}
          setDate={setDate}
          openModal={openModal}
          getDrivers={getDrivers}
          alertState={alertState}
          driversList={driversList}
          propagation={propagation}
          setOpenModal={setOpenModal}
          selectedDate={selectedDate}
          scheduleState={scheduleState}
          selectedBlock={selectedBlock}
          setAlertState={setAlertState}
          timeErrorList={timeErrorList}
          editBlockTime={editBlockTime}
          openEditModal={openEditModal}
          setPropagation={setPropagation}
          showBreakBlock={showBreakBlock}
          selectedGroup={selectedGroup}
          paginationProps={paginationProps}
          ruleState={ruleState}
          setRuleState={setRuleState}
          actualDate={actualDate}
          setSelectedDate={setSelectedDate}
          deleteBlockTime={deleteBlockTime}
          openDeleteModal={openDeleteModal}
          setScheduleState={setScheduleState}
          setSelectedBlock={setSelectedBlock}
          setOpenEditModal={setOpenEditModal}
          stackEventsState={stackEventsState}
          isTimeChangeError={isTimeChangeError}
          selectedUntilDate={selectedUntilDate}
          setShowBreakBlock={setShowBreakBlock}
          setOpenDeleteModal={setOpenDeleteModal}
          handleAddBlockTime={handleAddBlockTime}
          setSelectedGroup={setSelectedGroup}
          setStackEventsState={setStackEventsState}
          setSelectedUntilDate={setSelectedUntilDate}
          setIsTimeChangeError={setIsTimeChangeError}
          handleChangeScheduleTime={handleChangeScheduleTime}
          handleSelectedUntilDate={handleSelectedUntilDate}
          handleSetInitialStates={handleSetInitialStates}
          filterValues={filterValues}
          handleChangeDriver={handleChangeDriver}
          handleClearFilters={handleClearFilters}
          handleClearDriversList={handleClearDriversList}
          setFiltOption={setFiltOption}
          filtOption={filtOption}
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
   * Array of drivers props to fetch
   */
  propsToFetch: PropTypes.arrayOf(string)
}

const defaultProps = {
  propsToFetch: []
}

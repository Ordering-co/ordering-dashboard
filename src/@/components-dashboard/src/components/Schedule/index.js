import React, { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'

const schedulesEqual = (left, right) => JSON.stringify(left || []) === JSON.stringify(right || [])
const cloneSchedule = schedule => (schedule || []).map(day => ({
  ...day,
  lapses: (day?.lapses || []).map(lapse => ({
    ...lapse,
    open: { ...lapse.open },
    close: { ...lapse.close }
  }))
}))

export const Schedule = (props) => {
  const {
    UIComponent,
    scheduleList,
    handleChangeScheduleState
  } = props

  const [scheduleState, setScheduleState] = useState([])
  const scheduleRef = useRef(scheduleState)
  const commitSchedule = (nextSchedule) => {
    scheduleRef.current = nextSchedule
    setScheduleState(nextSchedule)
  }
  const [isConflict, setIsConflict] = useState(false)
  const [isTimeChangeError, setIsTimeChangeError] = useState(false)
  const [addScheduleTime, setAddScheduleTime] = useState({
    open: { hour: 0, minute: 0 },
    close: { hour: 23, minute: 59 }
  })
  const [openAddSchedule, setOpenAddSchedule] = useState({})
  const [selectedCopyDays, setSelectedCopyDays] = useState([])
  const selectedCopyDaysRef = useRef(selectedCopyDays)

  /**
   * Clean selectedCopyDays
   */
  const cleanSelectedCopyDays = () => {
    selectedCopyDaysRef.current = []
    setSelectedCopyDays([])
  }

  /**
   * Method to covert into minutes
   */
  const convertMinutes = ({ hour, minute }) => {
    return hour * 60 + minute
  }

  /**
   * Method to check contain conflict
   */
  const isCheckConflict = (lapses, newSchedule, index) => {
    const openNew = newSchedule.open.hour * 60 + newSchedule.open.minute
    const closeNew = newSchedule.close.hour * 60 + newSchedule.close.minute

    for (let i = 0; i < lapses.length; i++) {
      if (i !== index) {
        const openOld = lapses[i].open.hour * 60 + lapses[i].open.minute
        const closeOld = lapses[i].close.hour * 60 + lapses[i].close.minute

        // Check for any overlap
        if (openNew <= closeOld && closeNew >= openOld) return true
        if (openNew === closeOld || openNew === openOld) return true
        if (closeNew === closeOld || closeNew === openOld) return true
      }
    }

    return false
  }

  /**
   * Method to control the schedule
   */
  const handleEnabledSchedule = (daysOfWeekIndex, checked) => {
    const _schedule = cloneSchedule(scheduleRef.current)
    _schedule[daysOfWeekIndex].enabled = checked
    commitSchedule(_schedule)
  }

  /**
   * Method to change the schedule time on the week day
   * @param {String} changeTime change time
   * @param {Number} daysOfWeekIndex week day
   * @param {Number} lapseIndex lapse no
   * @param {Boolean} isOpen open or close
   */
  const handleChangeScheduleTime = (changeTime, daysOfWeekIndex, lapseIndex, isOpen, value) => {
    const _schedule = cloneSchedule(scheduleRef.current)
    const currentLapses = [..._schedule[daysOfWeekIndex].lapses]

    let changeScheduleTime
    let _isTimeChangeError = false
    if (isOpen) {
      const open = { ...currentLapses[lapseIndex].open, [value]: changeTime }
      _isTimeChangeError = convertMinutes({ hour: open.hour, minute: open.minute }) >= convertMinutes(currentLapses[lapseIndex].close)
      if (_isTimeChangeError) {
        setIsTimeChangeError(true)
      } else {
        changeScheduleTime = {
          open,
          close: currentLapses[lapseIndex].close
        }
      }
    } else {
      const close = { ...currentLapses[lapseIndex].close, [value]: changeTime }
      _isTimeChangeError = convertMinutes(currentLapses[lapseIndex].open) >= convertMinutes({ hour: close.hour, minute: close.minute })
      if (_isTimeChangeError) {
        setIsTimeChangeError(true)
      } else {
        changeScheduleTime = {
          open: currentLapses[lapseIndex].open,
          close
        }
      }
    }

    if (!_isTimeChangeError) {
      const conflict = isCheckConflict(currentLapses, changeScheduleTime, lapseIndex)
      if (conflict) {
        setIsConflict(true)
      } else {
        _schedule[daysOfWeekIndex].lapses[lapseIndex] = changeScheduleTime
        _schedule[daysOfWeekIndex].lapses.sort((a, b) => convertMinutes(a.open) - convertMinutes(b.open))
        commitSchedule(_schedule)
      }
    }
  }

  /**
   * Method to delete the schedule time on the week day
   * @param {Number} daysOfWeekIndex week day
   * @param {Number} index lapse index
   */
  const handleDeleteSchedule = (daysOfWeekIndex, index) => {
    const _schedule = cloneSchedule(scheduleRef.current)
    _schedule[daysOfWeekIndex].lapses.splice(index, 1)
    commitSchedule(_schedule)
  }

  const handleOpenAddSchedule = (daysOfWeekIndex) => {
    setAddScheduleTime({
      open: { hour: 0, minute: 0 },
      close: { hour: 23, minute: 59 }
    })
    setOpenAddSchedule({
      [daysOfWeekIndex]: true
    })
  }

  /**
   * Method to change the add schedule time
   * @param {String} changeTime change time
   * @param {Boolean} isOpen open or close
   */
  const handleChangeAddScheduleTime = (changeTime, isOpen, value) => {
    setAddScheduleTime((prevProps) => {
      let _isTimeChangeError = false
      if (isOpen) {
        const open = { ...prevProps.open, [value]: changeTime }
        _isTimeChangeError = convertMinutes({ hour: open.hour, minute: open.minute }) >= convertMinutes(prevProps.close)
        if (_isTimeChangeError) {
          setIsTimeChangeError(true)
          return prevProps
        }
        return {
          ...prevProps,
          open
        }
      } else {
        const close = { ...prevProps.close, [value]: changeTime }
        _isTimeChangeError = convertMinutes(prevProps.open) >= convertMinutes({ hour: close.hour, minute: close.minute })
        if (_isTimeChangeError) {
          setIsTimeChangeError(true)
          return prevProps
        }
        return {
          ...prevProps,
          close
        }
      }
    })
  }

  /**
   * Method to find a free time slot
   */
  const findFreeTimeSlot = (lapses) => {
    // Sort existing lapses by start time
    const sortedLapses = [...lapses].sort((a, b) => convertMinutes(a.open) - convertMinutes(b.open))

    // Try to find a gap between existing lapses
    for (let i = 0; i < sortedLapses.length - 1; i++) {
      const currentClose = convertMinutes(sortedLapses[i].close)
      const nextOpen = convertMinutes(sortedLapses[i + 1].open)

      // If there's at least 15 minutes gap between lapses
      if (nextOpen - currentClose >= 15) {
        const startMinutes = currentClose + 1 // Add 1 minute to avoid overlap
        const endMinutes = nextOpen - 1 // Subtract 1 minute to avoid overlap

        // Only create new lapse if there's enough space
        if (endMinutes - startMinutes >= 15) {
          return {
            open: {
              hour: Math.floor(startMinutes / 60),
              minute: startMinutes % 60
            },
            close: {
              hour: Math.floor(endMinutes / 60),
              minute: endMinutes % 60
            }
          }
        }
      }
    }

    // If there's no gaps, try to add before the first lapse or after the last one
    if (sortedLapses.length > 0) {
      const firstOpen = convertMinutes(sortedLapses[0].open)
      const lastClose = convertMinutes(sortedLapses[sortedLapses.length - 1].close)

      // Try to add before the first lapse
      if (firstOpen >= 15) {
        return {
          open: { hour: 0, minute: 0 },
          close: {
            hour: Math.floor((firstOpen - 1) / 60),
            minute: (firstOpen - 1) % 60
          }
        }
      }

      // Try to add after the last lapse
      const totalMinutes = 23 * 60 + 59
      if (totalMinutes - lastClose >= 15) {
        const startMinutes = lastClose + 1
        return {
          open: {
            hour: Math.floor(startMinutes / 60),
            minute: startMinutes % 60
          },
          close: {
            hour: 23,
            minute: 59
          }
        }
      }
    }

    return null
  }

  /**
   * Method to add new schedule on the week day
   * @param {Number} daysOfWeekIndex week day
   */
  const handleAddSchedule = (daysOfWeekIndex) => {
    const _schedule = cloneSchedule(scheduleRef.current)
    const currentLapses = [..._schedule[daysOfWeekIndex].lapses]

    // Find a free time slot
    const newTimeSlot = findFreeTimeSlot(currentLapses)

    if (newTimeSlot) {
      _schedule[daysOfWeekIndex].lapses.push(newTimeSlot)
      _schedule[daysOfWeekIndex].lapses.sort((a, b) => convertMinutes(a.open) - convertMinutes(b.open))
      commitSchedule(_schedule)
      setOpenAddSchedule({
        [daysOfWeekIndex]: false
      })
    } else {
      setIsConflict(true)
    }
  }

  /**
   * Method to copy times
   * @param {Number} index selected index
   * @param {Number} daysOfWeekIndex index of week days
   */
  const handleSelectCopyTimes = (index) => {
    const currentDays = selectedCopyDaysRef.current
    const nextDays = currentDays.includes(index)
      ? currentDays.filter(day => day !== index)
      : [...currentDays, index]
    selectedCopyDaysRef.current = nextDays
    setSelectedCopyDays(nextDays)
  }
  /**
   * Method to apply copy times
   * @param {Number} daysOfWeekIndex index of week days
   */
  const handleApplyScheduleCopyTimes = (daysOfWeekIndex) => {
    const currentSchedule = scheduleRef.current
    const _schedule = currentSchedule.map((option, index) => {
      if (selectedCopyDaysRef.current.includes(index)) {
        const source = cloneSchedule([currentSchedule[daysOfWeekIndex]])[0]
        return { enabled: source.enabled, lapses: source.lapses }
      }
      return option
    })
    commitSchedule(_schedule)
  }

  useEffect(() => {
    if (scheduleState.length === 0) return
    if (schedulesEqual(scheduleState, scheduleList)) return
    handleChangeScheduleState([...scheduleState])
  }, [scheduleState])

  useEffect(() => {
    if (scheduleList) {
      if (!schedulesEqual(scheduleRef.current, scheduleList)) {
        commitSchedule([...scheduleList])
      }
    } else {
      const schedule = []
      for (let i = 0; i < 7; i++) {
        schedule.push({
          enabled: true,
          lapses: [
            {
              open: {
                hour: 0,
                minute: 0
              },
              close: {
                hour: 23,
                minute: 59
              }
            }
          ]
        })
      }
      if (!schedulesEqual(scheduleRef.current, schedule)) {
        commitSchedule(schedule)
      }
    }
  }, [scheduleList])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          scheduleState={scheduleState}
          isConflict={isConflict}
          setIsConflict={setIsConflict}
          isTimeChangeError={isTimeChangeError}
          addScheduleTime={addScheduleTime}
          openAddSchedule={openAddSchedule}
          setIsTimeChangeError={setIsTimeChangeError}
          handleEnabledSchedule={handleEnabledSchedule}
          handleChangeScheduleTime={handleChangeScheduleTime}
          handleDeleteSchedule={handleDeleteSchedule}
          handleOpenAddSchedule={handleOpenAddSchedule}
          handleChangeAddScheduleTime={handleChangeAddScheduleTime}
          handleAddSchedule={handleAddSchedule}
          selectedCopyDays={selectedCopyDays}
          cleanSelectedCopyDays={cleanSelectedCopyDays}
          handleSelectCopyTimes={handleSelectCopyTimes}
          handleApplyScheduleCopyTimes={handleApplyScheduleCopyTimes}
        />
      )}
    </>
  )
}

Schedule.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}

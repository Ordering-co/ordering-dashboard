import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'

import { DAY, todayDay } from '../../../../utils/dateRange'
import { addQueryToUrl, removeQueryToUrl } from '../../utils'

dayjs.extend(customParseFormat)

// redesign SC-B1 (decision 3A; M-SC02, M-SC09): the day, grade and classroom that «Meals & reports» and «Print labels» share live in the
// URL (?date=, ?grade=, ?classroom=), so a link, a reload and a switch of tab keep them. The state of React follows the URL: a change of
// filter re-renders at once (history.replaceState does not reach the router) and a navigation (back button) is read again.

const isDay = (value) => typeof value === 'string' && dayjs(value, DAY, true).isValid()

// the select compares ids with ===: a grade in the URL is a number, and what is not a whole id is no filter
const toId = (value) => {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null
  const id = Number(value)
  return id > 0 ? id : null
}

const read = () => {
  const params = new URLSearchParams(window.location.search)
  const date = params.get('date')
  return {
    // redesign SC-B1 (M-SC02): the LOCAL day. main used toISOString(), which is UTC and is already tomorrow in the evening of the Americas.
    day: isDay(date) ? date : todayDay(),
    // a ?date= that is there but is not a day (or is empty) is dropped from the URL by the effect below
    badDate: date !== null && !isDay(date),
    gradeId: toId(params.get('grade')),
    classroomId: toId(params.get('classroom'))
  }
}

const same = (a, b) => a.day === b.day && a.gradeId === b.gradeId && a.classroomId === b.classroomId

/**
 * `{ day, gradeId, classroomId, setDay, setGradeId, setClassroomId, clearGroupFilters }`.
 * `day` is `YYYY-MM-DD`, today (local) when the URL has none or a wrong one. `setDay(today)` removes `?date=` instead of writing it.
 * `setGradeId(null)` / `setClassroomId(null)` remove their parameter. All the setters (and `clearGroupFilters`) drop `?page=`, as main did
 * when a filter changed. `clearGroupFilters()` removes grade, classroom and page: the shell calls it when the school changes.
 */
export const useSchoolDay = () => {
  const { search } = useLocation()
  const [state, setState] = useState(read)

  // the URL is the source: read it again when the router navigates
  useEffect(() => {
    const next = read()
    if (next.badDate) removeQueryToUrl(['date'])
    setState(current => (same(current, next) ? current : next))
  }, [search])

  const setDay = useCallback((day) => {
    if (!isDay(day)) return
    if (day === todayDay()) removeQueryToUrl(['date', 'page'])
    else {
      removeQueryToUrl(['page'])
      addQueryToUrl({ date: day })
    }
    setState(current => ({ ...current, day }))
  }, [])

  const setGradeId = useCallback((id) => {
    if (id === null || id === undefined) removeQueryToUrl(['grade', 'page'])
    else {
      removeQueryToUrl(['page'])
      addQueryToUrl({ grade: id })
    }
    setState(current => ({ ...current, gradeId: id ?? null }))
  }, [])

  const setClassroomId = useCallback((id) => {
    if (id === null || id === undefined) removeQueryToUrl(['classroom', 'page'])
    else {
      removeQueryToUrl(['page'])
      addQueryToUrl({ classroom: id })
    }
    setState(current => ({ ...current, classroomId: id ?? null }))
  }, [])

  const clearGroupFilters = useCallback(() => {
    removeQueryToUrl(['grade', 'classroom', 'page'])
    setState(current => ({ ...current, gradeId: null, classroomId: null }))
  }, [])

  return {
    day: state.day,
    gradeId: state.gradeId,
    classroomId: state.classroomId,
    setDay,
    setGradeId,
    setClassroomId,
    clearGroupFilters
  }
}

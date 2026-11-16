// redesign SC-B1 (decision 3A; M-SC02, M-SC09): the day, grade and classroom that «Meals & reports» and «Print labels» share, in the URL.
// Real helpers (dayjs, todayDay, addQueryToUrl, removeQueryToUrl); the router is a BrowserRouter so a change of the URL reaches useLocation.
import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import { act, renderHook } from '@testing-library/react'
import dayjs from 'dayjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSchoolDay } from '../useSchoolDay'

const wrapper = ({ children }) => <BrowserRouter>{children}</BrowserRouter>
const setUrl = (search = '') => window.history.replaceState(null, '', `/schools${search}`)
const params = () => Object.fromEntries(new URLSearchParams(window.location.search))
const render = () => renderHook(() => useSchoolDay(), { wrapper })
const today = () => dayjs().format('YYYY-MM-DD')

const originalTz = process.env.TZ

beforeEach(() => setUrl())
afterEach(() => {
  vi.useRealTimers()
  if (originalTz === undefined) delete process.env.TZ
  else process.env.TZ = originalTz
})

describe('the day', () => {
  it('is today by default, and the URL is not written for it', () => {
    const { result } = render()
    expect(result.current.day).toBe(today())
    expect(window.location.search).toBe('')
  })

  it('is the LOCAL day, not the UTC one (M-SC02): 23:30 in UTC-5 is still the same day', () => {
    process.env.TZ = 'America/Bogota'
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-12T04:30:00Z')) // 23:30 on the 11th in Bogota, already the 12th in UTC
    // the precondition: the engine really runs in that zone, or this test would prove nothing
    expect(new Date().getDate()).not.toBe(new Date().getUTCDate())
    const { result } = render()
    expect(result.current.day).toBe('2026-10-11')
  })

  it('a valid ?date= rules', () => {
    setUrl('?date=2026-03-04')
    const { result } = render()
    expect(result.current.day).toBe('2026-03-04')
    expect(params().date).toBe('2026-03-04')
  })

  it.each([['not-a-date'], ['2026-13-40'], ['2026-02-30'], ['04/03/2026'], ['']])('an invalid ?date=%s is today and leaves the URL', (bad) => {
    setUrl(`?date=${bad}&grade=2`)
    const { result } = render()
    expect(result.current.day).toBe(today())
    expect(params()).toEqual({ grade: '2' })
  })

  it('setDay writes ?date= for another day and drops page', () => {
    setUrl('?page=3&tab=meals')
    const { result } = render()
    act(() => result.current.setDay('2026-05-06'))
    expect(result.current.day).toBe('2026-05-06')
    expect(params()).toEqual({ tab: 'meals', date: '2026-05-06' })
  })

  it('setDay(today) removes ?date= instead of writing it', () => {
    setUrl('?date=2026-05-06&tab=meals')
    const { result } = render()
    act(() => result.current.setDay(today()))
    expect(result.current.day).toBe(today())
    expect(params()).toEqual({ tab: 'meals' })
  })
})

describe('grade and classroom', () => {
  it('are read from ?grade= and ?classroom= as numbers (the select compares with ===)', () => {
    setUrl('?grade=4&classroom=11')
    const { result } = render()
    expect(result.current.gradeId).toBe(4)
    expect(result.current.classroomId).toBe(11)
  })

  it('are null without the parameter', () => {
    const { result } = render()
    expect(result.current.gradeId).toBeNull()
    expect(result.current.classroomId).toBeNull()
  })

  it.each([['abc'], ['1.5'], ['-2'], ['0'], ['4x'], ['']])('a ?grade=%s that is not a whole id is ignored', (bad) => {
    setUrl(`?grade=${bad}&classroom=${bad}`)
    const { result } = render()
    expect(result.current.gradeId).toBeNull()
    expect(result.current.classroomId).toBeNull()
  })

  it('setGradeId puts the parameter, re-renders at once and drops page', () => {
    setUrl('?page=2')
    const { result } = render()
    act(() => result.current.setGradeId(5))
    expect(result.current.gradeId).toBe(5)
    expect(params()).toEqual({ grade: '5' })
  })

  it('setGradeId(null) removes the parameter', () => {
    setUrl('?grade=5&classroom=3')
    const { result } = render()
    act(() => result.current.setGradeId(null))
    expect(result.current.gradeId).toBeNull()
    expect(params()).toEqual({ classroom: '3' })
  })

  it('setClassroomId works the same, and changing a filter drops page', () => {
    setUrl('?page=4&classroom=3')
    const { result } = render()
    act(() => result.current.setClassroomId(8))
    expect(result.current.classroomId).toBe(8)
    expect(params()).toEqual({ classroom: '8' })
    act(() => result.current.setClassroomId(null))
    expect(result.current.classroomId).toBeNull()
    expect(window.location.search).toBe('')
  })

  it('clearGroupFilters removes grade, classroom and page from the URL and from the state, and keeps the day', () => {
    setUrl('?date=2026-05-06&grade=5&classroom=3&page=2&tab=meals')
    const { result } = render()
    act(() => result.current.clearGroupFilters())
    expect(result.current.gradeId).toBeNull()
    expect(result.current.classroomId).toBeNull()
    expect(result.current.day).toBe('2026-05-06')
    expect(params()).toEqual({ date: '2026-05-06', tab: 'meals' })
  })
})

describe('the URL as the source', () => {
  it('two readers mounted one after the other see the same day', () => {
    const first = render()
    act(() => first.result.current.setDay('2026-07-08'))
    first.unmount()
    const second = render()
    expect(second.result.current.day).toBe('2026-07-08')
  })

  it('a navigation of the router (back button) is read again', () => {
    setUrl('?date=2026-05-06&grade=5')
    const { result } = render()
    expect(result.current.gradeId).toBe(5)
    act(() => {
      window.history.pushState(null, '', '/schools?date=2026-06-07&classroom=9')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(result.current.day).toBe('2026-06-07')
    expect(result.current.gradeId).toBeNull()
    expect(result.current.classroomId).toBe(9)
  })
})

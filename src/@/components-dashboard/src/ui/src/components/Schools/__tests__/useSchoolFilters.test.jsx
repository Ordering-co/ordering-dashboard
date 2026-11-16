// redesign SC-B4 (decision 3A; M-SC13, auditor 1): the grades and classrooms of a school that the filters of the day bar offer.
// Only the API is replaced; the hook is the real one.
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const listGrades = vi.fn()
const listClassrooms = vi.fn()
const ORDERING = { root: 'https://api.example/v400/en/demo' }
const SESSION = { token: 'session-token' }

vi.mock('../../../../../index', () => ({
  useApi: () => [ORDERING],
  useSession: () => [SESSION]
}))

vi.mock('../../../../../components/Schools/schoolApi', () => ({
  listGrades: (...args) => listGrades(...args),
  listClassrooms: (...args) => listClassrooms(...args)
}))

import { useSchoolFilters, useDropForeignFilters } from '../useSchoolFilters'

const ok = (result) => ({ error: false, result })

const deferred = () => {
  let finish
  const promise = new Promise((resolve) => { finish = resolve })
  return { promise, resolve: finish }
}

beforeEach(() => {
  vi.clearAllMocks()
  listGrades.mockResolvedValue(ok([{ id: 1, name: 'Grade A' }]))
  listClassrooms.mockResolvedValue(ok([{ id: 10, name: 'Room 1' }]))
})

describe('useSchoolFilters', () => {
  it('asks for the grades and classrooms of the school, 100 at a time (as main did)', async () => {
    const { result } = renderHook(() => useSchoolFilters(67))
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(listGrades).toHaveBeenCalledWith(ORDERING, 'session-token', { schoolId: 67, pageSize: 100 })
    expect(listClassrooms).toHaveBeenCalledWith(ORDERING, 'session-token', { schoolId: 67, pageSize: 100 })
  })

  it('answers { grades, classrooms, loaded }: empty and not loaded until both lists answer', async () => {
    const grades = deferred()
    listGrades.mockReturnValue(grades.promise)
    const { result } = renderHook(() => useSchoolFilters(67))
    expect(result.current).toEqual({ grades: [], classrooms: [], loaded: false })
    await act(async () => { await Promise.resolve() })
    // the classrooms answered, the grades did not: still not loaded
    expect(result.current.loaded).toBe(false)
    await act(async () => { grades.resolve(ok([{ id: 1, name: 'Grade A' }])) })
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.grades).toEqual([{ id: 1, name: 'Grade A' }])
    expect(result.current.classrooms).toEqual([{ id: 10, name: 'Room 1' }])
  })

  it('empties both lists the moment the school changes, and does not keep the old school when the new one fails', async () => {
    const { result, rerender } = renderHook(({ schoolId }) => useSchoolFilters(schoolId), { initialProps: { schoolId: 67 } })
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.grades).toHaveLength(1)

    const pendingGrades = deferred()
    listGrades.mockReturnValue(pendingGrades.promise)
    rerender({ schoolId: 68 })
    // in the very render of the change: nothing of school 67 is offered
    expect(result.current).toEqual({ grades: [], classrooms: [], loaded: false })

    listGrades.mockResolvedValue({ error: true, result: ['Boom'] })
    listClassrooms.mockResolvedValue({ error: true, result: ['Boom'] })
    rerender({ schoolId: 69 })
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.grades).toEqual([])
    expect(result.current.classrooms).toEqual([])
  })

  it('an old answer never overwrites the lists of the school that is open now', async () => {
    const oldGrades = deferred()
    const oldClassrooms = deferred()
    listGrades.mockReturnValueOnce(oldGrades.promise)
    listClassrooms.mockReturnValueOnce(oldClassrooms.promise)
    const { result, rerender } = renderHook(({ schoolId }) => useSchoolFilters(schoolId), { initialProps: { schoolId: 67 } })

    listGrades.mockResolvedValue(ok([{ id: 2, name: 'Grade of 68' }]))
    listClassrooms.mockResolvedValue(ok([{ id: 20, name: 'Room of 68' }]))
    rerender({ schoolId: 68 })
    await waitFor(() => expect(result.current.loaded).toBe(true))

    await act(async () => {
      oldGrades.resolve(ok([{ id: 1, name: 'Grade of 67' }]))
      oldClassrooms.resolve(ok([{ id: 10, name: 'Room of 67' }]))
    })
    expect(result.current.grades).toEqual([{ id: 2, name: 'Grade of 68' }])
    expect(result.current.classrooms).toEqual([{ id: 20, name: 'Room of 68' }])
    expect(result.current.loaded).toBe(true)
  })

  it('asks for nothing without a school', () => {
    const { result } = renderHook(() => useSchoolFilters(undefined))
    expect(listGrades).not.toHaveBeenCalled()
    expect(result.current).toEqual({ grades: [], classrooms: [], loaded: false })
  })
})

describe('useDropForeignFilters', () => {
  const setup = (props) => {
    const setGradeId = vi.fn()
    const setClassroomId = vi.fn()
    const hook = renderHook((current) => useDropForeignFilters({ setGradeId, setClassroomId, ...current }), { initialProps: props })
    return { ...hook, setGradeId, setClassroomId }
  }
  const lists = { grades: [{ id: 1 }], classrooms: [{ id: 10 }] }

  it('removes a grade and a classroom of the URL that the school does not have (auditor 1)', () => {
    const { setGradeId, setClassroomId } = setup({ ...lists, loaded: true, gradeId: 99, classroomId: 98 })
    expect(setGradeId).toHaveBeenCalledWith(null)
    expect(setClassroomId).toHaveBeenCalledWith(null)
  })

  it('leaves the ones the school has, and the absent ones', () => {
    const { setGradeId, setClassroomId } = setup({ ...lists, loaded: true, gradeId: 1, classroomId: null })
    expect(setGradeId).not.toHaveBeenCalled()
    expect(setClassroomId).not.toHaveBeenCalled()
  })

  it('waits for the lists: before they answer an id is not foreign yet', () => {
    const { setGradeId, setClassroomId } = setup({ grades: [], classrooms: [], loaded: false, gradeId: 99, classroomId: 98 })
    expect(setGradeId).not.toHaveBeenCalled()
    expect(setClassroomId).not.toHaveBeenCalled()
  })

  it('acts when the lists arrive', () => {
    const { rerender, setGradeId } = setup({ grades: [], classrooms: [], loaded: false, gradeId: 99, classroomId: null })
    rerender({ ...lists, loaded: true, gradeId: 99, classroomId: null })
    expect(setGradeId).toHaveBeenCalledWith(null)
  })
})

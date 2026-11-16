import { useState, useEffect } from 'react'
import { useApi, useSession } from '../../../../index'
import { listGrades, listClassrooms } from '../../../../components/Schools/schoolApi'

// redesign SC-B4 (decision 3A; M-SC13, auditor 1): the grades and classrooms of one school, for the filters of the day bar.
//   { grades, classrooms, loaded }
//   loaded  both lists have answered FOR THIS school (a failed answer counts: the lists stay empty and the filter ids are checked
//           against nothing, as against a school that has none).
// main kept the lists of the previous school when the new one failed to load, and let an old answer overwrite a new one. Here the lists
// belong to the school they were asked for: the moment `schoolId` changes they are empty again, and an answer for another school is dropped.

const EMPTY = { schoolId: null, grades: [], classrooms: [], loaded: false }

export const useSchoolFilters = (schoolId) => {
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [state, setState] = useState(EMPTY)

  useEffect(() => {
    if (!schoolId) return
    let current = true
    ;(async () => {
      const [g, c] = await Promise.all([
        listGrades(ordering, token, { schoolId, pageSize: 100 }),
        listClassrooms(ordering, token, { schoolId, pageSize: 100 })
      ])
      if (!current) return
      setState({
        schoolId,
        grades: g.error ? [] : (g.result || []),
        classrooms: c.error ? [] : (c.result || []),
        loaded: true
      })
    })()
    return () => { current = false }
  }, [schoolId])

  // the lists of another school are never offered, not even for the render of the change
  if (!schoolId || state.schoolId !== schoolId) return { grades: EMPTY.grades, classrooms: EMPTY.classrooms, loaded: false }
  return { grades: state.grades, classrooms: state.classrooms, loaded: state.loaded }
}

/**
 * redesign SC-B4 (auditor 1): a grade or classroom in the URL that the open school does not have (a link from another school, a stale
 * bookmark) must never filter in silence. Once the lists of the school have answered, an id that is not among them is removed.
 * Before that an id is not foreign yet, only unknown.
 */
export const useDropForeignFilters = ({ grades, classrooms, loaded, gradeId, classroomId, setGradeId, setClassroomId }) => {
  useEffect(() => {
    if (!loaded) return
    if (gradeId !== null && gradeId !== undefined && !grades.some((grade) => grade.id === gradeId)) setGradeId(null)
    if (classroomId !== null && classroomId !== undefined && !classrooms.some((classroom) => classroom.id === classroomId)) setClassroomId(null)
  }, [loaded, grades, classrooms, gradeId, classroomId])
}

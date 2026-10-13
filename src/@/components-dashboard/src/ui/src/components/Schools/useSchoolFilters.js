import { useState, useEffect } from 'react'
import { useApi, useSession } from '../../../../index'
import { listGrades, listClassrooms } from '../../../../components/Schools/schoolApi'

export const useSchoolFilters = (schoolId) => {
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [grades, setGrades] = useState([])
  const [classrooms, setClassrooms] = useState([])

  useEffect(() => {
    if (!schoolId) return
    let mounted = true
    ;(async () => {
      const [g, c] = await Promise.all([
        listGrades(ordering, token, { schoolId, pageSize: 100 }),
        listClassrooms(ordering, token, { schoolId, pageSize: 100 })
      ])
      if (!mounted) return
      if (!g.error) setGrades(g.result || [])
      if (!c.error) setClassrooms(c.result || [])
    })()
    return () => { mounted = false }
  }, [schoolId])

  return { grades, classrooms }
}

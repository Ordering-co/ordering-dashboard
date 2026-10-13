// Raw-fetch wrappers for the School backoffice endpoints (not wrapped by the SDK).

const jsonHeaders = (token) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`
})

const parse = async (response) => {
  try {
    const body = await response.json()
    return { error: body.error, result: body.result, pagination: body.pagination }
  } catch (err) {
    return { error: true, result: [err.message] }
  }
}

const request = async (url, options) => {
  try {
    const response = await fetch(url, options)
    return await parse(response)
  } catch (err) {
    return { error: true, result: [err.message] }
  }
}

const buildQuery = (params = {}) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    if (Array.isArray(value)) {
      value.forEach((v) => search.append(`${key}[]`, v))
    } else {
      search.append(key, value)
    }
  })
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

// Schools (backoffice) — /backoffice/schools (already scoped to vertical=school)
export const listSchools = (ordering, token, { page = 1, pageSize = 10, search } = {}) => {
  const params = { page, page_size: pageSize }
  if (search) {
    params.where = JSON.stringify({ conditions: [{ attribute: 'name', value: { condition: 'ilike', value: `%${search}%` } }], conector: 'AND' })
  }
  return request(`${ordering.root}/backoffice/schools${buildQuery(params)}`, { method: 'GET', headers: jsonHeaders(token) })
}

// Grades — /backoffice/schools/grades
export const listGrades = (ordering, token, { schoolId, page, pageSize } = {}) =>
  request(
    `${ordering.root}/backoffice/schools/grades${buildQuery({ school_id: schoolId, page, page_size: pageSize })}`,
    { method: 'GET', headers: jsonHeaders(token) }
  )

export const createGrade = (ordering, token, payload) =>
  request(`${ordering.root}/backoffice/schools/grades`, {
    method: 'POST', headers: jsonHeaders(token), body: JSON.stringify(payload)
  })

export const bulkGrades = (ordering, token, payload) =>
  request(`${ordering.root}/backoffice/schools/grades/bulk`, {
    method: 'POST', headers: jsonHeaders(token), body: JSON.stringify(payload)
  })

export const updateGrade = (ordering, token, gradeId, payload) =>
  request(`${ordering.root}/backoffice/schools/grades/${gradeId}`, {
    method: 'PUT', headers: jsonHeaders(token), body: JSON.stringify(payload)
  })

export const deleteGrade = (ordering, token, gradeId) =>
  request(`${ordering.root}/backoffice/schools/grades/${gradeId}`, {
    method: 'DELETE', headers: jsonHeaders(token)
  })

// Classrooms — /backoffice/schools/classrooms
export const listClassrooms = (ordering, token, { schoolId, page, pageSize } = {}) =>
  request(
    `${ordering.root}/backoffice/schools/classrooms${buildQuery({ school_id: schoolId, page, page_size: pageSize })}`,
    { method: 'GET', headers: jsonHeaders(token) }
  )

export const createClassroom = (ordering, token, payload) =>
  request(`${ordering.root}/backoffice/schools/classrooms`, {
    method: 'POST', headers: jsonHeaders(token), body: JSON.stringify(payload)
  })

export const updateClassroom = (ordering, token, classroomId, payload) =>
  request(`${ordering.root}/backoffice/schools/classrooms/${classroomId}`, {
    method: 'PUT', headers: jsonHeaders(token), body: JSON.stringify(payload)
  })

export const deleteClassroom = (ordering, token, classroomId) =>
  request(`${ordering.root}/backoffice/schools/classrooms/${classroomId}`, {
    method: 'DELETE', headers: jsonHeaders(token)
  })

// Students (read-only in dashboard) — /backoffice/schools/students
export const listStudents = (ordering, token, { schoolId, classroomId, gradeId, page, pageSize } = {}) =>
  request(
    `${ordering.root}/backoffice/schools/students${buildQuery({ school_id: schoolId, classroom_id: classroomId, grade_id: gradeId, page, page_size: pageSize })}`,
    { method: 'GET', headers: jsonHeaders(token) }
  )

export const getStudent = (ordering, token, studentId) =>
  request(`${ordering.root}/backoffice/schools/students/${studentId}`, {
    method: 'GET', headers: jsonHeaders(token)
  })

export const updateStudent = (ordering, token, studentId, payload) =>
  request(`${ordering.root}/backoffice/schools/students/${studentId}`, {
    method: 'PUT', headers: jsonHeaders(token), body: JSON.stringify(payload)
  })

export const attachParent = (ordering, token, studentId, payload) =>
  request(`${ordering.root}/backoffice/schools/students/${studentId}/parents`, {
    method: 'POST', headers: jsonHeaders(token), body: JSON.stringify(payload)
  })

export const detachParent = (ordering, token, studentId, userId) =>
  request(`${ordering.root}/backoffice/schools/students/${studentId}/parents/${userId}`, {
    method: 'DELETE', headers: jsonHeaders(token)
  })

// Parent-centric management — /backoffice/schools/parents/{customer_id}/students
const PARENT_STUDENT_PARAMS = '*,school(name),grade(name),classroom(name)'

export const listParentStudents = (ordering, token, customerId) =>
  request(`${ordering.root}/backoffice/schools/parents/${customerId}/students?params=${PARENT_STUDENT_PARAMS}`, {
    method: 'GET', headers: jsonHeaders(token)
  })

export const createParentStudent = (ordering, token, customerId, payload) =>
  request(`${ordering.root}/backoffice/schools/parents/${customerId}/students`, {
    method: 'POST', headers: jsonHeaders(token), body: JSON.stringify(payload)
  })

export const removeParentStudent = (ordering, token, customerId, studentId) =>
  request(`${ordering.root}/backoffice/schools/parents/${customerId}/students/${studentId}`, {
    method: 'DELETE', headers: jsonHeaders(token)
  })

// Meals of the day — /backoffice/schools/{school_id}/meals
export const listMeals = (ordering, token, schoolId, { preparationDate, classroomId, gradeId, studentId, studentCode, params, page, pageSize } = {}) =>
  request(
    `${ordering.root}/backoffice/schools/${schoolId}/meals${buildQuery({
      preparation_date: preparationDate,
      classroom_id: classroomId,
      grade_id: gradeId,
      student_id: studentId,
      student_code: studentCode,
      params,
      page,
      page_size: pageSize
    })}`,
    { method: 'GET', headers: jsonHeaders(token) }
  )

// Student meal labels — /backoffice/schools/{school_id}/labels (count) and /labels.pdf (sheet)
export const getSchoolLabelsCount = (ordering, token, schoolId, { preparationDate, gradeId, classroomId } = {}) =>
  request(
    `${ordering.root}/backoffice/schools/${schoolId}/labels${buildQuery({
      preparation_date: preparationDate,
      grade_id: gradeId,
      classroom_id: classroomId
    })}`,
    { method: 'GET', headers: jsonHeaders(token) }
  )

const filenameFromDisposition = (header, fallback) => {
  if (!header) return fallback
  const match = /filename="?([^"]+)"?/i.exec(header)
  return match?.[1] || fallback
}

export const fetchSchoolLabelsPdf = async (
  ordering,
  token,
  schoolId,
  { preparationDate, gradeId, classroomId, guides } = {},
  { fetchFn = fetch, signal } = {}
) => {
  const query = buildQuery({
    preparation_date: preparationDate,
    grade_id: gradeId,
    classroom_id: classroomId,
    guides: guides ? 1 : undefined
  })
  const response = await fetchFn(`${ordering.root}/backoffice/schools/${schoolId}/labels.pdf${query}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    signal
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message = Array.isArray(body?.result) ? body.result[0] : (body?.result || 'Download failed')
    const error = new Error(message)
    error.code = body?.error_codes?.[0]
    throw error
  }

  const contentType = response.headers.get('Content-Type') || ''
  if (!contentType.includes('pdf')) {
    throw new Error('Invalid response format')
  }

  const blob = await response.blob()
  const filename = filenameFromDisposition(response.headers.get('Content-Disposition'), `labels_${preparationDate}.pdf`)
  return { blob, filename }
}

const REPORT_CONTENT_TYPES = { pdf: 'pdf', csv: 'csv', xlsx: 'spreadsheetml' }

export const fetchSchoolReport = async (
  ordering,
  token,
  schoolId,
  report,
  format,
  { preparationDate, gradeId, classroomId } = {},
  { fetchFn = fetch } = {}
) => {
  const query = buildQuery({
    preparation_date: preparationDate,
    grade_id: gradeId,
    classroom_id: classroomId
  })
  const response = await fetchFn(`${ordering.root}/backoffice/schools/${schoolId}/reports/${report}.${format}${query}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message = Array.isArray(body?.result) ? body.result[0] : (body?.result || 'Download failed')
    const error = new Error(message)
    error.code = body?.error_codes?.[0]
    throw error
  }

  const contentType = response.headers.get('Content-Type') || ''
  if (!contentType.includes(REPORT_CONTENT_TYPES[format])) {
    throw new Error('Invalid response format')
  }

  const blob = await response.blob()
  const filename = filenameFromDisposition(response.headers.get('Content-Disposition'), `${report}_${preparationDate}.${format}`)
  return { blob, filename }
}

import React, { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { useApi, useSession, useLanguage, useToast, ToastType } from '../../../../../index'
import { Button } from '../../../styles'
import { Select as FirstSelect } from '../../../styles/Select/FirstSelect'
import { SideBar, SpinnerLoader, Pagination } from '../../Shared'
import {
  listStudents, getStudent, attachParent, detachParent
} from '../../../../../components/Schools/schoolApi'
import { useSchoolFilters } from '../useSchoolFilters'
import {
  Toolbar, Table, RowActions, FormGrid, FormActions, EmptyState, Chips, Chip
} from '../styles'

const PAGE_SIZE = 10

export const SchoolStudents = (props) => {
  const { school, initialPage, onPageChange } = props
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()

  const [state, setState] = useState({ loading: false, items: [], error: null })
  const [pagination, setPagination] = useState({ currentPage: initialPage || 1, totalPages: 1, pageSize: PAGE_SIZE })
  const [filters, setFilters] = useState({ classroomId: null, gradeId: null })
  const firstLoad = useRef(true)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [customers, setCustomers] = useState([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [customerPagination, setCustomerPagination] = useState({ currentPage: 1, totalPages: 1, pageSize: 10 })
  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  const [savingParent, setSavingParent] = useState(false)

  const schoolId = school?.id
  const { grades, classrooms } = useSchoolFilters(schoolId)

  const load = async (page = 1, pageSize = pagination.pageSize) => {
    if (!schoolId) return
    setState((s) => ({ ...s, loading: true }))
    const { error, result, pagination: meta } = await listStudents(ordering, token, {
      schoolId, classroomId: filters.classroomId, gradeId: filters.gradeId, page, pageSize
    })
    if (error) {
      setState({ loading: false, items: [], error: result })
    } else {
      setState({ loading: false, items: result || [], error: null })
      setPagination({ currentPage: meta?.current_page || page, totalPages: meta?.total_pages || 1, pageSize })
    }
  }

  const goToPage = (page) => { onPageChange && onPageChange(page); load(page) }
  const handleChangePageSize = (size) => { onPageChange && onPageChange(1); load(1, size) }

  useEffect(() => {
    if (firstLoad.current) { firstLoad.current = false; load(initialPage || 1) } else { onPageChange && onPageChange(1); load(1) }
  }, [schoolId, filters.classroomId, filters.gradeId])

  const refreshDetail = async (studentId) => {
    const { error, result } = await getStudent(ordering, token, studentId)
    if (!error) setDetail(result)
  }

  const openDetail = async (student) => {
    setDetail({ id: student.id })
    setSelectedCustomerId(null)
    setDetailLoading(true)
    const { error, result } = await getStudent(ordering, token, student.id)
    setDetailLoading(false)
    if (!error) setDetail(result)
    loadCustomers(1, '')
  }

  const loadCustomers = async (page = 1, search = customerSearch) => {
    setLoadingCustomers(true)
    const conditions = [{ attribute: 'level', value: 3 }]
    if (search) conditions.push({ attribute: 'name', value: { condition: 'ilike', value: `%${search}%` } })
    try {
      const { content } = await ordering.users().asDashboard()
        .select(['id', 'name', 'lastname', 'email'])
        .where({ conditions, conector: 'AND' })
        .get({ query: { page, page_size: 10 } })
      setCustomers(content?.result || [])
      setCustomerPagination({ currentPage: content?.pagination?.current_page || page, totalPages: content?.pagination?.total_pages || 1, pageSize: 10 })
    } catch (err) {
      setCustomers([])
    } finally {
      setLoadingCustomers(false)
    }
  }

  const handleCustomerSearch = (value) => {
    setCustomerSearch(value || '')
    loadCustomers(1, value || '')
  }

  const handleAttachParent = async () => {
    if (!selectedCustomerId) { showToast(ToastType.Error, t('SCHOOL_SELECT_CUSTOMER', 'Select a customer')); return }
    setSavingParent(true)
    const { error, result } = await attachParent(ordering, token, detail.id, { user_id: selectedCustomerId })
    setSavingParent(false)
    if (error) { showToast(ToastType.Error, Array.isArray(result) ? result[0] : result); return }
    showToast(ToastType.Success, t('SCHOOL_PARENT_ASSIGNED', 'Parent assigned'))
    setSelectedCustomerId(null)
    handleCustomerSearch('')
    refreshDetail(detail.id)
  }

  const handleDetachParent = async (userId) => {
    const { error, result } = await detachParent(ordering, token, detail.id, userId)
    if (error) { showToast(ToastType.Error, Array.isArray(result) ? result[0] : result); return }
    showToast(ToastType.Success, t('SCHOOL_PARENT_REMOVED', 'Parent removed'))
    refreshDetail(detail.id)
  }

  const gradeOptions = [{ value: null, content: t('SCHOOL_ALL_GRADES', 'All grades') }]
    .concat(grades.map((g) => ({ value: g.id, content: g.name })))
  const classroomOptions = [{ value: null, content: t('SCHOOL_ALL_CLASSROOMS', 'All classrooms') }]
    .concat(classrooms.map((c) => ({ value: c.id, content: c.name })))

  const gradeNameById = Object.fromEntries(grades.map((g) => [g.id, g.name]))
  const classroomNameById = Object.fromEntries(classrooms.map((c) => [c.id, c.name]))

  const customerOptions = customers.map((u) => ({
    value: u.id,
    content: `${u.name || ''} ${u.lastname || ''}${u.email ? ` · ${u.email}` : ''}`.trim()
  }))

  return (
    <div>
      <Toolbar>
        <div>
          <FirstSelect
            defaultValue={filters.gradeId}
            options={gradeOptions}
            placeholder={t('SCHOOL_ALL_GRADES', 'All grades')}
            onChange={(value) => setFilters((f) => ({ ...f, gradeId: value }))}
          />
        </div>
        <div>
          <FirstSelect
            defaultValue={filters.classroomId}
            options={classroomOptions}
            placeholder={t('SCHOOL_ALL_CLASSROOMS', 'All classrooms')}
            onChange={(value) => setFilters((f) => ({ ...f, classroomId: value }))}
          />
        </div>
      </Toolbar>

      {state.loading
        ? <SpinnerLoader />
        : state.items.length === 0
          ? <EmptyState>{t('SCHOOL_NO_STUDENTS', 'No students yet')}</EmptyState>
          : (
            <Table>
              <thead>
                <tr>
                  <th>{t('SCHOOL_STUDENT_CODE', 'Code')}</th>
                  <th>{t('NAME', 'Name')}</th>
                  <th>{t('SCHOOL_CLASSROOM', 'Classroom')}</th>
                  <th>{t('SCHOOL_GRADE', 'Grade')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {state.items.map((student) => (
                  <tr key={student.id} onClick={() => openDetail(student)} style={{ cursor: 'pointer' }}>
                    <td>{student.code}</td>
                    <td>{student.name} {student.lastname}</td>
                    <td>{student.classroom?.name || classroomNameById[student.classroom_id] || '-'}</td>
                    <td>{student.grade?.name || gradeNameById[student.grade_id] || '-'}</td>
                    <td>
                      <RowActions>
                        <Button color='primary' onClick={(e) => { e.stopPropagation(); openDetail(student) }}>{t('VIEW', 'View')}</Button>
                      </RowActions>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            )}

      {state.items.length > 0 && (
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          defaultPageSize={pagination.pageSize}
          handleChangePage={goToPage}
          handleChangePageSize={handleChangePageSize}
        />
      )}

      {detail && (
        <SideBar open={!!detail} onClose={() => setDetail(null)} showExpandIcon>
          <div style={{ flex: 1, width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '24px 20px' }}>
            <h2 style={{ marginTop: 0 }}>{t('SCHOOL_STUDENT', 'Student')}</h2>
            {detailLoading
              ? <SpinnerLoader />
              : (
                <FormGrid>
                  <div><strong>{t('NAME', 'Name')}:</strong> {detail.name} {detail.lastname}</div>
                  <div><strong>{t('SCHOOL_STUDENT_CODE', 'Code')}:</strong> {detail.code}</div>
                  <div><strong>{t('SCHOOL_CLASSROOM', 'Classroom')}:</strong> {detail.classroom?.name || '-'}</div>
                  <div><strong>{t('SCHOOL_GRADE', 'Grade')}:</strong> {detail.grade?.name || '-'}</div>
                  <div>
                    <strong>{t('SCHOOL_ALLERGIES', 'Allergies')}:</strong>
                    <Chips>
                      {(detail.allergies || []).length
                        ? detail.allergies.map((a) => <Chip key={a}>{a}</Chip>)
                        : <span> -</span>}
                    </Chips>
                  </div>
                  <div>
                    <strong>{t('SCHOOL_DIETARY_TAGS', 'Dietary tags')}:</strong>
                    <Chips>
                      {(detail.dietary_tags || []).length
                        ? detail.dietary_tags.map((d) => <Chip key={d}>{d}</Chip>)
                        : <span> -</span>}
                    </Chips>
                  </div>

                  <div>
                    <strong>{t('SCHOOL_GUARDIANS', 'Guardians')}:</strong>
                    {(detail.parents || []).length === 0 && <span> -</span>}
                    {(detail.parents || []).map((p) => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
                        <span>{p.name} {p.lastname}{p.email ? ` · ${p.email}` : ''}</span>
                        <Button color='secundary' onClick={() => handleDetachParent(p.id)}>{t('REMOVE', 'Remove')}</Button>
                      </div>
                    ))}
                  </div>

                  <div>
                    <label>{t('SCHOOL_ASSIGN_PARENT', 'Assign parent')}</label>
                    <FirstSelect
                      defaultValue={selectedCustomerId}
                      options={customerOptions}
                      placeholder={t('SCHOOL_SELECT_CUSTOMER', 'Select a customer')}
                      isShowSearchBar
                      searchValue={customerSearch}
                      handleChangeSearch={handleCustomerSearch}
                      isLoading={loadingCustomers}
                      pagination={customerPagination}
                      handleChangePage={(page) => loadCustomers(page, customerSearch)}
                      optionInnerMaxHeight='220px'
                      onChange={(value) => setSelectedCustomerId(value)}
                    />
                    <FormActions style={{ justifyContent: 'flex-start' }}>
                      <Button color='primary' onClick={handleAttachParent} disabled={savingParent}>
                        {savingParent ? t('LOADING', 'Loading') : t('SCHOOL_ASSIGN_PARENT', 'Assign parent')}
                      </Button>
                    </FormActions>
                  </div>
                </FormGrid>
                )}
          </div>
        </SideBar>
      )}
    </div>
  )
}

SchoolStudents.propTypes = {
  school: PropTypes.object
}

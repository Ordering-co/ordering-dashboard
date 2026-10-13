import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useApi, useSession, useLanguage, useToast, ToastType } from '../../../../../index'
import { Button, Input } from '../../../styles'
import { Select as FirstSelect } from '../../../styles/Select/FirstSelect'
import { MultiSelect } from '../../../styles/MultiSelect'
import { StandardField } from '../../../styles/StandardField'
import { Modal, Confirm, SpinnerLoader } from '../../Shared'
import {
  listGrades, listClassrooms, listParentStudents, createParentStudent, updateStudent, removeParentStudent
} from '../../../../../components/Schools/schoolApi'
import { SCHOOL_ALLERGENS, SCHOOL_DIETARY_TAGS, SCHOOL_VERTICAL } from '../../../../../constants/school'
import {
  Toolbar, Table, RowActions, FormGrid, FormActions, EmptyState
} from '../styles'

const generateCode = () => `STU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

const emptyForm = { name: '', lastname: '', gradeId: null, classroomId: null, allergies: [], dietaryTags: [] }

export const SchoolUserStudents = (props) => {
  const { userId } = props
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()

  const [students, setStudents] = useState({ loading: false, items: [] })
  const [schools, setSchools] = useState([])
  const [grades, setGrades] = useState([])
  const [classrooms, setClassrooms] = useState([])
  const [selectedSchoolId, setSelectedSchoolId] = useState(null)
  const [schoolSearch, setSchoolSearch] = useState('')
  const [loadingSchools, setLoadingSchools] = useState(false)
  const [schoolPagination, setSchoolPagination] = useState({ currentPage: 1, pageSize: 10, totalPages: 1 })
  const [form, setForm] = useState(emptyForm)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState({ open: false, student: null })

  const allergenOptions = SCHOOL_ALLERGENS.map((a) => ({ value: a.value, content: <span style={{ marginLeft: '8px' }}>{t(`SCHOOL_ALLERGEN_${a.value.toUpperCase()}`, a.name)}</span> }))
  const dietaryOptions = SCHOOL_DIETARY_TAGS.map((d) => ({ value: d.value, content: <span style={{ marginLeft: '8px' }}>{t(`SCHOOL_DIETARY_${d.value.toUpperCase()}`, d.name)}</span> }))

  const loadStudents = async () => {
    if (!userId) return
    setStudents((s) => ({ ...s, loading: true }))
    const { error, result } = await listParentStudents(ordering, token, userId)
    setStudents({ loading: false, items: error ? [] : (result || []) })
  }

  const loadSchools = async (page = schoolPagination.currentPage, search = schoolSearch) => {
    setLoadingSchools(true)
    try {
      const conditions = [{ attribute: 'vertical', value: SCHOOL_VERTICAL }]
      if (search) conditions.push({ attribute: 'name', value: { condition: 'ilike', value: `%${search}%` } })
      const where = { conditions, conector: 'AND' }
      const { content } = await ordering.businesses().asDashboard().select(['id', 'name']).where(where).get({ query: { page, page_size: schoolPagination.pageSize } })
      setSchools(content?.result || [])
      setSchoolPagination((prev) => ({ ...prev, currentPage: page, totalPages: content?.pagination?.total_pages || 1 }))
    } catch (err) {
      setSchools([])
    } finally {
      setLoadingSchools(false)
    }
  }

  const handleSchoolSearch = (value) => {
    setSchoolSearch(value || '')
    loadSchools(1, value || '')
  }

  const loadSchoolLists = async (schoolId) => {
    if (!schoolId) { setGrades([]); setClassrooms([]); return }
    const [g, c] = await Promise.all([
      listGrades(ordering, token, { schoolId, pageSize: 100 }),
      listClassrooms(ordering, token, { schoolId, pageSize: 100 })
    ])
    if (!g.error) setGrades(g.result || [])
    if (!c.error) setClassrooms(c.result || [])
  }

  useEffect(() => { loadStudents() }, [userId])
  useEffect(() => { loadSchools() }, [])
  useEffect(() => { loadSchoolLists(selectedSchoolId) }, [selectedSchoolId])

  const openCreate = () => { setEditing(null); setForm(emptyForm); setSelectedSchoolId(null); setOpen(true) }

  const openEdit = (student) => {
    setEditing(student)
    setSelectedSchoolId(student.school?.id ?? student.school_id ?? null)
    setForm({
      name: student.name || '',
      lastname: student.lastname || '',
      classroomId: student.classroom?.id ?? student.classroom_id ?? null,
      gradeId: student.grade?.id ?? student.grade_id ?? null,
      allergies: student.allergies || [],
      dietaryTags: student.dietary_tags || []
    })
    setOpen(true)
  }

  const closeForm = () => setOpen(false)

  const toggle = (key, value) => {
    setForm((f) => {
      const current = f[key] || []
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
      return { ...f, [key]: next }
    })
  }

  const handleSave = async () => {
    if (!selectedSchoolId) { showToast(ToastType.Error, t('SCHOOL_SELECT_SCHOOL', 'Select a school')); return }
    if (!form.name || !form.lastname) { showToast(ToastType.Error, t('SCHOOL_NAME_REQUIRED', 'Name is required')); return }
    if (!form.classroomId) { showToast(ToastType.Error, t('SCHOOL_CLASSROOM_REQUIRED', 'Classroom is required')); return }
    if (gradeOptions.length > 0 && !form.gradeId) { showToast(ToastType.Error, t('SCHOOL_GRADE_REQUIRED', 'Grade is required')); return }
    setSaving(true)
    const payload = {
      classroom_id: form.classroomId,
      grade_id: form.gradeId || undefined,
      name: form.name,
      lastname: form.lastname,
      allergies: form.allergies,
      dietary_tags: form.dietaryTags
    }
    const { error, result } = editing
      ? await updateStudent(ordering, token, editing.id, payload)
      : await createParentStudent(ordering, token, userId, { ...payload, school_id: selectedSchoolId, code: generateCode() })
    setSaving(false)
    if (error) { showToast(ToastType.Error, Array.isArray(result) ? result[0] : result); return }
    showToast(ToastType.Success, t('SCHOOL_CHANGES_SAVED', 'Changes saved'))
    closeForm()
    loadStudents()
  }

  const handleRemove = async () => {
    const student = confirm.student
    setConfirm({ open: false, student: null })
    const { error, result } = await removeParentStudent(ordering, token, userId, student.id)
    if (error) { showToast(ToastType.Error, Array.isArray(result) ? result[0] : result); return }
    showToast(ToastType.Success, t('SCHOOL_STUDENT_REMOVED', 'Student removed'))
    loadStudents()
  }

  const schoolOptions = schools.map((s) => ({ value: s.id, content: s.name }))
  const editingSchoolId = editing?.school?.id ?? editing?.school_id
  if (editingSchoolId && !schoolOptions.some((o) => o.value === editingSchoolId)) {
    schoolOptions.unshift({ value: editingSchoolId, content: editing?.school?.name || `#${editingSchoolId}` })
  }
  const gradeOptions = grades.map((g) => ({ value: g.id, content: g.name }))
  const classroomOptions = classrooms.map((c) => ({ value: c.id, content: c.name }))

  return (
    <div>
      <Toolbar>
        <Button color='primary' onClick={openCreate}>{t('SCHOOL_ADD_STUDENT', 'Add student')}</Button>
      </Toolbar>

      {students.loading
        ? <SpinnerLoader />
        : students.items.length === 0
          ? <EmptyState>{t('SCHOOL_NO_STUDENTS', 'No students yet')}</EmptyState>
          : (
            <Table>
              <thead>
                <tr>
                  <th>{t('NAME', 'Name')}</th>
                  <th>{t('SCHOOL', 'School')}</th>
                  <th>{t('SCHOOL_CLASSROOM', 'Classroom')}</th>
                  <th>{t('SCHOOL_GRADE', 'Grade')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {students.items.map((student) => (
                  <tr key={student.id} onClick={() => openEdit(student)} style={{ cursor: 'pointer' }}>
                    <td>{student.name} {student.lastname}</td>
                    <td>{student.school?.name || student.school_id || '-'}</td>
                    <td>{student.classroom?.name || '-'}</td>
                    <td>{student.grade?.name || '-'}</td>
                    <td>
                      <RowActions>
                        <Button color='secundary' onClick={(e) => { e.stopPropagation(); setConfirm({ open: true, student }) }}>{t('DELETE', 'Delete')}</Button>
                      </RowActions>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            )}

      <Modal open={open} onClose={closeForm} title={editing ? t('SCHOOL_EDIT_STUDENT', 'Edit student') : t('SCHOOL_ADD_STUDENT', 'Add student')} width='520px' maxWidth='560px'>
        <FormGrid>
          <div>
            <label>{t('SCHOOL', 'School')}</label>
            <StandardField>
              <FirstSelect
                defaultValue={selectedSchoolId}
                options={schoolOptions}
                placeholder={t('SCHOOL_SELECT_SCHOOL', 'Select a school')}
                optionInnerMaxHeight='220px'
                isShowSearchBar
                isDisabled={!!editing}
                searchValue={schoolSearch}
                handleChangeSearch={handleSchoolSearch}
                isLoading={loadingSchools}
                pagination={schoolPagination}
                handleChangePage={(page) => loadSchools(page)}
                onChange={(value) => { setSelectedSchoolId(value); setForm((f) => ({ ...f, classroomId: null, gradeId: null })) }}
              />
            </StandardField>
          </div>
          <div>
            <label>{t('NAME', 'Name')}</label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label>{t('LASTNAME', 'Lastname')}</label>
            <Input value={form.lastname} onChange={(e) => setForm((f) => ({ ...f, lastname: e.target.value }))} />
          </div>
          <div>
            <label>{t('SCHOOL_CLASSROOM', 'Classroom')}</label>
            <StandardField>
              <FirstSelect
                defaultValue={form.classroomId}
                options={classroomOptions}
                placeholder={selectedSchoolId ? t('SCHOOL_SELECT_CLASSROOM', 'Select a classroom') : t('SCHOOL_SELECT_SCHOOL_FIRST', 'Select a school first')}
                isDisabled={!selectedSchoolId}
                onChange={(value) => setForm((f) => ({ ...f, classroomId: value }))}
              />
            </StandardField>
          </div>
          <div>
            <label>{t('SCHOOL_GRADE', 'Grade')}</label>
            <StandardField>
              <FirstSelect
                defaultValue={form.gradeId}
                options={gradeOptions}
                placeholder={selectedSchoolId ? t('SCHOOL_SELECT_GRADE', 'Select a grade') : t('SCHOOL_SELECT_SCHOOL_FIRST', 'Select a school first')}
                isDisabled={!selectedSchoolId}
                onChange={(value) => setForm((f) => ({ ...f, gradeId: value }))}
              />
            </StandardField>
          </div>
          <div>
            <label>{t('SCHOOL_ALLERGIES', 'Allergies')}</label>
            <StandardField>
              <MultiSelect
                placeholder={t('SCHOOL_SELECT_ALLERGENS', 'Select allergens')}
                options={allergenOptions}
                optionsPosition='left'
                dropdownMinWidth='100%'
                isFullWidthOptions
                optionInnerMaxHeight='260px'
                optionBottomBorder
                defaultValue={form.allergies}
                onChange={(val) => toggle('allergies', val)}
              />
            </StandardField>
          </div>
          <div>
            <label>{t('SCHOOL_DIETARY_TAGS', 'Dietary tags')}</label>
            <StandardField>
              <MultiSelect
                placeholder={t('SCHOOL_SELECT_DIETARY_TAGS', 'Select dietary tags')}
                options={dietaryOptions}
                optionsPosition='left'
                dropdownMinWidth='100%'
                isFullWidthOptions
                optionInnerMaxHeight='260px'
                optionBottomBorder
                defaultValue={form.dietaryTags}
                onChange={(val) => toggle('dietaryTags', val)}
              />
            </StandardField>
          </div>
          <FormActions>
            <Button color='secundary' onClick={closeForm}>{t('CANCEL', 'Cancel')}</Button>
            <Button color='primary' onClick={handleSave} disabled={saving}>
              {saving ? t('LOADING', 'Loading') : t('SAVE', 'Save')}
            </Button>
          </FormActions>
        </FormGrid>
      </Modal>

      <Confirm
        open={confirm.open}
        title={t('SCHOOL', 'School')}
        content={t('SCHOOL_CONFIRM_REMOVE_STUDENT', 'Remove this student from the parent?')}
        onClose={() => setConfirm({ open: false, student: null })}
        onCancel={() => setConfirm({ open: false, student: null })}
        onAccept={handleRemove}
        closeOnBackdrop={false}
      />
    </div>
  )
}

SchoolUserStudents.propTypes = {
  userId: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
}

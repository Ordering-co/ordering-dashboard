import React, { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { useApi, useSession, useLanguage, useToast, ToastType } from '../../../../../index'
import { Button, Input } from '../../../styles'
import { Select as FirstSelect } from '../../../styles/Select/FirstSelect'
import { Modal, Confirm, SpinnerLoader, Pagination } from '../../Shared'
import {
  listGrades, createGrade, updateGrade, deleteGrade, bulkGrades
} from '../../../../../components/Schools/schoolApi'
import { SCHOOL_GRADE_CODES } from '../../../../../constants/school'
import {
  Toolbar, Table, RowActions, FormGrid, FormActions, EmptyState
} from '../styles'

const PAGE_SIZE = 10

export const SchoolGrades = (props) => {
  const { school, initialPage, onPageChange } = props
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()

  const [state, setState] = useState({ loading: false, items: [], error: null })
  const [pagination, setPagination] = useState({ currentPage: initialPage || 1, totalPages: 1, pageSize: PAGE_SIZE })
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ code: '', name: '' })
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState({ open: false, grade: null })
  const firstLoad = useRef(true)

  const schoolId = school?.id

  const load = async (page = 1, pageSize = pagination.pageSize) => {
    if (!schoolId) return
    setState((s) => ({ ...s, loading: true }))
    const { error, result, pagination: meta } = await listGrades(ordering, token, { schoolId, page, pageSize })
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
    if (firstLoad.current) { firstLoad.current = false; load(initialPage || 1) } else { load(1) }
  }, [schoolId])

  const openCreate = () => { setForm({ code: '', name: '' }); setEditing({}) }
  const openEdit = (grade) => { setForm({ code: grade.code, name: grade.name }); setEditing(grade) }
  const closeForm = () => setEditing(null)

  const handleSave = async () => {
    if (!form.name) {
      showToast(ToastType.Error, t('SCHOOL_NAME_REQUIRED', 'Name is required'))
      return
    }
    setSaving(true)
    const isEdit = editing && editing.id
    const payload = isEdit
      ? { code: form.code, name: form.name }
      : { school_id: schoolId, code: form.code, name: form.name }
    const { error, result } = isEdit
      ? await updateGrade(ordering, token, editing.id, payload)
      : await createGrade(ordering, token, payload)
    setSaving(false)
    if (error) {
      showToast(ToastType.Error, Array.isArray(result) ? result[0] : result)
      return
    }
    showToast(ToastType.Success, t('SCHOOL_CHANGES_SAVED', 'Changes saved'))
    closeForm()
    load(pagination.currentPage)
  }

  const handleBulk = async () => {
    setSaving(true)
    const { error, result } = await bulkGrades(ordering, token, { school_id: schoolId })
    setSaving(false)
    if (error) {
      showToast(ToastType.Error, Array.isArray(result) ? result[0] : result)
      return
    }
    showToast(ToastType.Success, t('SCHOOL_GRADES_SEEDED', 'Grades created from catalog'))
    load(1)
  }

  const handleDelete = async () => {
    const grade = confirm.grade
    setConfirm({ open: false, grade: null })
    const { error, result } = await deleteGrade(ordering, token, grade.id)
    if (error) {
      showToast(ToastType.Error, Array.isArray(result) ? result[0] : result)
      return
    }
    showToast(ToastType.Success, t('SCHOOL_GRADE_DELETED', 'Grade deleted'))
    load(pagination.currentPage)
  }

  const codeOptions = SCHOOL_GRADE_CODES.map((g) => ({
    value: g.value,
    content: t(`SCHOOL_GRADE_${g.value.toUpperCase()}`, g.name)
  }))

  return (
    <div>
      <Toolbar>
        <Button color='primary' onClick={openCreate} disabled={!schoolId}>
          {t('SCHOOL_ADD_GRADE', 'Add grade')}
        </Button>
        <Button color='secundary' onClick={handleBulk} disabled={!schoolId || saving}>
          {t('SCHOOL_SEED_GRADES', 'Create from catalog')}
        </Button>
      </Toolbar>

      {state.loading
        ? <SpinnerLoader />
        : state.items.length === 0
          ? <EmptyState>{t('SCHOOL_NO_GRADES', 'No grades yet')}</EmptyState>
          : (
            <Table>
              <thead>
                <tr>
                  <th>{t('SCHOOL_GRADE_CODE', 'Code')}</th>
                  <th>{t('NAME', 'Name')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {state.items.map((grade) => (
                  <tr key={grade.id}>
                    <td>{grade.code}</td>
                    <td>{grade.name}</td>
                    <td>
                      <RowActions>
                        <Button color='primary' onClick={() => openEdit(grade)}>{t('EDIT', 'Edit')}</Button>
                        <Button color='secundary' onClick={() => setConfirm({ open: true, grade })}>{t('DELETE', 'Delete')}</Button>
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

      <Modal
        open={!!editing}
        onClose={closeForm}
        title={editing && editing.id ? t('SCHOOL_EDIT_GRADE', 'Edit grade') : t('SCHOOL_ADD_GRADE', 'Add grade')}
        width='480px'
        maxWidth='520px'
      >
        <FormGrid>
          <div>
            <label>{t('NAME', 'Name')}</label>
            <Input
              value={form.name}
              placeholder={t('NAME', 'Name')}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label>{t('SCHOOL_GRADE_CODE', 'Code')}</label>
            <FirstSelect
              defaultValue={form.code}
              options={codeOptions}
              placeholder={t('SELECT_OPTION', 'Select option')}
              optionInnerMaxHeight='220px'
              onChange={(value) => setForm((f) => ({ ...f, code: value }))}
            />
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
        content={t('SCHOOL_CONFIRM_DELETE_GRADE', 'Delete this grade? Students keep working and lose this grade.')}
        onClose={() => setConfirm({ open: false, grade: null })}
        onCancel={() => setConfirm({ open: false, grade: null })}
        onAccept={handleDelete}
        closeOnBackdrop={false}
      />
    </div>
  )
}

SchoolGrades.propTypes = {
  school: PropTypes.object
}

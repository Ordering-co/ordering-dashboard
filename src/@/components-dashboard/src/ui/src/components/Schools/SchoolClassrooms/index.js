import React, { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { useApi, useSession, useLanguage, useToast, ToastType } from '../../../../../index'
import { Button, Input } from '../../../styles'
import { Modal, Confirm, SpinnerLoader, Pagination } from '../../Shared'
import {
  listClassrooms, createClassroom, updateClassroom, deleteClassroom
} from '../../../../../components/Schools/schoolApi'
import {
  Toolbar, Table, RowActions, FormGrid, FormActions, EmptyState
} from '../styles'

const PAGE_SIZE = 10

export const SchoolClassrooms = (props) => {
  const { school, initialPage, onPageChange } = props
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()

  const [state, setState] = useState({ loading: false, items: [], error: null })
  const [pagination, setPagination] = useState({ currentPage: initialPage || 1, totalPages: 1, pageSize: PAGE_SIZE })
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '' })
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState({ open: false, classroom: null })
  const firstLoad = useRef(true)

  const schoolId = school?.id

  const load = async (page = 1, pageSize = pagination.pageSize) => {
    if (!schoolId) return
    setState((s) => ({ ...s, loading: true }))
    const { error, result, pagination: meta } = await listClassrooms(ordering, token, { schoolId, page, pageSize })
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

  const openCreate = () => { setForm({ name: '' }); setEditing({}) }
  const openEdit = (classroom) => { setForm({ name: classroom.name }); setEditing(classroom) }
  const closeForm = () => setEditing(null)

  const handleSave = async () => {
    if (!form.name) {
      showToast(ToastType.Error, t('SCHOOL_NAME_REQUIRED', 'Name is required'))
      return
    }
    setSaving(true)
    const isEdit = editing && editing.id
    const { error, result } = isEdit
      ? await updateClassroom(ordering, token, editing.id, { name: form.name })
      : await createClassroom(ordering, token, { school_id: schoolId, name: form.name })
    setSaving(false)
    if (error) {
      showToast(ToastType.Error, Array.isArray(result) ? result[0] : result)
      return
    }
    showToast(ToastType.Success, t('SCHOOL_CHANGES_SAVED', 'Changes saved'))
    closeForm()
    load(pagination.currentPage)
  }

  const handleDelete = async () => {
    const classroom = confirm.classroom
    setConfirm({ open: false, classroom: null })
    const { error, result } = await deleteClassroom(ordering, token, classroom.id)
    if (error) {
      showToast(ToastType.Error, Array.isArray(result) ? result[0] : result)
      return
    }
    showToast(ToastType.Success, t('SCHOOL_CLASSROOM_DELETED', 'Classroom deleted'))
    load(pagination.currentPage)
  }

  return (
    <div>
      <Toolbar>
        <Button color='primary' onClick={openCreate} disabled={!schoolId}>
          {t('SCHOOL_ADD_CLASSROOM', 'Add classroom')}
        </Button>
      </Toolbar>

      {state.loading
        ? <SpinnerLoader />
        : state.items.length === 0
          ? <EmptyState>{t('SCHOOL_NO_CLASSROOMS', 'No classrooms yet')}</EmptyState>
          : (
            <Table>
              <thead>
                <tr>
                  <th>{t('NAME', 'Name')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {state.items.map((classroom) => (
                  <tr key={classroom.id}>
                    <td>{classroom.name}</td>
                    <td>
                      <RowActions>
                        <Button color='primary' onClick={() => openEdit(classroom)}>{t('EDIT', 'Edit')}</Button>
                        <Button color='secundary' onClick={() => setConfirm({ open: true, classroom })}>{t('DELETE', 'Delete')}</Button>
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
        title={editing && editing.id ? t('SCHOOL_EDIT_CLASSROOM', 'Edit classroom') : t('SCHOOL_ADD_CLASSROOM', 'Add classroom')}
        width='480px'
        maxWidth='520px'
      >
        <FormGrid>
          <div>
            <label>{t('NAME', 'Name')}</label>
            <Input
              value={form.name}
              placeholder={t('SCHOOL_CLASSROOM_NAME_HINT', 'e.g. Ms. Smith - Grade 1')}
              onChange={(e) => setForm({ name: e.target.value })}
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
        content={t('SCHOOL_CONFIRM_DELETE_CLASSROOM', 'Delete this classroom? Students in it lose their classroom and must be reassigned.')}
        onClose={() => setConfirm({ open: false, classroom: null })}
        onCancel={() => setConfirm({ open: false, classroom: null })}
        onAccept={handleDelete}
        closeOnBackdrop={false}
      />
    </div>
  )
}

SchoolClassrooms.propTypes = {
  school: PropTypes.object
}

import React, { useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useApi, useSession, useLanguage, useToast, ToastType } from '../../../../../index'
import {
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  IconButton,
  RecordCardList
} from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { Users, Pencil, Plus, Trash2 } from '../../Shared/Icon'
import {
  listClassrooms, createClassroom, updateClassroom, deleteClassroom
} from '../../../../../components/Schools/schoolApi'
import { SchoolListError } from '../SchoolListError'
import { useSchoolList } from '../useSchoolList'
import { SchoolPager, apiErrorText, cardHref, useReloadFocus } from '../SchoolGrades'
import { ClassroomDialog } from './ClassroomDialog'
import '../schools.css'
import '../SchoolGrades/grades.css'

// redesign SC-B2 (decision 4; M-SC03, M-SC06, M-SC10, M-SC11): the Classrooms tab, built like Grades (SchoolGrades/index.js): a Product
// DataTable (RecordCards under 768px) with the two actions of a row always in view, a dialog to add and edit, a danger confirmation to
// delete and the notice with «Retry» when the load fails. Same requests, same parameters, same toasts as main.

const PAGE_SIZE = 10 // main's page size

export const SchoolClassrooms = (props) => {
  const { school, initialPage, onPageChange } = props
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const isPhone = useIsPhone()
  const frameRef = useRef(null)

  const schoolId = school?.id
  const list = useSchoolList({
    fetchPage: ({ page, pageSize }) => (schoolId
      ? listClassrooms(ordering, token, { schoolId, page, pageSize })
      : Promise.resolve({ error: false, result: [] })),
    deps: [schoolId],
    initialPage,
    pageSize: PAGE_SIZE,
    onPageChange
  })
  // redesign the focus comes back after the reload (SchoolGrades/useReloadFocus)
  const { focusEditAfterReload, focusSuccessorAfterReload } = useReloadFocus(list, frameRef)

  // `key` is new each time the dialog opens: the form starts from the classroom (or empty) and a closing one keeps its content while it fades
  const [form, setForm] = useState({ open: false, classroom: null, key: 0 })
  const [saving, setSaving] = useState(false)
  const [removal, setRemoval] = useState({ open: false, classroom: null })
  const [deleting, setDeleting] = useState(false)

  const openCreate = () => setForm((current) => ({ open: true, classroom: null, key: current.key + 1 }))
  const openEdit = (classroom) => setForm((current) => ({ open: true, classroom, key: current.key + 1 }))
  const closeForm = () => setForm((current) => ({ ...current, open: false }))

  const handleSave = async ({ name }) => {
    const classroom = form.classroom
    const isEdit = Boolean(classroom && classroom.id)
    setSaving(true)
    const { error, result } = isEdit
      ? await updateClassroom(ordering, token, classroom.id, { name })
      : await createClassroom(ordering, token, { school_id: schoolId, name })
    setSaving(false)
    if (error) {
      showToast(ToastType.Error, apiErrorText(t, result)) // the dialog stays open with what was typed
      return
    }
    showToast(ToastType.Success, t('SCHOOL_CHANGES_SAVED', 'Changes saved'))
    closeForm()
    if (isEdit) focusEditAfterReload(classroom.id)
    list.reload()
  }

  const handleDelete = async () => {
    const classroom = removal.classroom
    if (!classroom) return
    setDeleting(true)
    const { error, result } = await deleteClassroom(ordering, token, classroom.id)
    setDeleting(false)
    setRemoval((current) => ({ ...current, open: false })) // it closes when the API answers, whichever way
    if (error) {
      showToast(ToastType.Error, apiErrorText(t, result))
      return
    }
    showToast(ToastType.Success, t('SCHOOL_CLASSROOM_DELETED', 'Classroom deleted'))
    focusSuccessorAfterReload(list.items, classroom.id)
    list.reload()
  }

  // ---- the cells (the table and the cards draw the same ones) ----
  const editLabel = (classroom) => t('SCHOOL_EDIT_CLASSROOM_NAMED', 'Edit classroom _name_').replace('_name_', () => classroom.name ?? '')
  const deleteLabel = (classroom) => t('SCHOOL_DELETE_CLASSROOM_NAMED', 'Delete classroom _name_').replace('_name_', () => classroom.name ?? '')

  const actionButtons = (classroom, size) => (
    <>
      <Button size={size} variant='ghost' icon={Pencil} aria-label={editLabel(classroom)} data-school-edit={classroom.id} onClick={() => openEdit(classroom)}>
        {t('EDIT', 'Edit')}
      </Button>
      <IconButton size={size} icon={Trash2} label={deleteLabel(classroom)} onClick={() => setRemoval({ open: true, classroom })} />
    </>
  )

  const loadingLabel = t('LOADING', 'Loading')
  const listLabel = t('SCHOOL_TAB_CLASSROOMS', 'Classrooms')

  const emptyState = (
    <EmptyState
      icon={Users}
      title={t('SCHOOL_NO_CLASSROOMS', 'No classrooms yet')}
      action={(
        <Button variant='primary' icon={Plus} disabled={!schoolId} onClick={openCreate}>
          {t('SCHOOL_ADD_CLASSROOM', 'Add classroom')}
        </Button>
      )}
    />
  )

  // a failure takes the place of the list, with the way to try again (while it retries, the skeleton shows)
  const failed = Boolean(list.error) && !list.loading

  let body
  if (failed) {
    body = <SchoolListError message={list.error} onRetry={list.reload} />
  } else if (isPhone) {
    body = (
      <div className='odc-school-cards'>
        <RecordCardList
          label={listLabel}
          loading={list.loading}
          loadingLabel={loadingLabel}
          skeletonCount={PAGE_SIZE}
          empty={emptyState}
          items={list.loading
            ? []
            : list.items.map((classroom) => ({
              id: classroom.id,
              href: cardHref(),
              label: classroom.name ?? '',
              title: <span className='odc-school-name' dir='auto'>{classroom.name}</span>,
              actions: <div className='odc-school-card-actions' data-card-actions=''>{actionButtons(classroom, 'md')}</div>,
              onOpen: () => openEdit(classroom)
            }))}
        />
      </div>
    )
  } else {
    body = (
      <DataTable
        label={listLabel}
        columns={[
          { id: 'name', header: t('NAME', 'Name'), rowHeader: true, wrap: true, skeleton: { lines: 1 }, cell: (classroom) => <span className='odc-school-name' dir='auto'>{classroom.name}</span> },
          // no visible title (auditor 8): the screen readers get «Actions»; both actions in view, none behind a «⋯»
          { id: 'actions', srHeader: t('ACTIONS', 'Actions'), align: 'end', skeleton: { lines: 1 }, cell: (classroom) => <span className='odc-school-row-actions'>{actionButtons(classroom, 'sm')}</span> }
        ]}
        rows={list.items}
        getRowId={(classroom) => classroom.id}
        onOpenRow={openEdit}
        loading={list.loading}
        loadingLabel={loadingLabel}
        skeletonRows={PAGE_SIZE}
        empty={emptyState}
      />
    )
  }

  return (
    <div className='odc-root odc-school-tab' ref={frameRef}>
      <div className='odc-school-toolbar'>
        <div className='odc-school-toolbar-group'>
          <Button variant='primary' icon={Plus} onClick={openCreate} disabled={!schoolId} data-school-add=''>
            {t('SCHOOL_ADD_CLASSROOM', 'Add classroom')}
          </Button>
        </div>
      </div>

      {body}
      {!failed && <SchoolPager list={list} />}

      <ClassroomDialog
        key={form.key}
        open={form.open}
        classroom={form.classroom}
        saving={saving}
        onSave={handleSave}
        onClose={closeForm}
      />

      <ConfirmDialog
        open={removal.open}
        tone='danger'
        busy={deleting}
        title={t('SCHOOL_DELETE_CLASSROOM_TITLE', 'Delete classroom "_name_"?').replace('_name_', () => removal.classroom?.name ?? '')}
        confirmLabel={t('SCHOOL_DELETE_CLASSROOM', 'Delete classroom')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onCancel={() => setRemoval((current) => ({ ...current, open: false }))}
        onConfirm={handleDelete}
      >
        {t('SCHOOL_CONFIRM_DELETE_CLASSROOM', 'Delete this classroom? Students in it lose their classroom and must be reassigned.')}
      </ConfirmDialog>
    </div>
  )
}

SchoolClassrooms.propTypes = {
  school: PropTypes.object
}

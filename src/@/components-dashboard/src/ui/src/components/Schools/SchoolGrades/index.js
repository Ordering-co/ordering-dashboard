import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useApi, useSession, useLanguage, useToast, ToastType } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import {
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  IconButton,
  Pagination,
  RecordCardList
} from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { GraduationCap, Pencil, Plus, Trash2 } from '../../Shared/Icon'
import {
  listGrades, createGrade, updateGrade, deleteGrade, bulkGrades
} from '../../../../../components/Schools/schoolApi'
import { gradeCodeLabel, gradeCodeOptions } from '../schoolDisplay'
import { settleFocusOn } from '../../../utils/listFocus'
import { SchoolListError } from '../SchoolListError'
import { useSchoolList } from '../useSchoolList'
import { GradeDialog } from './GradeDialog'
import '../schools.css'
import './grades.css'

// redesign SC-B2 (decision 4; M-SC03, M-SC06, M-SC10, M-SC11): the Grades tab. A Product DataTable (RecordCards under 768px) with the two
// actions of a row always in view, a dialog to add and edit, a danger confirmation to delete (main deleted after a generic «School»
// confirm) and, when the load fails, the notice with «Retry» instead of «No grades yet» (main swallowed the error). Same requests, same
// parameters, same toasts as main; «Create from catalog» asks first (redesign D-79, owner, 2026-10-19).

const PAGE_SIZE = 10 // main's page size
const PAGE_SIZES = [10, 25, 50] // S/Pagination's options

// ---- parts the Classrooms tab shares (it imports them from here) ----

// «_total_» in a translated template becomes a node (an .odc-figure) and keeps its direction in RTL (as Marketing/CampaignsTable)
const fillTemplate = (template, values, figure) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{figure(values[name])}</React.Fragment> : part
})

// What the API said, as the toast of main showed it (`result[0]` of a list, or the text), translated; with nothing to show, a generic line.
export const apiErrorText = (t, result) => {
  const message = Array.isArray(result) ? result[0] : result
  return translateApiMessage(t, message, t('SCHOOL_ACTION_FAILED', 'Something went wrong. Try again.'))
}

// The card of a record is a link; a school list has no page per record, so it points at the one it is on (a plain click opens the dialog)
export const cardHref = () => (typeof window === 'undefined' ? undefined : `${window.location.pathname}${window.location.search}`)

// The foot: the pages, with the sizes of Campaigns' foot and its texts. Nothing when there are no rows.
export const SchoolPager = ({ list }) => {
  const [, t] = useLanguage()
  const total = list.total
  if (!(total != null ? total > 0 : list.items.length > 0)) return null
  return (
    <div className='odc-school-foot'>
      <Pagination
        page={list.page}
        pageSize={list.pageSize}
        total={total ?? undefined}
        hasMore={total == null && list.page < list.totalPages}
        itemCount={list.items.length}
        pageSizeOptions={PAGE_SIZES}
        onPageChange={(page) => list.goToPage(page)}
        onPageSizeChange={(size) => list.changePageSize(size)}
        busy={list.loading}
        showPageInput
        label={t('PAGINATION', 'Pagination')}
        previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
        nextLabel={t('NEXT_PAGE', 'Next page')}
        pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
        pageLabel={t('PAGE', 'Page')}
        pageOfLabel={(totalPages, figure) => fillTemplate(t('PAGE_OF_TOTAL', 'of _total_'), { total: totalPages }, figure)}
        rangeLabel={(from, to, count, figure) => fillTemplate(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from, to, total: count }, figure)}
        pageStatusLabel={(current, totalPages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(totalPages))}
      />
    </div>
  )
}

// redesign (T; the pattern of CartRecovery/RecoveryActionListing, listFocus.settleFocusOn): `list.reload()` puts the table in its
// skeleton and unmounts the button that opened the dialog, so the focus fell on <body> (or on the next tab stop). The tab remembers where
// the focus goes and hands it over once the reload has finished and the rows are back: a save goes to that record's «Edit» button
// (`data-school-edit`), a delete to the row that took its place (the next one, else the one before) and, with none left, to the toolbar's
// «Add …» button (`data-school-add`). `frameRef` is the tab's root, which holds the toolbar and the table (or the cards).
export const useReloadFocus = (list, frameRef) => {
  const pending = useRef(null)
  useEffect(() => {
    const next = pending.current
    if (!next || list.loading) return
    pending.current = null
    if (list.error) return // the notice with «Retry» takes the place of the list: nothing to give the focus to
    settleFocusOn(() => frameRef.current, next.id, next.options)
  }, [list.loading])

  return {
    // no row id on purpose: `emptyTarget` names the exact control, and the row of settleFocusOn would take the whole row
    focusEditAfterReload: (id) => {
      pending.current = {
        id: null,
        options: { emptyTarget: (frame) => Array.from(frame.querySelectorAll('[data-school-edit]')).find((button) => button.getAttribute('data-school-edit') === String(id)) ?? null }
      }
    },
    focusSuccessorAfterReload: (items, id) => {
      const index = items.findIndex((item) => item.id === id)
      const successor = index === -1 ? undefined : (items[index + 1] ?? items[index - 1])
      pending.current = {
        id: successor ? successor.id : null,
        options: { takeover: true, emptyTarget: (frame) => frame.querySelector('[data-school-add]') }
      }
    }
  }
}

export const SchoolGrades = (props) => {
  const { school, initialPage, onPageChange } = props
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const isPhone = useIsPhone()
  const frameRef = useRef(null)

  const schoolId = school?.id
  // redesign SC-B2 (M-SC03, M-SC10): the shared loader keeps the rows when a load fails, goes back a page when the last row of one is
  // deleted, and drops an old answer. Without a school main did not ask; neither does this.
  const list = useSchoolList({
    fetchPage: ({ page, pageSize }) => (schoolId
      ? listGrades(ordering, token, { schoolId, page, pageSize })
      : Promise.resolve({ error: false, result: [] })),
    deps: [schoolId],
    initialPage,
    pageSize: PAGE_SIZE,
    onPageChange
  })
  const { focusEditAfterReload, focusSuccessorAfterReload } = useReloadFocus(list, frameRef)

  // `key` is new each time the dialog opens: the form starts from the grade (or empty) and a closing one keeps its content while it fades
  const [form, setForm] = useState({ open: false, grade: null, key: 0 })
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [seedAsk, setSeedAsk] = useState(false)
  const [removal, setRemoval] = useState({ open: false, grade: null })
  const [deleting, setDeleting] = useState(false)

  const openCreate = () => setForm((current) => ({ open: true, grade: null, key: current.key + 1 }))
  const openEdit = (grade) => setForm((current) => ({ open: true, grade, key: current.key + 1 }))
  const closeForm = () => setForm((current) => ({ ...current, open: false }))

  const handleSave = async ({ name, code }) => {
    const grade = form.grade
    const isEdit = Boolean(grade && grade.id)
    setSaving(true)
    const { error, result } = isEdit
      ? await updateGrade(ordering, token, grade.id, { code, name })
      : await createGrade(ordering, token, { school_id: schoolId, code, name })
    setSaving(false)
    if (error) {
      showToast(ToastType.Error, apiErrorText(t, result)) // the dialog stays open with what was typed
      return
    }
    showToast(ToastType.Success, t('SCHOOL_CHANGES_SAVED', 'Changes saved'))
    closeForm()
    if (isEdit) focusEditAfterReload(grade.id)
    list.reload()
  }

  // redesign D-79 (owner, 2026-10-19): the button opens a confirmation (C8, primary); this runs on confirm and the dialog
  // closes when the API answers, whichever way. The client sends only { school_id }: the catalog is the API's, and nothing here says
  // whether it skips the codes the school already has, so the text counts «up to» the dashboard's own 14 codes.
  const handleBulk = async () => {
    setSeeding(true)
    const { error, result } = await bulkGrades(ordering, token, { school_id: schoolId })
    setSeeding(false)
    setSeedAsk(false)
    if (error) {
      showToast(ToastType.Error, apiErrorText(t, result))
      return
    }
    showToast(ToastType.Success, t('SCHOOL_GRADES_SEEDED', 'Grades created from catalog'))
    list.goToPage(1)
  }

  const handleDelete = async () => {
    const grade = removal.grade
    if (!grade) return
    setDeleting(true)
    const { error, result } = await deleteGrade(ordering, token, grade.id)
    setDeleting(false)
    setRemoval((current) => ({ ...current, open: false })) // it closes when the API answers, whichever way
    if (error) {
      showToast(ToastType.Error, apiErrorText(t, result))
      return
    }
    showToast(ToastType.Success, t('SCHOOL_GRADE_DELETED', 'Grade deleted'))
    focusSuccessorAfterReload(list.items, grade.id)
    list.reload()
  }

  // ---- the cells (the table and the cards draw the same ones) ----
  const editLabel = (grade) => t('SCHOOL_EDIT_GRADE_NAMED', 'Edit grade _name_').replace('_name_', () => grade.name ?? '')
  const deleteLabel = (grade) => t('SCHOOL_DELETE_GRADE_NAMED', 'Delete grade _name_').replace('_name_', () => grade.name ?? '')

  // «Grade 1 · g1»: the name of the code, then the stored code quieter and in mono. An unknown code shows once; no code is a dash.
  const codeNode = (code) => {
    if (!code) return '—'
    const label = gradeCodeLabel(t, code)
    if (label === code) return <span className='odc-mono'>{code}</span>
    return (
      <>
        {label}
        <span className='odc-school-code-raw'>{' · '}<span className='odc-mono'>{code}</span></span>
      </>
    )
  }

  const actionButtons = (grade, size) => (
    <>
      <Button size={size} variant='ghost' icon={Pencil} aria-label={editLabel(grade)} data-school-edit={grade.id} onClick={() => openEdit(grade)}>
        {t('EDIT', 'Edit')}
      </Button>
      <IconButton size={size} icon={Trash2} label={deleteLabel(grade)} onClick={() => setRemoval({ open: true, grade })} />
    </>
  )

  const loadingLabel = t('LOADING', 'Loading')
  const listLabel = t('SCHOOL_TAB_GRADES', 'Grades')

  const emptyState = (
    <EmptyState
      icon={GraduationCap}
      title={t('SCHOOL_NO_GRADES', 'No grades yet')}
      action={(
        <Button variant='primary' icon={Plus} disabled={!schoolId} onClick={openCreate}>
          {t('SCHOOL_ADD_GRADE', 'Add grade')}
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
            : list.items.map((grade) => ({
              id: grade.id,
              href: cardHref(),
              label: grade.name ?? '',
              title: <span className='odc-school-name' dir='auto'>{grade.name}</span>,
              from: grade.code ? <span className='odc-school-card-code'>{codeNode(grade.code)}</span> : undefined,
              actions: <div className='odc-school-card-actions' data-card-actions=''>{actionButtons(grade, 'md')}</div>,
              onOpen: () => openEdit(grade)
            }))}
        />
      </div>
    )
  } else {
    body = (
      <DataTable
        label={listLabel}
        columns={[
          { id: 'name', header: t('NAME', 'Name'), rowHeader: true, wrap: true, skeleton: { lines: 1 }, cell: (grade) => <span className='odc-school-name' dir='auto'>{grade.name}</span> },
          { id: 'code', header: t('SCHOOL_GRADE_CODE', 'Code'), skeleton: { lines: 1 }, cell: (grade) => codeNode(grade.code) },
          // no visible title (auditor 8): the screen readers get «Actions»; both actions in view, none behind a «⋯»
          { id: 'actions', srHeader: t('ACTIONS', 'Actions'), align: 'end', skeleton: { lines: 1 }, cell: (grade) => <span className='odc-school-row-actions'>{actionButtons(grade, 'sm')}</span> }
        ]}
        rows={list.items}
        getRowId={(grade) => grade.id}
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
            {t('SCHOOL_ADD_GRADE', 'Add grade')}
          </Button>
          <Button onClick={() => setSeedAsk(true)} busy={seeding} disabled={!schoolId}>
            {t('SCHOOL_SEED_GRADES', 'Create from catalog')}
          </Button>
        </div>
      </div>

      {body}
      {!failed && <SchoolPager list={list} />}

      <GradeDialog
        key={form.key}
        open={form.open}
        grade={form.grade}
        saving={saving}
        onSave={handleSave}
        onClose={closeForm}
      />

      <ConfirmDialog
        open={seedAsk}
        tone='primary'
        busy={seeding}
        title={t('SCHOOL_SEED_GRADES_TITLE', 'Create grades from the catalog?')}
        confirmLabel={t('SCHOOL_SEED_GRADES_CONFIRM', 'Create grades')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onCancel={() => setSeedAsk(false)}
        onConfirm={handleBulk}
      >
        {t('SCHOOL_SEED_GRADES_BODY', 'This adds up to _count_ grades to this school. You can delete them one by one.')
          .replace('_count_', () => gradeCodeOptions(t).length)}
      </ConfirmDialog>

      <ConfirmDialog
        open={removal.open}
        tone='danger'
        busy={deleting}
        title={t('SCHOOL_DELETE_GRADE_TITLE', 'Delete grade "_name_"?').replace('_name_', () => removal.grade?.name ?? '')}
        confirmLabel={t('SCHOOL_DELETE_GRADE', 'Delete grade')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onCancel={() => setRemoval((current) => ({ ...current, open: false }))}
        onConfirm={handleDelete}
      >
        {t('SCHOOL_CONFIRM_DELETE_GRADE', 'Delete this grade? Students keep working and lose this grade.')}
      </ConfirmDialog>
    </div>
  )
}

SchoolGrades.propTypes = {
  school: PropTypes.object
}

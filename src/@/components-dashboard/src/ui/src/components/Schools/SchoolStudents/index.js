import React, { useRef, useState } from 'react'
import PropTypes from 'prop-types'

import { useApi, useLanguage, useSession } from '../../../../../index'
import { listStudents } from '../../../../../components/Schools/schoolApi'
import { GraduationCap } from '../../Shared/Icon'
import { DataTable, EmptyState, Pagination, RecordCardList, SplitView } from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { SchoolDayBar } from '../SchoolDayBar'
import { SchoolListError } from '../SchoolListError'
import { personName } from '../schoolDisplay'
import { useSchoolFilters } from '../useSchoolFilters'
import { useSchoolList } from '../useSchoolList'
import { StudentPanel } from './StudentPanel'
import '../schools.css'
import './students.css'

// redesign SC-B3 (decisions 1A and 12; M-SC03, M-SC15): the Students tab. The day bar (grade and classroom, no date) over the list, beside ONE
// panel (the student) in a split view; a phone gets cards. The filters are not in the URL (as main) and the tab is mounted with `key` = the
// school (B5), so its state starts clean in every school (M-SC13).

const PAGE_SIZE = 10
const PAGE_SIZES = [10, 25, 50] // as the other redesigned lists
const DASH = '—'

const nextFrame = (callback) => (typeof window !== 'undefined' && window.requestAnimationFrame ? window.requestAnimationFrame(callback) : setTimeout(callback, 16))

// «_total_» of a template becomes a node (an .odc-figure number), the rest stays text (as Marketing/CampaignDirectory/CampaignsTable)
const fillTemplate = (template, values, figure) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{figure(values[name])}</React.Fragment> : part
})

const figureOf = (value) => <bdi dir='ltr' className='odc-figure'>{value}</bdi>

// A student's code is a figure (decision 11)
const codeNode = (student) => (student.code ? figureOf(student.code) : DASH)

// The card is a link to the list itself (a plain click opens the student, never the address): a link without an `href` takes no focus
const hrefHere = () => (typeof window === 'undefined' ? '' : `${window.location.pathname}${window.location.search}`)

export const SchoolStudents = (props) => {
  const { school, initialPage, onPageChange } = props
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, t] = useLanguage()
  const isPhone = useIsPhone()
  const schoolId = school?.id
  const { grades, classrooms } = useSchoolFilters(schoolId)

  const [filters, setFilters] = useState({ gradeId: null, classroomId: null })
  const [open, setOpen] = useState(null) // the row of the open student
  const [expanded, setExpanded] = useState(false)
  const frameRef = useRef(null)

  const list = useSchoolList({
    // the same call and parameters as main; with no school there is nothing to ask
    fetchPage: ({ page, pageSize }) => (schoolId
      ? listStudents(ordering, token, { schoolId, classroomId: filters.classroomId, gradeId: filters.gradeId, page, pageSize })
      : Promise.resolve({ error: false, result: [] })),
    deps: [schoolId, filters.classroomId, filters.gradeId],
    initialPage,
    pageSize: PAGE_SIZE,
    onPageChange
  })

  const gradeNameById = Object.fromEntries(grades.map((grade) => [grade.id, grade.name]))
  const classroomNameById = Object.fromEntries(classrooms.map((classroom) => [classroom.id, classroom.name]))
  const classroomOf = (student) => student.classroom?.name || classroomNameById[student.classroom_id] || null
  const gradeOf = (student) => student.grade?.name || gradeNameById[student.grade_id] || null

  // ---- the open student and the focus ----
  // redesign SC-B3: closing the panel gives the focus back to the row (the cards of a phone carry `data-row-id` too). It is tried on the next
  // frame, after the panel left the page, and leaves alone a focus the person already put somewhere in the list.
  const focusRow = (id) => nextFrame(() => {
    const frame = frameRef.current
    if (!frame) return
    const active = document.activeElement
    if (active && active !== document.body && active.isConnected && frame.contains(active)) return
    const row = Array.from(frame.querySelectorAll('[data-row-id]')).find((element) => element.getAttribute('data-row-id') === String(id))
    if (!row) return
    const target = row.hasAttribute('tabindex') ? row : (row.querySelector('a[href], button, [tabindex]') ?? row)
    target.focus({ preventScroll: true })
  })

  const closePanel = () => {
    if (!open) return
    const { id } = open
    setOpen(null)
    setExpanded(false)
    focusRow(id)
  }

  // The list's own version of the open student when it has one (the panel shows the row until the student loads)
  const openRow = open ? (list.items.find((student) => student.id === open.id) ?? open) : null

  // ---- the list: a table, or cards on a phone ----
  const loadingLabel = t('LOADING', 'Loading')
  const listLabel = t('SCHOOL_STUDENTS', 'School students')
  const empty = <EmptyState icon={GraduationCap} title={t('SCHOOL_NO_STUDENTS', 'No students yet')} />
  // redesign SC-B3 (M-SC03): a failed load is its own state, never «No students yet»
  const failed = !list.loading && Boolean(list.error)

  const total = list.total
  const showFoot = !failed && (total != null ? total > 0 : list.items.length > 0)
  const foot = showFoot && (
    <Pagination
      page={list.page}
      pageSize={list.pageSize}
      total={total ?? undefined}
      hasMore={total == null && list.page < list.totalPages}
      itemCount={list.items.length}
      pageSizeOptions={PAGE_SIZES}
      onPageChange={list.goToPage}
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
  )

  const columns = [
    {
      id: 'name',
      header: t('NAME', 'Name'),
      rowHeader: true,
      wrap: true,
      skeleton: { lines: 1 },
      cell: (student) => <span className='odc-school-student-name' dir='auto'>{personName(student) || DASH}</span>
    },
    { id: 'code', header: t('SCHOOL_STUDENT_CODE', 'Code'), skeleton: { lines: 1 }, cell: codeNode },
    { id: 'classroom', header: t('SCHOOL_CLASSROOM', 'Classroom'), skeleton: { lines: 1 }, cell: (student) => classroomOf(student) ?? DASH },
    { id: 'grade', header: t('SCHOOL_GRADE', 'Grade'), skeleton: { lines: 1 }, cell: (student) => gradeOf(student) ?? DASH }
  ]

  const toCard = (student) => {
    const name = personName(student)
    return {
      id: student.id,
      href: hrefHere(),
      label: t('SCHOOL_OPEN_STUDENT', 'Open _name_').replace('_name_', () => name),
      title: <span className='odc-school-student-name' dir='auto'>{name || DASH}</span>,
      from: codeNode(student),
      indicator: <span className='odc-school-student-card-line'>{[classroomOf(student), gradeOf(student)].filter(Boolean).join(' · ') || DASH}</span>,
      active: open?.id === student.id,
      onOpen: () => setOpen(student)
    }
  }

  let content
  if (failed) {
    content = <SchoolListError message={list.error} onRetry={list.reload} />
  } else if (isPhone) {
    content = (
      <RecordCardList
        label={listLabel}
        items={list.loading ? [] : list.items.map(toCard)}
        loading={list.loading}
        loadingLabel={loadingLabel}
        skeletonCount={PAGE_SIZE}
        empty={empty}
      />
    )
  } else {
    content = (
      <DataTable
        label={listLabel}
        columns={columns}
        rows={list.items}
        getRowId={(student) => student.id}
        activeRowId={open?.id}
        onOpenRow={(student) => setOpen(student)}
        loading={list.loading}
        loadingLabel={loadingLabel}
        skeletonRows={PAGE_SIZE}
        empty={empty}
      />
    )
  }

  const listView = (
    <div ref={frameRef} className='odc-root odc-school-tab'>
      <SchoolDayBar
        showDate={false}
        grades={grades}
        classrooms={classrooms}
        gradeId={filters.gradeId}
        setGradeId={(gradeId) => setFilters((current) => ({ ...current, gradeId }))}
        classroomId={filters.classroomId}
        setClassroomId={(classroomId) => setFilters((current) => ({ ...current, classroomId }))}
      />
      {content}
      {foot}
    </div>
  )

  const panel = openRow && (
    <StudentPanel
      key={openRow.id}
      student={openRow}
      onClose={closePanel}
      expanded={expanded}
      onExpandedChange={setExpanded}
    />
  )

  return (
    <SplitView
      list={listView}
      panel={panel}
      open={Boolean(open)}
      expanded={expanded}
      panelLabel={t('SCHOOL_STUDENT', 'Student')}
      resizeLabel={t('SCHOOL_STUDENT_RESIZE_PANEL', 'Resize the student panel')}
      storageKey='odc-schools-student-panel'
      onClose={closePanel}
    />
  )
}

SchoolStudents.propTypes = {
  school: PropTypes.object,
  initialPage: PropTypes.number,
  onPageChange: PropTypes.func
}

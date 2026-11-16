import React, { useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import { useApi, useSession, useLanguage, useToast, ToastType } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { listMeals, fetchSchoolReport } from '../../../../../components/Schools/schoolApi'
import { saveInvoicePdfBlob } from '../../BusinessIntelligence/downloadInvoicePdf'
import { DataTable, EmptyState, Pagination, RecordCardList } from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { SchoolChips } from '../SchoolChips'
import { SchoolDayBar } from '../SchoolDayBar'
import { SchoolListError } from '../SchoolListError'
import { personName } from '../schoolDisplay'
import { useSchoolDay } from '../useSchoolDay'
import { useDropForeignFilters, useSchoolFilters } from '../useSchoolFilters'
import { useSchoolList } from '../useSchoolList'
import { ReportCards } from './ReportCards'
import '../schools.css'
import './meals.css'

// redesign SC-B4 (decision 3A; M-SC01, M-SC02, M-SC03, M-SC05, M-SC08, M-SC09, M-SC13): «Meals & reports». The filter bar comes first and its
// day, grade and classroom are the ones of the URL that «Print labels» shares; the two report cards say what their download includes; the
// meals are a Product table (cards on a phone). What main did is kept: the requests, the five downloads, the toasts, 25 per page.

const PAGE_SIZE = 25
const PAGE_SIZES = [10, 25, 50]
const MEAL_PARAMS = 'name,quantity,allergens,dietary_tags,order(id,student(name,lastname,code,classroom(name),grade(name)))'
const NONE = '—'

const figure = (value) => <bdi dir='ltr' className='odc-figure'>{value}</bdi>
// apply-list row 25 (schools P-6): the order number opens the order (the /orders detail by `?id=`, as the gift cards link it), with P/Button's link look
const orderLink = (id) => <Link className='odc-btn' data-variant='link' to={`/orders?id=${id}`}>{figure(id)}</Link>

// «Showing _from_–_to_ of _total_»: the numbers become figure nodes (decision 11)
const fillTemplate = (template, values, makeFigure) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{makeFigure(values[name])}</React.Fragment> : part
})

export const SchoolMealsReports = (props) => {
  const { school, initialPage, onPageChange } = props
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const isPhone = useIsPhone()

  // redesign SC-B4 (decision 3A, M-SC02): the day (local), the grade and the classroom live in the URL; main kept its own UTC date and filters
  const { day, gradeId, classroomId, setDay, setGradeId, setClassroomId } = useSchoolDay()
  const [running, setRunning] = useState([])
  const runningNow = useRef(new Set())

  const schoolId = school?.id
  const filters = useSchoolFilters(schoolId)
  // auditor 1: a grade or classroom of another school never filters here in silence
  useDropForeignFilters({ ...filters, gradeId, classroomId, setGradeId, setClassroomId })

  const list = useSchoolList({
    fetchPage: ({ page, pageSize }) => (schoolId
      ? listMeals(ordering, token, schoolId, { preparationDate: day, classroomId, gradeId, params: MEAL_PARAMS, page, pageSize })
      : Promise.resolve({ error: false, result: [] })),
    deps: [schoolId, day, gradeId, classroomId],
    initialPage,
    pageSize: PAGE_SIZE,
    onPageChange
  })

  // the scope the cards show is the scope the downloads carry: while the bar cannot name the grade or classroom of the URL (the lists
  // are loading, or the id is another school's and is about to be removed) nothing can be downloaded
  const grade = gradeId === null ? null : filters.grades.find((item) => item.id === gradeId)
  const classroom = classroomId === null ? null : filters.classrooms.find((item) => item.id === classroomId)
  const scopeReady = (gradeId === null || Boolean(grade)) && (classroomId === null || Boolean(classroom))

  const downloadReport = async (report, format) => {
    const key = `${report}.${format}`
    if (runningNow.current.has(key)) return
    runningNow.current.add(key)
    setRunning((keys) => [...keys, key])
    try {
      const { blob, filename } = await fetchSchoolReport(ordering, token, schoolId, report, format, { preparationDate: day, gradeId, classroomId })
      saveInvoicePdfBlob(blob, filename)
    } catch (err) {
      showToast(ToastType.Error, translateApiMessage(t, err?.message, t('SCHOOL_REPORT_DOWNLOAD_FAILED', 'Report could not be downloaded')))
    }
    runningNow.current.delete(key)
    setRunning((keys) => keys.filter((item) => item !== key))
  }

  // ---- the meals ----
  const mealsLabel = t('SCHOOL_MEALS', 'Meals')
  const loadingLabel = t('LOADING', 'Loading')
  const allergensLabel = t('SCHOOL_ALLERGENS', 'Allergens')
  const dietaryLabel = t('SCHOOL_DIETARY_TAGS', 'Dietary tags')
  const empty = <EmptyState title={t('SCHOOL_NO_MEALS', 'No meals for this date')} />

  const columns = [
    { id: 'order', header: t('ORDER_ID', 'Order ID'), skeleton: { lines: 1 }, cell: (line) => (line.order?.id != null ? orderLink(line.order.id) : NONE) },
    { id: 'meal', header: t('SCHOOL_MEAL', 'Meal'), rowHeader: true, wrap: true, skeleton: { lines: 1 }, cell: (line) => line.name },
    { id: 'quantity', header: t('SCHOOL_QUANTITY', 'Qty'), align: 'end', skeleton: { lines: 1 }, cell: (line) => figure(line.quantity) },
    { id: 'student', header: t('SCHOOL_STUDENT', 'Student'), wrap: true, skeleton: { lines: 1 }, cell: (line) => (line.order?.student ? personName(line.order.student) : NONE) },
    { id: 'classroom', header: t('SCHOOL_CLASSROOM', 'Classroom'), wrap: true, skeleton: { lines: 1 }, cell: (line) => line.order?.student?.classroom?.name || NONE },
    { id: 'grade', header: t('SCHOOL_GRADE', 'Grade'), wrap: true, skeleton: { lines: 1 }, cell: (line) => line.order?.student?.grade?.name || NONE },
    {
      id: 'allergens',
      header: allergensLabel,
      skeleton: { lines: 1 },
      cell: (line) => <SchoolChips kind='allergen' values={line.allergens} emptyLabel={NONE} label={allergensLabel} />
    },
    {
      id: 'dietary',
      header: dietaryLabel,
      skeleton: { lines: 1 },
      cell: (line) => <SchoolChips kind='dietary' values={line.dietary_tags} emptyLabel={NONE} label={dietaryLabel} />
    }
  ]

  // redesign SC-B4 (coordinator): under 768px the meals are a list of RecordCards, like the other tabs. A meal opens nothing, as in main, so its
  // card is `link={false}` without `onOpen` (X-SC4): a static card, no overlay, no hover state. It carries every field of the table;
  // its only link is the order number (row 25), never the card.
  const toCard = (line) => {
    const student = line.order?.student
    const where = [student ? personName(student) : null, student?.classroom?.name, student?.grade?.name].filter(Boolean)
    const hasChips = (line.allergens || []).length > 0 || (line.dietary_tags || []).length > 0
    return {
      id: line.id,
      link: false,
      title: <span className='odc-school-meal-title' dir='auto'>{line.name} × {figure(line.quantity)}</span>,
      from: <p className='odc-school-meal-where' dir='auto'>{where.length ? where.join(' · ') : NONE}</p>,
      indicator: line.order?.id != null ? <p className='odc-school-meal-order'>{t('ORDER_ID', 'Order ID')} {orderLink(line.order.id)}</p> : undefined,
      actions: hasChips
        ? (
          <div className='odc-school-meal-chips'>
            <SchoolChips kind='allergen' values={line.allergens} emptyLabel='' label={allergensLabel} />
            <SchoolChips kind='dietary' values={line.dietary_tags} emptyLabel='' label={dietaryLabel} />
          </div>
          )
        : undefined
    }
  }

  const foot = (
    <Pagination
      page={list.page}
      pageSize={list.pageSize}
      total={list.total ?? undefined}
      hasMore={list.total == null && list.page < list.totalPages}
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
      pageOfLabel={(totalPages, makeFigure) => fillTemplate(t('PAGE_OF_TOTAL', 'of _total_'), { total: totalPages }, makeFigure)}
      rangeLabel={(from, to, count, makeFigure) => fillTemplate(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from, to, total: count }, makeFigure)}
      pageStatusLabel={(current, totalPages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(totalPages))}
    />
  )

  const renderMeals = () => {
    // redesign SC-B4 (M-SC03): a failed load is an error with «Retry», never «No meals». The rows of another day would mislead: they go.
    if (list.error) return <SchoolListError message={list.error} onRetry={list.reload} />
    if (isPhone) {
      return (
        <>
          <RecordCardList
            label={mealsLabel}
            items={list.loading ? [] : list.items.map(toCard)}
            loading={list.loading}
            loadingLabel={loadingLabel}
            skeletonCount={list.pageSize}
            empty={empty}
          />
          {foot}
        </>
      )
    }
    return (
      <>
        <DataTable
          label={mealsLabel}
          columns={columns}
          rows={list.items}
          getRowId={(line) => line.id}
          loading={list.loading}
          loadingLabel={loadingLabel}
          skeletonRows={list.pageSize}
          empty={empty}
        />
        {foot}
      </>
    )
  }

  return (
    <div className='odc-root odc-school-tab'>
      <SchoolDayBar
        day={day}
        setDay={setDay}
        grades={filters.grades}
        classrooms={filters.classrooms}
        gradeId={gradeId}
        setGradeId={setGradeId}
        classroomId={classroomId}
        setClassroomId={setClassroomId}
      />
      <ReportCards
        day={day}
        gradeName={grade?.name ?? null}
        classroomName={classroom?.name ?? null}
        running={running}
        disabled={!schoolId || !scopeReady}
        onDownload={downloadReport}
      />
      {renderMeals()}
    </div>
  )
}

SchoolMealsReports.propTypes = {
  school: PropTypes.object,
  initialPage: PropTypes.number,
  onPageChange: PropTypes.func
}

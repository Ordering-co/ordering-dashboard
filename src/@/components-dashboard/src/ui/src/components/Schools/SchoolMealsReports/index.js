import React, { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { useApi, useSession, useLanguage, useToast, ToastType } from '../../../../../index'
import { Button, Input } from '../../../styles'
import { Select as FirstSelect } from '../../../styles/Select/FirstSelect'
import { SpinnerLoader, Pagination } from '../../Shared'
import { Download as DownloadIcon } from 'react-bootstrap-icons'
import { listMeals, fetchSchoolReport } from '../../../../../components/Schools/schoolApi'
import { saveInvoicePdfBlob } from '../../BusinessIntelligence/downloadInvoicePdf'
import { useSchoolFilters } from '../useSchoolFilters'
import {
  Toolbar, Table, EmptyState, Chips, Chip, ReportsWrapper, ReportCard, ReportActions
} from '../styles'

const PAGE_SIZE = 25
const ALL_FILTER = 'all'
const MEAL_PARAMS = 'name,quantity,allergens,dietary_tags,order(id,student(name,lastname,code,classroom(name),grade(name)))'

const todayYmd = () => new Date().toISOString().slice(0, 10)

export const SchoolMealsReports = (props) => {
  const { school, initialPage, onPageChange } = props
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()

  const [date, setDate] = useState(todayYmd())
  const [filters, setFilters] = useState({ classroomId: null, gradeId: null })
  const [state, setState] = useState({ loading: false, items: [], error: null })
  const [pagination, setPagination] = useState({ currentPage: initialPage || 1, totalPages: 1, pageSize: PAGE_SIZE })
  const [reporting, setReporting] = useState(null)
  const firstLoad = useRef(true)

  const schoolId = school?.id
  const { grades, classrooms } = useSchoolFilters(schoolId)

  const load = async (page = 1, pageSize = pagination.pageSize) => {
    if (!schoolId || !date) return
    setState((s) => ({ ...s, loading: true }))
    const { error, result, pagination: meta } = await listMeals(ordering, token, schoolId, {
      preparationDate: date,
      classroomId: filters.classroomId,
      gradeId: filters.gradeId,
      params: MEAL_PARAMS,
      page,
      pageSize
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
  }, [schoolId, date, filters.classroomId, filters.gradeId])

  const downloadReport = async (report, format) => {
    setReporting(`${report}.${format}`)
    try {
      const { blob, filename } = await fetchSchoolReport(ordering, token, schoolId, report, format, { preparationDate: date, ...filters })
      saveInvoicePdfBlob(blob, filename)
    } catch (err) {
      showToast(ToastType.Error, err?.message || t('SCHOOL_REPORT_DOWNLOAD_FAILED', 'Report could not be downloaded'))
    }
    setReporting(null)
  }

  const renderDownload = (report, format) => {
    const key = `${report}.${format}`
    return (
      <Button color='primary' borderRadius='8px' disabled={!schoolId || !date || reporting === key} onClick={() => downloadReport(report, format)}>
        <DownloadIcon />
        {reporting === key ? t('LOADING', 'Loading') : format.toUpperCase()}
      </Button>
    )
  }

  const gradeOptions = [{ value: ALL_FILTER, content: t('SCHOOL_ALL_GRADES', 'All grades') }]
    .concat(grades.map((g) => ({ value: g.id, content: g.name })))
  const classroomOptions = [{ value: ALL_FILTER, content: t('SCHOOL_ALL_CLASSROOMS', 'All classrooms') }]
    .concat(classrooms.map((c) => ({ value: c.id, content: c.name })))

  return (
    <div>
      <ReportsWrapper style={{ marginTop: 0, marginBottom: '24px' }}>
        <ReportCard>
          <h3>{t('SCHOOL_KITCHEN_REPORT', 'Kitchen report')}</h3>
          <p>{t('SCHOOL_KITCHEN_REPORT_DOWNLOAD_DESC', 'What the kitchen must cook and pack on this date. CSV has one row per meal; XLSX adds the totals per meal and add-on.')}</p>
          <p><strong>{t('SCHOOL_REPORT_FOR_DATE', 'For the selected date')}:</strong> {date}</p>
          <ReportActions>
            {renderDownload('kitchen', 'csv')}
            {renderDownload('kitchen', 'xlsx')}
          </ReportActions>
        </ReportCard>
        <ReportCard>
          <h3>{t('SCHOOL_PRODUCTS_ORDERED_REPORT', 'Products ordered report')}</h3>
          <p>{t('SCHOOL_PRODUCTS_ORDERED_REPORT_DOWNLOAD_DESC', 'One row per ordered meal (per student) for this date. PDF is the report for the province; CSV has only the rows; XLSX has the full report in one sheet.')}</p>
          <p><strong>{t('SCHOOL_REPORT_FOR_DATE', 'For the selected date')}:</strong> {date}</p>
          <ReportActions>
            {renderDownload('products_ordered', 'pdf')}
            {renderDownload('products_ordered', 'csv')}
            {renderDownload('products_ordered', 'xlsx')}
          </ReportActions>
        </ReportCard>
      </ReportsWrapper>

      <Toolbar>
        <div>
          <label>{t('SCHOOL_PREPARATION_DATE', 'Preparation date')}</label>
          <Input type='date' value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <FirstSelect
            defaultValue={filters.gradeId ?? ALL_FILTER}
            options={gradeOptions}
            placeholder={t('SCHOOL_ALL_GRADES', 'All grades')}
            onChange={(value) => setFilters((f) => ({ ...f, gradeId: value === ALL_FILTER ? null : value }))}
          />
        </div>
        <div>
          <FirstSelect
            defaultValue={filters.classroomId ?? ALL_FILTER}
            options={classroomOptions}
            placeholder={t('SCHOOL_ALL_CLASSROOMS', 'All classrooms')}
            onChange={(value) => setFilters((f) => ({ ...f, classroomId: value === ALL_FILTER ? null : value }))}
          />
        </div>
      </Toolbar>

      {state.loading
        ? <SpinnerLoader />
        : state.items.length === 0
          ? <EmptyState>{t('SCHOOL_NO_MEALS', 'No meals for this date')}</EmptyState>
          : (
            <Table>
              <thead>
                <tr>
                  <th>{t('ORDER_ID', 'Order ID')}</th>
                  <th>{t('SCHOOL_MEAL', 'Meal')}</th>
                  <th>{t('SCHOOL_QUANTITY', 'Qty')}</th>
                  <th>{t('SCHOOL_STUDENT', 'Student')}</th>
                  <th>{t('SCHOOL_CLASSROOM', 'Classroom')}</th>
                  <th>{t('SCHOOL_GRADE', 'Grade')}</th>
                  <th>{t('SCHOOL_ALLERGENS', 'Allergens')}</th>
                  <th>{t('SCHOOL_DIETARY_TAGS', 'Dietary tags')}</th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((line) => (
                  <tr key={line.id}>
                    <td>{line.order?.id ?? '-'}</td>
                    <td>{line.name}</td>
                    <td>{line.quantity}</td>
                    <td>{line.order?.student ? `${line.order.student.name} ${line.order.student.lastname}` : '-'}</td>
                    <td>{line.order?.student?.classroom?.name || '-'}</td>
                    <td>{line.order?.student?.grade?.name || '-'}</td>
                    <td>
                      <Chips>
                        {(line.allergens || []).length
                          ? line.allergens.map((a) => <Chip key={a}>{a}</Chip>)
                          : <span>-</span>}
                      </Chips>
                    </td>
                    <td>
                      <Chips>
                        {(line.dietary_tags || []).length
                          ? line.dietary_tags.map((d) => <Chip key={d}>{d}</Chip>)
                          : <span>-</span>}
                      </Chips>
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
    </div>
  )
}

SchoolMealsReports.propTypes = {
  school: PropTypes.object
}

import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useApi, useSession, useLanguage, useToast, ToastType } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { getSchoolLabelsCount, fetchSchoolLabelsPdf } from '../../../../../components/Schools/schoolApi'
import { saveInvoicePdfBlob } from '../../BusinessIntelligence/downloadInvoicePdf'
import { Download } from '../../Shared/Icon'
import { Button, EmptyState, InlineNotice, Skeleton } from '../../Shared/Product'
import { SchoolDayBar } from '../SchoolDayBar'
import { SchoolListError } from '../SchoolListError'
import { labelTemplateName } from '../schoolDisplay'
import { useSchoolDay } from '../useSchoolDay'
import { useDropForeignFilters, useSchoolFilters } from '../useSchoolFilters'
import { PdfPreview } from './PdfPreview'
import '../schools.css'
import './labels.css'

// redesign SC-B4 (decision 3A; M-SC01, M-SC02, M-SC03, M-SC09, M-SC13): «Print labels». The day, the grade and the classroom are the ones of
// the URL that «Meals & reports» shares (useSchoolDay); the filter bar is the first thing in the tab. What main did with them is kept:
// the count of the day, the preview with cut guides (cancelled when the selection changes) and the sheet without guides to download.

const figure = (value) => <bdi dir='ltr' className='odc-figure'>{value}</bdi>

// the message of a failed count, or `true` when the API said nothing usable (SchoolListError then shows its own hint)
const messageOf = (result) => {
  const message = Array.isArray(result) ? result[0] : result
  return typeof message === 'string' && message.trim() ? message : true
}

export const SchoolPrintLabels = (props) => {
  const { school } = props
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()

  // redesign SC-B4 (decision 3A, M-SC02): the day lives in the URL, local; main kept its own UTC date and filters here
  const { day, gradeId, classroomId, setDay, setGradeId, setClassroomId } = useSchoolDay()
  const [count, setCount] = useState({ loading: false, result: null, error: null })
  const [preview, setPreview] = useState({ loading: false, blob: null, error: null })
  const [generating, setGenerating] = useState(false)
  const [zoom, setZoom] = useState(1)
  const requestId = useRef(0)
  const previewAbort = useRef(null)
  const generatingNow = useRef(false)

  const schoolId = school?.id
  const filters = useSchoolFilters(schoolId)
  // auditor 1: a grade or classroom of another school never filters here in silence
  useDropForeignFilters({ ...filters, gradeId, classroomId, setGradeId, setClassroomId })

  const load = async () => {
    if (!schoolId || !day) return
    const id = ++requestId.current
    previewAbort.current?.abort()
    setCount((s) => ({ ...s, loading: true }))
    setPreview({ loading: false, blob: null, error: null })
    let answer
    try {
      answer = await getSchoolLabelsCount(ordering, token, schoolId, { preparationDate: day, gradeId, classroomId })
    } catch (err) {
      answer = { error: true, result: err?.message }
    }
    if (id !== requestId.current) return
    const { error, result } = answer || {}
    if (error) {
      setCount({ loading: false, result: null, error: messageOf(result) })
      return
    }
    setCount({ loading: false, result, error: null })
    if (!result?.labels || result.exceeds_max) return
    const controller = new AbortController()
    previewAbort.current = controller
    setPreview({ loading: true, blob: null, error: null })
    try {
      const { blob } = await fetchSchoolLabelsPdf(
        ordering, token, schoolId,
        { preparationDate: day, gradeId, classroomId, guides: true },
        { signal: controller.signal }
      )
      if (id !== requestId.current) return
      setPreview({ loading: false, blob, error: null })
    } catch (err) {
      if (err?.name === 'AbortError' || id !== requestId.current) return
      setPreview({ loading: false, blob: null, error: err?.message })
    }
  }

  useEffect(() => { load() }, [schoolId, day, gradeId, classroomId])
  useEffect(() => () => previewAbort.current?.abort(), [])

  const handleGenerate = async () => {
    if (generatingNow.current) return
    generatingNow.current = true
    setGenerating(true)
    try {
      const { blob, filename } = await fetchSchoolLabelsPdf(ordering, token, schoolId, { preparationDate: day, gradeId, classroomId })
      saveInvoicePdfBlob(blob, filename)
    } catch (err) {
      showToast(ToastType.Error, translateApiMessage(t, err?.message, t('SCHOOL_LABELS_DOWNLOAD_FAILED', 'Labels could not be downloaded')))
    }
    generatingNow.current = false
    setGenerating(false)
  }

  const result = count.result
  const hasLabels = !!result?.labels
  // busy keeps the button where it is while the sheet is made; it is off only when there is nothing to print
  const canGenerate = hasLabels && !result?.exceeds_max && !count.loading

  const renderBody = () => {
    if (count.loading) {
      return (
        <div className='odc-school-labels-loading' role='status' aria-busy='true'>
          <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
          <Skeleton size='40%' />
          <Skeleton size='100%' block='var(--od-x-chart-height-compact)' />
        </div>
      )
    }
    // redesign SC-B4 (M-SC03): a failed count is an error with «Retry», not text on an empty tab
    if (count.error) return <SchoolListError message={count.error} onRetry={load} />
    if (!hasLabels) {
      return <EmptyState title={translateApiMessage(t, result?.message, t('SCHOOL_NO_MEALS', 'No meals for this date'))} />
    }
    return (
      <>
        <div className='odc-school-labels-summary'>
          <span>{figure(result.labels)} {t('SCHOOL_LABELS_COUNT', 'labels')}</span>
          <span>{figure(result.classrooms)} {t('SCHOOL_LABELS_CLASSROOMS_COUNT', 'classrooms')}</span>
          <span>{figure(result.grades)} {t('SCHOOL_LABELS_GRADES_COUNT', 'grades')}</span>
          <span>{figure(result.sheets)} {t('SCHOOL_LABELS_SHEETS_COUNT', 'sheets')}</span>
          {((result.by_band || []).length > 0 || result.template) && (
            <ul className='odc-school-chips'>
              {(result.by_band || []).map((item) => (
                <li key={item.band ?? 'none'} className='odc-school-chip'>
                  {/* redesign SC-R1 (review r1 #3): one inline run, so the flex chip keeps the space before the figure */}
                  <span>{item.band ?? t('SCHOOL_LABELS_WITHOUT_GRADE', 'Without grade')}: {figure(item.labels)}</span>
                </li>
              ))}
              {result.template && <li className='odc-school-chip'>{labelTemplateName(result.template)}</li>}
            </ul>
          )}
        </div>

        {result.exceeds_max
          ? (
            <div className='odc-school-labels-notice'>
              <InlineNotice tone='warning'>
                {t('SCHOOL_LABELS_TOO_MANY', 'Too many labels to generate; narrow the selection by grade or classroom.')} ({t('SCHOOL_LABELS_MAX', 'max')} {figure(result.max_labels)})
              </InlineNotice>
            </div>
            )
          : (
            <PdfPreview
              blob={preview.blob}
              loading={preview.loading}
              error={preview.error}
              zoom={zoom}
              onZoomChange={setZoom}
              note={t('SCHOOL_LABELS_PREVIEW_GUIDES_HINT', 'Preview shows cut guides; the downloaded sheet has none.')}
              actions={(
                <Button variant='primary' icon={Download} busy={generating} disabled={!canGenerate} onClick={handleGenerate}>
                  {t('DOWNLOAD', 'Download')}
                </Button>
              )}
            />
            )}
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

      <div className='odc-school-labels-head'>
        <h2 className='odc-school-labels-title'>{t('SCHOOL_PRINT_LABELS_TITLE', 'Print labels')}</h2>
        <p className='odc-school-labels-desc'>
          {t('SCHOOL_PRINT_LABELS_DESC', 'One peel-and-stick label per ordered meal for the selected date. Downloads as a print-ready PDF.')}
        </p>
      </div>

      {renderBody()}
    </div>
  )
}

SchoolPrintLabels.propTypes = {
  school: PropTypes.object
}

import React, { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { useApi, useSession, useLanguage, useToast, ToastType } from '../../../../../index'
import { Button, Input } from '../../../styles'
import { Select as FirstSelect } from '../../../styles/Select/FirstSelect'
import { SpinnerLoader } from '../../Shared'
import { getSchoolLabelsCount, fetchSchoolLabelsPdf } from '../../../../../components/Schools/schoolApi'
import { saveInvoicePdfBlob } from '../../BusinessIntelligence/downloadInvoicePdf'
import { useSchoolFilters } from '../useSchoolFilters'
import { PdfPreview } from './PdfPreview'
import { Toolbar, EmptyState, Chips, Chip } from '../styles'
import { LabelsHeader, SummaryBar, WarningBox, PreviewWrapper } from './styles'

const ALL_FILTER = 'all'

const todayYmd = () => new Date().toISOString().slice(0, 10)

const templateName = (template) => (template || '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

export const SchoolPrintLabels = (props) => {
  const { school } = props
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()

  const [date, setDate] = useState(todayYmd())
  const [filters, setFilters] = useState({ gradeId: null, classroomId: null })
  const [count, setCount] = useState({ loading: false, result: null, error: null })
  const [preview, setPreview] = useState({ loading: false, blob: null, error: null })
  const [generating, setGenerating] = useState(false)
  const [zoom, setZoom] = useState(1)
  const requestId = useRef(0)
  const previewAbort = useRef(null)

  const schoolId = school?.id
  const { grades, classrooms } = useSchoolFilters(schoolId)

  const load = async () => {
    if (!schoolId || !date) return
    const id = ++requestId.current
    previewAbort.current?.abort()
    setCount((s) => ({ ...s, loading: true }))
    setPreview({ loading: false, blob: null, error: null })
    const { error, result } = await getSchoolLabelsCount(ordering, token, schoolId, { preparationDate: date, ...filters })
    if (id !== requestId.current) return
    if (error) {
      setCount({ loading: false, result: null, error: Array.isArray(result) ? result[0] : result })
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
        { preparationDate: date, ...filters, guides: true },
        { signal: controller.signal }
      )
      if (id !== requestId.current) return
      setPreview({ loading: false, blob, error: null })
    } catch (err) {
      if (err?.name === 'AbortError' || id !== requestId.current) return
      setPreview({ loading: false, blob: null, error: err?.message })
    }
  }

  useEffect(() => { load() }, [schoolId, date, filters.gradeId, filters.classroomId])
  useEffect(() => () => previewAbort.current?.abort(), [])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const { blob, filename } = await fetchSchoolLabelsPdf(ordering, token, schoolId, { preparationDate: date, ...filters })
      saveInvoicePdfBlob(blob, filename)
    } catch (err) {
      showToast(ToastType.Error, err?.message || t('SCHOOL_LABELS_DOWNLOAD_FAILED', 'Labels could not be downloaded'))
    }
    setGenerating(false)
  }

  const gradeOptions = [{ value: ALL_FILTER, content: t('SCHOOL_ALL_GRADES', 'All grades') }]
    .concat(grades.map((g) => ({ value: g.id, content: g.name })))
  const classroomOptions = [{ value: ALL_FILTER, content: t('SCHOOL_ALL_CLASSROOMS', 'All classrooms') }]
    .concat(classrooms.map((c) => ({ value: c.id, content: c.name })))

  const result = count.result
  const hasLabels = !!result?.labels
  const canGenerate = hasLabels && !result?.exceeds_max && !count.loading && !generating

  return (
    <div>
      <LabelsHeader>
        <h3>{t('SCHOOL_PRINT_LABELS_TITLE', 'Print labels')}</h3>
        <p>{t('SCHOOL_PRINT_LABELS_DESC', 'One peel-and-stick label per ordered meal for the selected date. Downloads as a print-ready PDF.')}</p>
      </LabelsHeader>

      <Toolbar>
        <div>
          <label>{t('SCHOOL_PREPARATION_DATE', 'Preparation date')}</label>
          <Input type='date' value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label>{t('SCHOOL_GRADE', 'Grade')}</label>
          <FirstSelect
            defaultValue={filters.gradeId ?? ALL_FILTER}
            options={gradeOptions}
            placeholder={t('SCHOOL_ALL_GRADES', 'All grades')}
            onChange={(value) => setFilters((f) => ({ ...f, gradeId: value === ALL_FILTER ? null : value }))}
          />
        </div>
        <div>
          <label>{t('SCHOOL_CLASSROOM', 'Classroom')}</label>
          <FirstSelect
            defaultValue={filters.classroomId ?? ALL_FILTER}
            options={classroomOptions}
            placeholder={t('SCHOOL_ALL_CLASSROOMS', 'All classrooms')}
            onChange={(value) => setFilters((f) => ({ ...f, classroomId: value === ALL_FILTER ? null : value }))}
          />
        </div>
      </Toolbar>

      {count.loading
        ? <SpinnerLoader />
        : count.error
          ? <EmptyState>{count.error}</EmptyState>
          : !hasLabels
              ? <EmptyState>{result?.message || t('SCHOOL_NO_MEALS', 'No meals for this date')}</EmptyState>
              : (
              <>
                <SummaryBar>
                  <strong>{result.labels} {t('SCHOOL_LABELS_COUNT', 'labels')}</strong>
                  <span>{result.classrooms} {t('SCHOOL_LABELS_CLASSROOMS_COUNT', 'classrooms')}</span>
                  <span>{result.grades} {t('SCHOOL_LABELS_GRADES_COUNT', 'grades')}</span>
                  <span>{result.sheets} {t('SCHOOL_LABELS_SHEETS_COUNT', 'sheets')}</span>
                  <Chips>
                    {(result.by_band || []).map((item) => (
                      <Chip key={item.band ?? 'none'}>
                        {item.band ?? t('SCHOOL_LABELS_WITHOUT_GRADE', 'Without grade')}: {item.labels}
                      </Chip>
                    ))}
                    {result.template && <Chip>{templateName(result.template)}</Chip>}
                  </Chips>
                </SummaryBar>

                {result.exceeds_max
                  ? (
                    <WarningBox>
                      {t('SCHOOL_LABELS_TOO_MANY', 'Too many labels to generate; narrow the selection by grade or classroom.')} ({t('SCHOOL_LABELS_MAX', 'max')} {result.max_labels})
                    </WarningBox>
                    )
                  : (
                    <PreviewWrapper>
                      <PdfPreview
                        blob={preview.blob}
                        loading={preview.loading}
                        error={preview.error}
                        zoom={zoom}
                        onZoomChange={setZoom}
                        note={t('SCHOOL_LABELS_PREVIEW_GUIDES_HINT', 'Preview shows cut guides; the downloaded sheet has none.')}
                        actions={(
                          <Button color='primary' disabled={!canGenerate} onClick={handleGenerate}>
                            {generating ? t('LOADING', 'Loading') : t('DOWNLOAD', 'Download')}
                          </Button>
                        )}
                      />
                    </PreviewWrapper>
                    )}
              </>
                )}
    </div>
  )
}

SchoolPrintLabels.propTypes = {
  school: PropTypes.object
}

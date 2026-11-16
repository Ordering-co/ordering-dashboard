import React from 'react'
import PropTypes from 'prop-types'

import { useLanguage, useUtils } from '../../../../../index'
import { formatVisibleDay } from '../../../../../utils/dateRange'
import { Download } from '../../Shared/Icon'
import { Button } from '../../Shared/Product'
import './meals.css'

// redesign SC-B4 (decision 3A; M-SC08): the two report cards of «Meals & reports». Each says what its download includes (the day, the grade
// and the classroom of the bar above, M-SC08) and has one button per format. The accessible name of a button says report and format
// («Download Kitchen report as CSV»): five buttons that read «CSV» told a screen reader nothing.
//
// @param {string}   props.day            `YYYY-MM-DD`, the day of the bar.
// @param {string|null} [props.gradeName]     The grade of the filter, or null for «All grades».
// @param {string|null} [props.classroomName] The classroom of the filter, or null for «All classrooms».
// @param {string[]} [props.running]      The `report.format` keys that are being downloaded: their button is busy and takes no second click.
// @param {boolean}  [props.disabled]     No download can start (no school, or the filter is not known yet).
// @param {Function} props.onDownload     `(report, format) => void`

const figure = (value) => <bdi dir='ltr' className='odc-figure'>{value}</bdi>

// «For _date_ · _grade_ · _classroom_»: the day becomes a figure node; the names are plain text
const fillScope = (template, values) => template.split(/(_date_|_grade_|_classroom_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{values[name]}</React.Fragment> : part
})

export const ReportCards = ({ day, gradeName = null, classroomName = null, running = [], disabled = false, onDownload }) => {
  const [, t] = useLanguage()
  const [{ parseDate } = {}] = useUtils() || []
  const visibleDay = parseDate ? formatVisibleDay(day, parseDate) : day

  const scope = fillScope(t('SCHOOL_REPORT_SCOPE', 'For _date_ · _grade_ · _classroom_'), {
    date: figure(visibleDay),
    grade: gradeName || t('SCHOOL_ALL_GRADES', 'All grades'),
    classroom: classroomName || t('SCHOOL_ALL_CLASSROOMS', 'All classrooms')
  })

  const reports = [
    {
      id: 'kitchen',
      title: t('SCHOOL_KITCHEN_REPORT', 'Kitchen report'),
      description: t('SCHOOL_KITCHEN_REPORT_DOWNLOAD_DESC', 'What the kitchen must cook and pack on this date. CSV has one row per meal; XLSX adds the totals per meal and add-on.'),
      formats: ['csv', 'xlsx']
    },
    {
      id: 'products_ordered',
      title: t('SCHOOL_PRODUCTS_ORDERED_REPORT', 'Products ordered report'),
      description: t('SCHOOL_PRODUCTS_ORDERED_REPORT_DOWNLOAD_DESC', 'One row per ordered meal (per student) for this date. PDF is the report for the province; CSV has only the rows; XLSX has the full report in one sheet.'),
      formats: ['pdf', 'csv', 'xlsx']
    }
  ]

  return (
    <div className='odc-root odc-school-reports'>
      {reports.map((report) => {
        const titleId = `odc-school-report-${report.id}`
        return (
          <section key={report.id} className='odc-school-report' aria-labelledby={titleId}>
            <h3 id={titleId} className='odc-school-report-title'>{report.title}</h3>
            <p className='odc-school-report-desc'>{report.description}</p>
            <p className='odc-school-report-scope'>{scope}</p>
            <div className='odc-school-report-actions'>
              {report.formats.map((format) => {
                const key = `${report.id}.${format}`
                const name = t('SCHOOL_DOWNLOAD_REPORT_FORMAT', 'Download _report_ as _format_')
                  .replace('_report_', report.title)
                  .replace('_format_', format.toUpperCase())
                return (
                  <Button
                    key={key}
                    size='sm'
                    icon={Download}
                    busy={running.includes(key)}
                    disabled={disabled}
                    aria-label={name}
                    onClick={() => onDownload(report.id, format)}
                  >
                    {format.toUpperCase()}
                  </Button>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

ReportCards.propTypes = {
  day: PropTypes.string.isRequired,
  gradeName: PropTypes.string,
  classroomName: PropTypes.string,
  running: PropTypes.arrayOf(PropTypes.string),
  disabled: PropTypes.bool,
  onDownload: PropTypes.func.isRequired
}

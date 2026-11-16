import React, { useMemo } from 'react'

import { useConfig, useLanguage } from '../../../../index'
import { DatePicker, Field } from '../Shared/Product'
import { FirstSelect } from '../Shared/UI/FirstSelect'
import { SelectSurfaceContext } from '../Shared/UI/selectPlacement'
import { dateSettings, pickerLabels } from '../Marketing/CampaignDirectory/campaignDraft'
import './schools.css'

// redesign SC-B1 (decisions 3A and 13; M-SC01): the filter bar of «Meals & reports», «Print labels» and (without a date) «Students».
// It holds no state: the day, the grade and the classroom live in the URL (useSchoolDay) and the tab passes them in.
//
// @param {boolean}  [props.showDate]   False in Students (it has no day).
// @param {string}   props.day          `YYYY-MM-DD`.
// @param {Function} props.setDay       `(day: string) => void`
// @param {object[]} props.grades       `[{ id, name }]` (useSchoolFilters). Empty while they load.
// @param {object[]} props.classrooms   `[{ id, name }]`
// @param {number|null} props.gradeId, props.classroomId   The filter. An id that is not among the options shows «All …» and is left
//                                      alone: the tab decides what to do with it.
// @param {Function} props.setGradeId, props.setClassroomId `(id: number|null) => void`

// the value of the «All …» row (as main: S/SchoolMealsReports/index.js:15); it reaches the setters as null
const ALL_FILTER = 'all'

// C18 (the anatomy of every dropdown of the redesigned pages): the list starts at the trigger and is as wide as it
const FIT_TRIGGER = { fitTrigger: true }

// A select named by the visible label of its P/Field (the trigger reads «Grade All grades»: X-SC2, P/Field links it).
// No search box, as in main.
const FilterSelect = ({ allLabel, items, selectedId, onSelect }) => {
  const options = useMemo(
    () => [{ value: ALL_FILTER, content: allLabel }, ...items.map((item) => ({ value: item.id, content: item.name }))],
    [allLabel, items]
  )
  const known = selectedId !== null && selectedId !== undefined && items.some((item) => item.id === selectedId)
  return (
    <FirstSelect
      options={options}
      defaultValue={known ? selectedId : ALL_FILTER}
      placeholder={allLabel}
      onChange={(value) => onSelect(value === ALL_FILTER ? null : value)}
    />
  )
}

export const SchoolDayBar = ({
  showDate = true,
  day,
  setDay,
  grades = [],
  classrooms = [],
  gradeId = null,
  setGradeId,
  classroomId = null,
  setClassroomId
}) => {
  const [languageState, t] = useLanguage()
  const [{ configs } = {}] = useConfig() || []
  const { dateFormat } = dateSettings(configs)
  const dateLabel = t('SCHOOL_PREPARATION_DATE', 'Preparation date')

  return (
    <div className='odc-root odc-school-daybar'>
      {showDate && (
        <Field label={dateLabel}>
          <DatePicker
            value={day}
            // always a day: there is no «Clear» (labels carry none), and a null never reaches the tab
            onChange={(next) => { if (next) setDay(next) }}
            label={dateLabel}
            labels={pickerLabels(t)}
            dateFormat={dateFormat}
            locale={languageState?.language?.code}
          />
        </Field>
      )}
      <SelectSurfaceContext.Provider value={FIT_TRIGGER}>
        <Field label={t('SCHOOL_GRADE', 'Grade')}>
          <FilterSelect
            allLabel={t('SCHOOL_ALL_GRADES', 'All grades')}
            items={grades}
            selectedId={gradeId}
            onSelect={setGradeId}
          />
        </Field>
        <Field label={t('SCHOOL_CLASSROOM', 'Classroom')}>
          <FilterSelect
            allLabel={t('SCHOOL_ALL_CLASSROOMS', 'All classrooms')}
            items={classrooms}
            selectedId={classroomId}
            onSelect={setClassroomId}
          />
        </Field>
      </SelectSurfaceContext.Provider>
    </div>
  )
}

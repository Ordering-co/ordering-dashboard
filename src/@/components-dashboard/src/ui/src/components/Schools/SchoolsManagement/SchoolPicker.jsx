import React, { useEffect, useMemo, useRef, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { Field } from '../../Shared/Product'
import { FirstSelect } from '../../Shared/UI/FirstSelect'
import { SelectSurfaceContext } from '../../Shared/UI/selectPlacement'
import './schools-page.css'

// redesign SC-B5 (decision 1A; auditor 9): the school picker, on the row under the page header (not inside it). It holds only the text its search box shows: the shell
// loads the schools (search and pages of 10, as main) and passes them in.
//
// @param {object[]}      props.schools         `[{ id, name }]`: the page of schools the search and the page ask for.
// @param {object|null}   props.selectedSchool  The chosen school. It is listed first even when it is not on this page (main, :120-122).
// @param {boolean}       props.loading
// @param {string}        props.searchValue, props.onSearch   The search box of the list.
// @param {number}        props.page, props.totalPages, props.pageSize, props.onChangePage  `(page) => void`
// @param {Function}      props.onSelect        `(id) => void`
//
// (X-SC1, X-SC2, X-SC3): the picker is a C18 select like the Grade and Classroom ones of the day bar: the list starts at the trigger,
// pages (the schools of a project are paged 10 at a time, as main), keeps the search box named «Search», and P/Field names the trigger
// («School Riverside»). The search box of a C18 list tells on every key where main's waited for a pause (750 ms), so the picker keeps the
// text it shows and tells the shell once, when the person pauses; emptying the box asks at once.

// C18 (the anatomy of every dropdown of the redesigned pages): the list starts at the trigger and is as wide as it
const FIT_TRIGGER = { fitTrigger: true }

// main: the search box of the list told after 750 ms of no typing
const SEARCH_PAUSE = 750

// What the box shows (`draft`) and what the shell is told (`onSearch`, after the pause). A search that comes from outside replaces the draft.
const useSearchPause = (searchValue, onSearch) => {
  const [draft, setDraft] = useState(searchValue ?? '')
  const timer = useRef(null)
  const told = useRef(searchValue ?? '')
  const latest = useRef(onSearch)
  latest.current = onSearch

  const tell = (text) => {
    told.current = text
    latest.current?.(text)
  }
  const type = (next) => {
    const text = next ?? ''
    setDraft(text)
    clearTimeout(timer.current)
    if (text === '') tell('')
    else timer.current = setTimeout(() => tell(text), SEARCH_PAUSE)
  }

  useEffect(() => {
    if ((searchValue ?? '') !== told.current) {
      told.current = searchValue ?? ''
      setDraft(told.current)
    }
  }, [searchValue])
  useEffect(() => () => clearTimeout(timer.current), [])

  return [draft, type]
}

// a value that is not a school id (a school id is a number)
const NO_RESULTS = 'school-picker-no-results'

export const SchoolPicker = ({
  schools,
  selectedSchool,
  loading,
  searchValue,
  onSearch,
  page,
  totalPages,
  pageSize,
  onChangePage,
  onSelect
}) => {
  const [, t] = useLanguage()
  const [draft, handleSearch] = useSearchPause(searchValue, onSearch)

  const options = useMemo(() => {
    const schoolOption = (school) => ({
      value: school.id,
      showOnSelected: school.name,
      content: <span className='odc-school-picker-name'>{school.name}</span>
    })
    const list = (schools || []).map(schoolOption)
    // main, :120-122: the chosen school is an option even when it is not on this page
    if (selectedSchool && !list.some((option) => option.value === selectedSchool.id)) list.unshift(schoolOption(selectedSchool))
    // a search that finds nothing is said in the list (the page does not change, M-SC14); the row cannot be picked
    if (!loading && (schools || []).length === 0) {
      list.push({ value: NO_RESULTS, disabled: true, content: <span className='odc-school-picker-note'>{t('NO_RESULTS', 'No results')}</span> })
    }
    return list
  }, [schools, selectedSchool, loading, t])

  return (
    <Field label={t('SCHOOL', 'School')}>
      <SelectSurfaceContext.Provider value={FIT_TRIGGER}>
        <FirstSelect
          defaultValue={selectedSchool?.id}
          options={options}
          placeholder={t('SCHOOL_SELECT_SCHOOL', 'Select a school')}
          isShowSearchBar
          searchBarPlaceholder={t('SEARCH', 'Search')}
          searchValue={draft}
          handleChangeSearch={handleSearch}
          isLoading={loading}
          pagination={{ currentPage: page, pageSize, totalPages }}
          handleChangePage={onChangePage}
          onChange={onSelect}
        />
      </SelectSurfaceContext.Provider>
    </Field>
  )
}

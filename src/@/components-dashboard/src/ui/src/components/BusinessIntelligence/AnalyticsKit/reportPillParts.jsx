import React, { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { Skeleton } from '../../Shared/Product'
import { pillValue, withoutLeadingLabel } from '../../Shared/Product/filterValueText'

// redesign reports FB2 (D4, D5): the small parts that ReportFilterPills had inside and that ReportPeoplePills needs too, moved here
// as they were (not changed) so the two files do not import each other. Nothing in this file is new behaviour.

// The wait before the text typed in a server search reaches the controller: each change of it is a request
export const SEARCH_DEBOUNCE_MS = 500
export const SKELETON_ROWS = 8

export const asList = (value) => (Array.isArray(value) ? value : [])
export const toggled = (ids, id) => (ids.includes(id) ? ids.filter(other => other !== id) : [...ids, id])
// BI-10: «nothing selected» is `null`, never `[]` (the page and its URL builders read null as no filter)
export const orNull = (ids) => (ids.length > 0 ? ids : null)
export const figure = (value) => <bdi className='odc-figure'>{value}</bdi>

// «Showing _from_–_to_ of _total_»: the numbers become .odc-figure nodes (decision 11) and keep their direction in RTL
export const fillTemplate = (template, values, figureOf) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{figureOf(values[name])}</React.Fragment> : part
})

/**
 * What a pill says of the ids it holds: the name when there is one and it is known, else how many (a figure). A store the bar
 * has never seen (the ids a country brought, a store of another page) still counts, so one of them reads «1», not its id.
 */
export const pillText = (label, ids, nameOf) => {
  if (ids.length === 0) return ''
  if (ids.length === 1 && nameOf(ids[0]) != null) return withoutLeadingLabel(label, pillValue(ids, nameOf))
  return figure(ids.length)
}

/** The text a server search sends: typed here, sent after a wait (at once on Enter or on clear), `null` when it is empty. */
export const useServerSearch = (onSearch) => {
  const [query, setQuery] = useState('')
  const timer = useRef(null)
  const touched = useRef(false)
  useEffect(() => () => clearTimeout(timer.current), [])
  const send = (text) => {
    clearTimeout(timer.current)
    touched.current = true
    onSearch?.(text.trim() || null)
  }
  const type = (text) => {
    setQuery(text)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => send(text), SEARCH_DEBOUNCE_MS)
  }
  return { query, type, send, touched }
}

export const useSearchTexts = (label) => {
  const [, t] = useLanguage()
  return {
    searchLabel: t('SEARCH', 'Search'),
    fieldLabel: `${t('SEARCH', 'Search')} ${label}`,
    clearSearchLabel: t('CLEAR_SEARCH', 'Clear search'),
    noResultsLabel: t('NO_RESULTS_FOUND', 'No results found'),
    clearLabel: t('CLEAR', 'Clear')
  }
}

export const SkeletonRows = ({ label }) => (
  <div className='odc-orders-picker-list odc-bi-skeletons' role='group' aria-label={label} aria-busy='true'>
    {[...Array(SKELETON_ROWS).keys()].map(index => (
      <div key={index} className='odc-bi-skeleton-row'>
        <Skeleton shape='box' size='var(--od-x-checkbox-box)' block='var(--od-x-checkbox-box)' />
        <Skeleton size='60%' />
      </div>
    ))}
  </div>
)

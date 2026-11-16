import { useState } from 'react'
import { useLocation } from 'react-router-dom'

import { addQueryToUrl, removeQueryToUrl } from '../../../utils'

// the address of /settings/logs, as ReviewsDirectory/useReviewsQuery keeps its own: ?page= and ?pageSize=, ?id= (the open
// log) and the filters ?config= and ?author= (ids, comma separated), ?from= and ?to= (days, YYYY-MM-DD). The page keeps the state;
// this reads the address once, when the page opens, and is the only place that writes it. addQueryToUrl replaces the entry: a page or
// a log does not add one to the history, so «Back» brings the list back as it was left, not step by step.

const FILTER_KEYS = ['config', 'author', 'from', 'to']

const positiveInteger = (raw) => {
  if (raw == null || String(raw).trim() === '') return null
  const value = Number(raw)
  return Number.isInteger(value) && value >= 1 ? value : null
}
const idsOf = (raw) => [...new Set(String(raw ?? '').split(',').map(positiveInteger).filter(Boolean))]
const dayOf = (raw) => (/^\d{4}-\d{2}-\d{2}$/.test(raw ?? '') ? raw : null)

/** The address as the page needs it on its first render. */
export const parseSettingsLogsQuery = (search) => {
  const query = new URLSearchParams(search)
  return {
    page: positiveInteger(query.get('page')) ?? 1,
    pageSize: positiveInteger(query.get('pageSize')) ?? 10,
    id: positiveInteger(query.get('id')),
    filters: {
      configIds: idsOf(query.get('config')),
      authorIds: idsOf(query.get('author')),
      from: dayOf(query.get('from')),
      to: dayOf(query.get('to'))
    }
  }
}

/** The list moved to another page. */
export const writePage = (page, pageSize) => addQueryToUrl({ page, pageSize })

/** A log opens (`id`) or closes (`null`). */
export const writeRecord = (id) => (id == null ? removeQueryToUrl(['id']) : addQueryToUrl({ id }))

/** New filters: the old ones and the page go away (the list is on page 1 of the new ones). `keepPage`: the same list, only cleaned. */
export const writeFilters = (filters, { keepPage = false } = {}) => {
  removeQueryToUrl(keepPage ? FILTER_KEYS : ['page', ...FILTER_KEYS])
  const next = {
    ...(filters?.configIds?.length ? { config: filters.configIds.join(',') } : {}),
    ...(filters?.authorIds?.length ? { author: filters.authorIds.join(',') } : {}),
    ...(filters?.from ? { from: filters.from } : {}),
    ...(filters?.to ? { to: filters.to } : {})
  }
  if (Object.keys(next).length > 0) addQueryToUrl(next)
}

/** The address of the first render, read once. */
export const useSettingsLogsQuery = () => {
  const { search } = useLocation()
  const [initial] = useState(() => parseSettingsLogsQuery(search))
  return initial
}

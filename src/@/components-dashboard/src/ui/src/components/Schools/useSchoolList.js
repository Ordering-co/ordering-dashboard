import { useCallback, useEffect, useRef, useState } from 'react'

// redesign SC-B1 (M-SC03, M-SC10): the paged loader of the four lists (grades, classrooms, students, meals). Each tab of main repeated
// the same code and swallowed the error: a failed load became an empty list that read «No … yet». Here a failure keeps the rows that
// were on screen and sets `error`, so the tab can show SchoolListError with «Retry» (`reload`).
//
// useSchoolList({ fetchPage, deps, initialPage, pageSize, onPageChange })
//   fetchPage     ({ page, pageSize }) => Promise<{ error, result, pagination }>  (the functions of K/schoolApi.js already answer that)
//   deps          what the list depends on (the school, the filters): a change goes back to page 1 and tells the shell
//   initialPage   the ?page= the shell holds, used by the first load only
//   onPageChange  (page) => void, called when the page changes for any reason except the first load
// Returns { items, loading, error, page, pageSize, total, totalPages, goToPage, changePageSize, reload }.
//   error  null, the message of the API (`result[0]` of a list, or the text), or `true` when it failed with no message to show. It is
//          truthy exactly when the load failed, so `list.error ? <SchoolListError message={list.error} …/> : …` is safe.
//   total  `pagination.total` when the API sends it, else null.

export const DEFAULT_PAGE_SIZE = 25

const messageOf = (result) => {
  const message = Array.isArray(result) ? result[0] : result
  return typeof message === 'string' && message.trim() ? message : true
}

const sameDeps = (a, b) => a.length === b.length && a.every((value, index) => Object.is(value, b[index]))

export const useSchoolList = ({ fetchPage, deps = [], initialPage = 1, pageSize = DEFAULT_PAGE_SIZE, onPageChange } = {}) => {
  const [rows, setRows] = useState({ items: [], loading: true, error: null })
  const [paging, setPaging] = useState({ page: initialPage || 1, pageSize, total: null, totalPages: 1 })
  // the freshest props, read by the async code (a closure of the first render would use an old fetch)
  const latest = useRef({})
  latest.current = { fetchPage, onPageChange }
  const request = useRef(0)
  const lastRequested = useRef({ page: initialPage || 1, size: pageSize })
  const sizeRef = useRef(pageSize)
  const loadedDeps = useRef(null)
  const mounted = useRef(true)

  const load = useCallback(async (page, size = sizeRef.current) => {
    const mine = ++request.current
    lastRequested.current = { page, size }
    setRows(current => ({ ...current, loading: true }))
    let answer
    try {
      answer = await latest.current.fetchPage({ page, pageSize: size })
    } catch (error) {
      answer = { error: true, result: error?.message }
    }
    // an old answer never overwrites a new one (or the end of the list)
    if (mine !== request.current || !mounted.current) return
    const { error, result, pagination } = answer || {}
    if (error) {
      // the rows stay as they were: a failed load is not an empty list
      setRows(current => ({ items: current.items, loading: false, error: messageOf(result) }))
      return
    }
    const items = Array.isArray(result) ? result : []
    // redesign SC-B1 (M-SC10): a page beyond the first that comes back empty (its last row was deleted, or ?page= is out of range) is
    // not «No … yet» while earlier pages have rows: load the page before and tell the shell.
    if (items.length === 0 && page > 1) {
      // redesign SC-R1 (review r1 #1): straight to the last page the answer reports, not one page at a time (?page=40 asked 40 pages)
      const last = Number(pagination?.total_pages)
      const target = Math.max(1, Math.min(page - 1, Number.isFinite(last) && last >= 1 ? last : page - 1))
      latest.current.onPageChange?.(target)
      load(target, size)
      return
    }
    setRows({ items, loading: false, error: null })
    setPaging({
      page: pagination?.current_page || page,
      pageSize: size,
      total: pagination?.total ?? null,
      totalPages: pagination?.total_pages || 1
    })
  }, [])

  useEffect(() => {
    const previous = loadedDeps.current
    loadedDeps.current = deps
    if (previous === null) {
      load(initialPage || 1)
      return
    }
    if (sameDeps(previous, deps)) return
    latest.current.onPageChange?.(1)
    load(1)
  })

  // an answer that comes after the list is gone does nothing
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const goToPage = useCallback((page) => {
    latest.current.onPageChange?.(page)
    load(page)
  }, [load])

  const changePageSize = useCallback((size) => {
    sizeRef.current = size
    latest.current.onPageChange?.(1)
    load(1, size)
  }, [load])

  const reload = useCallback(() => {
    load(lastRequested.current.page, lastRequested.current.size)
  }, [load])

  return {
    items: rows.items,
    loading: rows.loading,
    error: rows.error,
    page: paging.page,
    pageSize: paging.pageSize,
    total: paging.total,
    totalPages: paging.totalPages,
    goToPage,
    changePageSize,
    reload
  }
}

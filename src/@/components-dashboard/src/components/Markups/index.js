import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'

import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const Markups = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    paginationSettings,
    isSearchById,
    isSearchByName,
    propsToFetchBusinesses,
    propsToFetchSites,
    businessId,
    includeGlobalMarkups,
    isFetchBusinesses,
    isFetchSites
  } = props

  const [ordering] = useApi()
  const [session] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()
  const token = session?.token

  const firstRender = useRef(true)
  const [searchValue, setSearchValue] = useState(null)

  const [markupsList, setMarkupsList] = useState({
    loading: false,
    error: null,
    markups: []
  })

  const [actionState, setActionState] = useState({ loading: false, error: null })
  const [businessesState, setBusinessesState] = useState({ loading: false, error: null, businesses: [] })
  const [businessesPaginationProps, setBusinessesPaginationProps] = useState({
    currentPage: 1,
    pageSize: 10,
    totalPages: null,
    totalItems: null,
    hasMore: true
  })
  const [businessesSearchValue, setBusinessesSearchValue] = useState('')
  const [sitesState, setSitesState] = useState({ loading: false, error: null, sites: [] })

  const [paginationProps, setPaginationProps] = useState({
    currentPage: (paginationSettings.controlType === 'pages' && paginationSettings.initialPage && paginationSettings.initialPage >= 1)
      ? paginationSettings.initialPage
      : 1,
    pageSize: paginationSettings.pageSize ?? 10,
    totalItems: null,
    totalPages: null,
    from: null,
    to: null
  })

  const handleChangeSearch = (search) => {
    setSearchValue(search)
  }

  const calcTotalPages = (totalItems, pageSize) => {
    const safePageSize = Number(pageSize) >= 1 ? Number(pageSize) : 10
    const safeTotalItems = Number(totalItems) >= 0 ? Number(totalItems) : 0
    return Math.max(1, Math.ceil(safeTotalItems / safePageSize))
  }

  const addMarkupToList = (markup) => {
    if (!markup?.id) return
    setMarkupsList((prev) => {
      const current = Array.isArray(prev?.markups) ? prev.markups : []
      const without = current.filter((m) => m?.id !== markup.id)
      // Only inject into current view if we're on first page (avoid surprising jumps)
      if (paginationProps.currentPage !== 1) {
        return { ...prev, markups: without }
      }
      const safePageSize = Number(paginationProps.pageSize) >= 1 ? Number(paginationProps.pageSize) : 10
      const next = [...without, markup].slice(-safePageSize)
      return { ...prev, markups: next }
    })
    setPaginationProps((prev) => {
      const nextTotal = (prev.totalItems ?? 0) + 1
      const safePageSize = Number(prev.pageSize) >= 1 ? Number(prev.pageSize) : 10
      const totalPages = calcTotalPages(nextTotal, safePageSize)
      return {
        ...prev,
        pageSize: safePageSize,
        totalItems: nextTotal,
        totalPages,
        currentPage: prev.currentPage ?? 1
      }
    })
  }

  const updateMarkupInList = (markup) => {
    if (!markup?.id) return
    setMarkupsList((prev) => {
      const current = Array.isArray(prev?.markups) ? prev.markups : []
      const next = current.map((m) => (m?.id === markup.id ? { ...m, ...markup } : m))
      return { ...prev, markups: next }
    })
  }

  const removeMarkupsFromList = (ids) => {
    const idList = Array.isArray(ids) ? ids : []
    if (!idList.length) return
    setMarkupsList((prev) => {
      const current = Array.isArray(prev?.markups) ? prev.markups : []
      const next = current.filter((m) => !idList.includes(m?.id))
      return { ...prev, markups: next }
    })
    setPaginationProps((prev) => {
      const nextTotal = Math.max(0, (prev.totalItems ?? 0) - idList.length)
      const safePageSize = Number(prev.pageSize) >= 1 ? Number(prev.pageSize) : 10
      const totalPages = calcTotalPages(nextTotal, safePageSize)
      const currentPage = Math.min(prev.currentPage ?? 1, totalPages)
      return { ...prev, pageSize: safePageSize, totalItems: nextTotal, totalPages, currentPage }
    })
  }

  const BUSINESSES_PAGE_SIZE = 10

  const getBusinesses = async (page, pageSize, search, append = false) => {
    if (!token) return
    if (session?.user?.level !== 0) return

    try {
      setBusinessesState((prev) => ({ ...prev, loading: true, error: null }))

      const safePage = Number(page) >= 1 ? Number(page) : 1
      const safePageSize = Number(pageSize) >= 1 ? Number(pageSize) : BUSINESSES_PAGE_SIZE

      const conditions = []
      if (search && String(search).trim()) {
        conditions.push({
          attribute: 'name',
          value: {
            condition: 'ilike',
            value: encodeURI(`%${String(search).trim()}%`)
          }
        })
      }

      const requestOptions = {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      }
      const whereObj = conditions.length ? JSON.stringify({ conditions, conector: 'AND' }) : ''
      const whereParam = whereObj ? `&where=${whereObj}` : ''
      const params = (propsToFetchBusinesses || []).join(',')
      const response = await fetch(
        `${ordering.root}/backoffice/businesses?params=${params}&page=${safePage}&page_size=${safePageSize}${whereParam}`,
        requestOptions
      )
      const content = await response.json()

      if (content?.error) {
        setBusinessesState({ loading: false, error: null, businesses: [] })
        setBusinessesPaginationProps({
          currentPage: 1,
          pageSize: BUSINESSES_PAGE_SIZE,
          totalPages: null,
          totalItems: null,
          hasMore: true
        })
        return
      }

      const result = Array.isArray(content?.result) ? content.result : []
      const totalItems = content?.pagination?.total ?? result.length
      const totalPages = content?.pagination?.total_pages ?? Math.max(1, Math.ceil(totalItems / safePageSize))
      const hasMore = safePage < totalPages

      setBusinessesState((prev) => ({
        loading: false,
        error: null,
        businesses: append ? [...(prev.businesses || []), ...result] : result
      }))

      setBusinessesPaginationProps({
        currentPage: safePage,
        pageSize: safePageSize,
        totalPages,
        totalItems,
        hasMore
      })
    } catch (err) {
      setBusinessesState({ loading: false, error: null, businesses: [] })
      setBusinessesPaginationProps({
        currentPage: 1,
        pageSize: BUSINESSES_PAGE_SIZE,
        totalPages: null,
        totalItems: null,
        hasMore: true
      })
    }
  }

  const searchBusinesses = (searchVal) => {
    const normalized = searchVal == null ? '' : String(searchVal).trim()
    setBusinessesSearchValue(normalized)
    setBusinessesPaginationProps((prev) => ({ ...prev, currentPage: 1 }))
    getBusinesses(1, BUSINESSES_PAGE_SIZE, normalized, false)
  }

  const handleChangeBusinessPage = (page) => {
    const { pageSize } = businessesPaginationProps
    const safePage = Number(page) >= 1 ? Number(page) : 1
    getBusinesses(safePage, pageSize, businessesSearchValue, false)
  }

  const getSites = async () => {
    if (!token) return
    if (session?.user?.level !== 0) return
    try {
      setSitesState((prev) => ({ ...prev, loading: true, error: null }))
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/sites?params=id,name`, requestOptions)
      const content = await response.json()
      if (content?.error) {
        setSitesState({ loading: false, error: content?.result, sites: [] })
        return
      }
      const sites = Array.isArray(content?.result) ? content.result : []
      const pickedSites = sites.map((site) => {
        const picked = {}
        propsToFetchSites.forEach((key) => {
          picked[key] = site?.[key]
        })
        return picked
      })
      setSitesState({ loading: false, error: null, sites: pickedSites })
    } catch (err) {
      setSitesState({ loading: false, error: [err?.message || 'Unknown error'], sites: [] })
    }
  }

  const getMarkups = async (page, pageSize) => {
    if (!token) return
    if (markupsList.loading) return
    if (session?.user?.level !== 0) {
      setMarkupsList({
        loading: false,
        error: ['Only administrators can manage markups'],
        markups: []
      })
      return
    }

    try {
      setMarkupsList((prev) => ({ ...prev, loading: true, error: null }))

      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }

      const safePage = Number(page) >= 1 ? Number(page) : 1
      const safePageSize = Number(pageSize) >= 1 ? Number(pageSize) : (paginationProps.pageSize ?? 10)

      let where = null
      const conditions = []

      if (businessId) {
        const safeBusinessId = Number(businessId)
        if (!Number.isNaN(safeBusinessId)) {
          const businessConditions = []
          if (includeGlobalMarkups) {
            businessConditions.push({
              attribute: 'business_id',
              value: null
            })
          }
          businessConditions.push({
            attribute: 'business_id',
            value: safeBusinessId
          })
          conditions.push({
            conector: 'OR',
            conditions: businessConditions
          })
        }
      }
      if (searchValue) {
        const searchConditions = []

        if (isSearchById) {
          searchConditions.push({
            attribute: 'id',
            value: {
              condition: 'ilike',
              value: encodeURI(`%${searchValue}%`)
            }
          })
        }

        if (isSearchByName) {
          searchConditions.push({
            attribute: 'name',
            value: {
              condition: 'ilike',
              value: encodeURI(`%${searchValue}%`)
            }
          })
        }

        if (searchConditions.length) {
          conditions.push({
            conector: 'OR',
            conditions: searchConditions
          })
        }
      }

      if (conditions.length) {
        where = {
          conditions,
          conector: 'AND'
        }
      }

      const fetchEndpoint = where
        ? `${ordering.root}/markups?page=${safePage}&page_size=${safePageSize}&orderBy=-created_at&where=${JSON.stringify(where)}`
        : `${ordering.root}/markups?page=${safePage}&page_size=${safePageSize}&orderBy=-created_at`
      const response = await fetch(fetchEndpoint, requestOptions)
      const content = await response.json()

      if (content?.error) {
        setMarkupsList((prev) => ({
          ...prev,
          loading: false,
          error: content?.result
        }))
        return
      }

      const result = Array.isArray(content?.result) ? content.result : []
      setMarkupsList({
        loading: false,
        error: null,
        markups: result
      })

      if (content?.pagination) {
        const serverPageSize = Number(content.pagination.page_size)
        const nextPageSize = serverPageSize >= 1 ? serverPageSize : safePageSize
        const serverTotalPages = Number(content.pagination.total_pages)
        setPaginationProps((prev) => ({
          ...prev,
          currentPage: content.pagination.current_page ?? safePage,
          pageSize: nextPageSize,
          totalItems: (Number(content.pagination.total) >= 0 ? Number(content.pagination.total) : (prev.totalItems ?? result.length)),
          totalPages: (serverTotalPages >= 1
            ? serverTotalPages
            : calcTotalPages((Number(content.pagination.total) >= 0 ? Number(content.pagination.total) : (prev.totalItems ?? result.length)), nextPageSize)),
          from: content.pagination.from ?? prev.from,
          to: content.pagination.to ?? prev.to
        }))
      } else {
        // Fallback when API doesn't return pagination
        setPaginationProps((prev) => ({
          ...prev,
          currentPage: safePage,
          pageSize: safePageSize,
          totalPages: safePage,
          totalItems: result.length,
          from: 1,
          to: result.length
        }))
      }

      firstRender.current = false
    } catch (err) {
      if (err?.constructor?.name === 'Cancel') return
      setMarkupsList((prev) => ({
        ...prev,
        loading: false,
        error: [err?.message || 'Unknown error']
      }))
    }
  }

  const getMarkup = async (id) => {
    if (!token) return { error: true, result: ['Missing token'] }
    try {
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/markups/${id}`, requestOptions)
      const content = await response.json()
      return content
    } catch (err) {
      return { error: true, result: [err?.message || 'Unknown error'] }
    }
  }

  const createMarkup = async (changes) => {
    if (!token) return
    if (session?.user?.level !== 0) return
    try {
      showToast?.(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ loading: true, error: null })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }
      const response = await fetch(`${ordering.root}/markups`, requestOptions)
      const content = await response.json()
      if (content?.error) {
        showToast?.(ToastType.Error, t('ERROR', 'Error'))
        setActionState({ loading: false, error: content?.result })
        return { error: true, result: content?.result }
      }
      setActionState({ loading: false, error: null })
      addMarkupToList(content?.result)
      showToast?.(ToastType.Success, t('MARKUP_CREATED', 'Markup created'))
      return content
    } catch (err) {
      showToast?.(ToastType.Error, t('ERROR', 'Error'))
      setActionState({ loading: false, error: [err?.message || 'Unknown error'] })
      return { error: true, result: [err?.message || 'Unknown error'] }
    }
  }

  const updateMarkup = async (id, changes) => {
    if (!token) return
    if (session?.user?.level !== 0) return
    try {
      showToast?.(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ loading: true, error: null })
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }
      const response = await fetch(`${ordering.root}/markups/${id}`, requestOptions)
      const content = await response.json()
      if (content?.error) {
        showToast?.(ToastType.Error, t('ERROR', 'Error'))
        setActionState({ loading: false, error: content?.result })
        return { error: true, result: content?.result }
      }
      setActionState({ loading: false, error: null })
      updateMarkupInList(content?.result)
      showToast?.(ToastType.Success, t('CHANGES_SAVED', 'Changes saved'))
      return content
    } catch (err) {
      showToast?.(ToastType.Error, t('ERROR', 'Error'))
      setActionState({ loading: false, error: [err?.message || 'Unknown error'] })
      return { error: true, result: [err?.message || 'Unknown error'] }
    }
  }

  const deleteMarkups = async (ids) => {
    if (!token) return
    if (session?.user?.level !== 0) return
    const list = Array.isArray(ids) ? ids : []
    if (list.length === 0) return
    try {
      showToast?.(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ loading: true, error: null })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }

      const errors = []
      for (const id of list) {
        const response = await fetch(`${ordering.root}/markups/${id}`, requestOptions)
        const content = await response.json()
        if (content?.error) {
          const msg = Array.isArray(content?.result) ? content.result.join(', ') : String(content?.result || 'Error')
          errors.push(`#${id}: ${msg}`)
        }
      }

      if (errors.length) {
        showToast?.(ToastType.Error, t('ERROR', 'Error'))
        setActionState({ loading: false, error: errors })
        return { error: true, result: errors }
      }

      setActionState({ loading: false, error: null })
      removeMarkupsFromList(list)
      showToast?.(ToastType.Success, t('MARKUPS_DELETED', 'Markups deleted'))
      return { error: false, result: true }
    } catch (err) {
      showToast?.(ToastType.Error, t('ERROR', 'Error'))
      const msg = [err?.message || 'Unknown error']
      setActionState({ loading: false, error: msg })
      return { error: true, result: msg }
    }
  }

  useEffect(() => {
    if (!token) return
    if (!firstRender.current) return
    getMarkups(paginationProps.currentPage, paginationProps.pageSize)
  }, [token])

  useEffect(() => {
    if (!token) return
    if (isFetchBusinesses) getBusinesses(1, BUSINESSES_PAGE_SIZE, '', false)
    if (isFetchSites) getSites()
  }, [token])

  useEffect(() => {
    if (!token) return
    if (searchValue === null) return
    setPaginationProps((prev) => ({ ...prev, currentPage: 1 }))
    getMarkups(1, paginationProps.pageSize)
  }, [searchValue])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          searchValue={searchValue}
          handleChangeSearch={handleChangeSearch}
          markupsList={markupsList}
          getMarkups={getMarkups}
          getMarkup={getMarkup}
          createMarkup={createMarkup}
          updateMarkup={updateMarkup}
          deleteMarkups={deleteMarkups}
          actionState={actionState}
          businessesState={businessesState}
          businessesPaginationProps={businessesPaginationProps}
          handleChangeBusinessPage={handleChangeBusinessPage}
          searchBusinesses={searchBusinesses}
          sitesState={sitesState}
          paginationProps={paginationProps}
          setPaginationProps={setPaginationProps}
        />
      )}
    </>
  )
}

Markups.propTypes = {
  UIComponent: PropTypes.elementType,
  paginationSettings: PropTypes.exact({
    initialPage: PropTypes.number,
    pageSize: PropTypes.number,
    controlType: PropTypes.string
  }),
  isSearchById: PropTypes.bool,
  isSearchByName: PropTypes.bool,
  propsToFetchBusinesses: PropTypes.arrayOf(PropTypes.string),
  propsToFetchSites: PropTypes.arrayOf(PropTypes.string)
}

const defaultProps = {
  paginationSettings: { initialPage: 1, pageSize: 10, controlType: 'pages' },
  isSearchById: true,
  isSearchByName: true,
  propsToFetchBusinesses: ['id', 'name'],
  propsToFetchSites: ['id', 'name'],
  businessId: null,
  includeGlobalMarkups: false,
  isFetchBusinesses: true,
  isFetchSites: true
}

import React, { useEffect, useRef, useState } from 'react'
import PropTypes, { string } from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

/**
 * Component to manage BusinessBrandBUSIDetail behavior without UI component
 */
export const BusinessBrandBUSIDetail = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    propsToFetch,
    isSearchByName
  } = props
  const [ordering] = useApi()
  const [{ token, user }] = useSession()
  const [searchValue, setSearchValue] = useState(null)
  const [, { showToast, hideToast }] = useToast()
  const [, t] = useLanguage()
  // redesign SB-B1 (G5-45, M-SB7): `error` is the load error (the UI tells it from an empty list), `failures` is
  // `{ [businessId]: error }` of the stores whose save failed and `pending` the ids of the stores being saved.
  const [businessList, setBusinessList] = useState({
    loading: false,
    businesses: [],
    result: { error: null },
    error: null,
    failures: {},
    pending: []
  })
  const lastRequest = useRef({ page: 1, pageSize: 10 })
  const latestBusinesses = useRef([])
  latestBusinesses.current = businessList.businesses

  const rex = new RegExp(/^[A-Za-z0-9\s]+$/g)
  const PAGE_SIZE = 10

  const setPending = (ids, isPending) => {
    setBusinessList(prev => {
      const current = prev.pending || []
      const pending = isPending
        ? [...current, ...ids.filter(id => !current.includes(id))]
        : current.filter(id => !ids.includes(id))
      return { ...prev, pending }
    })
  }

  const clearFailures = (ids) => {
    setBusinessList(prev => {
      const failures = { ...(prev.failures || {}) }
      ids.forEach(id => { delete failures[id] })
      return { ...prev, failures }
    })
  }

  /**
   * redesign SB-B1: same signature as before; returns the promise of the save (`{ ok, error }`).
   */
  const handleChangeCheckBox = (e, businessId, brandId) => {
    let changes = { franchise_id: brandId }
    if (!e.target.checked) changes = { franchise_id: null }
    return updateBusinessList(businessId, changes)
  }

  /**
   * redesign SB-B1 (G5-45, M-SB2): one request per store of the visible page that changes, IN SERIES. Selecting all
   * moves the stores whose `franchise_id !== brandId`; selecting none frees only the stores whose `franchise_id === brandId`
   * (the stores of other brands are not touched). Nothing is mutated before the answer of each request: a store that fails
   * keeps its value and stays in `businessList.failures`. One «Loading» at the start and one «Business updated» if all went well.
   * @returns {Promise<{ ok: boolean, failed: Array<{ id: number, error: any }> }>}
   */
  const handleSelectAllBusinesses = async (isAll, brandId) => {
    const changes = { franchise_id: isAll ? brandId : null }
    const targets = latestBusinesses.current.filter(business => isAll
      ? business.franchise_id !== brandId
      : business.franchise_id === brandId)
    if (!targets.length) return { ok: true, failed: [] }
    const ids = targets.map(business => business.id)
    clearFailures(ids)
    setPending(ids, true)
    showToast(ToastType.Info, t('LOADING', 'Loading'))
    const failed = []
    for (const business of targets) {
      const { ok, error } = await updateBusinessList(business.id, changes, { silent: true })
      if (!ok) failed.push({ id: business.id, error })
    }
    if (!failed.length) showToast(ToastType.Success, t('BUSINESS_UPDATED', 'Business updated'))
    // redesign bugs F row 19: each failed store says why in its row, so the «Loading» toast must not stay
    else hideToast?.()
    return { ok: !failed.length, failed }
  }

  /**
   * Method to get business list from API
   * @param {number} page page to fetch
   * @param {number} pageSize page size
   */
  const getBusinessList = async (page = 1, pageSize = PAGE_SIZE) => {
    try {
      const safePage = Number(page) >= 1 ? Number(page) : 1
      const safePageSize = Number(pageSize) >= 1 ? Number(pageSize) : PAGE_SIZE
      lastRequest.current = { page: safePage, pageSize: safePageSize }
      // redesign SB-B1 (G5-45): searching or paging forgets the failures of the stores of the page that is left
      setBusinessList(prev => ({ ...prev, loading: true, failures: {} }))

      let where = null
      const conditions = []
      if (searchValue) {
        const searchConditions = []
        const isSpecialCharacter = rex.test(searchValue)
        if (isSearchByName) {
          searchConditions.push(
            {
              attribute: 'name',
              value: {
                condition: 'ilike',
                value: !isSpecialCharacter ? `%${searchValue}%` : encodeURI(`%${searchValue}%`)
              }
            }
          )
        }
        conditions.push({
          conector: 'OR',
          conditions: searchConditions
        })
      }
      if (conditions.length) {
        where = {
          conditions,
          conector: 'AND'
        }
      }
      let content = null
      if (user?.level === 0) {
        const requestOptions = {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        }
        const whereParam = where ? `&where=${JSON.stringify(where)}` : ''
        const params = (propsToFetch || []).join(',')
        const response = await fetch(
          `${ordering.root}/backoffice/businesses?params=${params}&page=${safePage}&page_size=${safePageSize}${whereParam}`,
          requestOptions
        )
        content = await response.json()
      } else {
        let fetchEndpoint = ordering.businesses().asDashboard().select(propsToFetch)
        if (where) {
          fetchEndpoint = fetchEndpoint.where(where)
        }
        const response = await fetchEndpoint.get({ query: { page: safePage, page_size: safePageSize } })
        content = response.content
      }
      const { error, result, pagination } = content || {}
      if (!error) {
        setBusinessList(prev => ({
          ...prev,
          loading: false,
          businesses: result || [],
          pagination,
          error: null
        }))
      } else {
        setBusinessList(prev => ({
          ...prev,
          loading: false,
          error: result
        }))
      }
    } catch (error) {
      setBusinessList(prev => ({
        ...prev,
        loading: false,
        error: [error?.message || String(error)]
      }))
    }
  }

  const handleChangeBusinessPage = (page) => {
    getBusinessList(page, businessList?.pagination?.page_size || PAGE_SIZE)
  }

  const handleChangeBusinessPageSize = (pageSize) => {
    getBusinessList(1, pageSize)
  }

  /**
   * redesign SB-B1 (M-SB7): retries the last page requested (the UI shows it when the load failed).
   */
  const handleRetry = () => getBusinessList(lastRequest.current.page, lastRequest.current.pageSize)

  /**
   * Method to update a business of the list from API
   * redesign SB-B1 (G5-45, M-SB2): returns `{ ok: true }`, `{ ok: false, error: result }` (API error) or
   * `{ ok: false, error: [message] }` (exception). Nothing changes before the answer; on success only that store changes, with
   * the `franchise_id` the API returned. A failure is kept in `businessList.failures[id]` until that store is retried or the
   * list is searched or paged. `options.silent` skips the toasts (the block of `handleSelectAllBusinesses` has its own).
   */
  const updateBusinessList = async (id, changes, options = {}) => {
    const { silent = false } = options
    clearFailures([id])
    setPending([id], true)
    try {
      if (!silent) showToast(ToastType.Info, t('LOADING', 'Loading'))
      const { content: { error, result } } = await ordering.businesses(parseInt(id)).save(changes)
      if (error) {
        // redesign bugs F row 19: the row shows the failure; hide the «Loading» toast (a silent call has none)
        if (!silent) hideToast?.()
        setBusinessList(prev => ({ ...prev, failures: { ...prev.failures, [id]: result } }))
        return { ok: false, error: result }
      }
      const franchiseId = result && 'franchise_id' in result ? result.franchise_id : changes.franchise_id
      setBusinessList(prev => ({
        ...prev,
        businesses: prev.businesses.map(business => business.id === id
          ? { ...business, franchise_id: franchiseId }
          : business)
      }))
      if (!silent) showToast(ToastType.Success, t('BUSINESS_UPDATED', 'Business updated'))
      return { ok: true }
    } catch (err) {
      const failure = [err.message]
      if (!silent) hideToast?.()
      setBusinessList(prev => ({ ...prev, failures: { ...prev.failures, [id]: failure } }))
      return { ok: false, error: failure }
    } finally {
      setPending([id], false)
    }
  }

  useEffect(() => {
    // redesign bugs F row 41 (M-02): a search goes back to page 1 but keeps the page size the user chose
    getBusinessList(1, lastRequest.current.pageSize)
  }, [searchValue])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          searchValue={searchValue}
          onSearch={setSearchValue}
          businessList={businessList}
          handleChangeCheckBox={handleChangeCheckBox}
          handleSelectAllBusinesses={handleSelectAllBusinesses}
          handleChangeBusinessPage={handleChangeBusinessPage}
          handleChangeBusinessPageSize={handleChangeBusinessPageSize}
          handleRetry={handleRetry}
        />
      )}
    </>
  )
}

BusinessBrandBUSIDetail.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Array of business props to fetch
   */
  propsToFetch: PropTypes.arrayOf(string)
}

const defaultProps = {
  propsToFetch: ['id', 'name', 'header', 'logo', 'name', 'schedule', 'open', 'delivery_price', 'distance', 'delivery_time', 'pickup_time', 'reviews', 'featured', 'offers', 'food', 'laundry', 'alcohol', 'groceries', 'slug']
}

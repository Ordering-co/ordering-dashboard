import React, { useEffect, useState, useRef } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { translateApiMessage } from '../../utils/translateApiMessage'

const BUSINESSES_PAGE_SIZE = 10

const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

// redesign stores 2.H: the one controller behind «Share with» for menus and delivery zones. Before, each had
// its own 225-line copy, and both failed in silence (G3-05): a zone stayed disabled for good, a menu said «Business
// saved» (the SDK response has no `error`, so `content.error` was never true). The caller says what to save
// (`saveShare(ids)` → the API body `{ error, result }`) and what to do with the stores it saved (`onShared`); this
// lists the project's stores, keeps the selection and reports the outcome.
export const StoreSharePicker = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    business,
    businesses,
    sharedBusinesses,
    busienssesPropsToFetch,
    saveShare,
    onShared
  } = props

  const [ordering] = useApi()
  const [{ token, user }] = useSession()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()

  const [businessesState, setBusinessesState] = useState({ businesses: [], loading: false, error: null })
  const [actionState, setActionState] = useState({ loading: false, result: { error: false } })
  const [selectedBusinessIds, setSelectedBusinessIds] = useState([])
  const [businessesPaginationProps, setBusinessesPaginationProps] = useState({ currentPage: 1, pageSize: BUSINESSES_PAGE_SIZE, totalPages: null, totalItems: null })
  const businessesSearchValue = useRef('')
  // Every store seen (already shared, or on any page loaded): a store picked on page 2 keeps its name after the
  // list moves to page 3 (G3-05: the saved menu or zone listed it as `undefined`).
  const knownBusinesses = useRef(new Map())
  const listRequest = useRef(0)
  // The last page asked for, so Retry asks for it again (a failed load resets the pagination shown).
  const lastListQuery = useRef({ page: 1, pageSize: BUSINESSES_PAGE_SIZE, search: '' })
  const mounted = useRef(true)

  const remember = (list) => {
    for (const item of list || []) {
      if (item?.id != null) knownBusinesses.current.set(item.id, { ...knownBusinesses.current.get(item.id), ...item })
    }
  }

  const resetList = (error) => {
    setBusinessesState({ loading: false, error, businesses: [] })
    setBusinessesPaginationProps({ currentPage: 1, pageSize: BUSINESSES_PAGE_SIZE, totalPages: null, totalItems: null })
  }

  /**
   * Method to get all the business list from API with pagination + search
   */
  const getAllBusinesses = async (page, pageSize, search) => {
    const request = ++listRequest.current
    const isCurrent = () => mounted.current && request === listRequest.current
    lastListQuery.current = { page, pageSize, search }
    try {
      const safePage = Number(page) >= 1 ? Number(page) : 1
      const safePageSize = Number(pageSize) >= 1 ? Number(pageSize) : BUSINESSES_PAGE_SIZE
      setBusinessesState(state => ({ ...state, loading: true, error: null }))

      const conditions = []
      if (search && String(search).trim()) {
        conditions.push({
          attribute: 'name',
          value: { condition: 'ilike', value: encodeURI(`%${String(search).trim()}%`) }
        })
      }

      let content = null
      if (user?.level === 0) {
        const requestOptions = {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        }
        const whereObj = conditions.length ? JSON.stringify({ conditions, conector: 'AND' }) : ''
        const whereParam = whereObj ? `&where=${whereObj}` : ''
        const params = busienssesPropsToFetch.join(',')
        const response = await fetch(
          `${ordering.root}/backoffice/businesses?params=${params}&page=${safePage}&page_size=${safePageSize}${whereParam}`,
          requestOptions
        )
        content = await response.json()
      } else {
        let fetchEndpoint = ordering.setAccessToken(token).businesses().select(busienssesPropsToFetch).asDashboard()
        if (conditions.length) {
          fetchEndpoint = fetchEndpoint.where({ conditions, conector: 'AND' })
        }
        const options = { query: { page: safePage, page_size: safePageSize } }
        const response = await fetchEndpoint.get(options)
        content = response.content
      }
      if (!isCurrent()) return

      if (content?.error) {
        resetList(content.result ?? true)
        return
      }

      const result = Array.isArray(content?.result) ? content.result : []
      const _businesses = result.filter(_business => _business.id !== business?.id)
      remember(_businesses)
      const totalItems = content?.pagination?.total ?? result.length
      const totalPages = content?.pagination?.total_pages ?? Math.max(1, Math.ceil(totalItems / safePageSize))

      setBusinessesState({ loading: false, error: null, businesses: _businesses })
      setBusinessesPaginationProps({
        currentPage: content?.pagination?.current_page ?? safePage,
        pageSize: safePageSize,
        totalPages,
        totalItems
      })
    } catch (err) {
      if (isCurrent()) resetList(err?.message || true)
    }
  }

  const searchBusinesses = (searchVal) => {
    businessesSearchValue.current = searchVal ?? ''
    getAllBusinesses(1, businessesPaginationProps.pageSize, searchVal ?? '')
  }

  const handleChangeBusinessPage = (page) => {
    getAllBusinesses(page, businessesPaginationProps.pageSize, businessesSearchValue.current)
  }

  const handleChangeBusinessPageSize = (pageSize) => {
    getAllBusinesses(1, pageSize, businessesSearchValue.current)
  }

  // Retry after the list failed to load: the page, size and search that failed.
  const reloadBusinesses = () => {
    const { page, pageSize, search } = lastListQuery.current
    getAllBusinesses(page, pageSize, search)
  }

  /**
   * Method to select or unselect one store
   * @param {Number} businessId business id
   * @param {Boolean} checked checked state
   */
  const handleSelectBusiness = (businessId, checked) => {
    setSelectedBusinessIds(ids => checked
      ? (ids.includes(businessId) ? ids : [...ids, businessId])
      : ids.filter(id => id !== businessId))
  }

  /**
   * Method to select the stores on screen, or none
   * @param {Boolean} isAll state if all or none
   */
  const handleSelectAllBusiness = (isAll) => {
    if (isAll) {
      // 2H-01: the page on screen joins the selection; stores picked on other pages stay picked.
      const pageIds = businessesState.businesses?.map(_business => _business.id) || []
      setSelectedBusinessIds(ids => [...ids, ...pageIds.filter(id => !ids.includes(id))])
    } else {
      setSelectedBusinessIds([])
    }
  }

  /**
   * Method to save who the menu or zone is shared with
   */
  const handleShareBusinesses = async () => {
    if (actionState.loading) return
    const ids = selectedBusinessIds
    // The toast is global: it still says how the save ended after the panel closed; only the panel state is skipped.
    const fail = (error) => {
      showToast(ToastType.Error, translateApiMessage(t, firstMessage(error), t('STORES_CHANGE_FAILED', 'We couldn\'t save the change.')))
      if (mounted.current) setActionState({ loading: false, result: { error: true, result: error } })
    }
    let content
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ loading: true, result: { error: false } })
      content = await saveShare(ids)
    } catch {
      // A thrown error (5xx, network, a body that is not JSON) carries a technical text, not an API message.
      return fail()
    }
    if (!content || content.error) return fail(content?.result)
    if (mounted.current) setActionState({ loading: false, result: { error: false } })
    showToast(ToastType.Success, t('BUSINESS_SAVED', 'Business saved'))
    // After the save worked: a failure here is not a failed save.
    onShared && onShared(ids.map(id => ({ id, name: knownBusinesses.current.get(id)?.name })))
  }

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (businesses) {
      remember(businesses)
      setBusinessesState(state => ({ ...state, businesses, loading: false }))
    } else {
      getAllBusinesses(1, BUSINESSES_PAGE_SIZE, '')
    }
  }, [businesses])

  useEffect(() => {
    if (sharedBusinesses) {
      remember(sharedBusinesses)
      setSelectedBusinessIds(sharedBusinesses.map(_business => _business.id))
    }
  }, [sharedBusinesses])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          businessesState={businessesState}
          actionState={actionState}
          selectedBusinessIds={selectedBusinessIds}
          handleSelectBusiness={handleSelectBusiness}
          handleSelectAllBusiness={handleSelectAllBusiness}
          handleShareBusinesses={handleShareBusinesses}
          searchBusinesses={searchBusinesses}
          handleChangeBusinessPage={handleChangeBusinessPage}
          handleChangeBusinessPageSize={handleChangeBusinessPageSize}
          businessesPaginationProps={businessesPaginationProps}
          reloadBusinesses={reloadBusinesses}
        />
      )}
    </>
  )
}

StoreSharePicker.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * The store that owns the menu or zone (left out of the list)
   */
  business: PropTypes.object,
  /**
   * Stores the menu or zone is shared with now (`[{ id, name }]`)
   */
  sharedBusinesses: PropTypes.array,
  /**
   * Saves the selection: `(ids) => Promise<{ error, result }>` (the API body)
   */
  saveShare: PropTypes.func.isRequired,
  /**
   * After a save that worked: `(stores) => void`, with `[{ id, name }]` in the order picked
   */
  onShared: PropTypes.func
}

const defaultProps = {
  busienssesPropsToFetch: ['id', 'name', 'logo']
}

import React, { useEffect, useState, useRef } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { saveAssignment } from '../../utils/saveAssignment'

const BUSINESSES_PAGE_SIZE = 10
// the largest page GET /business serves (api-core's max_page_size)
const SOLE_OWNED_BATCH = 50

export const BusinessManagerBusinesses = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    userId,
    busienssesPropsToFetch,
    typeBusinessPropToFetch = 'businesses'
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()

  const [businessesState, setBusinessesState] = useState({ businesses: [], loading: false, error: null })
  const [selectedBusinessIds, setSelectedBusinessIds] = useState([])
  // redesign BO-B1 (additive): assigned objects, ids saved on the server and every name seen so far
  const [assignedBusinesses, setAssignedBusinesses] = useState([])
  const [savedBusinessIds, setSavedBusinessIds] = useState([])
  const [businessNames, setBusinessNames] = useState({})
  const [actionState, setActionState] = useState({ loading: false, error: null })
  // redesign BO-B1 (BO-9, additive): state of reading the assigned stores; `loaded` is true only after a successful response
  const [assignedState, setAssignedState] = useState({ loading: false, error: null, loaded: false })
  const [businessesPaginationProps, setBusinessesPaginationProps] = useState({ currentPage: 1, pageSize: BUSINESSES_PAGE_SIZE, totalPages: null, totalItems: null })
  // (additive): the saved stores this owner is the only owner of. A store keeps at least one owner, so the section keeps them
  // ticked. Read after the assigned stores, for owners only (`businesses`); if the read fails nothing is kept and the API still refuses.
  const [soleOwnedBusinessIds, setSoleOwnedBusinessIds] = useState([])
  const businessesSearchValue = useRef('')
  // redesign BO-B1 (BO-3): last catalog request, so a retry repeats it even after a failure reset the pagination
  const lastCatalogRequest = useRef({ page: 1, pageSize: BUSINESSES_PAGE_SIZE })

  // redesign BO-B1: remember names across pages and searches; never drop one
  const rememberBusinessNames = (businesses) => {
    const known = (businesses || []).filter(item => item?.id !== undefined && item?.id !== null)
    if (!known.length) return
    setBusinessNames(prev => known.reduce((names, item) => ({ ...names, [item.id]: item.name }), prev))
  }

  /**
   * Method to get the user's businesses from API
   */
  const getDefaultBusinesses = async () => {
    try {
      setActionState({
        ...actionState,
        loading: true
      })
      setAssignedState({ loading: true, error: null, loaded: false })
      const fetchEndpoint = ordering.setAccessToken(token).users(userId).select([typeBusinessPropToFetch])
      const { content: { error, result } } = await fetchEndpoint.get()
      if (!error) {
        setActionState({ loading: false, error: null })
        const businessIds = result[typeBusinessPropToFetch]?.reduce((ids, business) => [...ids, business.id], []) || []
        setSelectedBusinessIds(businessIds)
        // redesign BO-B1 (additive)
        setAssignedBusinesses(result[typeBusinessPropToFetch] || [])
        setSavedBusinessIds(businessIds)
        rememberBusinessNames(result[typeBusinessPropToFetch])
        setAssignedState({ loading: false, error: null, loaded: true })
        readSoleOwned(businessIds)
      } else {
        setActionState({ loading: false, error: result })
        setAssignedState({ loading: false, error: result, loaded: false })
      }
    } catch (err) {
      setActionState({
        loading: false,
        error: [err.message]
      })
      setAssignedState({ loading: false, error: [err.message], loaded: false })
    }
  }

  /**
   * which of these stores have this user as their only owner (GET /business with `owners`, as the API answers today)
   * @param {Array} ids business ids the user owns
   */
  const readSoleOwned = async (ids) => {
    setSoleOwnedBusinessIds([])
    if (typeBusinessPropToFetch !== 'businesses' || !ids.length) return
    // GET /business answers at most 50 a page and, asked for more, quietly answers 10: one request per 50 stores. A batch that
    // fails or comes back short keeps nothing of its own; the others still do.
    const batches = Array.from({ length: Math.ceil(ids.length / SOLE_OWNED_BATCH) }, (_, index) => ids.slice(index * SOLE_OWNED_BATCH, (index + 1) * SOLE_OWNED_BATCH))
    const answers = await Promise.all(batches.map(async (batch) => {
      try {
        const where = { conditions: [{ attribute: 'id', value: batch }], conector: 'AND' }
        const { content: { error, result } } = await ordering.setAccessToken(token).businesses().select(['id', 'owners']).asDashboard().where(where)
          .get({ query: { page: 1, page_size: batch.length } })
        return !error && Array.isArray(result) && result.length >= batch.length ? result : []
      } catch (err) {
        return []
      }
    }))
    setSoleOwnedBusinessIds(answers.flat()
      .filter(store => store?.owners?.length === 1 && String(store.owners[0]?.id) === String(userId))
      .map(store => store.id))
  }

  /**
   * redesign BO-B1 (BO-9): read the assigned stores again ("Retry")
   */
  const reloadAssigned = () => getDefaultBusinesses()

  /**
   * Method to get all the business list from API with pagination + search
   */
  const getAllBusinesses = async (page, pageSize, search) => {
    try {
      const safePage = Number(page) >= 1 ? Number(page) : 1
      const safePageSize = Number(pageSize) >= 1 ? Number(pageSize) : BUSINESSES_PAGE_SIZE
      setBusinessesState({ ...businessesState, loading: true })
      lastCatalogRequest.current = { page: safePage, pageSize: safePageSize }

      const conditions = []
      if (search && String(search).trim()) {
        conditions.push({
          attribute: 'name',
          value: { condition: 'ilike', value: encodeURI(`%${String(search).trim()}%`) }
        })
      }

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
      const content = await response.json()

      if (content?.error) {
        // redesign BO-B1 (BO-3): surface the message instead of an empty list with no error
        setBusinessesState({ loading: false, error: content.result, businesses: [] })
        setBusinessesPaginationProps({ currentPage: 1, pageSize: BUSINESSES_PAGE_SIZE, totalPages: null, totalItems: null })
        return
      }

      const result = Array.isArray(content?.result) ? content.result : []
      const totalItems = content?.pagination?.total ?? result.length
      const totalPages = content?.pagination?.total_pages ?? Math.max(1, Math.ceil(totalItems / safePageSize))

      setBusinessesState({ loading: false, error: null, businesses: result })
      rememberBusinessNames(result)
      setBusinessesPaginationProps({
        currentPage: content?.pagination?.current_page ?? safePage,
        pageSize: safePageSize,
        totalPages,
        totalItems
      })
    } catch (err) {
      setBusinessesState({ loading: false, error: [err.message], businesses: [] })
      setBusinessesPaginationProps({ currentPage: 1, pageSize: BUSINESSES_PAGE_SIZE, totalPages: null, totalItems: null })
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

  /**
   * redesign BO-B1 (BO-3): request again the last page with the current search ("Retry")
   */
  const reloadBusinesses = () => {
    const { page, pageSize } = lastCatalogRequest.current
    getAllBusinesses(page, pageSize, businessesSearchValue.current)
  }

  /**
   * Method to share the business menu
   * @param {Number} businessId business id
   * @param {Boolean} checked checked state
   */
  const handleSelectBusiness = (businessId, checked) => {
    // redesign BO-B1: functional updates, so two quick presses in one render keep both, and an id is never added twice
    if (checked) {
      setSelectedBusinessIds(prev => (prev.includes(businessId) ? prev : [...prev, businessId]))
    } else {
      setSelectedBusinessIds(prev => prev.filter(id => id !== businessId))
    }
  }

  /**
   * Method to share the business menu
   * @param {Boolean} isAll state if all or none
   */
  const handleSelectAllBusiness = (isAll) => {
    if (isAll) {
      const businessIds = businessesState.businesses?.reduce((ids, business) => [...ids, business.id], []) || []
      setSelectedBusinessIds(businessIds)
    } else {
      setSelectedBusinessIds([])
    }
  }

  /**
   * redesign BO-B1 (BO-1): add the visible page to the selection (union, no duplicates, already selected first).
   * Unlike handleSelectAllBusiness(true) it never drops the stores selected on other pages.
   */
  const handleSelectPageBusinesses = () => {
    const pageIds = businessesState.businesses?.map(business => business.id) || []
    setSelectedBusinessIds(prev => [...new Set([...prev, ...pageIds])])
  }

  /**
   * redesign BO-B1: set the selection as is (e.g. "Discard" back to the saved ids)
   * @param {Array} ids business ids
   */
  const handleSetSelectedBusinessIds = (ids) => {
    setSelectedBusinessIds(() => Array.isArray(ids) ? [...ids] : [])
  }

  /**
   * Function to update the business owner's businesses from API
   * redesign BO-B1: resolves { ok: true } or { ok: false, error }
   * redesign BO-B1 (BO-9): sends nothing until the assigned stores were read, or a failed read (selection []) would
   * wipe the owner's stores on Save. The old callcenter UI shares this save: with a failed read it used to save the
   * empty selection, so not sending is a safe improvement for it too.
   * only the stores added or removed since the last save are sent,
   * one by one, so someone else's changes to the same owner survive; a failure keeps as saved what was already sent.
   */
  const handleUpdateBusinesses = async () => {
    if (!assignedState.loaded) return { ok: false, error: ['NOT_LOADED'] }
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ loading: true, error: null })
      let error, result
      let saved = savedBusinessIds
      const changes = [
        ...selectedBusinessIds.filter(id => !saved.includes(id)).map(id => [id, true]),
        ...saved.filter(id => !selectedBusinessIds.includes(id)).map(id => [id, false])
      ]
      for (const [id, assign] of changes) {
        ({ error, result } = await saveAssignment(ordering, token, `users/${userId}/businesses/${id}`, assign))
        if (error) break
        saved = assign ? [...saved, id] : saved.filter(savedId => savedId !== id)
      }
      if (error) setSavedBusinessIds(saved)
      if (!error) {
        setActionState({ loading: false, error: null })
        setSavedBusinessIds([...selectedBusinessIds])
        readSoleOwned(selectedBusinessIds)
        showToast(ToastType.Success, t('BUSINESS_SAVED', 'Business saved'))
        return { ok: true }
      } else {
        setActionState({ loading: false, error: result })
        return { ok: false, error: result }
      }
    } catch (err) {
      setActionState({
        loading: false,
        error: [err.message]
      })
      return { ok: false, error: [err.message] }
    }
  }

  useEffect(() => {
    if (props.businesses) {
      setBusinessesState({ ...businessesState, businesses: props.businesses, loading: false })
      rememberBusinessNames(props.businesses)
    } else {
      getAllBusinesses(1, BUSINESSES_PAGE_SIZE, '')
    }
  }, [props.businesses])

  useEffect(() => {
    getDefaultBusinesses()
  }, [userId])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          actionState={actionState}
          businessesState={businessesState}
          selectedBusinessIds={selectedBusinessIds}
          handleSelectBusiness={handleSelectBusiness}
          handleSelectAllBusiness={handleSelectAllBusiness}
          handleSelectPageBusinesses={handleSelectPageBusinesses}
          handleSetSelectedBusinessIds={handleSetSelectedBusinessIds}
          assignedBusinesses={assignedBusinesses}
          savedBusinessIds={savedBusinessIds}
          soleOwnedBusinessIds={soleOwnedBusinessIds}
          assignedState={assignedState}
          reloadAssigned={reloadAssigned}
          businessNames={businessNames}
          reloadBusinesses={reloadBusinesses}
          handleUpdateBusinesses={handleUpdateBusinesses}
          searchBusinesses={searchBusinesses}
          handleChangeBusinessPage={handleChangeBusinessPage}
          handleChangeBusinessPageSize={handleChangeBusinessPageSize}
          businessesPaginationProps={businessesPaginationProps}
        />
      )}
    </>
  )
}

BusinessManagerBusinesses.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}

const defaultProps = {
  busienssesPropsToFetch: ['id', 'name', 'logo']
}

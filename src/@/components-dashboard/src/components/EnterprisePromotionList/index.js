import React, { useState, useEffect, useRef } from 'react'
import PropTypes, { string } from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { translateApiMessage } from '../../utils/translateApiMessage'
import { BUILDER_MAX_PAGE_SIZE, fetchAllPages } from '../../utils/fetchAllPages'
import {
  deletePromotionJourney,
  getAllPromotionBusinesses,
  getPromotionLoyaltyLevels,
  savePromotionJourney,
  updatePromotionJourneyStatus
} from './promotionJourneyApi'

const BUSINESSES_PAGE_SIZE = 10

// redesign PE-B2: the first readable message of what the API (or a throw) left as an error: a string, a list of strings or a list of lists
const firstMessage = (error) => (Array.isArray(error) ? error.flat(Infinity) : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

export const EnterprisePromotionList = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    paginationSettings,
    orderBy,
    propsToFetch,
    isSearchByPromotionName,
    isSearchByPromotionDescription
  } = props

  const [ordering] = useApi()
  const [{ token, user }] = useSession()
  const [, t] = useLanguage()
  const [, { showToast, hideToast }] = useToast()

  const firstRender = useRef(true)
  const businessesSearchValue = useRef('')
  // redesign PE-B2 (inventory D6): a search typed while a request is in flight waits for it instead of being dropped
  const searchPending = useRef(false)

  const [promotionListState, setPromotionListState] = useState({ promotions: [], loading: false, error: null })
  const [actionState, setActionState] = useState({ loading: false, error: null })
  const [searchValue, setSearchValue] = useState(null)
  const [paginationProps, setPaginationProps] = useState({
    currentPage: (paginationSettings.controlType === 'pages' && paginationSettings.initialPage && paginationSettings.initialPage >= 1) ? paginationSettings.initialPage : 1,
    pageSize: paginationSettings.pageSize ?? 10,
    totalItems: null,
    totalPages: null
  })
  const [dataSelected, setDataSelected] = useState(null)
  const [isPromotionBottom, setIsPromotionBottom] = useState(false)
  const [sitesState, setSitesState] = useState({ loading: false, sites: [], error: null })
  const [paymethodsState, setPaymethodsState] = useState({ loading: false, paymethods: [], error: null })
  const [businessesList, setBusinessesList] = useState({ businesses: [], loading: false, error: null })
  const [businessesPaginationProps, setBusinessesPaginationProps] = useState({ currentPage: 1, pageSize: BUSINESSES_PAGE_SIZE, totalPages: null, totalItems: null })

  const saveJourney = ({ payload, promotionId, enabled }) => savePromotionJourney({
    root: ordering.root,
    token,
    payload,
    promotionId,
    enabled
  })

  const updateJourneyStatus = ({ promotionId, enabled }) => updatePromotionJourneyStatus({
    root: ordering.root,
    token,
    promotionId,
    enabled
  })

  const deleteJourney = ({ promotionId }) => deletePromotionJourney({
    root: ordering.root,
    token,
    promotionId
  })

  const loadJourneyLoyaltyLevels = () => getPromotionLoyaltyLevels({ root: ordering.root, token })

  const loadAllJourneyBusinesses = ({ pageSize } = {}) => getAllPromotionBusinesses({
    ordering,
    token,
    userLevel: user?.level,
    pageSize
  })

  /**
   * Method to get the promotions from API
   */
  const getPromotions = async (page, pageSize) => {
    try {
      // redesign PE-B2: functional updates, so a record the list just forgot (or changed) is not brought back by a stale copy of the state
      setPromotionListState(current => ({ ...current, loading: true }))
      let where = null
      const conditions = []
      if (searchValue) {
        const searchConditions = []
        if (isSearchByPromotionName) {
          searchConditions.push(
            {
              attribute: 'name',
              value: {
                condition: 'ilike',
                value: encodeURI(`%${searchValue}%`)
              }
            }
          )
        }
        if (isSearchByPromotionDescription) {
          searchConditions.push(
            {
              attribute: 'description',
              value: {
                condition: 'ilike',
                value: encodeURI(`%${searchValue}%`)
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

      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const fetchEndpoint = where
        ? `${ordering.root}/offers?page=${page}&page_size=${pageSize}&params=${propsToFetch.toString()}&&where=${JSON.stringify(where)}`
        : `${ordering.root}/offers?page=${page}&page_size=${pageSize}&params=${propsToFetch.toString()}`

      const orderingParam = orderBy ? `&orderBy=${encodeURIComponent(orderBy)}` : ''
      const response = await fetch(`${fetchEndpoint}${orderingParam}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setPromotionListState({ promotions: content.result, loading: false, error: null })
        setPaginationProps(current => ({
          ...current,
          currentPage: content.pagination.current_page,
          pageSize: content.pagination.page_size === 0 ? current.pageSize : content.pagination.page_size,
          totalPages: content.pagination.total_pages,
          totalItems: content.pagination.total,
          from: content.pagination.from,
          to: content.pagination.to
        }))
      } else {
        setPromotionListState(current => ({
          ...current,
          loading: false,
          error: content.result
        }))
      }
      firstRender.current = false
    } catch (err) {
      setPromotionListState(current => ({
        ...current,
        loading: false,
        error: [err.message]
      }))
    }
  }

  /**
   * Method to control the business promotion enabled state
   * @param {Number} promotionId promotion id
   */
  // redesign PE-B2 (PE-03): RESOLVES its outcome (`{ ok: true }` or `{ ok: false, error }`) for the switch that asked, always frees
  // `actionState.loading` and replaces the «Loading» toast with the failure. The record in the list is replaced by a new object (inventory D32).
  const handleEnablePromotion = async (promotionId, enabled) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ enabled })
      }
      const response = await fetch(`${ordering.root}/offers/${promotionId}`, requestOptions)
      const content = await response.json()
      if (content.error) {
        setActionState({ loading: false, error: content.result })
        showToast(ToastType.Error, translateApiMessage(t, firstMessage(content.result), t('PROMOTION_TOGGLE_FAILED', "We couldn't change this promotion. Try again.")))
        return { ok: false, error: content.result }
      }
      setPromotionListState(current => ({
        ...current,
        promotions: current.promotions.map(promotion => (promotion.id === promotionId ? { ...promotion, ...content.result } : promotion))
      }))
      setActionState({ loading: false, error: null })
      showToast(ToastType.Success, t('CHANGES_SAVED', 'Changes saved'))
      return { ok: true }
    } catch (err) {
      const error = [err.message]
      setActionState({ loading: false, error })
      showToast(ToastType.Error, translateApiMessage(t, err.message, t('PROMOTION_TOGGLE_FAILED', "We couldn't change this promotion. Try again.")))
      return { ok: false, error }
    }
  }

  /**
   * Method to handle drag start
   */
  const handleDragStart = (event, promotion) => {
    event.dataTransfer.setData('transferPromotionId', promotion.id)

    const ghostEle = document.createElement('div')
    ghostEle.classList.add('ghostDragging')
    ghostEle.textContent = promotion?.name
    document.body.appendChild(ghostEle)
    event.dataTransfer.setDragImage(ghostEle, 0, 0)
  }

  /**
   * Method to handle drag over
   */
  const handleAllowDrop = (event, promotionId, promoIndex) => {
    event.preventDefault()
    const element = event.target.closest('.draggable_promotion')
    if (element) {
      if (promoIndex < promotionListState?.promotions.length - 1) {
        setDataSelected(promotionId)
        setIsPromotionBottom(false)
      } else {
        const middlePositionY = window.scrollY + event.target.getBoundingClientRect().top + event.target.offsetHeight / 2
        const dragPositionY = event.clientY
        if (dragPositionY > middlePositionY) {
          setIsPromotionBottom(true)
          setDataSelected('')
        } else {
          setIsPromotionBottom(false)
          setDataSelected(promotionId)
        }
      }
    }
  }

  /**
   * Method to handle drag drop
   */
  const handleDrop = (event, promotion) => {
    event.preventDefault()
    const transferPromotionId = parseInt(event.dataTransfer.getData('transferPromotionId'))

    const transferPromotion = promotionListState.promotions.find(_promotion => _promotion.id === transferPromotionId)
    const transferPromotionRank = transferPromotion?.rank
    let dropPromotionRank = promotion?.rank
    if (transferPromotionRank === null && dropPromotionRank === null) {
      dropPromotionRank = 1
    }
    if (isPromotionBottom) {
      dropPromotionRank = Number(dropPromotionRank) + 1
    }
    handleChangeCategoryRank(transferPromotionId, { rank: dropPromotionRank })
  }

  /**
   * Method to handle drag end
   */
  const handleDragEnd = () => {
    const elements = document.getElementsByClassName('ghostDragging')
    while (elements.length > 0) {
      elements[0].parentNode.removeChild(elements[0])
    }
    setDataSelected('')
    setIsPromotionBottom(false)
  }

  /**
   * Method to change the rank of transfer category
   */
  // redesign PE-B2 (PE-14, inventory D16): RESOLVES `{ ok, error }`, says «Priority updated» (main said «Category updated»), frees
  // `actionState.loading` and asks for the current page again, so the rows that moved over show the ranks the API gave them.
  const handleChangeCategoryRank = async (transferCategoryId, params) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(params)
      }
      const response = await fetch(`${ordering.root}/offers/${transferCategoryId}`, requestOptions)
      const { error, result } = await response.json()
      if (error) {
        setActionState({ loading: false, error: result })
        showToast(ToastType.Error, translateApiMessage(t, firstMessage(result), t('PROMOTION_PRIORITY_FAILED', "We couldn't change the priority. Try again.")))
        return { ok: false, error: result }
      }
      setActionState({ loading: false, error: null })
      showToast(ToastType.Success, t('PROMOTION_PRIORITY_UPDATED', 'Priority updated'))
      setPromotionListState(current => ({
        ...current,
        promotions: current.promotions.map(promotion => (promotion?.id === result?.id ? { ...promotion, rank: result?.rank } : promotion))
      }))
      getPromotions(paginationProps.currentPage, paginationProps.pageSize)
      return { ok: true }
    } catch (err) {
      const errors = [err.message]
      setActionState({ loading: false, error: errors })
      showToast(ToastType.Error, translateApiMessage(t, err.message, t('PROMOTION_PRIORITY_FAILED', "We couldn't change the priority. Try again.")))
      return { ok: false, error: errors }
    }
  }

  /**
   * Method to delete a promotion from the list (the row menu)
   * @param {Object} promotion promotion to delete
   */
  // redesign PE-B2 (PE-07): the same request the editor sends (`DELETE offers/:id`), then the list and the totals forget it and the page is
  // asked for again (the one before when this one is left empty). Resolves `{ ok }` or `{ ok: false, error }`: the page's confirmation
  // shows the error inside itself.
  const handleDeletePromotionFromList = async (promotion) => {
    const promotionId = promotion?.id
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/offers/${promotionId}`, requestOptions)
      const content = await response.json()
      if (content.error) {
        hideToast?.() // redesign (row 81, review r1 R10): the «Loading» toast must not outlive a failed delete
        setActionState({ loading: false, error: content.result })
        return { ok: false, error: content.result }
      }
      setActionState({ loading: false, error: null })
      showToast(ToastType.Success, t('OFFER_DELETED', 'Offer deleted'))
      const remaining = promotionListState.promotions.filter(item => item.id !== promotionId).length
      handleSuccessDeletePromotion(promotionId)
      const currentPage = Number(paginationProps.currentPage) || 1
      getPromotions(remaining === 0 && currentPage > 1 ? currentPage - 1 : currentPage, paginationProps.pageSize)
      return { ok: true }
    } catch (err) {
      hideToast?.()
      const error = [err.message]
      setActionState({ loading: false, error })
      return { ok: false, error }
    }
  }

  /**
   * Method to update the promotion list
   */
  const handleSuccessUpdatePromotions = (updatedPromotions) => {
    setPromotionListState(current => ({
      ...current,
      promotions: updatedPromotions
    }))
  }

  /**
   * Method to add the promotion in the promotion list
   * @param {Object} promotion promotion to add
   */
  // redesign PE-B2 (inventory D16): the pager reads `totalItems`; main wrote a `total` nobody reads
  const handleSuccessAddPromotion = (promotion) => {
    setPaginationProps(current => ({
      ...current,
      to: (current?.to ?? 0) + 1,
      totalItems: (current?.totalItems ?? 0) + 1
    }))
    setPromotionListState(current => ({ ...current, promotions: [...current.promotions, promotion] }))
  }

  /**
   * Method to delete the promotion in the promotion list
   * @param {Number} promotionId promotion to delete
   */
  const handleSuccessDeletePromotion = (promotionId) => {
    setPaginationProps(current => ({
      ...current,
      to: Math.max((current?.to ?? 0) - 1, 0),
      totalItems: Math.max((current?.totalItems ?? 0) - 1, 0)
    }))
    setPromotionListState(current => ({ ...current, promotions: current.promotions.filter(promotion => promotion.id !== promotionId) }))
  }

  /**
   * Method to get all the sites from API
   */
  const getSites = async () => {
    try {
      setSitesState({ ...sitesState, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/sites`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setSitesState({ sites: content.result, loading: false, error: null })
      } else {
        setSitesState({ sites: [], loading: false, error: content.result || 'Sales channels could not be loaded.' })
      }
    } catch (err) {
      setSitesState({
        ...sitesState,
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
   * Method to get all the paymethods from API
   */
  const getPaymethods = async () => {
    try {
      setPaymethodsState({ ...paymethodsState, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/paymethods?where=${JSON.stringify({ enabled: true })}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setPaymethodsState({ paymethods: content.result, loading: false, error: null })
      }
    } catch (err) {
      setPaymethodsState({
        ...paymethodsState,
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
   * Method to get businesses from API with pagination + search
   */
  const getBusinesses = async (page, pageSize, search) => {
    try {
      const safePage = Number(page) >= 1 ? Number(page) : 1
      const safePageSize = Number(pageSize) >= 1 ? Number(pageSize) : BUSINESSES_PAGE_SIZE
      setBusinessesList({ ...businessesList, loading: true })

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
        const response = await fetch(
          `${ordering.root}/backoffice/businesses?params=id,name,logo,slug&page=${safePage}&page_size=${safePageSize}${whereParam}`,
          requestOptions
        )
        content = await response.json()
      } else {
        let fetchEndpoint = ordering.setAccessToken(token).businesses().select(['name', 'logo', 'slug']).asDashboard()
        if (conditions.length) {
          fetchEndpoint = fetchEndpoint.where({ conditions, conector: 'AND' })
        }
        const options = { query: { page: safePage, page_size: safePageSize } }
        const response = await fetchEndpoint.get(options)
        content = response.content
      }

      if (content?.error) {
        setBusinessesList({ loading: false, error: null, businesses: [] })
        setBusinessesPaginationProps({ currentPage: 1, pageSize: BUSINESSES_PAGE_SIZE, totalPages: null, totalItems: null })
        return
      }

      const result = Array.isArray(content?.result) ? content.result : []
      const totalItems = content?.pagination?.total ?? result.length
      const totalPages = content?.pagination?.total_pages ?? Math.max(1, Math.ceil(totalItems / safePageSize))

      setBusinessesList({ loading: false, error: null, businesses: result })
      setBusinessesPaginationProps({
        currentPage: content?.pagination?.current_page ?? safePage,
        pageSize: safePageSize,
        totalPages,
        totalItems
      })
    } catch (err) {
      setBusinessesList({ loading: false, error: null, businesses: [] })
      setBusinessesPaginationProps({ currentPage: 1, pageSize: BUSINESSES_PAGE_SIZE, totalPages: null, totalItems: null })
    }
  }

  /**
   * Method to get the id of EVERY business of the project, or of every business the current search finds (owner decision 14 B:
   * «Select all» of the editor is not the loaded page). Ids only, every page at the API maximum, with the same name filter as
   * `getBusinesses` (the search the list was last asked for) in each branch. Rejects with the first failing page's message.
   */
  const getAllBusinessIds = async () => {
    const search = String(businessesSearchValue.current ?? '').trim()
    const conditions = search
      ? [{ attribute: 'name', value: { condition: 'ilike', value: encodeURI(`%${search}%`) } }]
      : []
    // an API error without text gives an empty message: the caller says its own (translated) text
    const failure = (result) => new Error(firstMessage(result) || '')
    const idsOf = (list) => (Array.isArray(list) ? list : []).map(business => business.id)

    if (user?.level === 0) {
      const requestOptions = {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      }
      const whereParam = conditions.length ? `&where=${JSON.stringify({ conditions, conector: 'AND' })}` : ''
      const { error, result } = await fetchAllPages(`${ordering.root}/backoffice/businesses?params=id${whereParam}`, requestOptions)
      if (error) throw failure(result)
      return idsOf(result)
    }

    const getPage = async (page) => {
      let endpoint = ordering.setAccessToken(token).businesses().select(['id']).asDashboard()
      if (conditions.length) endpoint = endpoint.where({ conditions, conector: 'AND' })
      const { content } = await endpoint.get({ query: { page, page_size: BUILDER_MAX_PAGE_SIZE } })
      if (content?.error) throw failure(content.result)
      return content
    }
    const first = await getPage(1)
    const totalPages = Number(first?.pagination?.total_pages) || 1
    const rest = await Promise.all(Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => getPage(index + 2)))
    return [first, ...rest].flatMap(content => idsOf(content?.result))
  }

  const searchBusinesses = (searchVal) => {
    businessesSearchValue.current = searchVal ?? ''
    getBusinesses(1, businessesPaginationProps.pageSize, searchVal ?? '')
  }

  const handleChangeBusinessPage = (page) => {
    getBusinesses(page, businessesPaginationProps.pageSize, businessesSearchValue.current)
  }

  const handleChangeBusinessPageSize = (pageSize) => {
    getBusinesses(1, pageSize, businessesSearchValue.current)
  }

  // redesign PE-B2 (inventory D6): a search typed while a request is out is kept (the latest value) and runs when that request ends
  useEffect(() => {
    if (promotionListState.loading) {
      searchPending.current = true
      return
    }
    searchPending.current = false
    getPromotions(firstRender.current ? paginationProps.currentPage : 1, paginationProps.pageSize)
  }, [searchValue])

  useEffect(() => {
    if (promotionListState.loading || !searchPending.current) return
    searchPending.current = false
    getPromotions(1, paginationProps.pageSize)
  }, [promotionListState.loading])

  useEffect(() => {
    getSites()
    getBusinesses(1, BUSINESSES_PAGE_SIZE, '')
    getPaymethods()
  }, [])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            sitesState={sitesState}
            businessesList={businessesList}
            businessesPaginationProps={businessesPaginationProps}
            searchBusinesses={searchBusinesses}
            getAllBusinessIds={getAllBusinessIds}
            handleChangeBusinessPage={handleChangeBusinessPage}
            handleChangeBusinessPageSize={handleChangeBusinessPageSize}
            paymethodsState={paymethodsState}
            promotionListState={promotionListState}
            paginationProps={paginationProps}
            setPaginationProps={setPaginationProps}
            searchValue={searchValue}
            onSearch={setSearchValue}
            getPromotions={getPromotions}
            dataSelected={dataSelected}
            handleDragStart={handleDragStart}
            handleAllowDrop={handleAllowDrop}
            handleDrop={handleDrop}
            handleDragEnd={handleDragEnd}
            isPromotionBottom={isPromotionBottom}
            handleEnablePromotion={handleEnablePromotion}
            handleChangeCategoryRank={handleChangeCategoryRank}
            handleDeletePromotionFromList={handleDeletePromotionFromList}
            handleSuccessUpdatePromotions={handleSuccessUpdatePromotions}
            handleSuccessAddPromotion={handleSuccessAddPromotion}
            handleSuccessDeletePromotion={handleSuccessDeletePromotion}
            saveJourney={saveJourney}
            updateJourneyStatus={updateJourneyStatus}
            deleteJourney={deleteJourney}
            loadJourneyLoyaltyLevels={loadJourneyLoyaltyLevels}
            loadAllJourneyBusinesses={loadAllJourneyBusinesses}
            loadPromotionSites={getSites}
          />
        )
      }
    </>
  )
}

EnterprisePromotionList.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Array of drivers props to fetch
   */
  propsToFetch: PropTypes.arrayOf(string)
}

const defaultProps = {
  paginationSettings: { initialPage: 1, pageSize: 10, controlType: 'infinity' },
  propsToFetch: [
    'name', 'auto', 'enabled', 'end', 'description', 'image', 'label', 'order_priority', 'sites', 'stackable', 'start', 'target', 'type',
    'limit_per_user', 'user_order_count', 'user_order_count_condition', 'valid_from_after_user_last_order_minutes', 'valid_until_after_user_last_order_minutes',
    'users', 'delivery_zones', 'paymethods', 'order_types_allowed', 'max_discount', 'rank', 'rate_type', 'rate', 'public', 'coupon', 'businesses', 'condition_type',
    'minimum', 'products', 'categories', 'schedule', 'limit', 'include_options', 'loyalty_levels'
  ]
}

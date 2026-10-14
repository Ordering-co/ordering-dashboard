import React, { useState, useEffect, useRef } from 'react'
import PropTypes, { string } from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import {
  deletePromotionJourney,
  getAllPromotionBusinesses,
  getPromotionLoyaltyLevels,
  savePromotionJourney,
  updatePromotionJourneyStatus
} from './promotionJourneyApi'

const BUSINESSES_PAGE_SIZE = 10

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
  const [, { showToast }] = useToast()

  const firstRender = useRef(true)
  const businessesSearchValue = useRef('')

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
      setPromotionListState({ ...promotionListState, loading: true })
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
        setPaginationProps({
          ...paginationProps,
          currentPage: content.pagination.current_page,
          pageSize: content.pagination.page_size === 0 ? paginationProps.pageSize : content.pagination.page_size,
          totalPages: content.pagination.total_pages,
          totalItems: content.pagination.total,
          from: content.pagination.from,
          to: content.pagination.to
        })
      } else {
        setPromotionListState({
          ...promotionListState,
          loading: false,
          error: content.result
        })
      }
      firstRender.current = false
    } catch (err) {
      setPromotionListState({
        ...promotionListState,
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
   * Method to control the business promotion enabled state
   * @param {Number} promotionId promotion id
   */
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
      if (!content.error) {
        const _promotions = promotionListState.promotions.filter(promotion => {
          if (promotion.id === promotionId) {
            Object.assign(promotion, content.result)
          }
          return true
        })
        setPromotionListState({ ...promotionListState, promotions: _promotions })
        showToast(ToastType.Success, t('CHANGES_SAVED', 'Changes saved'))
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
    }
  }

  /**
   * Method to handle drag start
   */
  const handleDragStart = (event, promotion) => {
    event.dataTransfer.setData('transferPromotionId', promotion.id)

    const ghostEle = document.createElement('div')
    ghostEle.classList.add('ghostDragging')
    ghostEle.innerHTML = promotion?.name
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
      if (!error) {
        showToast(ToastType.Success, t('CATEOGORY_UPDATED', 'Category updated'))
        const _promotions = promotionListState?.promotions.map(promotion => promotion?.id === result?.id ? { ...promotion, rank: result?.rank } : promotion)
        setPromotionListState({
          promotions: _promotions,
          loading: false,
          error: false
        })
      }
    } catch (err) {
      setActionState({
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
   * Method to update the promotion list
   */
  const handleSuccessUpdatePromotions = (updatedPromotions) => {
    setPromotionListState({
      ...promotionListState,
      promotions: updatedPromotions
    })
  }

  /**
   * Method to add the promotion in the promotion list
   * @param {Object} promotion promotion to add
   */
  const handleSuccessAddPromotion = (promotion) => {
    const promotions = [...promotionListState.promotions, promotion]
    setPaginationProps({
      ...paginationProps,
      to: paginationProps?.to + 1,
      total: paginationProps?.total + 1
    })
    setPromotionListState({ ...promotionListState, promotions })
  }

  /**
   * Method to delete the promotion in the promotion list
   * @param {Number} promotionId promotion to delete
   */
  const handleSuccessDeletePromotion = (promotionId) => {
    const promotions = promotionListState.promotions.filter(promotion => promotion.id !== promotionId)
    setPaginationProps({
      ...paginationProps,
      total: paginationProps?.total - 1
    })
    setPromotionListState({ ...promotionListState, promotions })
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

  useEffect(() => {
    if (promotionListState.loading) return
    getPromotions(firstRender.current ? paginationProps.currentPage : 1, paginationProps.pageSize)
  }, [searchValue])

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

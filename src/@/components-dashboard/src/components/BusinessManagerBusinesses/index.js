import React, { useEffect, useState, useRef } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

const BUSINESSES_PAGE_SIZE = 10

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
  const [actionState, setActionState] = useState({ loading: false, error: null })
  const [businessesPaginationProps, setBusinessesPaginationProps] = useState({ currentPage: 1, pageSize: BUSINESSES_PAGE_SIZE, totalPages: null, totalItems: null })
  const businessesSearchValue = useRef('')

  /**
   * Method to get the user's businesses from API
   */
  const getDefaultBusinesses = async () => {
    try {
      setActionState({
        ...actionState,
        loading: true
      })
      const fetchEndpoint = ordering.setAccessToken(token).users(userId).select([typeBusinessPropToFetch])
      const { content: { error, result } } = await fetchEndpoint.get()
      if (!error) {
        setActionState({ loading: false, error: null })
        const businessIds = result[typeBusinessPropToFetch]?.reduce((ids, business) => [...ids, business.id], []) || []
        setSelectedBusinessIds(businessIds)
      } else {
        setActionState({ loading: false, error: result })
      }
    } catch (err) {
      setActionState({
        loading: false,
        error: [err.message]
      })
    }
  }
  /**
   * Method to get all the business list from API with pagination + search
   */
  const getAllBusinesses = async (page, pageSize, search) => {
    try {
      const safePage = Number(page) >= 1 ? Number(page) : 1
      const safePageSize = Number(pageSize) >= 1 ? Number(pageSize) : BUSINESSES_PAGE_SIZE
      setBusinessesState({ ...businessesState, loading: true })

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
        setBusinessesState({ loading: false, error: null, businesses: [] })
        setBusinessesPaginationProps({ currentPage: 1, pageSize: BUSINESSES_PAGE_SIZE, totalPages: null, totalItems: null })
        return
      }

      const result = Array.isArray(content?.result) ? content.result : []
      const totalItems = content?.pagination?.total ?? result.length
      const totalPages = content?.pagination?.total_pages ?? Math.max(1, Math.ceil(totalItems / safePageSize))

      setBusinessesState({ loading: false, error: null, businesses: result })
      setBusinessesPaginationProps({
        currentPage: content?.pagination?.current_page ?? safePage,
        pageSize: safePageSize,
        totalPages,
        totalItems
      })
    } catch (err) {
      setBusinessesState({ loading: false, error: null, businesses: [] })
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
   * Method to share the business menu
   * @param {Number} businessId business id
   * @param {Boolean} checked checked state
   */
  const handleSelectBusiness = (businessId, checked) => {
    if (checked) {
      setSelectedBusinessIds([...selectedBusinessIds, businessId])
    } else {
      const _selectedBusinessIds = selectedBusinessIds.filter(id => id !== businessId)
      setSelectedBusinessIds(_selectedBusinessIds)
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
   * Function to update the business owner's businesses from API
   */
  const handleUpdateBusinesses = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ loading: true, error: null })
      const { content: { error, result } } = await ordering.setAccessToken(token).users(userId).save({ businesses: selectedBusinessIds })
      if (!error) {
        setActionState({ loading: false, error: null })
        showToast(ToastType.Success, t('BUSINESS_SAVED', 'Business saved'))
      } else {
        setActionState({ loading: false, error: result })
      }
    } catch (err) {
      setActionState({
        loading: false,
        error: [err.message]
      })
    }
  }

  useEffect(() => {
    if (props.businesses) {
      setBusinessesState({ ...businessesState, businesses: props.businesses, loading: false })
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

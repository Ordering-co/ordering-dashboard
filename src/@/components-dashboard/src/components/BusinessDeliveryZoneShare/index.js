import React, { useEffect, useState, useRef } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

const BUSINESSES_PAGE_SIZE = 10

export const BusinessDeliveryZoneShare = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    business,
    zone,
    businesses,
    busienssesPropsToFetch,
    handleSuccessUpdate
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

      if (content?.error) {
        setBusinessesState({ loading: false, error: null, businesses: [] })
        setBusinessesPaginationProps({ currentPage: 1, pageSize: BUSINESSES_PAGE_SIZE, totalPages: null, totalItems: null })
        return
      }

      const result = Array.isArray(content?.result) ? content.result : []
      const _businesses = result.filter(_business => _business.id !== business.id)
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
   * Method to share the business zone
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
   * Method to share the business zone
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
   * Method to share the business zone
   */
  const handleShareBusinesses = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })

      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ businesses: selectedBusinessIds })
      }

      const response = await fetch(`${ordering.root}/business/${business.id}/deliveryzones/${zone.id}`, requestOptions)
      const content = await response.json()

      if (!content.error) {
        const zoneBusinesses = []
        for (const id of selectedBusinessIds) {
          zoneBusinesses.push({
            id,
            name: businessesState.businesses.find(_business => _business.id === id)?.name,
            pivot: { business_id: id, zone_id: zone.id }
          })
        }
        const _businessZone = { ...zone, businesses: zoneBusinesses }
        const zones = business.zones.filter(_zone => {
          if (_zone.id === _businessZone.id) {
            Object.assign(_zone, _businessZone)
          }
          return true
        })
        const _business = { ...business, zones }
        handleSuccessUpdate && handleSuccessUpdate(_business)
        setActionState({ loading: false, result: { error: false } })
        showToast(ToastType.Success, t('BUSINESS_SAVED', 'Business saved'))
      }
    } catch (err) {
      setActionState({ loading: false, result: { error: false } })
    }
  }

  useEffect(() => {
    if (businesses) {
      setBusinessesState({ ...businessesState, businesses, loading: false })
    } else {
      getAllBusinesses(1, BUSINESSES_PAGE_SIZE, '')
    }
  }, [businesses])

  useEffect(() => {
    if (zone?.businesses) {
      const businessIds = zone.businesses?.reduce((ids, business) => [...ids, business.id], [])
      setSelectedBusinessIds(businessIds)
    }
  }, [zone])

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
        />
      )}
    </>
  )
}

BusinessDeliveryZoneShare.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}

const defaultProps = {
  busienssesPropsToFetch: ['id', 'name', 'logo']
}

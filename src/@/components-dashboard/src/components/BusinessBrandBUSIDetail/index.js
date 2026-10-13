import React, { useEffect, useState } from 'react'
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
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()
  const [businessList, setBusinessList] = useState({ loading: false, businesses: [], result: { error: null } })

  const rex = new RegExp(/^[A-Za-z0-9\s]+$/g)
  const PAGE_SIZE = 10

  const handleChangeCheckBox = (e, businessId, brandId) => {
    let changes = { franchise_id: brandId }
    if (!e.target.checked) changes = { franchise_id: null }
    updateBusinessList(businessId, changes)
  }

  const handleSelectAllBusinesses = (isAll, brandId) => {
    let changes
    const _businesses = []
    if (isAll) {
      changes = { franchise_id: brandId }
      businessList.businesses.forEach(business => {
        if (business.franchise_id !== brandId) {
          updateBusinessList(business.id, changes)
          business.franchise_id = brandId
        }
        _businesses.push(business)
      })
    } else {
      changes = { franchise_id: null }
      businessList.businesses.forEach(business => {
        if (business.franchise_id !== null) {
          updateBusinessList(business.id, changes)
          business.franchise_id = null
        }
        _businesses.push(business)
      })
    }
    setBusinessList({ ...businessList, businesses: _businesses })
  }

  /**
   * Method to get business list from API
   * @param {number} page page to fetch
   * @param {number} pageSize page size
   */
  const getBusinessList = async (page = 1, pageSize = PAGE_SIZE) => {
    try {
      setBusinessList(prev => ({ ...prev, loading: true }))

      const safePage = Number(page) >= 1 ? Number(page) : 1
      const safePageSize = Number(pageSize) >= 1 ? Number(pageSize) : PAGE_SIZE

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
        error: [error || error?.toString() || error?.message]
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
   * Method to update business list from API
   */
  const updateBusinessList = async (id, changes) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const { content: { error, result } } = await ordering.businesses(parseInt(id)).save(changes)
      if (!error) {
        const _businesses = businessList?.businesses.map(business => {
          if (business.id === id) {
            return {
              ...business,
              franchise_id: result.franchise_id
            }
          }
          return business
        })
        setBusinessList(preBusinessList => ({ ...preBusinessList, businesses: _businesses }))
        showToast(ToastType.Success, t('BUSINESS_UPDATED', 'Business updated'))
      }
    } catch {}
  }

  useEffect(() => {
    getBusinessList()
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
